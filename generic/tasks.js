import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

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
 * Fetches tasks with flexible filtering options
 * @param {Object} options - Filter options
 * @param {string} options.module - Module name ('machining' or 'cnc_cutting')
 * @param {number} options.machineId - Machine ID filter
 * @param {boolean} options.completionDateIsNull - Filter by completion date
 * @param {boolean} options.inPlan - Filter by plan status
 * @param {string} options.ordering - Ordering field
 * @param {number} options.page - Page number for pagination
 * @param {number} options.pageSize - Items per page
 * @param {string} options.search - Search term
 * @param {string} options.status - Task status filter
 * @returns {Promise<Object>} - Tasks data with pagination info
 */
export async function fetchTasks(options = {}) {
    const {
        module = 'machining',
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

/**
 * Fetches all tasks for task overview (no pagination)
 * @param {string} module - Module name ('machining' or 'cnc_cutting')
 * @returns {Promise<Array>} - Array of all tasks
 */
export async function fetchAllTasks(module = 'machining') {
    try {
        const data = await fetchTasks({
            module,
            pageSize: 1000, // Large page size to get all tasks
            completionDateIsNull: true
        });
        
        // Return results array or the data itself if not paginated
        return data.results || data;
    } catch (error) {
        console.error('Error fetching all tasks:', error);
        return [];
    }
}

/**
 * Fetches tasks with flexible filtering
 * @param {string} module - Module name
 * @param {Object} filters - Filter options
 * @param {number} filters.machineId - Machine ID (optional)
 * @param {boolean} filters.inPlan - Plan status filter (optional)
 * @param {boolean} filters.completionDateIsNull - Filter by completion date (optional)
 * @param {string} filters.ordering - Ordering field (default: 'plan_order')
 * @param {string} filters.status - Task status filter (optional)
 * @param {string} filters.search - Search term (optional)
 * @param {number} filters.page - Page number (optional)
 * @param {number} filters.pageSize - Items per page (optional)
 * @returns {Promise<Array>} - Array of tasks
 */
export async function fetchMachineTasks(module, filters = {}) {
    try {
        const {
            ordering = 'plan_order',
            ...otherFilters
        } = filters;

        const data = await fetchTasks({
            module,
            ordering,
            ...otherFilters
        });
        
        return data.results || data;
    } catch (error) {
        console.error('Error fetching machine tasks:', error);
        return [];
    }
}

/**
 * Fetches unassigned tasks (no machine assigned)
 * @param {string} module - Module name
 * @param {boolean} inPlan - Plan status filter
 * @returns {Promise<Array>} - Array of unassigned tasks
 */
export async function fetchUnassignedTasks(module, inPlan = null) {
    try {
        const data = await fetchTasks({
            module,
            machineId: null,
            completionDateIsNull: true,
            inPlan,
            ordering: 'created_at'
        });
        
        return data.results || data;
    } catch (error) {
        console.error('Error fetching unassigned tasks:', error);
        return [];
    }
}