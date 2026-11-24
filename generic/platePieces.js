import { backendBase } from "../base.js";
import { authedFetch } from "../authService.js";

/**
 * Plate stock (Sac Stoğu), grouped by stock card + size + shape: one group per
 * card, size and shape, with its sheets (each with its own code, e.g. S26-00012).
 * @param {{page?: number, page_size?: number, search?: string}} params
 *   search matches a sheet code (S26-00012, "s26 12"), card code / name, a size
 *   (1500x3000), heat no, thickness ("10 mm"), place…
 * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
 *   count = the number of groups; each result: {key, item, item_code, width_mm, length_mm, shape, lots, quantity, pieces}
 *   (groups are per card + size + shape; shape is missing before the backend had shapes: a rectangle)
 */
export async function getPlateGroups({ page = 1, page_size = 50, search = '' } = {}) {
    const query = new URLSearchParams({ kind: 'plate', page: String(page), page_size: String(page_size) });
    if (search) query.set('search', search);
    const response = await authedFetch(`${backendBase}/warehouse/pieces/groups/?${query.toString()}`);
    if (!response.ok) {
        let message = '';
        try {
            const data = await response.json();
            message = data?.detail || '';
        } catch (e) {
            message = '';
        }
        const error = new Error(message || `Sac stoğu yüklenemedi (${response.status}).`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}
