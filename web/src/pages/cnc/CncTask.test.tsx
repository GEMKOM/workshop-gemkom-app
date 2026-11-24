import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { resetServerTime } from '@/api/time';
import { renderApp, signIn } from '@/test/render';
import { readRemnantRows, remnantCodes } from './RemnantSheets';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

type Call = { url: URL; init: RequestInit; body: unknown };

const TASK = {
  key: 'CNC-2278',
  nesting_id: 'E8338',
  material: 'ST37',
  dimensions: '1500x3000',
  thickness_mm: '10',
  parts: [
    { id: 1, job_no: '304-01', weight_kg: '2.5' },
    { id: 2, job_no: '304-02', weight_kg: '1.5' },
  ],
  files: [],
};

function serveTask({
  task = TASK as Record<string, unknown>,
  machine = { id: 7, name: 'Fiber Lazer' } as Record<string, unknown>,
  timers = [] as unknown[],
  finish = { booked: null } as unknown,
} = {}) {
  let current = timers;
  let busy = false;
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const call = { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      const post = init.method === 'POST';
      const reply = (b: unknown) => Promise.resolve(json(b));
      if (url.pathname === '/now/') return reply({ now: Date.now() });
      if (url.pathname === '/machines/7/')
        return reply({ ...machine, has_active_timer: busy || machine.has_active_timer });
      if (url.pathname === `/cnc_cutting/tasks/${String(task.key)}/`) return reply(task);
      if (url.pathname === '/cnc_cutting/timers/' && !post) return reply({ results: current });
      if (url.pathname === '/cnc_cutting/timers/start/' && post) {
        current = [{ id: 70, start_time: Date.now() - 3000, issue_key: task.key }];
        busy = true;
        return reply({ id: 70 });
      }
      if (url.pathname === '/cnc_cutting/timers/stop/' && post) {
        current = [];
        busy = false;
        return reply({});
      }
      if (url.pathname === '/cnc_cutting/manual-time/' && post) return reply({});
      if (url.pathname === '/cnc_cutting/tasks/mark-completed/' && post) return reply(finish);
      if (url.pathname === '/machines/faults/' && post) return reply({ id: 1 });
      return reply({ results: [] });
    }),
  );
  return calls;
}

const perms = { access_cnc_cutting: true, access_cnc_cutting_tasks: true };

beforeEach(() => {
  localStorage.clear();
  resetServerTime();
});
afterEach(() => vi.unstubAllGlobals());

describe('remnant helpers', () => {
  it('reads the rows, skipping empty ones and stopping at a problem', () => {
    const row = (r: Record<string, string>) => ({
      shape: 'rectangle',
      width: '',
      length: '',
      area: '',
      quantity: '1',
      ...r,
    });
    expect(readRemnantRows([row({}), row({ width: '600', length: '1200' })])).toEqual({
      remnants: [{ width_mm: '600.0', length_mm: '1200.0', quantity: 1, shape: 'rectangle' }],
      error: '',
    });
    expect(readRemnantRows([row({ width: '600' })]).error).toBe('1. satır: boy girin.');
  });

  it('lists the booked sheets that got a code', () => {
    expect(
      remnantCodes({
        remnants: [
          {
            item_code: '0100',
            width_mm: '600',
            length_mm: '1200',
            sheets: [{ code: 'S26-00101', heat_number: 'H-1' }, { code: null }],
          },
        ],
      }),
    ).toEqual([
      {
        code: 'S26-00101',
        item_code: '0100',
        item_name: undefined,
        size: '600 × 1200 mm',
        heat_number: 'H-1',
      },
    ]);
  });
});

