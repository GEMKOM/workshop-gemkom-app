// Plate shapes and sizes, ported from the legacy cnc_cutting/plateShape.js
// (the Sac Stoğu tab and the remnants entered when a cut is finished).

export const SHAPES = ['rectangle', 'triangle', 'circle', 'irregular'] as const;
export type Shape = (typeof SHAPES)[number];

export const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: 'Dikdörtgen',
  triangle: 'Üçgen',
  circle: 'Daire',
  irregular: 'Şekilsiz',
};

export function normalizeShape(shape: unknown): Shape {
  return (SHAPES as readonly string[]).includes(String(shape)) ? (shape as Shape) : 'rectangle';
}

export function shapeLabel(shape: unknown): string {
  return SHAPE_LABELS[normalizeShape(shape)];
}

export type ShapeField = 'width' | 'length' | 'area';

/** The inputs a remnant row asks for, per shape (label + the name used in messages). */
export function shapeFields(shape: unknown): { field: ShapeField; label: string; name: string }[] {
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
export function formatNumber(value: unknown, maxDecimals = 1): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const factor = 10 ** maxDecimals;
  return String(Math.round(n * factor) / factor).replace('.', ',');
}

export interface SizedPiece {
  shape?: unknown;
  width_mm?: unknown;
  length_mm?: unknown;
  area_m2?: unknown;
}

/**
 * A sheet's size with its shape: "600 × 1200 mm", "Ø 600 mm",
 * "Üçgen 600 × 800 mm", "Şekilsiz 800 × 900 mm · ~0,45 m²".
 */
export function sizeText(piece: SizedPiece, { withArea = true } = {}): string {
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

export function boxAreaM2(widthMm: number, lengthMm: number): number {
  return (widthMm * lengthMm) / 1e6;
}

/** The short side a remnant is judged by (a circle's is its diameter). */
export function shortSideMm(shape: unknown, widthMm: number, lengthMm: number): number {
  return normalizeShape(shape) === 'circle' ? widthMm : Math.min(widthMm, lengthMm);
}

/** A typed number (a comma is the decimal point), rounded; NaN when blank or not a number. */
export function parseDecimal(value: unknown, decimals: number): number {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!text) return NaN;
  const n = Number(text);
  if (!Number.isFinite(n)) return NaN;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function joinTr(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ve ${names[names.length - 1]}`;
}

export interface RemnantInput {
  shape: string;
  width: string;
  length: string;
  area: string;
  quantity: string;
}

export interface Remnant {
  width_mm: string;
  length_mm: string;
  quantity: number;
  shape: Shape;
  area_m2?: string;
}

/** Reads one remnant row as typed and checks it (rowNumber is 1-based, for the messages). */
export function buildRemnant(
  input: RemnantInput,
  rowNumber: number,
): { empty: true } | { error: string } | { remnant: Remnant; shortSide: number } {
  const shape = normalizeShape(input.shape);
  const fields = shapeFields(shape);
  const values: Partial<Record<ShapeField, number>> = {};
  for (const f of fields)
    values[f.field] = parseDecimal(input[f.field], f.field === 'area' ? 4 : 1);
  const blank = fields.filter((f) => !String(input[f.field] ?? '').trim());
  if (blank.length === fields.length) return { empty: true };
  const prefix = `${rowNumber}. satır:`;
  const missing = fields.filter((f) => Number.isNaN(values[f.field]));
  if (missing.length) return { error: `${prefix} ${joinTr(missing.map((f) => f.name))} girin.` };
  const notPositive = fields.filter((f) => !((values[f.field] ?? 0) > 0));
  if (notPositive.length) {
    return { error: `${prefix} ${joinTr(notPositive.map((f) => f.name))} 0'dan büyük olmalı.` };
  }
  const quantity = Number(String(input.quantity ?? '').trim());
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: `${prefix} adet en az 1 olan bir tam sayı olmalı.` };
  }
  const width = values.width as number;
  const length = shape === 'circle' ? width : (values.length as number);
  const remnant: Remnant = {
    width_mm: width.toFixed(1),
    length_mm: length.toFixed(1),
    quantity,
    shape,
  };
  if (shape === 'irregular') {
    const box = boxAreaM2(width, length);
    const area = values.area as number;
    if (area > box + 0.00005) {
      return {
        error:
          `${prefix} tahmini alan (${formatNumber(area, 4)} m²) en × boy alanından ` +
          `(${formatNumber(box, 4)} m²) büyük olamaz.`,
      };
    }
    remnant.area_m2 = area.toFixed(4);
  }
  return { remnant, shortSide: shortSideMm(shape, width, length) };
}

/** The sheet code a search looks for: "S26-00012", "s26 12", "S2600012" → "S26-00012"; else null. */
export function sheetCodeFromSearch(text: unknown): string | null {
  const s = String(text ?? '').trim();
  let m = s.match(/^s\s*(\d{2})\s*[-\s]\s*(\d{1,5})$/i);
  if (!m) m = s.match(/^s(\d{2})(\d{5})$/i);
  return m ? `S${m[1]}-${(m[2] ?? '').padStart(5, '0')}` : null;
}
