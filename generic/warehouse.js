import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

const PLANNING_BASE_URL = `${backendBase}/planning`;
/**
 * Planning Request API Functions
 * Handles all planning request operations
 */

/**
 * Get all planning requests with optional filtering
 * @param {Object} filters - Filter parameters
 * @param {string} filters.status - Filter by status (draft, ready, converted, cancelled)
 * @param {string} filters.priority - Filter by priority (normal, urgent, critical)
 * @param {number} filters.department_request - Filter by department request ID
 * @param {string} filters.search - Search in title, description
 * @param {string} filters.ordering - Ordering field (e.g., '-created_at', 'request_number')
 * @param {number} filters.page - Page number for pagination
 * @param {number} filters.page_size - Page size for pagination
 * @returns {Promise<Object>} Response with planning requests
 */
export async function getPlanningRequests(filters = {}) {
    try {
        const queryParams = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.append(key, value);
            }
        });

        const url = `${PLANNING_BASE_URL}/requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        console.log('Fetching planning requests from:', url);
        
        const response = await authedFetch(url);

        if (!response.ok) {
            let errorMessage = 'Planlama talepleri yüklenirken hata oluştu';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                // If error response is not JSON, use status text
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Planning requests response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching planning requests:', error);
        throw error;
    }
}

/**
 * Get a single planning request by ID
 * @param {number} planningRequestId - Planning request ID
 * @returns {Promise<Object>} Planning request details with items
 */
export async function getPlanningRequest(planningRequestId) {
    try {
        const url = `${PLANNING_BASE_URL}/requests/${planningRequestId}/`;
        
        console.log('Fetching planning request from:', url);
        
        const response = await authedFetch(url);

        if (!response.ok) {
            let errorMessage = 'Planlama talebi yüklenirken hata oluştu';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Planning request response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching planning request:', error);
        throw error;
    }
}

/**
 * Manually allocate specific quantities of inventory to planning request items
 * @param {number} planningRequestId - Planning request ID
 * @param {Object} allocationData - Allocation data
 * @param {Array} allocationData.allocations - Array of allocation objects
 * @param {number} allocationData.allocations[].planning_request_item_id - Planning request item ID
 * @param {string} allocationData.allocations[].allocated_quantity - Allocated quantity (e.g., "10.00")
 * @param {string} [allocationData.allocations[].notes] - Optional notes
 * @returns {Promise<Object>} Response with allocation details and updated planning request
 */
export async function allocateInventory(planningRequestId, allocationData) {
    try {
        const response = await authedFetch(`${PLANNING_BASE_URL}/requests/${planningRequestId}/allocate_inventory/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(allocationData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Envanter tahsisi yapılırken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error allocating inventory:', error);
        throw error;
    }
}

/**
 * Get all inventory allocations for a planning request
 * @param {number} planningRequestId - Planning request ID
 * @returns {Promise<Array>} Array of inventory allocations
 */
export async function getInventoryAllocations(planningRequestId) {
    try {
        const response = await authedFetch(`${PLANNING_BASE_URL}/requests/${planningRequestId}/inventory_allocations/`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Envanter tahsisleri yüklenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching inventory allocations:', error);
        throw error;
    }
}

/**
 * Update inventory found quantities for planning request items
 * Updates quantity_from_inventory and quantity_to_purchase for each item based on found quantities.
 * Only accessible by warehouse team and superusers.
 * 
 * @param {number} planningRequestId - Planning request ID
 * @param {Object} data - Update data
 * @param {Array} data.items - Array of items with found quantities
 * @param {number} data.items[].planning_request_item_id - Planning request item ID
 * @param {string} data.items[].quantity_found - Quantity found in inventory (e.g., "10.00")
 * @returns {Promise<Object>} Response with updated count and planning request
 */
export async function updateInventoryQuantities(planningRequestId, data) {
    try {
        const response = await authedFetch(`${PLANNING_BASE_URL}/requests/${planningRequestId}/update_inventory_quantities/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Envanter miktarları güncellenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating inventory quantities:', error);
        throw error;
    }
}

/**
 * Mark inventory control as completed for a planning request
 * After allocating inventory (either manually or via auto_allocate_inventory),
 * call this endpoint to finalize the inventory control process.
 * 
 * Logic:
 * - If ALL items are fulfilled from inventory → status='completed' (not available for procurement)
 * - If SOME/NO items from inventory → status='ready' (available for procurement)
 * 
 * @param {number} planningRequestId - Planning request ID
 * @param {Object} [data] - Optional data
 * @param {Array} [data.allocations] - Optional array of allocations to create before completing
 * @param {number} data.allocations[].planning_request_item_id - Planning request item ID
 * @param {string} data.allocations[].allocated_quantity - Allocated quantity (e.g., "5.00")
 * @param {string} [data.allocations[].notes] - Optional notes
 * @returns {Promise<Object>} Response with completion status and updated planning request
 */
export async function completeInventoryControl(planningRequestId, data = {}) {
    try {
        const response = await authedFetch(`${PLANNING_BASE_URL}/requests/${planningRequestId}/complete_inventory_control/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Envanter kontrolü tamamlanırken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error completing inventory control:', error);
        throw error;
    }
}

/**
 * Get planning requests for warehouse team
 * Shows requests that need inventory checking or have been submitted.
 * Only accessible by warehouse team and superusers.
 * 
 * @param {Object} filters - Filter parameters
 * @param {string} filters.status - Filter by specific status (pending_inventory, pending_erp_entry, completed)
 * @param {number} filters.page - Page number for pagination
 * @param {number} filters.page_size - Page size for pagination
 * @returns {Promise<Object>} Response with warehouse planning requests (paginated)
 */
export async function getWarehouseRequests(filters = {}) {
    try {
        const queryParams = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.append(key, value);
            }
        });

        const url = `${PLANNING_BASE_URL}/requests/warehouse_requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        console.log('Fetching warehouse requests from:', url);
        
        const response = await authedFetch(url);

        if (!response.ok) {
            let errorMessage = 'Depo talepleri yüklenirken hata oluştu';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                // If error response is not JSON, use status text
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Warehouse requests response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching warehouse requests:', error);
        throw error;
    }
}