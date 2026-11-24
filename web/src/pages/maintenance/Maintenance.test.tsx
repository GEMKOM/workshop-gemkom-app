import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { activeFaultTimer, maintenanceRequestBody } from '@/api/maintenance';
import { resetServerTime } from '@/api/time';
import { renderApp, signIn } from '@/test/render';

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
      return Promise.resolve(handler(call) ?? json({ results: [] }));
    }),
  );
  return calls;
}

const FAULTS = [
  {
    id: 12,
    machine_name: 'Mazak Torna',
    description: 'Hidrolik kaçak',
    is_breaking: true,
    reported_at: '2026-11-24T07:30:00Z',
  },
  { id: 13, asset_name: 'Kompresör', description: 'Ses yapıyor', is_maintenance: true },
];

beforeEach(() => {
  localStorage.clear();
  resetServerTime();
});
afterEach(() => vi.unstubAllGlobals());

describe('maintenance request payload', () => {
  it('matches the legacy page', () => {
    expect(
      maintenanceRequestBody({ kind: 'fault', description: 'X', operable: false, machineId: 4 }),
    ).toEqual({ is_maintenance: false, description: 'X', is_breaking: true, machine: 4 });
    expect(
      maintenanceRequestBody({
        kind: 'maintenance',
        description: 'Y',
        operable: false,
        custom: { assetName: 'Vinç', location: 'Hol 2' },
      }),
    ).toEqual({
      is_maintenance: true,
      description: 'Y',
      is_breaking: false,
      asset_name: 'Vinç',
      location: 'Hol 2',
    });
  });

  it('finds the running fault timer by flag or by a missing finish time', () => {
    expect(
      activeFaultTimer([
        { id: 1, finish_time: 5 },
        { id: 2, is_active: true },
      ])?.id,
    ).toBe(2);
    expect(activeFaultTimer([{ id: 1, finish_time: 5 }, { id: 3 }])?.id).toBe(3);
    expect(activeFaultTimer([{ id: 1, end_time: 5 }])).toBeNull();
  });
});

