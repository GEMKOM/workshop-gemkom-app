import { backendBase } from "../base.js";
import { extractResultsFromResponse } from "./paginationHelper.js";
import { authedFetch } from "../authService.js";


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