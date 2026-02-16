import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

/**
 * Get planning request items with optional filters
 * @param {Object} filters - Filter parameters (all optional)
 * @param {number} filters.planning_request - Filter by planning request ID
 * @param {string} filters.job_no - Exact match on job number
 * @param {string} filters.job_no__icontains - Partial match on job number
 * @param {number} filters.item - Filter by catalog item ID
 * @param {string} filters.item_code - Partial match on item code
 * @param {string} filters.item_name - Partial match on item name
 * @param {string} filters.search - Searches both code and name
 * @param {string} filters.priority - Exact match (low, normal, high, urgent)
 * @param {boolean} filters.is_delivered - Filter by delivery status
 * @param {boolean} filters.needs_purchase - Only items with quantity_to_purchase > 0
 * @param {boolean} filters.is_available - Has remaining qty for new PRs
 * @param {boolean} filters.available_for_procurement - Ready/converted + has remaining qty
 * @param {string} filters.planning_request_status - Filter by parent request status
 * @param {string} filters.planning_request_number - Partial match on request number
 * @param {string} filters.ordering - Sort field (e.g., 'id', '-id')
 * @param {number} filters.page - Pagination page number
 * @returns {Promise<Object>} Paginated response with results array
 */
export async function getPlanningRequestItems(filters = {}) {
    try {
        // Build query parameters
        const queryParams = new URLSearchParams();

        // Add fields=simple parameter for faster response
        queryParams.append('fields', 'simple');

        // Add filters if provided
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                // Convert boolean to string for URL params
                if (typeof value === 'boolean') {
                    queryParams.append(key, value.toString());
                } else {
                    queryParams.append(key, value);
                }
            }
        });

        const url = `${backendBase}/planning/items/?${queryParams.toString()}`;
        const response = await authedFetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Planlama talebi öğeleri yüklenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching planning request items:', error);
        throw error;
    }
}

/**
 * Mark a single planning request item as delivered
 * @param {number} planningRequestItemId - The ID of the planning request item
 * @returns {Promise<Object>} Full PlanningRequestItem object with is_delivered: true
 */
export async function markItemDelivered(planningRequestItemId) {
    try {
        const response = await authedFetch(`${backendBase}/planning/items/${planningRequestItemId}/mark_delivered/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Öğe teslim edildi olarak işaretlenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error marking item as delivered:', error);
        throw error;
    }
}

/**
 * Bulk mark multiple planning request items as delivered
 * @param {number[]} ids - Array of planning request item IDs
 * @returns {Promise<Object>} Response with detail message and updated_count
 */
export async function bulkMarkItemsDelivered(ids) {
    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error('ids is required and must be a non-empty list');
        }

        const response = await authedFetch(`${backendBase}/planning/items/bulk_mark_delivered/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Öğeler teslim edildi olarak işaretlenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error bulk marking items as delivered:', error);
        throw error;
    }
}
