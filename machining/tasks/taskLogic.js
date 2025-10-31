// --- taskLogic.js ---
// Core business logic for task functionality

import { state } from '../machiningService.js';
import { stopTimerShared, startTimerShared } from '../../generic/timers.js';
import { updateTimerDisplay, setupTaskDisplay, stopTimerUpdate } from './taskUI.js';
import { TimerWidget } from '../../components/timerWidget.js';
import { getSyncedNow, syncServerTime } from '../../generic/timeService.js';
import { setCurrentTimerState, setCurrentMachineState } from './taskState.js';
import { createMaintenanceRequest } from '../../generic/machines.js';
import { navigateTo, ROUTES } from '../../authService.js';

// ============================================================================
// TIMER SETUP
// ============================================================================

export function setupTimerHandlers(restoring = false) {
    if (restoring) {
        state.currentTimer.start_time = parseInt(state.currentTimer.start_time);
        updateTimerDisplay();
        state.intervalId = setInterval(updateTimerDisplay, 1000);
    } else {
        state.currentTimer.start_time = null;
    }
}

export async function handleStartTimer(comment = null) {
    if (!state.currentMachine.id || !state.currentIssue.key){
        alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
        navigateTo(ROUTES.MACHINING);
        return;
    }
    
    try {
        await syncServerTime();
        const timerData = {
            issue_key: state.currentIssue.key,
            start_time: getSyncedNow(),
            machine_fk: state.currentMachine.id,
        }
        
        // Add comment if provided
        if (comment) {
            timerData.comment = comment;
        }
        
        const timer = await startTimerShared(timerData, 'machining');
        if (!timer) {
            alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
            navigateTo(ROUTES.MACHINING);
            return;
        }
        
        timerData.id = timer.id;
        setCurrentTimerState(timerData);
        setCurrentMachineState(state.currentMachine.id);
        
        // Start the interval AFTER setting the timer state
        state.intervalId = setInterval(updateTimerDisplay, 1000);
        // Update display immediately to show 00:00:00 or initial value
        updateTimerDisplay();
        
        setupTaskDisplay(true, state.currentIssue.is_hold_task);
        TimerWidget.triggerUpdate();
        console.log(state.currentIssue.key);
        // Create breaking maintenance request for W-07 tasks
        if (state.currentIssue.key === 'W-07') {
            try {
                await createMaintenanceRequest({
                    machine: state.currentMachine.id,
                    is_maintenance: false,
                    description: comment ? comment : `Makine arızası nedeniyle bekleme - ${state.currentIssue.name}`,
                    is_breaking: true
                });
                console.log('Breaking maintenance request created for W-07 task');
            } catch (error) {
                console.error('Error creating maintenance request:', error);
                // Don't show alert to user as this is a background process
            }
        }
        
    } catch (error) {
        console.error('Error starting timer:', error);
        alert("Zamanlayıcı başlatılırken hata oluştu.");
    }
}

export async function handleStopTimer(save_to_jira=true) {
    const startBtn = document.getElementById('start-stop');
    
    // Stop timer and log to Jira
    clearInterval(state.intervalId);
    let elapsed = Math.round((getSyncedNow() - state.currentTimer.start_time) / 1000);
    if (elapsed < 60) elapsed = 60;
    
    startBtn.disabled = true;
    startBtn.textContent = 'İşleniyor...';
    
    try {
        const stopSuccess = await stopTimerShared({ 
            timerId: state.currentTimer.id, 
            finishTime: getSyncedNow(),
            syncToJira: save_to_jira
        }, 'machining');
        
        if (stopSuccess) {
            // Call stopTimerUpdate to properly reset timer display and button states
            stopTimerUpdate();
            setupTaskDisplay(false, state.currentIssue.is_hold_task);
            setCurrentTimerState(null);
            setCurrentMachineState(state.currentMachine.id);
            TimerWidget.triggerUpdate();
            // Ensure button is re-enabled after successful stop
            startBtn.disabled = false;
            // Force button to be clickable by removing disabled class
            startBtn.classList.remove('disabled');
        } else {
            alert("Hata oluştu. Lütfen tekrar deneyin.");
            // Re-enable button on error
            startBtn.disabled = false;
            // Force button to be clickable by removing disabled class
            startBtn.classList.remove('disabled');
        }
    } catch (error) {
        console.error('Error stopping timer:', error);
        alert("Hata oluştu. Lütfen tekrar deneyin.");
        // Re-enable button on error
        startBtn.disabled = false;
        // Force button to be clickable by removing disabled class
        startBtn.classList.remove('disabled');
    }
}