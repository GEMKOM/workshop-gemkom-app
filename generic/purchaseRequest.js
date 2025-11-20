import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

/**
 * Create a new department request
 */
export async function createDepartmentRequest(requestData) {
    try {
        const response = await authedFetch(`${backendBase}/planning/department-requests/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Talep oluşturulurken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating department request:', error);
        throw error;
    }
}

/**
 * Get all department requests for the current user
 */
export async function getDepartmentRequests(filters = {}) {
    try {
        // Build query parameters
        const queryParams = new URLSearchParams();

        // Add filters if provided
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.append(key, value);
            }
        });

        const url = `${backendBase}/planning/department-requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await authedFetch(url);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Talepler yüklenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching department requests:', error);
        throw error;
    }
}

export async function getMyDepartmentRequests(filters = {}) {
    try {
        // Build query parameters
        const queryParams = new URLSearchParams();

        // Set default status filter to 'submitted' (onay bekliyor) if not explicitly provided
        // If status is explicitly set to empty string, don't apply default
        const defaultFilters = {
            ...filters
        };
        
        // Only apply default status if status is not in filters at all (not even as empty string)
        if (!('status' in filters)) {
            defaultFilters.status = 'submitted';
        }

        // Add filters if provided
        Object.entries(defaultFilters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.append(key, value);
            }
        });

        const url = `${backendBase}/planning/department-requests/my_requests/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const response = await authedFetch(url);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Taleplerim y�klenirken hata olu_tu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching my department requests:', error);
        throw error;
    }
}

/**
 * Get a single department request by ID
 */
export async function getDepartmentRequest(requestId) {
    try {
        const response = await authedFetch(`${backendBase}/planning/department-requests/${requestId}/`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Talep yüklenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching department request:', error);
        throw error;
    }
}

/**
 * Submit a department request for approval
 */
export async function submitDepartmentRequest(requestId) {
    try {
        const response = await authedFetch(`${backendBase}/planning/department-requests/${requestId}/submit/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Talep gönderilirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error submitting department request:', error);
        throw error;
    }
}

/**
 * Update a department request
 */
export async function updateDepartmentRequest(requestId, requestData) {
    try {
        const response = await authedFetch(`${backendBase}/planning/department-requests/${requestId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Talep güncellenirken hata oluştu');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating department request:', error);
        throw error;
    }
}

/**
 * Delete a department request
 */
export async function deleteDepartmentRequest(requestId) {
    try {
        const response = await authedFetch(`${backendBase}/planning/department-requests/${requestId}/`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || errorData.error || 'Talep silinirken hata oluştu');
        }

        return true;
    } catch (error) {
        console.error('Error deleting department request:', error);
        throw error;
    }
}
