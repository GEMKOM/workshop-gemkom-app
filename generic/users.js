import { backendBase } from "../base.js";
import { extractResultsFromResponse } from "./paginationHelper.js";
import { authedFetch } from "../authService.js";

export async function fetchUsers(team = null) {
    // Adjust endpoint if needed
    let url = `${backendBase}/users/`;
    if (team) {
        url += `?team=${team}`;
    }
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
        const resp = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
            },
            // Add cache control for mobile networks
            cache: 'no-cache',
        });
        
        clearTimeout(timeoutId);
        
        if (!resp.ok) {
            console.error(`Failed to fetch users: ${resp.status} ${resp.statusText}`);
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        
        const data = await resp.json();
        const results = extractResultsFromResponse(data);
        
        if (!results || results.length === 0) {
            console.warn('No users returned from API');
            return [];
        }
        
        return results;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error('Request timeout while fetching users');
            throw new Error('Request timeout - please check your internet connection');
        }
        
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function fetchTeams() {
    const resp = await authedFetch(`${backendBase}/users/teams/`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return extractResultsFromResponse(data);
}

export async function fetchOccupations() {
    const resp = await authedFetch(`${backendBase}/users/occupations/`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return extractResultsFromResponse(data);
}

/**
 * Updates the current user's profile information
 * @param {Object} userData - User data to update
 * @param {string} userData.first_name - User's first name
 * @param {string} userData.last_name - User's last name
 * @param {string} userData.email - User's email
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function updateCurrentUser({ first_name, last_name, email }) {
    const response = await authedFetch(`${backendBase}/users/me/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name, last_name, email })
    });
    return response.ok;
}

/**
 * Resets the current user's password
 * @param {string} newPassword - New password to set
 * @returns {Promise<Response>} Response object for further error handling
 */
export async function resetPassword(newPassword) {
    const response = await authedFetch(`${backendBase}/users/reset-password/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_password: newPassword })
    });
    return response;
}