// --- taskState.js ---
// State management and utilities for task functionality

import { state } from '../machiningService.js';
import { getMachine } from '../../generic/machines.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
export function setCurrentIssueState(issue) {
    state.currentIssue = {
        key: issue.key,
        name: issue.name,
        job_no: issue.job_no,
        image_no: issue.image_no,
        position_no: issue.position_no,
        quantity: issue.quantity,
        is_hold_task: issue.is_hold_task
    };
}   

export function setCurrentTimerState(activeTimer) {
    if (activeTimer) {
        state.currentTimer = activeTimer;
    } 
}

export async function setCurrentMachineState() {
    const urlParams = new URLSearchParams(window.location.search);
    const machineId = urlParams.get('machine_id');
    const machine = await getMachine(machineId);
    state.currentMachine = machine;
}