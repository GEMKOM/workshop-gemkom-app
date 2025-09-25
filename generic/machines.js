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