describe('maintenance tabs', () => {
  it('hides the open-requests tab without the list permission', async () => {
    serve(() => undefined);
    signIn({ permissions: { access_maintenance: true } });
    // (Opening ?tab=fault-requests itself is refused by the route guard, as before.)
    renderApp('/maintenance/');
    expect(await screen.findByText('Yeni Talep')).toBeInTheDocument();
    expect(screen.getByText('Çözülen')).toBeInTheDocument();
    expect(screen.queryByText('Açık Talepler')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talep Oluştur' })).toBeInTheDocument();
  });

  it('lists open faults with a search, linking to their timer page', async () => {
    serve(({ url }) =>
      url.pathname === '/machines/faults/' && url.searchParams.get('unresolved') === 'true'
        ? json({ results: FAULTS })
        : undefined,
    );
    signIn({ permissions: { access_maintenance: true, access_maintenance_list: true } });
    renderApp('/maintenance/?tab=fault-requests');
    const card = await screen.findByRole('link', { name: /Mazak Torna/ });
    expect(card).toHaveAttribute('href', '/maintenance/faults/task/?fault_id=12');
    expect(card).toHaveTextContent('Makine duruşta');
    fireEvent.change(screen.getByLabelText('Ara'), { target: { value: 'kompresör' } });
    expect(screen.queryByText('Mazak Torna')).not.toBeInTheDocument();
    expect(screen.getByText('Kompresör')).toBeInTheDocument();
  });
});

describe('create maintenance request', () => {
  it('picks a machine, asks for the type, then creates a fault', async () => {
    const calls = serve(({ url, init }) => {
      if (url.pathname === '/machines/' && url.searchParams.get('exclude_used_in') === 'it') {
        return json({
          results: [
            { id: 4, name: 'Mazak Torna', code: 'M-04', assigned_users: [{ username: 'ali' }] },
            { id: 5, name: 'Okuma Freze', code: 'M-05' },
          ],
        });
      }
      if (url.pathname === '/machines/faults/' && init.method === 'POST') return json({ id: 20 });
      return undefined;
    });
    signIn({ permissions: { access_maintenance: true, access_maintenance_list: true } });
    const { router } = renderApp('/maintenance/');
    fireEvent.click(await screen.findByRole('button', { name: 'Makine Seç' }));
    fireEvent.change(await screen.findByLabelText('Makine ara'), { target: { value: 'ali' } });
    expect(screen.queryByText('Okuma Freze')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Mazak Torna'));

    fireEvent.change(screen.getByLabelText(/Detaylı Açıklama/), { target: { value: 'Kaçak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Talep Oluştur' }));
    expect(
      await screen.findByText('Lütfen talep türü ve açıklama alanlarını doldurun.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Arıza'));
    fireEvent.click(screen.getByLabelText('Makine çalışır durumda'));
    fireEvent.click(screen.getByRole('button', { name: 'Talep Oluştur' }));
    await waitFor(() => expect(router.state.location.search).toBe('?tab=fault-requests'));
    expect(calls.find((c) => c.init.method === 'POST')?.body).toEqual({
      is_maintenance: false,
      description: 'Kaçak',
      is_breaking: true,
      machine: 4,
    });
  });
});

describe('fault task', () => {
  function serveFault(timers: unknown[]) {
    let current = timers;
    const calls = serve(({ url, init }) => {
      if (url.pathname === '/machines/faults/12/') return json(FAULTS[0]);
      if (url.pathname === '/machines/faults/timers/') return json(current);
      if (url.pathname === '/now/') return json({ now: Date.now() });
      if (url.pathname === '/machines/faults/timers/start/' && init.method === 'POST') {
        current = [{ id: 77, start_time: Date.now() - 5000 }];
        return json({ id: 77 });
      }
      if (url.pathname === '/machines/faults/timers/stop/' && init.method === 'POST') {
        current = [];
        return json({});
      }
      if (url.pathname === '/machines/faults/12/complete/') return json({});
      return undefined;
    });
    return calls;
  }

  it('starts and stops the fault timer on server time', async () => {
    const calls = serveFault([]);
    signIn({ permissions: { access_maintenance: true } });
    renderApp('/maintenance/faults/task/?fault_id=12');
    expect(await screen.findByText('ARIZA-12')).toBeInTheDocument();
    expect(screen.getByText('Beklemede')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));
    expect(await screen.findByText('Çalışıyor')).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith('/start/'))?.body).toMatchObject({
      task_key: '12',
      task_type: 'machine_fault',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Durdur' }));
    expect(await screen.findByText('Beklemede')).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith('/stop/'))?.body).toMatchObject({
      timer_id: 77,
    });
  });

  it('asks before leaving while the timer runs', async () => {
    serveFault([{ id: 77, start_time: Date.now() - 60_000 }]);
    signIn({ permissions: { access_maintenance: true } });
    const { router } = renderApp('/maintenance/faults/task/?fault_id=12');
    expect(await screen.findByText('Çalışıyor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Ana Sayfa' }));
    expect(await screen.findByText('Sayfadan çıkılsın mı?')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/maintenance/faults/task/');
    fireEvent.click(screen.getByRole('button', { name: 'Çık' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('completes the fault with a resolution and goes back to the list', async () => {
    const calls = serveFault([]);
    signIn({ permissions: { access_maintenance: true, access_maintenance_list: true } });
    const { router } = renderApp('/maintenance/faults/task/?fault_id=12');
    fireEvent.click(await screen.findByRole('button', { name: 'Tamamla' }));
    const dialog = await screen.findByRole('dialog', { name: 'Arızayı Tamamla' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tamamla' }));
    expect(await within(dialog).findByText('Lütfen çözüm açıklaması girin.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Çözüm Açıklaması/), {
      target: { value: 'Conta değişti' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tamamla' }));
    await waitFor(() => expect(router.state.location.search).toBe('?tab=fault-requests'));
    expect(calls.find((c) => c.url.pathname.endsWith('/complete/'))?.body).toEqual({
      resolution_description: 'Conta değişti',
    });
  });
});
