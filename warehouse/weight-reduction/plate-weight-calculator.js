/**
 * Calculate plate weight based on dimensions, thickness, and density
 * 
 * @param {number} width - Width in mm
 * @param {number} length - Length in mm
 * @param {number} thickness - Thickness in mm
 * @param {number} density - Density in g/cm³ (default: 7.88)
 * @returns {number} Weight in kg
 * 
 * @example
 * // Calculate weight for 300x550mm plate, 15mm thick, density 7.88
 * const weight = calculatePlateWeight(300, 550, 15.00, 7.88);
 * // Returns: 19.503
 */
export function calculatePlateWeight(width, length, thickness, density = 7.88) {
    // Validate inputs
    if (typeof width !== 'number' || typeof length !== 'number' || 
        typeof thickness !== 'number' || typeof density !== 'number') {
        throw new Error('All parameters must be numbers');
    }
    
    if (width <= 0 || length <= 0 || thickness <= 0 || density <= 0) {
        throw new Error('All values must be positive');
    }
    
    // Formula: width (mm) * length (mm) * thickness (mm) * density (g/cm³)
    // Convert mm³ to cm³: divide by 1000
    // Convert g to kg: divide by 1000
    // So: (width * length * thickness * density) / 1,000,000
    const weightKg = (width * length * thickness * density) / 1000000;
    
    return weightKg;
}