describe('cnc task', () => {
  it('starts and stops a cut on server time', async () => {
    const calls = serveTask();
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    expect(await screen.findByRole('heading', { name: 'E8338' })).toBeInTheDocument();
    expect(screen.getByText(/2 parça · 4.00 kg · 2 iş emri/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));
    expect(await screen.findByText('Çalışıyor')).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname === '/cnc_cutting/timers/start/')?.body).toMatchObject({
      issue_key: 'CNC-2278',
      machine_fk: 7,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Durdur' }));
    expect(await screen.findByText('Beklemede')).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname === '/cnc_cutting/timers/stop/')?.body).toMatchObject({
      timer_id: 70,
      synced_to_jira: true,
    });
  });

  it('cannot start or finish while the sheets wait for Mal Kabul', async () => {
    serveTask({ task: { ...TASK, sheets_waiting: 2 } });
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    expect(await screen.findByText(/2 sac bekleniyor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sac bekleniyor' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Manuel' })).toBeDisabled();
  });

  it('finishes with remnants and shows their codes to write and print', async () => {
    const calls = serveTask({
      finish: {
        booked: {
          remnants: [
            {
              item_code: '0100',
              width_mm: '600',
              length_mm: '1200',
              sheets: [{ code: 'S26-00101', heat_number: 'H-1' }],
            },
          ],
        },
      },
    });
    signIn({ permissions: perms });
    const { router } = renderApp('/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    fireEvent.click(await screen.findByRole('button', { name: 'Tamamla' }));
    const confirm = await screen.findByRole('dialog', { name: 'Görevi Tamamla' });
    expect(within(confirm).getByText(/E8338 tamamen kesildi/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Evet' }));
    const sheet = await screen.findByRole('dialog', { name: 'Fire Sac Ölçüleri' });
    fireEvent.change(within(sheet).getByLabelText('En (mm)'), { target: { value: '600' } });
    fireEvent.change(within(sheet).getByLabelText('Boy (mm)'), { target: { value: '400' } });
    expect(within(sheet).getByText(/Kısa kenarı 500 mm'den kısa/)).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText('Boy (mm)'), { target: { value: '1200' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Görevi Tamamla' }));
    const codes = await screen.findByRole('dialog', { name: /Fire sac kodları/ });
    expect(within(codes).getByText('S26-00101')).toBeInTheDocument();
    expect(
      calls.find((c) => c.url.pathname === '/cnc_cutting/tasks/mark-completed/')?.body,
    ).toEqual({
      key: 'CNC-2278',
      remnants: [{ width_mm: '600.0', length_mm: '1200.0', quantity: 1, shape: 'rectangle' }],
      no_remnant: false,
    });
    fireEvent.click(within(codes).getByRole('button', { name: 'Kodları yazdım' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cnc_cutting/'));
  });

  it('a finish without remnants sends no_remnant and goes back to the list', async () => {
    const calls = serveTask();
    signIn({ permissions: perms });
    const { router } = renderApp('/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    fireEvent.click(await screen.findByRole('button', { name: 'Tamamla' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Görevi Tamamla' })).getByRole('button', {
        name: 'Evet',
      }),
    );
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Fire Sac Ölçüleri' })).getByRole('button', {
        name: 'Görevi Tamamla',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/cnc_cutting/'));
    expect(
      calls.find((c) => c.url.pathname === '/cnc_cutting/tasks/mark-completed/')?.body,
    ).toEqual({
      key: 'CNC-2278',
      remnants: [],
      no_remnant: true,
    });
  });

  it('a hold task asks why before starting and has no Tamamla', async () => {
    const calls = serveTask({ task: { key: 'W-05' } });
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/tasks/?machine_id=7&key=W-05&name=Malzeme%20Bekleme&hold=1');
    expect(await screen.findByRole('heading', { name: 'W-05' })).toBeInTheDocument();
    expect(screen.getByText('Malzeme Bekleme')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tamamla' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Başlat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bekletme Görevi Başlatma' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Başlat' }));
    expect(await within(dialog).findByText('Lütfen bir açıklama giriniz.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Açıklama/), {
      target: { value: 'Sac gelmedi' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Başlat' }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.url.pathname === '/cnc_cutting/timers/start/')?.body,
      ).toMatchObject({
        issue_key: 'W-05',
        comment: 'Sac gelmedi',
      }),
    );
  });

  it('Arıza: a working machine gets a fault report; a stopped one opens the fault hold task', async () => {
    const calls = serveTask();
    signIn({ permissions: perms });
    const { router } = renderApp('/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    fireEvent.click(await screen.findByRole('button', { name: 'Arıza' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Makine Durumu' })).getByRole('button', {
        name: 'Evet',
      }),
    );
    const report = await screen.findByRole('dialog', { name: 'Arıza Bildirimi' });
    fireEvent.change(within(report).getByLabelText(/Arıza detaylarını giriniz/), {
      target: { value: 'Kafa titriyor' },
    });
    fireEvent.click(within(report).getByRole('button', { name: 'Gönder' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.pathname === '/machines/faults/')?.body).toEqual({
        is_maintenance: false,
        description: 'Kafa titriyor',
        is_breaking: false,
        machine: 7,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Arıza' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Makine Durumu' })).getByRole('button', {
        name: 'Hayır',
      }),
    );
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Yönlendirme Uyarısı' })).getByRole(
        'button',
        { name: 'Tamam' },
      ),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe(
        '?machine_id=7&key=W-07&name=Makine+Ar%C4%B1zas%C4%B1+Nedeniyle+Bekleme&hold=1',
      ),
    );
  });

  it('saves manual time', async () => {
    const calls = serveTask();
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    fireEvent.click(await screen.findByRole('button', { name: 'Manuel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manuel Süre Girişi' });
    expect(within(dialog).getByText('Süre: 1 saat 0 dakika')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.pathname === '/cnc_cutting/manual-time/')?.body).toMatchObject(
        {
          issue_key: 'CNC-2278',
          machine_fk: 7,
        },
      ),
    );
  });
});
