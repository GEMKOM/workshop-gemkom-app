// --- taskLogic.js ---
// Core business logic for operation functionality

import { state } from '../operationsService.js';
import { startOperationTimer, stopOperationTimer } from '../../generic/machining/operations.js';
import { fetchTimers } from '../../generic/timers.js';
import { extractFirstResultFromResponse } from '../../generic/paginationHelper.js';
import { updateTimerDisplay, setupTaskDisplay, stopTimerUpdate } from './taskUI.js';
import { TimerWidget } from '../../components/timerWidget.js';
import { getSyncedNow, syncServerTime } from '../../generic/timeService.js';
import { setCurrentTimerState, setCurrentMachineState } from './taskState.js';
import { navigateTo } from '../../authService.js';

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

export async function handleStartTimer() {
    if (!state.currentMachine.id || !state.currentIssue.key){
        alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
        navigateTo('/machining/');
        return;
    }
    
    try {
        // Start timer using operation-specific endpoint
        const result = await startOperationTimer(state.currentIssue.key);
        
        if (!result || !result.timer_id) {
            alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
            navigateTo('/machining/');
            return;
        }
        
        // Fetch the full timer details to get start_time
        const activeTimer = extractFirstResultFromResponse(
            await fetchTimers({ 
                is_active: true, 
                machine_id: state.currentMachine.id, 
                issue_key: state.currentIssue.key 
            })
        );
        
        if (!activeTimer) {
            alert("Zamanlayıcı başlatıldı ancak detaylar alınamadı.");
            navigateTo('/machining/');
            return;
        }
        
        setCurrentTimerState(activeTimer);
        setCurrentMachineState(state.currentMachine.id);
        
        // Start the interval AFTER setting the timer state
        state.intervalId = setInterval(updateTimerDisplay, 1000);
        // Update display immediately to show 00:00:00 or initial value
        updateTimerDisplay();
        
        setupTaskDisplay(true);
        TimerWidget.triggerUpdate();
        console.log(state.currentIssue.key);
        
    } catch (error) {
        console.error('Error starting timer:', error);
        // Show specific error message from API if available
        const errorMessage = error.data?.error || error.message || "Zamanlayıcı başlatılırken hata oluştu.";
        alert(errorMessage);
    }
}

export async function handleStopTimer(save_to_jira=true) {
    const startBtn = document.getElementById('start-stop');
    
    // Stop timer
    clearInterval(state.intervalId);
    
    startBtn.disabled = true;
    startBtn.textContent = 'İşleniyor...';
    
    try {
        // Stop timer using operation-specific endpoint
        const result = await stopOperationTimer(state.currentIssue.key);
        
        if (!result || !result.timer_id) {
            alert("Hata oluştu. Lütfen tekrar deneyin.");
            // Re-enable button on error
            startBtn.disabled = false;
            startBtn.classList.remove('disabled');
            return;
        }
        
        // Call stopTimerUpdate to properly reset timer display and button states
        stopTimerUpdate();
        setupTaskDisplay(false);
        setCurrentTimerState(null);
        setCurrentMachineState(state.currentMachine.id);
        TimerWidget.triggerUpdate();
        // Ensure button is re-enabled after successful stop
        startBtn.disabled = false;
        // Force button to be clickable by removing disabled class
        startBtn.classList.remove('disabled');
        
    } catch (error) {
        console.error('Error stopping timer:', error);
        // Show specific error message from API if available
        const errorMessage = error.data?.error || error.message || "Hata oluştu. Lütfen tekrar deneyin.";
        alert(errorMessage);
        // Re-enable button on error
        startBtn.disabled = false;
        // Force button to be clickable by removing disabled class
        startBtn.classList.remove('disabled');
    }
}


