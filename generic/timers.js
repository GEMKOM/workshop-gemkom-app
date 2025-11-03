import { backendBase } from '../base.js';
import { authedFetch } from '../authService.js';

/**
 * Fetches timers from the API
 * @param {Object} urlParams - Object containing URL parameters
 * @param {boolean|null} [urlParams.is_active] - Filter by active status
 * @param {number|string} [urlParams.machine_id] - Filter by machine ID
 * @param {string} [urlParams.issue_key] - Filter by issue key
 * @param {number} [urlParams.start_after] - Filter by start time after timestamp
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<Object>} Timer data from API
 */
export async function fetchTimers(urlParams = {}, module = 'machining') {
    // Build URL based on module
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    let url = `${backendBase}/${modulePath}/timers/`;
    const params = [];
    
    // Handle URLSearchParams object if passed
    let paramsObj = urlParams;
    if (urlParams instanceof URLSearchParams) {
        paramsObj = Object.fromEntries(urlParams);
    }
    
    if (paramsObj.is_active !== null && paramsObj.is_active !== undefined) {
        params.push(`is_active=${paramsObj.is_active}`);
    }
    if (paramsObj.machine_id || paramsObj.machine_fk) {
        const machineParam = paramsObj.machine_id || paramsObj.machine_fk;
        params.push(`machine_fk=${machineParam}`);
    }
    if (paramsObj.issue_key) {
        params.push(`issue_key=${paramsObj.issue_key}`);
    }
    if (paramsObj.start_after) {
        params.push(`start_after=${paramsObj.start_after}`);
    }
    
    // Add any additional params that might be in the object (for pagination, etc.)
    for (const [key, value] of Object.entries(paramsObj)) {
        if (key !== 'is_active' && key !== 'machine_id' && key !== 'machine_fk' && 
            key !== 'issue_key' && key !== 'start_after' && value !== null && value !== undefined) {
            params.push(`${key}=${value}`);
        }
    }
    
    if (params.length > 0) {
        url += `?${params.join('&')}`;
    }
    
    const res = await authedFetch(url);
    const responseData = await res.json();
    return responseData;
}

/**
 * Fetches a timer by ID from the API
 * @param {number|string} timerId - Timer ID
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<Object|null>} Timer data or null if not found
 */
export async function fetchTimerById(timerId, module = 'machining') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const res = await authedFetch(`${backendBase}/${modulePath}/timers/${timerId}/`);
    if (!res.ok) return null;
    const timer = await res.json();
    return timer;
}

/**
 * Starts a timer on the API
 * @param {Object} timerData - Timer data to start
 * @param {string} timerData.issue_key - Issue key for the timer
 * @param {number} timerData.start_time - Start time timestamp
 * @param {number|string} timerData.machine_fk - Machine ID
 * @param {string} [timerData.comment] - Optional comment
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<Object|null>} Timer object if successful, null otherwise
 */
export async function startTimerShared(timerData, module = 'machining') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const response = await authedFetch(`${backendBase}/${modulePath}/timers/start/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timerData)
    });
    
    if (!response.ok) {
        return null;
    }
    
    return await response.json();
}

/**
 * Creates a manual time entry on the API
 * @param {Object} timerData - Manual time entry data
 * @param {string} timerData.issue_key - Issue key
 * @param {number} timerData.start_time - Start time timestamp
 * @param {number} timerData.finish_time - Finish time timestamp
 * @param {number|string} timerData.machine_fk - Machine ID
 * @param {string} [timerData.comment] - Optional comment
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function createManualTimeEntryShared(timerData, module = 'machining') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const response = await authedFetch(`${backendBase}/${modulePath}/manual-time/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timerData)
    });
    return response.ok;
}

/**
 * Stops a timer on the API
 * @param {Object} params - Parameters for stopping the timer
 * @param {number|string} params.timerId - Timer ID to stop
 * @param {string} params.finishTime - Finish time for the timer
 * @param {boolean} params.syncToJira - Whether to sync to Jira
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function stopTimerShared({ timerId, finishTime, syncToJira }, module = 'machining') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const response = await authedFetch(`${backendBase}/${modulePath}/timers/stop/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timer_id: timerId,
            finish_time: finishTime,
            synced_to_jira: syncToJira
        })
    });
    return response.ok;
}