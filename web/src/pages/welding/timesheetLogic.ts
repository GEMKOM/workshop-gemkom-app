import type { TimesheetCell, TimesheetRow } from '@/api/welding';

// The hour-grid rules of the legacy Kaynak Puantaj page (timesheet.js). The
// cell layout comes from the server (welding/timesheet_layout.py): the first
// REGULAR_CELLS are the day shift, the rest overtime.

export const REGULAR_CELLS = 10;
export const GENERAL_JOB = '1000';

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/** The job holding an hour, other than `exceptJob`. */
export function cellOwner(rows: TimesheetRow[], idx: number, exceptJob: string): string | null {
  return rows.find((r) => r.job_no !== exceptJob && r.cells[idx])?.job_no ?? null;
}

/** Tapping an hour: off if on; else on, taken from whichever job had it. */
export function toggleCell(rows: TimesheetRow[], jobNo: string, idx: number): TimesheetRow[] {
  const row = rows.find((r) => r.job_no === jobNo);
  if (!row) return rows;
  const turningOn = !row.cells[idx];
  return rows.map((r) => {
    if (r.job_no === jobNo) {
      const cells = [...r.cells];
      cells[idx] = turningOn;
      return { ...r, cells };
    }
    if (turningOn && r.cells[idx]) {
      const cells = [...r.cells];
      cells[idx] = false;
      return { ...r, cells };
    }
    return r;
  });
}

/** "Gündüz" (the day shift), "Akşam" (overtime) or clear; never takes another job's hours. */
export function quickFill(
  rows: TimesheetRow[],
  jobNo: string,
  kind: 'day' | 'evening' | 'clear',
  cellCount: number,
): TimesheetRow[] {
  return rows.map((r) => {
    if (r.job_no !== jobNo) return r;
    if (kind === 'clear') return { ...r, cells: r.cells.map(() => false) };
    const [from, to] = kind === 'day' ? [0, REGULAR_CELLS] : [REGULAR_CELLS, cellCount];
    const cells = [...r.cells];
    for (let i = from; i < to; i += 1) {
      if (!cellOwner(rows, i, jobNo)) cells[i] = true;
    }
    return { ...r, cells };
  });
}

export function rowHours(row: TimesheetRow, cells: TimesheetCell[]): number {
  return row.cells.reduce((sum, on, idx) => sum + (on ? Number(cells[idx]?.hours ?? 0) : 0), 0);
}

export function totalHours(rows: TimesheetRow[], cells: TimesheetCell[]): number {
  return rows.reduce((sum, row) => sum + rowHours(row, cells), 0);
}

/** "8 saat", "7,5 saat". */
export function formatHours(hours: number): string {
  const n = Number(hours) || 0;
  return `${Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')} saat`;
}

/** Each cell reads as a range ("08–09", "07:30–08"), never a single hour. */
export function cellLabel(cell: TimesheetCell): string {
  const short = (t: string) => (t.endsWith(':00') ? t.slice(0, 2) : t);
  return `${short(cell.start)}–${short(cell.end)}`;
}

/** Date chip text: "Bugün" / "Dün" for the first two allowed dates. */
export function dateLabel(iso: string, allowed: string[]): { main: string; sub: string } {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const name = DAY_NAMES[new Date(y, m - 1, d).getDay()] ?? '';
  const dm = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
  if (iso === allowed[0]) return { main: 'Bugün', sub: `${dm} ${name}` };
  if (iso === allowed[1]) return { main: 'Dün', sub: `${dm} ${name}` };
  return { main: dm, sub: name };
}

export const jobNumber = (jobNo: string) => (jobNo === GENERAL_JOB ? 'GENEL' : jobNo);
export const jobTitle = (jobNo: string, title?: string | null) =>
  jobNo === GENERAL_JOB ? 'İş emri dışı genel işler' : (title ?? '');
