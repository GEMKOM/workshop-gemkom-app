import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { formatElapsed, resetServerTime } from '@/api/time';
import { fetchActiveTimers, timerLabel, timerPath, type ActiveTimer } from '@/api/timers';
import { renderApp, signIn } from '@/test/render';
import { stoppedTimerRedirect } from './TimerBubble';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const t = (timer: Partial<ActiveTimer>): ActiveTimer =>
  ({ id: 1, module: 'machining', start_time: 0, ...timer }) as ActiveTimer;

function serveTimers({
  machining = [],
  cnc = [],
  faults = [],
  now = Date.now(),
}: {
  machining?: unknown[];
  cnc?: unknown[];
  faults?: unknown[];
  now?: number;
}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/machining/timers/') return Promise.resolve(json({ results: machining }));
    if (url.pathname === '/cnc_cutting/timers/') return Promise.resolve(json({ results: cnc }));
    if (url.pathname === '/machines/faults/timers/') return Promise.resolve(json(faults));
    if (url.pathname === '/now/') return Promise.resolve(json({ now }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  resetServerTime();
});
afterEach(() => vi.unstubAllGlobals());

describe('timer helpers', () => {
  it('links each timer to its page as the legacy widget did', () => {
    expect(timerPath(t({ machine_fk: 4, timer_type: 'productive', issue_key: 'OP-9' }))).toBe(
      '/machining/tasks/?machine_id=4&key=OP-9',
    );
    expect(
      timerPath(
        t({
          module: 'cnc_cutting',
          machine_fk: 7,
          timer_type: 'productive',
          issue_key: 'W-07',
          issue_is_hold_task: true,
        }),
      ),
    ).toBe('/cnc_cutting/tasks/?machine_id=7&key=W-07&hold=1');
    expect(timerPath(t({ id: 55, machine_fk: 4, timer_type: 'break' }))).toBe(
      '/machining/tasks/?machine_id=4&timer_id=55',
    );
    expect(timerPath(t({ module: 'maintenance_fault', task_key: 12 }))).toBe(
      '/maintenance/faults/task/?fault_id=12',
    );
  });

  it('names timers by kesim kodu, downtime reason or fault', () => {
    expect(timerLabel(t({ module: 'cnc_cutting', nesting_id: 'E8338', issue_key: 'CNC-1' }))).toBe(
      'E8338',
    );
    expect(timerLabel(t({ timer_type: 'break', downtime_reason_name: 'Mola' }))).toBe('Mola');
    expect(timerLabel(t({ module: 'maintenance_fault', task_key: 12 }))).toBe('ARIZA-12');
    expect(timerLabel(t({ id: 3 }))).toBe('Timer 3');
  });

  it('loads the three kinds, drops finished and resolved ones, and de-duplicates', async () => {
    serveTimers({
      machining: [
        { id: 1, start_time: 1 },
        { id: 2, start_time: 1, finish_time: 5 },
      ],
      cnc: [
        { id: 1, start_time: 1 },
        { id: 3, start_time: 1 },
      ],
      faults: [
        { id: 4, start_time: 1 },
        { id: 5, start_time: 1, fault_is_resolved: true },
      ],
    });
    localStorage.setItem('access', 'a');
    localStorage.setItem('refresh', 'r');
    const timers = await fetchActiveTimers();
    expect(timers.map((x) => `${x.module}:${x.id}`)).toEqual([
      'machining:1',
      'cnc_cutting:3',
      'maintenance_fault:4',
    ]);
  });

  it('closes a task page whose timer no longer runs', () => {
    const running = [t({ id: 55 })];
    expect(
      stoppedTimerRedirect('/machining/tasks/', '?machine_id=4&timer_id=55', running),
    ).toBeNull();
    expect(stoppedTimerRedirect('/machining/tasks/', '?machine_id=4&timer_id=56', running)).toBe(
      '/machining/',
    );
    expect(stoppedTimerRedirect('/cnc_cutting/tasks', '?timer_id=9', [])).toBe('/cnc_cutting/');
    // Task pages opened by key (no timer yet) stay.
    expect(stoppedTimerRedirect('/machining/tasks/', '?machine_id=4&key=OP-1', [])).toBeNull();
  });

  it('formats elapsed time as HH:MM:SS', () => {
    expect(formatElapsed(3725)).toBe('01:02:05');
    expect(formatElapsed(-4)).toBe('00:00:00');
  });
});

describe('timer bubble', () => {
  it('shows the running timers with server-time elapsed and links to their pages', async () => {
    const serverNow = Date.now() + 60 * 60 * 1000; // the phone's clock is an hour behind
    serveTimers({
      cnc: [
        {
          id: 9,
          start_time: serverNow - 90 * 1000,
          machine_fk: 7,
          machine_name: 'Fiber Lazer',
          timer_type: 'productive',
          issue_key: 'CNC-2278',
          nesting_id: 'E8338',
        },
      ],
      now: serverNow,
    });
    signIn({ permissions: { access_cnc_cutting: true } });
    renderApp('/');
    const bubble = await screen.findByRole('button', { name: 'Aktif zamanlayıcılar (1)' });
    // Let the clock sync land before opening.
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith('/now/'))).toBe(true),
    );
    await act(async () => {});
    fireEvent.pointerDown(bubble, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(bubble, { clientX: 10, clientY: 10, pointerId: 1 });

    const sheet = await screen.findByRole('dialog', { name: 'Aktif Zamanlayıcılar' });
    const row = within(sheet).getByRole('link', { name: /E8338/ });
    expect(row).toHaveAttribute('href', '/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    expect(row).toHaveTextContent('Fiber Lazer');
    expect(row.textContent).toMatch(/00:01:3\d/);
    expect(within(sheet).getByRole('link', { name: 'Yeni Zamanlayıcı' })).toHaveAttribute(
      'href',
      '/cnc_cutting/',
    );
  });

  it('a drag moves the bubble without opening the list', async () => {
    serveTimers({});
    signIn({ permissions: { access_machining: true } });
    renderApp('/');
    const bubble = await screen.findByRole('button', { name: /Aktif zamanlayıcılar/ });
    fireEvent.pointerDown(bubble, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(bubble, { clientX: 60, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(bubble, { clientX: 60, clientY: 40, pointerId: 1 });
    expect(screen.queryByRole('dialog', { name: 'Aktif Zamanlayıcılar' })).not.toBeInTheDocument();
  });

  it('is not shown without a timer area permission', async () => {
    serveTimers({});
    signIn({ permissions: { access_welding_timesheet: true } });
    renderApp('/');
    await screen.findByText('Kaynak Puantaj');
    expect(screen.queryByRole('button', { name: /Aktif zamanlayıcılar/ })).not.toBeInTheDocument();
  });

  it('reloads the timers and re-syncs the clock when the phone wakes', async () => {
    const fetchMock = serveTimers({});
    signIn({ permissions: { access_machining: true } });
    renderApp('/');
    await screen.findByRole('button', { name: /Aktif zamanlayıcılar/ });
    const count = (path: string) =>
      fetchMock.mock.calls.filter(([u]) => new URL(String(u)).pathname === path).length;
    const before = count('/machining/timers/');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(count('/machining/timers/')).toBeGreaterThan(before));
    expect(count('/now/')).toBeGreaterThan(0);
  });
});
