// --- task.js ---
// Entry point for operation page - initialization and coordination

import { initNavbar } from '../../components/navbar.js';
import { guardRoute, navigateTo, ROUTES } from '../../authService.js';
import { getOperation } from '../../generic/machining/operations.js';
import { 
    setCurrentIssueState,
    setCurrentTimerState,
    setCurrentMachineState
} from './taskState.js';
import { 
    setupTaskDisplay
} from './taskUI.js';
import { setupAllHandlers } from './taskHandlers.js';
import { fetchTimers } from '../../generic/timers.js';
import { extractFirstResultFromResponse, extractResultsFromResponse } from '../../generic/paginationHelper.js';
import { state } from '../operationsService.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

function getOperationKeyFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('key');
}

function getTimerIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('timer_id');
}

async function initializeTaskView() {
    if (!guardRoute()) {
        return;
    }
    
    initNavbar();
    
    await setCurrentMachineState();
    
    const operationKey = getOperationKeyFromURL();
    const timerId = getTimerIdFromURL();
    
    // Fetch the active timer first
    let activeTimer = null;
    if (timerId) {
        // If timer_id is provided, fetch by timer ID (for break/downtime timers)
        // For timer_id, we expect an active timer to exist, otherwise redirect
        const timersResponse = await fetchTimers({ is_active: true, machine_id: state.currentMachine.id });
        const timers = extractResultsFromResponse(timersResponse);
        activeTimer = timers.find(t => t.id === parseInt(timerId));
        
        // If timer_id is in URL but timer doesn't exist, redirect
        if (!activeTimer) {
            navigateTo('/machining/');
            return;
        }
    } else if (operationKey) {
        // If operation key is provided, try to fetch active timer (but don't require it)
        // User might be viewing the task page to start a timer
        activeTimer = extractFirstResultFromResponse(await fetchTimers({ is_active: true, machine_id: state.currentMachine.id, issue_key: operationKey }));
        
        // If no active timer, that's okay - user can start one
        // But we still need to fetch the operation to display task details
    } else {
        // No key or timer_id - try to get any active timer for this machine
        activeTimer = extractFirstResultFromResponse(await fetchTimers({ is_active: true, machine_id: state.currentMachine.id }));
    }
    
    // If we have an operation key but no active timer, fetch the operation to display task details
    if (operationKey && !activeTimer) {
        try {
            const operation = await getOperation(operationKey);
            if (operation) {
                setCurrentIssueState(operation);
            } else {
                // Operation not found, redirect
                navigateTo('/machining/');
                return;
            }
        } catch (error) {
            console.error('Could not fetch operation:', error);
            navigateTo('/machining/');
            return;
        }
    }
    
    // Check timer type - only productive timers have associated operations
    if (activeTimer && activeTimer.timer_type === 'productive' && activeTimer.issue_key) {
        // For productive timers, fetch the operation
        let operation = null;
        try {
            operation = await getOperation(activeTimer.issue_key);
            if (operation) {
                setCurrentIssueState(operation);
            }
        } catch (error) {
            console.warn('Could not fetch operation for productive timer:', error);
            // Fall back to timer data if operation fetch fails
        }
    }
    
    // If we don't have an operation (either because it's a break/downtime timer or fetch failed),
    // create issue state from timer data
    if (!state.currentIssue && activeTimer) {
        state.currentIssue = {
            key: activeTimer.issue_key || `TIMER-${activeTimer.id}`,
            part_task_key: null,
            name: activeTimer.issue_name || activeTimer.downtime_reason_name || 'Durma Nedeni',
            job_no: null,
            image_no: null,
            position_no: null,
            quantity: null,
            order: null
        };
    }
    
    // If we still don't have an issue state and we have an operation key, something went wrong
    if (!state.currentIssue && operationKey) {
        console.error('Failed to set current issue state');
        navigateTo('/machining/');
        return;
    }
    
    setCurrentTimerState(activeTimer);
    setupTaskDisplay(activeTimer ? true : false);
    setupAllHandlers(activeTimer ? true : false);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTaskView);


