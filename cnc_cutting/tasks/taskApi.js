// --- taskApi.js ---
// API calls and data fetching for task functionality

import { state } from '../cnc_cuttingService.js';
import { backendBase } from '../../base.js';
import { authedFetch, navigateTo, ROUTES } from '../../authService.js';
import { getSyncedNow, syncServerTime } from '../../generic/timeService.js';
import { setCurrentTimerState, setCurrentMachineState } from './taskState.js';

// ============================================================================
// TASK DATA FETCHING
// ============================================================================

export function getTaskKeyFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('key');
}

export async function fetchTaskDetails(taskKey=null) {
    const params = new URLSearchParams(window.location.search);

    const storedTaskJSON = sessionStorage.getItem('selectedTask');
    if (storedTaskJSON) {
        try {
            return JSON.parse(storedTaskJSON);
        } catch (error) {
            console.error('Error parsing stored task:', error);
        }
    }
    else if(params.get('hold') !== '1'){
        const response = await authedFetch(`${backendBase}/cnc_cutting/tasks/${taskKey}/`);
        
        if (!response.ok) {
            throw new Error('Task not found');
        }
        return response.json();
    } else {
        return {
                    key: params.get('key'),
                    name: params.get('name') || params.get('key'),                    // Task name
                    job_no: params.get('name') || params.get('key'),           // RM260-01-12
                    image_no: null,         // 8.7211.0005
                    position_no: null,      // 107
                    quantity: null,         // 6
                    machine: null,   // COLLET (optional)
                    is_hold_task: true
                };
    }
    
}
// ============================================================================
// TIMER OPERATIONS
// ============================================================================

export async function startTimer(comment = null) {
    if (!state.currentMachine.id || !state.currentIssue.key){
        alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    }
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
    
    const response = await authedFetch(`${backendBase}/cnc_cutting/timers/start/`, {
        method: 'POST',
        body: JSON.stringify(timerData)
    });
    if (!response.ok) {
        alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    } else {
        const timer = await response.json();
        timerData.id = timer.id;
        setCurrentTimerState(timerData);
        setCurrentMachineState(state.currentMachine.id);
        return timer;
    }
}

export async function createManualTimeEntry(startDateTime, endDateTime, comment = null) {
    if (!state.currentMachine.id){
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    }
    const requestBody = {
        issue_key: state.currentIssue.key,
        start_time: startDateTime.getTime(),
        finish_time: endDateTime.getTime(),
        machine: state.currentIssue.customfield_11411?.value || '',
        machine_fk: state.currentMachine.id,
        nesting_id: state.currentIssue.nesting_id || '',
        material: state.currentIssue.material || '',
        dimensions: state.currentIssue.dimensions || '',
        thickness_mm: state.currentIssue.thickness_mm || '',
        parts_count: state.currentIssue.parts_count || ''
    };
    
    // Add comment if provided
    if (comment) {
        requestBody.comment = comment;
    }
    
    const response = await authedFetch(`${backendBase}/cnc_cutting/manual-time/`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
    });
    
    return response.ok;
}

export async function markTaskAsDone() {
    const response = await authedFetch(`${backendBase}/cnc_cutting/tasks/mark-completed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key: state.currentIssue.key
        })
    });
        
    return response.ok;
}

export async function markAsWareHouseProcessed(taskKey = null) {
    const key = taskKey || state.currentIssue.key;
    const response = await authedFetch(`${backendBase}/cnc_cutting/tasks/warehouse-process/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key: key
        })
    });
        
    return response.ok;
}




// ============================================================================
// MAINTENANCE CHECKING
// ============================================================================

export async function checkMachineMaintenance(machineId) {
    const response = await authedFetch(`${backendBase}/machines/${machineId}/`);
    
    if (!response.ok) {
        return false;
    }
    
    const machine = await response.json();
    return machine ? machine.is_under_maintenance : false;
}
