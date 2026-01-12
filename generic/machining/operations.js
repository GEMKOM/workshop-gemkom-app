
import { authedFetch } from '../../authService.js';
import { backendBase } from '../../base.js';

const MACHINING_2_BASE_URL = `${backendBase}/tasks`;

/**
 * Machining Operations API Operations
 * Handles Operation model CRUD operations and custom actions
 * Based on OperationViewSet Django REST Framework ViewSet
 */

/**
 * Get all operations (list view)
 * @param {Object} [filters] - Optional filters and query parameters
 * @param {string} [filters.part__key] - Filter by part key
 * @param {number} [filters.machine_fk] - Filter by machine ID
 * @param {number} [filters.completion_date] - Filter by completion date (timestamp)
 * @param {string} [filters.part_key] - Filter by part key (query param)
 * @param {number} [filters.machine_id] - Filter by machine ID (query param)
 * @param {string} [filters.ordering] - Ordering field (e.g., 'part', 'order', 'created_at')
 * @param {number} [filters.page] - Page number for pagination
 * @param {number} [filters.page_size] - Page size for pagination
 * @returns {Promise<Array|Object>} Array of operations or paginated response
 */
export async function getOperations(filters = {}) {
    try {
        const queryParams = new URLSearchParams();
        queryParams.append('view', 'operator');
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                queryParams.append(key, value);
            }
        });
        
        const url = queryParams.toString() 
            ? `${MACHINING_2_BASE_URL}/operations/?${queryParams.toString()}`
            : `${MACHINING_2_BASE_URL}/operations/`;
        
        const response = await authedFetch(url);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch operations: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        const data = await response.json();
        
        // Handle both direct array response and paginated response
        if (data.results && Array.isArray(data.results)) {
            return data; // Return the full paginated response
        } else if (Array.isArray(data)) {
            return data; // Return the direct array
        } else {
            throw new Error('Unexpected response format');
        }
    } catch (error) {
        console.error('Error fetching operations:', error);
        throw error;
    }
}

/**
 * Get a single operation by key (detail view)
 * @param {string} operationKey - The operation key (primary key)
 * @returns {Promise<Object>} Operation data with tools and hours spent
 */
export async function getOperation(operationKey) {
    try {
        const response = await authedFetch(`${MACHINING_2_BASE_URL}/operations/${operationKey}/`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch operation: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching operation:', error);
        throw error;
    }
}

/**
 * Mark an operation as completed
 * Custom action endpoint
 * @param {string} operationKey - The operation key (primary key)
 * @returns {Promise<Object>} Updated operation with completion date
 */
export async function markOperationCompleted(operationKey) {
    try {
        const response = await authedFetch(`${MACHINING_2_BASE_URL}/operations/${operationKey}/mark_completed/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to mark operation as completed: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error marking operation as completed:', error);
        throw error;
    }
}

/**
 * Start a timer on an operation
 * Custom action endpoint
 * @param {string} operationKey - The operation key (primary key)
 * @returns {Promise<Object>} Timer data with timer_id
 * @throws {Error} If operation is already completed, timer already running, previous operations incomplete, or tools not available
 */
export async function startOperationTimer(operationKey) {
    try {
        const response = await authedFetch(`${MACHINING_2_BASE_URL}/operations/${operationKey}/start-timer/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `Failed to start timer: ${response.statusText}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = errorData;
            throw error;
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error starting operation timer:', error);
        throw error;
    }
}

/**
 * Stop the active timer on an operation
 * Custom action endpoint
 * @param {string} operationKey - The operation key (primary key)
 * @returns {Promise<Object>} Timer data with timer_id
 * @throws {Error} If no active timer found
 */
export async function stopOperationTimer(operationKey) {
    try {
        const response = await authedFetch(`${MACHINING_2_BASE_URL}/operations/${operationKey}/stop-timer/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `Failed to stop timer: ${response.statusText}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = errorData;
            throw error;
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error stopping operation timer:', error);
        throw error;
    }
}

/**
 * Fetch all active downtime reasons
 * @returns {Promise<Array>} Array of downtime reason objects
 */
export async function fetchDowntimeReasons() {
    try {
        const response = await authedFetch(`${MACHINING_2_BASE_URL}/downtime-reasons/`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch downtime reasons: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching downtime reasons:', error);
        throw error;
    }
}

/**
 * Log a downtime/break reason
 * @param {Object} logData - Log reason data
 * @param {number} [logData.current_timer_id] - Optional timer ID to stop
 * @param {number} logData.reason_id - Required downtime reason ID
 * @param {string} [logData.comment] - Optional description
 * @param {number} logData.machine_id - Required machine ID
 * @param {string} logData.operation_key - Required operation key
 * @returns {Promise<Object>} Response with stopped_timer_id, new_timer_id, timer, fault_id, operation_completed, message
 */
export async function logReason(logData) {
    try {
        const response = await authedFetch(`${MACHINING_2_BASE_URL}/log-reason/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `Failed to log reason: ${response.statusText}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            error.data = errorData;
            throw error;
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error logging reason:', error);
        throw error;
    }
}