import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

const WAREHOUSE_BASE_URL = `${backendBase}/warehouse`;
/**
 * Material Pull Request API Functions
 * Handles warehouse material pull request operations
 */

/**
 * Get all material pull requests with optional filtering
 * @param {Object} filters - Filter parameters
 * @param {string} filters.status - Filter by status (pending, transferred, cancelled)
 * @param {number} filters.subcontractor - Filter by subcontractor ID
 * @param {number} filters.team - Filter by team ID
 * @param {number} filters.requested_by - Filter by requesting user ID
 * @param {string} filters.job_no - Filter by job order number (contains match)
 * @param {string} filters.search - Search in number, destination name, job no, item code/name
 * @param {string} filters.requested_after - Filter by request date start (YYYY-MM-DD)
 * @param {string} filters.requested_before - Filter by request date end (YYYY-MM-DD)
 * @param {string} filters.ordering - Ordering field (e.g., '-requested_at', 'number')
 * @param {number} filters.page - Page number for pagination
 * @param {number} filters.page_size - Page size for pagination
 * @returns {Promise<Object>} Response with material pull requests (paginated)
 */
export async function getMaterialPullRequests(filters = {}) {
    try {
        const queryParams = new URLSearchParams();

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.append(key, value);
            }
        });

        const url = `${WAREHOUSE_BASE_URL}/pull-requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

        const response = await authedFetch(url);

        if (!response.ok) {
            let errorMessage = 'Malzeme çekme talepleri yüklenirken hata oluştu';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                // If error response is not JSON, use status text
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching material pull requests:', error);
        throw error;
    }
}

/**
 * Get a single material pull request by ID
 * @param {number} pullRequestId - Material pull request ID
 * @returns {Promise<Object>} Material pull request details with items
 */
export async function getMaterialPullRequest(pullRequestId) {
    try {
        const url = `${WAREHOUSE_BASE_URL}/pull-requests/${pullRequestId}/`;

        const response = await authedFetch(url);

        if (!response.ok) {
            let errorMessage = 'Malzeme çekme talebi yüklenirken hata oluştu';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching material pull request:', error);
        throw error;
    }
}

/**
 * Mark a material pull request as transferred (warehouse staff only)
 * @param {number} pullRequestId - Material pull request ID
 * @returns {Promise<Object>} Updated material pull request details
 */
export async function markMaterialPullRequestTransferred(pullRequestId) {
    try {
        const response = await authedFetch(`${WAREHOUSE_BASE_URL}/pull-requests/${pullRequestId}/mark_transferred/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            let errorMessage = 'Talep teslim edildi olarak işaretlenirken hata oluştu';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Error marking material pull request as transferred:', error);
        throw error;
    }
}
