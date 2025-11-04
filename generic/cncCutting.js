import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

/**
 * Create a new remnant plate
 * @param {Object} remnantData - Remnant plate data
 * @param {string} remnantData.thickness_mm - Thickness in mm
 * @param {string} remnantData.dimensions - Dimensions (e.g., "1200x800")
 * @param {number} remnantData.quantity - Quantity
 * @param {string} remnantData.material - Material type
 * @param {string|null} remnantData.assigned_to - Assigned user (optional)
 * @returns {Promise<Object>} Created remnant plate
 */
export async function createRemnantPlate(remnantData) {
    try {
        const response = await authedFetch(`${backendBase}/cnc_cutting/remnants/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(remnantData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to create remnant plate: ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error creating remnant plate:', error);
        throw error;
    }
}