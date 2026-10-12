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
 * Record a warehouse receipt on a planning request item.
 * @param {number} planningRequestItemId - The ID of the planning request item
 * @param {Object} [receipt]
 * @param {number|string} [receipt.quantity] - Amount received now (default: everything outstanding)
 * @param {string} [receipt.note]
 * @returns {Promise<Object>} PlanningRequestItem with delivered_quantity / is_delivered / deliveries
 */
export async function markItemDelivered(planningRequestItemId, receipt = {}) {
    try {
        const body = {};
        if (receipt.quantity !== undefined && receipt.quantity !== null && receipt.quantity !== '') {
            body.quantity = String(receipt.quantity);
        }
        if (receipt.note) body.note = receipt.note;
        const response = await authedFetch(`${backendBase}/planning/items/${planningRequestItemId}/mark_delivered/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
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
 * Undo the latest receipt on a planning request item (or every receipt with all=true).
 * @param {number} planningRequestItemId - The ID of the planning request item
 * @param {Object} [options]
 * @param {boolean} [options.all] - Wipe every receipt instead of only the last one
 * @returns {Promise<Object>} PlanningRequestItem with the re-derived delivery state
 */
export async function unmarkItemDelivered(planningRequestItemId, options = {}) {
    try {
        const response = await authedFetch(`${backendBase}/planning/items/${planningRequestItemId}/unmark_delivered/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options.all ? { all: true } : {})
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Öğenin teslim durumu geri alınırken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error unmarking item as delivered:', error);
        throw error;
    }
}

/**
 * Record receipts on several planning request items at once.
 * @param {number[]|{items: {id: number, quantity?: number|string}[], note?: string}} payload
 *   Either a list of ids (every line receives everything outstanding) or
 *   one amount per line. One over-delivery rejects the whole batch.
 * @returns {Promise<Object[]>} The affected items with their delivery state
 */
export async function bulkMarkItemsDelivered(payload) {
    try {
        let body;
        if (Array.isArray(payload)) {
            if (payload.length === 0) throw new Error('ids is required and must be a non-empty list');
            body = { ids: payload };
        } else {
            const items = (payload && payload.items) || [];
            if (items.length === 0) throw new Error('En az bir kalem seçilmelidir');
            body = {
                items: items.map((entry) => (
                    entry.quantity === undefined || entry.quantity === null || entry.quantity === ''
                        ? { id: entry.id }
                        : { id: entry.id, quantity: String(entry.quantity) }
                )),
            };
            if (payload.note) body.note = payload.note;
        }

        const response = await authedFetch(`${backendBase}/planning/items/bulk_mark_delivered/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
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

/**
 * Receipt history of a planning request item, oldest first.
 * @param {number} planningRequestItemId
 * @returns {Promise<Object[]>} [{id, quantity, delivered_at, delivered_by_name, note}]
 */
export async function getPlanningItemDeliveries(planningRequestItemId) {
    try {
        const response = await authedFetch(`${backendBase}/planning/items/${planningRequestItemId}/deliveries/`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || 'Teslimat geçmişi yüklenirken hata oluştu');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading delivery history:', error);
        throw error;
    }
}
