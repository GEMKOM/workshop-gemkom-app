import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { reasonCommentOptional, timerTaskPath } from '@/api/machining';
import { resetServerTime } from '@/api/time';
import { renderApp, signIn } from '@/test/render';
import { formatDuration } from '@/ui/FinishedTimers';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

type Call = { url: URL; init: RequestInit; body: unknown };

function serve(handler: (call: Call) => Response | undefined) {
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
      if (call.url.pathname === '/now/') return Promise.resolve(json({ now: Date.now() }));
      return Promise.resolve(handler(call) ?? json({ results: [] }));
    }),
  );
  return calls;
}

const REASONS = [
  { id: 1, name: 'Yemek Molası', code: 'LUNCH', creates_timer: true },
  { id: 2, name: 'Malzeme Bekleme', code: 'MATERIAL', creates_timer: true },
  { id: 3, name: 'Kayıt dışı', code: 'X', creates_timer: false },
];

const OPERATION = {
  key: 'OP-17',
  part_task_key: 'TI-203',
  part_name: 'Flanş',
  part_key: 'P-9',
  plan_order: 2,
  order: 2,
  part_job_no: '254-01',
  part_image_no: 'R-11',
  part_quantity: 4,
  due_date: '2026-11-28',
  projected_late: true,
};

const MACHINES = [
  { id: 4, name: 'Mazak Torna' },
  { id: 5, name: 'Okuma Freze', has_active_timer: true },
  { id: 6, name: 'Doosan', is_under_maintenance: true },
];

const perms = { access_machining: true, access_machining_tasks: true };

beforeEach(() => {
  localStorage.clear();
  resetServerTime();
});
afterEach(() => vi.unstubAllGlobals());

describe('machining rules', () => {
  it('needs a comment except for lunch and short breaks', () => {
    expect(reasonCommentOptional({ code: 'LUNCH', name: '' })).toBe(true);
    expect(reasonCommentOptional({ code: '', name: 'Kısa mola' })).toBe(true);
    expect(reasonCommentOptional({ code: 'MATERIAL', name: 'Malzeme' })).toBe(false);
  });

  it('links a started timer to its page and formats durations as before', () => {
    expect(
      timerTaskPath('machining', { id: 9, start_time: 0, machine_fk: 4, timer_type: 'break' }),
    ).toBe('/machining/tasks/?machine_id=4&timer_id=9');
    expect(formatDuration(1.42)).toBe('1s 25dk');
    expect(formatDuration(0.75)).toBe('45dk');
    expect(formatDuration(0)).toBe('0dk');
  });
});

