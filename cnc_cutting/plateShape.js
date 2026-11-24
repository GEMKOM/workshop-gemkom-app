// --- plateShape.js ---
// A plate sheet's shape. width_mm × length_mm is always its bounding box:
// a rectangle's en × boy, a triangle's taban × yükseklik, a circle's çap
// (both), an irregular sheet's box plus its estimated area (area_m2), which
// its weight comes from. No DOM here, so it can be tried in node.

export const SHAPES = ['rectangle', 'triangle', 'circle', 'irregular'];

export const SHAPE_LABELS = {
    rectangle: 'Dikdörtgen',
    triangle: 'Üçgen',
    circle: 'Daire',
    irregular: 'Şekilsiz',
};

// Sheets from before shapes existed have none: they are rectangles.
export function normalizeShape(shape) {
    return SHAPES.includes(shape) ? shape : 'rectangle';
}

export function shapeLabel(shape) {
    return SHAPE_LABELS[normalizeShape(shape)];
}

/** The inputs a remnant row asks for, per shape (label + name used in messages). */
export function shapeFields(shape) {
    switch (normalizeShape(shape)) {
        case 'triangle':
            return [
                { field: 'width', label: 'Taban (mm)', name: 'taban' },
                { field: 'length', label: 'Yükseklik (mm)', name: 'yükseklik' },
            ];
        case 'circle':
            return [{ field: 'width', label: 'Çap (mm)', name: 'çap' }];
        case 'irregular':
            return [
                { field: 'width', label: 'En (mm)', name: 'en' },
                { field: 'length', label: 'Boy (mm)', name: 'boy' },
                { field: 'area', label: 'Tahmini alan (m²)', name: 'tahmini alan' },
            ];
        default:
            return [
                { field: 'width', label: 'En (mm)', name: 'en' },
                { field: 'length', label: 'Boy (mm)', name: 'boy' },
            ];
    }
}

/** A number in Turkish style ("600", "600,5", "0,45"); '' when not a number. */
export function formatNumber(value, maxDecimals = 1) {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    const factor = 10 ** maxDecimals;
    const rounded = Math.round(n * factor) / factor;
    return String(rounded).replace('.', ',');
}

/**
 * A sheet's size with its shape: "600 × 1200 mm", "Ø 600 mm",
 * "Üçgen 600 × 800 mm", "Şekilsiz 800 × 900 mm · ~0,45 m²".
 * @param {{shape?: string, width_mm: any, length_mm: any, area_m2?: any}} piece
 * @param {{withArea?: boolean}} [options] withArea false leaves out a şekilsiz sheet's area
 */
export function sizeText(piece, { withArea = true } = {}) {
    const shape = normalizeShape(piece?.shape);
    const w = formatNumber(piece?.width_mm);
    const l = formatNumber(piece?.length_mm);
    if (shape === 'circle') return `Ø ${w || l} mm`;
    const box = w ? `${w} × ${l} mm` : `${l} mm`;
    if (shape === 'triangle') return `Üçgen ${box}`;
    if (shape === 'irregular') {
        const area = withArea ? formatNumber(piece?.area_m2, 2) : '';
        return area ? `Şekilsiz ${box} · ~${area} m²` : `Şekilsiz ${box}`;
    }
    return box;
}

/** The bounding box's area in m². */
export function boxAreaM2(widthMm, lengthMm) {
    return (widthMm * lengthMm) / 1e6;
}

/** The short side a remnant is judged by (a circle's is its diameter). */
export function shortSideMm(shape, widthMm, lengthMm) {
    return normalizeShape(shape) === 'circle' ? widthMm : Math.min(widthMm, lengthMm);
}

/** A typed number (a comma is the decimal point), rounded; NaN when blank or not a number. */
export function parseDecimal(value, decimals) {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!text) return NaN;
    const n = Number(text);
    if (!Number.isFinite(n)) return NaN;
    const factor = 10 ** decimals;
    return Math.round(n * factor) / factor;
}

function joinTr(names) {
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} ve ${names[names.length - 1]}`;
}

/**
 * Reads one remnant row as typed and checks it.
 * @param {{shape: string, width: string, length: string, area: string, quantity: string}} input raw input values
 * @param {number} rowNumber 1-based, for the messages
 * @returns {{empty: true} | {error: string} | {remnant: object, shortSide: number}}
 *   remnant in the mark-completed shape: {width_mm, length_mm, quantity, shape, area_m2?}
 */
export function buildRemnant(input, rowNumber) {
    const shape = normalizeShape(input.shape);
    const fields = shapeFields(shape);
    const values = {};
    for (const f of fields) {
        values[f.field] = parseDecimal(input[f.field], f.field === 'area' ? 4 : 1);
    }
    const blank = fields.filter((f) => !String(input[f.field] ?? '').trim());
    if (blank.length === fields.length) return { empty: true };

    const prefix = `${rowNumber}. satır:`;
    const missing = fields.filter((f) => Number.isNaN(values[f.field]));
    if (missing.length) return { error: `${prefix} ${joinTr(missing.map((f) => f.name))} girin.` };
    const notPositive = fields.filter((f) => !(values[f.field] > 0));
    if (notPositive.length) {
        return { error: `${prefix} ${joinTr(notPositive.map((f) => f.name))} 0'dan büyük olmalı.` };
    }
    const quantity = Number(String(input.quantity ?? '').trim());
    if (!Number.isInteger(quantity) || quantity < 1) {
        return { error: `${prefix} adet en az 1 olan bir tam sayı olmalı.` };
    }

    const width = values.width;
    const length = shape === 'circle' ? width : values.length;
    const remnant = { width_mm: width.toFixed(1), length_mm: length.toFixed(1), quantity, shape };
    if (shape === 'irregular') {
        const box = boxAreaM2(width, length);
        // A little slack for the box's own rounding (to 0.0001 m²).
        if (values.area > box + 0.00005) {
            return {
                error: `${prefix} tahmini alan (${formatNumber(values.area, 4)} m²) en × boy alanından `
                    + `(${formatNumber(box, 4)} m²) büyük olamaz.`,
            };
        }
        remnant.area_m2 = values.area.toFixed(4);
    }
    return { remnant, shortSide: shortSideMm(shape, width, length) };
}

/**
 * The sheet code a search looks for, if it is one: "S26-00012", "s26 12",
 * "S2600012" all give "S26-00012"; null otherwise.
 */
export function sheetCodeFromSearch(text) {
    const s = String(text ?? '').trim();
    let m = s.match(/^s\s*(\d{2})\s*[-\s]\s*(\d{1,5})$/i);
    if (!m) m = s.match(/^s(\d{2})(\d{5})$/i);
    return m ? `S${m[1]}-${m[2].padStart(5, '0')}` : null;
}
