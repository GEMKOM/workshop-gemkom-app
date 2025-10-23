// --- taskState.js ---
// State management and utilities for task functionality

import { state } from '../cnc_cuttingService.js';
import { getMachine } from '../../generic/machines.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
export function setCurrentIssueState(issue) {
    state.currentIssue = {
        key: issue.key,
        name: issue.name,
        nesting_id: issue.nesting_id,
        material: issue.material,
        dimensions: issue.dimensions,
        thickness_mm: issue.thickness_mm,
        parts_count: issue.parts_count,
        parts: issue.parts || [],
        files: issue.files || [],
        machine_fk: issue.machine_fk,
        machine_name: issue.machine_name,
        estimated_hours: issue.estimated_hours,
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
