import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TimesheetCell, TimesheetRow } from '@/api/welding';
import { renderApp, signIn } from '@/test/render';
import {
  cellLabel,
  dateLabel,
  formatHours,
  quickFill,
  toggleCell,
  totalHours,
} from './timesheetLogic';

// 10 day-shift cells (07:30–08 is half an hour) and 4 overtime hours.
const CELLS: TimesheetCell[] = [
  { start: '07:30', end: '08:00', hours: '0.5' },
  ...Array.from({ length: 9 }, (_, i) => ({
    start: `${String(8 + i).padStart(2, '0')}:00`,
    end: `${String(9 + i).padStart(2, '0')}:00`,
    hours: 1,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    start: `${17 + i}:00`,
    end: `${18 + i}:00`,
    hours: 1,
  })),
];

const empty = () => CELLS.map(() => false);
const row = (job_no: string, on: number[] = []): TimesheetRow => ({
  job_no,
  title: '',
  cells: CELLS.map((_, i) => on.includes(i)),
});

describe('timesheet grid rules', () => {
  it('moves an hour to the job that takes it', () => {
    const rows = toggleCell([row('293-11', [3]), row('1000')], '1000', 3);
    expect(rows[0]!.cells[3]).toBe(false);
    expect(rows[1]!.cells[3]).toBe(true);
    expect(toggleCell(rows, '1000', 3)[1]!.cells[3]).toBe(false);
  });

  it('quick fills skip hours other jobs hold', () => {
    const rows = quickFill([row('A', [2]), row('B')], 'B', 'day', CELLS.length);
    expect(rows[1]!.cells.slice(0, 10)).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(rows[1]!.cells.slice(10).some(Boolean)).toBe(false);
    const evening = quickFill(rows, 'B', 'evening', CELLS.length);
    expect(evening[1]!.cells.slice(10)).toEqual([true, true, true, true]);
    expect(quickFill(evening, 'B', 'clear', CELLS.length)[1]!.cells).toEqual(empty());
  });

  it('adds up half hours and labels cells as ranges', () => {
    expect(totalHours([row('A', [0, 1, 2])], CELLS)).toBe(2.5);
    expect(formatHours(2.5)).toBe('2,5 saat');
    expect(formatHours(8)).toBe('8 saat');
    expect(cellLabel(CELLS[0]!)).toBe('07:30–08');
    expect(cellLabel(CELLS[1]!)).toBe('08–09');
  });

  it('names today and yesterday', () => {
    const allowed = ['2026-11-24', '2026-11-23', '2026-11-22'];
    expect(dateLabel('2026-11-24', allowed)).toEqual({ main: 'Bugün', sub: '24.11 Sal' });
    expect(dateLabel('2026-11-23', allowed).main).toBe('Dün');
    expect(dateLabel('2026-11-22', allowed)).toEqual({ main: '22.11', sub: 'Paz' });
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const DAY = {
  date: '2026-11-24',
  allowed_dates: ['2026-11-24', '2026-11-23'],
  cells: CELLS,
  employee: { full_name: 'Mehmet Kaynakçı' },
  kind: 'weekday',
  submission: null,
  suggested_jobs: [
    { job_no: '293-11', title: 'Şase kaynağı', origin: 'team' },
    { job_no: '1000', title: '', origin: 'general' },
  ],
};

type Call = { url: URL; init: RequestInit; body: unknown };

function serve(day: unknown = DAY, handler?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const call = {
        url: new URL(String(input)),
        init,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const custom = handler?.(call);
      if (custom) return Promise.resolve(custom);
      if (call.url.pathname === '/welding/timesheets/mobile/day/')
        return Promise.resolve(json(day));
      return Promise.resolve(json({}));
    }),
  );
  return calls;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('timesheet page', () => {
  it('adds a job, taps hours and sends the day', async () => {
    const calls = serve(DAY, ({ url, init }) =>
      url.pathname === '/welding/timesheets/mobile/submit/' && init.method === 'POST'
        ? json({
            ...DAY,
            submission: {
              submitted_at: '2026-11-24T14:00:00Z',
              rows: [
                { job_no: '293-11', title: 'Şase kaynağı', cells: CELLS.map((_, i) => i < 10) },
              ],
            },
          })
        : undefined,
    );
    signIn({ permissions: { access_welding_timesheet: true } });
    renderApp('/welding/timesheet/');
    expect(await screen.findByText('Mehmet Kaynakçı')).toBeInTheDocument();
    // No timer bubble on the welding page.
    expect(screen.queryByRole('button', { name: /Aktif zamanlayıcılar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GÖNDER' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /293-11/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gündüz 07:30–17:00' }));
    expect(screen.getByText('9,5 saat', { selector: 'strong' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'GÖNDER' }));
    expect(await screen.findByRole('button', { name: 'TEKRAR GÖNDER' })).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(post.body).toEqual({
      date: '2026-11-24',
      blank_day: false,
      rows: [{ job_no: '293-11', cells: CELLS.map((_, i) => i < 10) }],
      note: '',
    });
  });

  it('shows the hour taken by another job and moves it on tap', async () => {
    serve({
      ...DAY,
      submission: {
        rows: [
          { job_no: '293-11', title: 'Şase', cells: CELLS.map((_, i) => i === 4) },
          { job_no: '1000', title: '', cells: empty() },
        ],
      },
    });
    signIn({ permissions: { access_welding_timesheet: true } });
    renderApp('/welding/timesheet/');
    const general = await screen.findByRole('button', { name: '1000 11:00-12:00' });
    expect(general).toHaveTextContent('293-11');
    fireEvent.click(general);
    expect(general).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '293-11 11:00-12:00' })).toHaveTextContent('GENEL');
  });

  it('a locked (approved) day cannot be edited', async () => {
    serve({ ...DAY, locked: true, submission: { rows: [] } });
    signIn({ permissions: { access_welding_timesheet: true } });
    renderApp('/welding/timesheet/');
    expect(await screen.findByText(/Bu günün puantajı kayıtlara geçti/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ONAYLANDI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Bugün çalışmadım/ })).toBeDisabled();
  });

  it('asks before switching days with unsent changes', async () => {
    const calls = serve();
    signIn({ permissions: { access_welding_timesheet: true } });
    renderApp('/welding/timesheet/');
    fireEvent.click(await screen.findByRole('button', { name: /Bugün çalışmadım/ }));
    fireEvent.click(screen.getByRole('button', { name: /Dün/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Gün değiştirilsin mi?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değiştir' }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.searchParams.get('date') === '2026-11-23')).toBe(true),
    );
  });

  it('searches jobs after two characters', async () => {
    const calls = serve(DAY, ({ url }) =>
      url.pathname === '/welding/timesheets/mobile/jobs/'
        ? json({ results: [{ job_no: '304-01', title: 'Tank', closed: true }] })
        : undefined,
    );
    signIn({ permissions: { access_welding_timesheet: true } });
    renderApp('/welding/timesheet/');
    const input = await screen.findByLabelText('İş emri ara');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.change(input, { target: { value: '304' } });
    const hit = await screen.findByRole('button', { name: /304-01/ });
    expect(hit).toHaveTextContent('kapalı');
    expect(
      calls
        .filter((c) => c.url.pathname.endsWith('/jobs/'))
        .map((c) => c.url.searchParams.get('q')),
    ).toEqual(['304']);
  });
});
