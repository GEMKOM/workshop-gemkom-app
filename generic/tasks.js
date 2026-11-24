import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

/**
 * Marks a task as completed
 * @param {string} taskKey - Task key to mark as done
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function markTaskAsDoneShared(taskKey, module = 'machining') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const response = await authedFetch(`${backendBase}/${modulePath}/tasks/mark-completed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key: taskKey
        })
    });
    return response.ok;
}

/**
 * Finishes a CNC cut with its remnants: the backend issues the cut's sheets,
 * brings the remnants back to stock and stores the fire.
 * @param {string} taskKey
 * @param {{remnants: Array<{width_mm: string, length_mm: string, quantity: number, shape: string, area_m2?: string}>, no_remnant: boolean}} payload
 *   shape: rectangle | triangle | circle | irregular (width × length is the bounding box; a circle's diameter both); area_m2 for irregular only
 * @returns {Promise<{ok: boolean, error: string, booked?: object}>} error: the backend's message when refused; booked: the finish result (remnants with their sheet codes)
 */
export async function finishCncTask(taskKey, payload) {
    const response = await authedFetch(`${backendBase}/cnc_cutting/tasks/mark-completed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: taskKey, ...payload })
    });
    if (response.ok) {
        // booked: what the cut booked, with the codes its remnant sheets got.
        let booked = null;
        try {
            booked = (await response.json())?.booked ?? null;
        } catch (e) {
            booked = null;
        }
        return { ok: true, error: '', booked };
    }
    let error = '';
    try {
        error = firstMessage(await response.json());
    } catch (e) {
        error = '';
    }
    return { ok: false, error };
}

/** The first message in a DRF error body: {error}, {detail}, or field errors (nested). */
function firstMessage(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
        for (const item of data) {
            const text = firstMessage(item);
            if (text) return text;
        }
        return '';
    }
    if (typeof data === 'object') {
        if (data.error || data.detail) return String(data.error || data.detail);
        for (const value of Object.values(data)) {
            const text = firstMessage(value);
            if (text) return text;
        }
    }
    return '';
}

/**
 * Marks a task as processed by warehouse
 * @param {string} taskKey - Task key to mark as warehouse processed
 * @param {string} [module='cnc_cutting'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function markAsWareHouseProcessed(taskKey, module = 'cnc_cutting') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const response = await authedFetch(`${backendBase}/${modulePath}/tasks/warehouse-process/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key: taskKey
        })
    });
    return response.ok;
}

/**
 * Fetches hold tasks (reason codes for putting tasks on hold)
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<Array>} Array of hold task reason codes
 */
export async function fetchHoldTasks(module = 'machining') {
    const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
    const response = await authedFetch(`${backendBase}/${modulePath}/hold-tasks/`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch hold tasks');
    }
    
    const data = await response.json();
    return data.results || data;
}

/**
 * Extracts the task key from the URL query parameters
 * @returns {string|null} Task key from URL, or null if not found
 */
export function getTaskKeyFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('key');
}

/**
 * Fetches a single task by key
 */
export async function fetchTaskById(taskKey, module = 'machining') {
    const res = await authedFetch(`${backendBase}/${module}/tasks/${taskKey}/`);
    if (!res.ok) return null;
    const task = await res.json();
    return task;
}

/**
 * Fetches task details with fallback logic for stored tasks and hold tasks
 * @param {string|null} taskKey - Task key to fetch, or null to use from URL
 * @param {string} [module='machining'] - Module name: 'machining' or 'cnc_cutting'
 * @returns {Promise<Object>} Task details object
 */
export async function fetchTaskDetails(taskKey = null, module = 'machining') {
    const params = new URLSearchParams(window.location.search);

    const storedTaskJSON = sessionStorage.getItem('selectedTask');
    if (storedTaskJSON) {
        try {
            return JSON.parse(storedTaskJSON);
        } catch (error) {
            console.error('Error parsing stored task:', error);
        }
    }
    else if(params.get('hold') !== '1'){
        const task = await fetchTaskById(taskKey, module);
        if (!task) {
            throw new Error('Task not found');
        }
        return task;
    } else {
        const key = params.get('key');
        return {
            key: key,
            name: params.get('name') || key,                    // Task name
            nesting_id: key,                                    // For CNC cutting, nesting_id is the same as key
            job_no: params.get('name') || key,           // RM260-01-12
            image_no: null,         // 8.7211.0005
            position_no: null,      // 107
            quantity: null,         // 6
            machine: null,   // COLLET (optional)
            is_hold_task: true
        };
    }
}

/**
 * Fetches tasks with flexible filtering options
 * @param {Object} options - Filter options
 * @param {number} options.machineId - Machine ID filter
 * @param {boolean} options.completionDateIsNull - Filter by completion date
 * @param {boolean} options.inPlan - Filter by plan status
 * @param {string} options.ordering - Ordering field
 * @param {number} options.page - Page number for pagination
 * @param {number} options.pageSize - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.status - Task status filter
 * @param {boolean} options.isWarehouseProcessed - Filter by warehouse processing status
 * @param {string} [module='machining'] - Module name ('machining' or 'cnc_cutting')
 * @returns {Promise<Object>} - Tasks data with pagination info
 */
export async function fetchTasks(options = {}, module = 'machining') {
    const {
        machineId = null,
        completionDateIsNull = null,
        isWarehouseProcessed = null,
        inPlan = null,
        ordering = null,
        page = 1,
        pageSize = 50,
        search = null,
        status = null
    } = options;

    // Build query parameters
    const params = new URLSearchParams();
    
    if (machineId !== null) {
        params.append('machine_fk', machineId);
    }
    
    if (completionDateIsNull !== null) {
        params.append('completion_date__isnull', completionDateIsNull);
    }
    
    if (inPlan !== null) {
        params.append('in_plan', inPlan);
    }
    
    if (ordering) {
        params.append('ordering', ordering);
    }
    
    if (page > 1) {
        params.append('page', page);
    }
    
    if (pageSize !== 50) {
        params.append('page_size', pageSize);
    }
    
    if (search) {
        params.append('search', search);
    }
    
    if (status) {
        params.append('status', status);
    }
    
    if (isWarehouseProcessed !== null) {
        params.append('processed_by_warehouse', isWarehouseProcessed);
    }

    try {
        const url = `${backendBase}/${module}/tasks/?${params.toString()}`;
        const response = await authedFetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
}
