// --- taskState.js ---
// State management and utilities for operation functionality

import { state } from '../operationsService.js';
import { getMachine } from '../../generic/machines.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
export function setCurrentIssueState(operation) {
    state.currentIssue = {
        key: operation.key,
        part_task_key: operation.part_task_key || null,
        name: operation.part_name || operation.name || '',
        job_no: operation.part_job_no || null,
        image_no: operation.part_image_no || null,
        position_no: operation.part_position_no || null,
        quantity: operation.part_quantity || null,
        order: operation.order || null
    };
}   

export function setCurrentTimerState(activeTimer) {
    if (activeTimer) {
        state.currentTimer = activeTimer;
    } else {
        // Explicitly clear the timer state when null/undefined
        state.currentTimer = null;
    }
}

export async function setCurrentMachineState() {
    const urlParams = new URLSearchParams(window.location.search);
    const machineId = urlParams.get('machine_id');
    const machine = await getMachine(machineId);
    state.currentMachine = machine;
}

