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

    if (!response.ok) {
        throw new Error('Failed to resolve maintenance request');
    }
    
    return response.json();
}

export async function fetchMachineFaults() {
    const response = await authedFetch(`${backendBase}/machines/faults/?page_size=1000`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch machine faults');
    }
    
    return response.json();
}