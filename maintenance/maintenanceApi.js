// --- maintenanceApi.js ---
// API functions for maintenance functionality

import { backendBase } from '../base.js';
import { authedFetch } from '../authService.js';
import { getSyncedNow } from '../generic/timeService.js'
import { stopTimerShared } from '../machining/machiningService.js';
import { getMachine } from '../generic/machines.js';

export async function createMaintenanceRequest(requestData) {
    const response = await authedFetch(`${backendBase}/machines/faults/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
        throw new Error('Failed to create maintenance request');
    }
    
    return response.json();
}

export async function resolveMaintenanceRequest(requestId, resolutionDescription) {
    const now = new Date().toISOString();
    
    // First, fetch the maintenance request to get the machine ID
    const requestResponse = await authedFetch(`${backendBase}/machines/faults/${requestId}/`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    if (!requestResponse.ok) {
        throw new Error('Failed to fetch maintenance request details');
    }
    
    const requestData = await requestResponse.json();
    const machineId = requestData.machine;
    
    // Now resolve the maintenance request
    const response = await authedFetch(`${backendBase}/machines/faults/${requestId}/`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            resolution_description: resolutionDescription
        })
    });

    // Stop active timers for the machine if any exist
    if (machineId && requestData.is_breaking) {
        const machine = await getMachine(machineId);
        const timers = machine.active_timer_ids;
        console.log(timers);
        if (timers.length > 0) {
            console.log('Stopping timers');
            for (const timerId of timers) {
                await stopTimerShared({
                    timerId: timerId,
                    finishTime: getSyncedNow(),
                    syncToJira: false
                });
            }
        }
    }

    if (!response.ok) {
        throw new Error('Failed to resolve maintenance request');
    }
    
    return response.json();
}