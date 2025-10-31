import { authedFetch } from '../authService.js';
import { backendBase } from '../base.js';
import { extractResultsFromResponse } from './paginationHelper.js';

export async function fetchMachines(filters = {}) {
    try {
        let url = `${backendBase}/machines/`;
        const params = new URLSearchParams();
        
        // Add page_size to get all machines
        params.append('page_size', '1000');
        
        // Apply any filters that are provided
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await authedFetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch machines');
        }
        
        const machinesResponse = await response.json();
        return extractResultsFromResponse(machinesResponse);
    } catch (error) {
        console.error('Error fetching machines:', error);
        throw error;
    }
}

export async function getMachine(machineId) {
    const response = await authedFetch(`${backendBase}/machines/${machineId}/`);
    return response.json();
}

export async function fetchMachineTypes() {
    const response = await authedFetch(`${backendBase}/machines/types/`);
    return response.json();
}

/**
 * Checks if a machine is under maintenance
 * @param {number|string} machineId - Machine ID to check
 * @returns {Promise<boolean>} True if machine is under maintenance, false otherwise
 */
export async function checkMachineMaintenance(machineId) {
    const response = await authedFetch(`${backendBase}/machines/${machineId}/`);
    
    if (!response.ok) {
        return false;
    }
    
    const machine = await response.json();
    return machine ? machine.is_under_maintenance : false;
}

/**
 * Creates a maintenance request (fault report)
 * @param {Object} requestData - Maintenance request data
 * @returns {Promise<Object>} Created maintenance request
 */
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

/**
 * Resolves a maintenance request
 * @param {number|string} requestId - Maintenance request ID
 * @param {string} resolutionDescription - Description of the resolution
 * @returns {Promise<Object>} Resolved maintenance request
 */
export async function resolveMaintenanceRequest(requestId, resolutionDescription) {
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

/**
 * Fetches all machine faults (maintenance requests)
 * @returns {Promise<Object>} Machine faults data with pagination info
 */
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