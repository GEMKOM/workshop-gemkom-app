// --- task.js ---
// Entry point for task page - initialization and coordination

import { guardRoute, navigateTo, ROUTES } from '../../authService.js';
import { 
    getTaskKeyFromURL, 
    fetchTaskDetails
} from './taskApi.js';
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
import { extractFirstResultFromResponse } from '../../generic/paginationHelper.js';
import { state } from '../machiningService.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initializeTaskView() {
    if (!guardRoute()) {
        return;
    }
    
    const taskKey = getTaskKeyFromURL();
    if (!taskKey) {
        navigateTo(ROUTES.MACHINING);
        return;
    }
    await setCurrentMachineState();
    let issue = await fetchTaskDetails(taskKey);
    const activeTimer = extractFirstResultFromResponse(await fetchTimers(true, state.currentMachine.id, taskKey));
    setCurrentIssueState(issue);
    setCurrentTimerState(activeTimer);
    setupTaskDisplay(activeTimer ? true : false, issue.is_hold_task);
    setupAllHandlers(activeTimer ? true : false);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTaskView); 