describe('machining list', () => {
  it('picks a machine (busy and maintenance ones disabled) and lists its operations', async () => {
    const calls = serve(({ url }) => {
      if (url.pathname === '/machines/dropdown/') return json(MACHINES);
      if (url.pathname === '/tasks/operations/') return json({ results: [OPERATION] });
      if (url.pathname === '/tasks/downtime-reasons/') return json(REASONS);
      return undefined;
    });
    signIn({ permissions: perms });
    const { router } = renderApp('/machining/');
    const select = await screen.findByLabelText(/Makine/);
    await waitFor(() =>
      expect(within(select).getByText('Okuma Freze (Kullanımda)')).toBeDisabled(),
    );
    expect(within(select).getByText('Doosan (Bakımda)')).toBeDisabled();
    fireEvent.change(select, { target: { value: '4' } });
    await waitFor(() => expect(router.state.location.search).toBe('?machine_id=4'));
    const card = await screen.findByRole('link', { name: /TI-203 \(OP-17\)/ });
    expect(card).toHaveAttribute('href', '/machining/tasks/?machine_id=4&key=OP-17');
    const opCall = calls.find((c) => c.url.pathname === '/tasks/operations/')!;
    expect(Object.fromEntries(opCall.url.searchParams)).toEqual({
      view: 'operator',
      machine_fk: '4',
      completion_date__isnull: 'true',
      in_plan: 'true',
    });
  });

  it('logs a downtime reason and opens the timer it started', async () => {
    const calls = serve(({ url, init }) => {
      if (url.pathname === '/machines/dropdown/') return json(MACHINES);
      if (url.pathname === '/tasks/downtime-reasons/') return json(REASONS);
      if (url.pathname === '/tasks/log-reason/' && init.method === 'POST') {
        return json({ new_timer_id: 88, timer: { id: 88, machine_fk: 4, timer_type: 'downtime' } });
      }
      return undefined;
    });
    signIn({ permissions: perms });
    const { router } = renderApp('/machining/?machine_id=4');
    fireEvent.click(await screen.findByText('Durma Nedeni Kaydet'));
    const sheet = await screen.findByRole('dialog', { name: 'Durma Nedeni Kaydet' });
    expect(within(sheet).queryByText('Kayıt dışı')).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Malzeme Bekleme' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
    expect(await within(sheet).findByText('Lütfen açıklama giriniz.')).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText(/Açıklama/), { target: { value: 'Sac yok' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(router.state.location.search).toBe('?machine_id=4&timer_id=88'));
    expect(calls.find((c) => c.url.pathname === '/tasks/log-reason/')?.body).toEqual({
      reason_id: 2,
      machine_id: '4',
      comment: 'Sac yok',
    });
  });
});

describe('machining task', () => {
  function serveTask({
    machine = { id: 4, name: 'Mazak Torna' },
    timers = [] as unknown[],
  }: { machine?: Record<string, unknown>; timers?: unknown[] } = {}) {
    let current = timers;
    let busy = !!machine.has_active_timer;
    const calls = serve(({ url, init }) => {
      if (url.pathname === '/machines/4/') return json({ ...machine, has_active_timer: busy });
      if (url.pathname === '/machining/timers/') return json({ results: current });
      if (url.pathname === '/tasks/operations/OP-17/') return json(OPERATION);
      if (url.pathname === '/tasks/downtime-reasons/') return json(REASONS);
      if (url.pathname === '/tasks/operations/OP-17/start-timer/' && init.method === 'POST') {
        current = [
          { id: 50, start_time: Date.now() - 2000, timer_type: 'productive', issue_key: 'OP-17' },
        ];
        busy = true;
        return json({ timer_id: 50 });
      }
      if (url.pathname === '/tasks/log-reason/' && init.method === 'POST') {
        current = [];
        busy = false;
        return json({});
      }
      if (url.pathname === '/machining/timers/stop/' && init.method === 'POST') {
        current = [];
        busy = false;
        return json({});
      }
      return undefined;
    });
    return calls;
  }

  it('starts the operation, then stops it with a reason and goes back to the list', async () => {
    const calls = serveTask();
    signIn({ permissions: perms });
    const { router } = renderApp('/machining/tasks/?machine_id=4&key=OP-17');
    expect(await screen.findByText('TI-203 (OP-17)')).toBeInTheDocument();
    expect(screen.getByText('Geç')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));
    expect(await screen.findByText('Çalışıyor')).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.endsWith('/start-timer/'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Durdur' }));
    const sheet = await screen.findByRole('dialog', { name: 'Neden duruyorsunuz?' });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Yemek Molası' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/machining/'));
    expect(calls.find((c) => c.url.pathname === '/tasks/log-reason/')?.body).toEqual({
      current_timer_id: 50,
      reason_id: 1,
    });
  });

  it('stops a break timer directly; a timer the user may not stop has no button', async () => {
    const calls = serveTask({
      machine: { id: 4, name: 'Mazak Torna', has_active_timer: true },
      timers: [
        {
          id: 61,
          start_time: Date.now() - 60_000,
          timer_type: 'break',
          downtime_reason_name: 'Mola',
        },
      ],
    });
    signIn({ permissions: perms });
    renderApp('/machining/tasks/?machine_id=4&timer_id=61');
    expect(await screen.findByText('Mola', { selector: 'h2' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Durdur' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.pathname === '/machining/timers/stop/')?.body).toMatchObject({
        timer_id: 61,
        synced_to_jira: true,
      }),
    );
  });

  it('marks a timer that cannot be stopped by the user', async () => {
    serveTask({
      machine: { id: 4, name: 'Mazak Torna', has_active_timer: true },
      timers: [
        {
          id: 62,
          start_time: Date.now(),
          timer_type: 'fault',
          can_be_stopped_by_user: false,
          downtime_reason_name: 'Arıza',
        },
      ],
    });
    signIn({ permissions: perms });
    renderApp('/machining/tasks/?machine_id=4&timer_id=62');
    expect(await screen.findByRole('button', { name: 'Durdurulamaz' })).toBeDisabled();
  });

  it('a timer page whose timer no longer runs goes back to the list', async () => {
    serveTask({ timers: [] });
    signIn({ permissions: perms });
    const { router } = renderApp('/machining/tasks/?machine_id=4&timer_id=99');
    await waitFor(() => expect(router.state.location.pathname).toBe('/machining/'));
  });

  it('a machine under maintenance or busy elsewhere cannot start', async () => {
    serveTask({ machine: { id: 4, name: 'Mazak Torna', is_under_maintenance: true } });
    signIn({ permissions: perms });
    renderApp('/machining/tasks/?machine_id=4&key=OP-17');
    expect(await screen.findByRole('button', { name: 'Makine bakımda' })).toBeDisabled();
  });
});
