// --- taskLogic.js ---
// Core business logic for task functionality

import { state, stopTimerShared } from '../machiningService.js';
import { updateTimerDisplay, setupTaskDisplay} from './taskUI.js';
import { TimerWidget } from '../../components/timerWidget.js';
import { startTimer } from './taskApi.js';
import { getSyncedNow } from '../../generic/timeService.js';
import { setCurrentTimerState, setCurrentMachineState } from './taskState.js';
import { createMaintenanceRequest } from '../../maintenance/maintenanceApi.js';

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
    try {
        state.intervalId = setInterval(updateTimerDisplay, 1000);
        await startTimer(comment);
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
        });
        
        if (stopSuccess) {
            setupTaskDisplay(false, state.currentIssue.is_hold_task);
            setCurrentTimerState(null);
            setCurrentMachineState(state.currentMachine.id);
            TimerWidget.triggerUpdate();
        } else {
            alert("Hata oluştu. Lütfen tekrar deneyin.");
        }
    } catch (error) {
        console.error('Error stopping timer:', error);
        alert("Hata oluştu. Lütfen tekrar deneyin.");
    }
}