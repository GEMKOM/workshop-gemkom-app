import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { groupCuts, type CncTask } from '@/api/cnc';
import { buildRemnant, sheetCodeFromSearch, sizeText } from '@/lib/plateShape';
import { renderApp, signIn } from '@/test/render';
import { reservedSummary } from './PlateStock';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

type Call = { url: URL };

function serve(handler: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const call = { url: new URL(String(input)) };
      calls.push(call);
      return Promise.resolve(handler(call) ?? json({ results: [] }));
    }),
  );
  return calls;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('plate shapes (ported from plateShape.js)', () => {
  it('writes sizes per shape', () => {
    expect(sizeText({ width_mm: '1500.0', length_mm: '3000.0' })).toBe('1500 × 3000 mm');
    expect(sizeText({ shape: 'circle', width_mm: 600 })).toBe('Ø 600 mm');
    expect(sizeText({ shape: 'triangle', width_mm: 600, length_mm: 800 })).toBe(
      'Üçgen 600 × 800 mm',
    );
    expect(sizeText({ shape: 'irregular', width_mm: 800, length_mm: 900, area_m2: '0.4512' })).toBe(
      'Şekilsiz 800 × 900 mm · ~0,45 m²',
    );
  });

  it('checks remnant rows as typed', () => {
    const row = (r: Partial<Record<string, string>>) => ({
      shape: 'rectangle',
      width: '',
      length: '',
      area: '',
      quantity: '1',
      ...r,
    });
    expect(buildRemnant(row({}), 1)).toEqual({ empty: true });
    expect(buildRemnant(row({ width: '600' }), 2)).toEqual({ error: '2. satır: boy girin.' });
    expect(buildRemnant(row({ width: '600,5', length: '1200', quantity: '2' }), 1)).toEqual({
      remnant: { width_mm: '600.5', length_mm: '1200.0', quantity: 2, shape: 'rectangle' },
      shortSide: 600.5,
    });
    expect(buildRemnant(row({ shape: 'circle', width: '400' }), 1)).toMatchObject({
      remnant: { width_mm: '400.0', length_mm: '400.0' },
      shortSide: 400,
    });
    expect(
      buildRemnant(row({ shape: 'irregular', width: '100', length: '100', area: '0,5' }), 3),
    ).toEqual({
      error: '3. satır: tahmini alan (0,5 m²) en × boy alanından (0,01 m²) büyük olamaz.',
    });
    expect(buildRemnant(row({ width: '10', length: '10', quantity: '0' }), 1)).toEqual({
      error: '1. satır: adet en az 1 olan bir tam sayı olmalı.',
    });
  });

  it('reads sheet codes from a search', () => {
    expect(sheetCodeFromSearch('s26 12')).toBe('S26-00012');
    expect(sheetCodeFromSearch('S2600012')).toBe('S26-00012');
    expect(sheetCodeFromSearch('1500x3000')).toBeNull();
  });
});

describe('cnc grouping', () => {
  it('splits cuts into Rezerv, planned without a machine and machines, in plan order', () => {
    const t = (key: string, extra: Partial<CncTask>) => ({ key, ...extra }) as CncTask;
    const groups = groupCuts([
      t('A', { in_plan: false, machine_fk: 3 }),
      t('B', { in_plan: true, plan_order: 2 }),
      t('C', { in_plan: true, plan_order: 1 }),
      t('D', { in_plan: true, machine_fk: 3, plan_order: 5 }),
      t('E', { machine_fk: 3, plan_order: 1 }),
    ]);
    expect(groups.reserve.map((x) => x.key)).toEqual(['A']);
    expect(groups.planned.map((x) => x.key)).toEqual(['C', 'B']);
    expect(groups.machines.get(3)?.map((x) => x.key)).toEqual(['E', 'D']);
  });

  it('sums what is set aside in a plate group', () => {
    expect(
      reservedSummary([
        {
          id: 1,
          reserved_quantity: 2,
          reservations: [
            { cnc_task: 'CNC-1', quantity: 1 },
            { pull_request: 9, quantity: 1 },
          ],
        },
        { id: 2, reserved_quantity: 1, reservations: [] },
      ]),
    ).toBe('(1 kesime ayrılmış, 1 çıkış talebine ayrılmış, 1 ayrılmış)');
    expect(reservedSummary([{ id: 1, reserved_quantity: 0 }])).toBe('');
  });
});

const perms = { access_cnc_cutting: true, access_cnc_cutting_tasks: true };

describe('cnc page', () => {
  it('lists a machine’s cuts by kesim kodu and always offers Diğer İşler', async () => {
    const calls = serve(({ url }) => {
      if (url.pathname === '/machines/') return json({ results: [{ id: 7, name: 'Fiber Lazer' }] });
      if (url.pathname === '/cnc_cutting/tasks/' && url.searchParams.get('machine_fk') === '7') {
        return json({
          results: [
            {
              key: 'CNC-2278',
              nesting_id: 'E8338',
              material: 'ST37',
              thickness_mm: '10',
              quantity: 2,
              parts_count: 5,
            },
          ],
        });
      }
      if (url.pathname === '/cnc_cutting/hold-tasks/')
        return json([{ key: 'W-02', name: 'Yemek Molası' }]);
      return undefined;
    });
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/?machine_id=7');
    const card = await screen.findByRole('link', { name: /E8338/ });
    // The cut's task screen, in the app.
    expect(card).toHaveAttribute('href', '/cnc_cutting/tasks/?machine_id=7&key=CNC-2278');
    const params = calls.find((c) => c.url.searchParams.get('machine_fk') === '7')!.url
      .searchParams;
    expect(Object.fromEntries(params)).toMatchObject({
      completion_date__isnull: 'true',
      in_plan: 'true',
      ordering: 'plan_order',
      page_size: '10',
    });
    fireEvent.change(screen.getByLabelText('Kesim ara'), { target: { value: 'yok' } });
    expect(screen.getByText('Aramayla eşleşen kesim yok.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Diğer İşler'));
    const sheet = await screen.findByRole('dialog', { name: 'Bekletme Nedeni Seç' });
    expect(await within(sheet).findByRole('option', { name: 'Yemek Molası' })).toBeInTheDocument();
  });

  it('groups open cuts in the overview and opens their details', async () => {
    serve(({ url }) => {
      if (url.pathname === '/machines/') return json({ results: [{ id: 7, name: 'Fiber Lazer' }] });
      if (url.pathname === '/cnc_cutting/tasks/') {
        return json({
          results: [{ key: 'CNC-1', nesting_id: 'E1', machine_fk: 7, in_plan: true }],
        });
      }
      if (url.pathname === '/cnc_cutting/tasks/CNC-1/') {
        return json({
          key: 'CNC-1',
          nesting_id: 'E1',
          machine_name: 'Fiber Lazer',
          parts: [
            { id: 1, job_no: '304-01', weight_kg: '2.5' },
            { id: 2, job_no: '304-01', weight_kg: '1' },
          ],
          files: [
            {
              id: 4,
              file_name: 'task_attachments/cnc_cutting/CNC-1/E1.pdf',
              file_url: 'https://files.test/E1.pdf',
              uploaded_by_username: 'planlama',
            },
            {
              id: 5,
              file_name: 'task_attachments/cnc_cutting/CNC-1/E1.MPG',
              file_url: 'https://files.test/E1.MPG',
            },
          ],
        });
      }
      if (url.href === 'https://files.test/E1.MPG') {
        return new Response('E1-ST44-20MM\r\nInfo: Columbus');
      }
      return undefined;
    });
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/');
    fireEvent.click(await screen.findByText('Genel Bakış'));
    fireEvent.click(await screen.findByText('Fiber Lazer'));
    fireEvent.click(await screen.findByText('E1'));
    const sheet = await screen.findByRole('dialog', { name: 'CNC-1 - Görev Detayları' });
    expect(await within(sheet).findByText('3.50 kg')).toBeInTheDocument();
    // Each file has Önizle and İndir (legacy Görüntüle / İndir), named by its last path segment.
    expect(within(sheet).getByText('E1.pdf')).toBeInTheDocument();
    expect(within(sheet).getByText('planlama')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'E1.pdf indir' })).toBeInTheDocument();
    // The CNC program (MPG) previews as text.
    fireEvent.click(within(sheet).getByRole('button', { name: 'E1.MPG önizle' }));
    const viewer = await screen.findByRole('dialog', { name: 'E1.MPG' });
    expect(await within(viewer).findByText(/E1-ST44-20MM/)).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'İndir' })).toBeInTheDocument();
  });

  it('searches plate stock and shows each sheet’s state', async () => {
    const calls = serve(({ url }) => {
      if (url.pathname === '/warehouse/pieces/groups/') {
        return json({
          count: 1,
          results: [
            {
              item_code: '0100 0000 0010 000 000',
              width_mm: '1500.0',
              length_mm: '3000.0',
              quantity: 2,
              pieces: [
                {
                  id: 1,
                  code: 'S26-00012',
                  item_name: '10 mm ST37',
                  plate_thickness_mm: '10',
                  quantity: 1,
                  reserved_quantity: 1,
                  reservations: [{ cnc_task: 'CNC-9', quantity: 1 }],
                },
                { id: 2, code: 'S26-00013', quantity: 1, reserved_quantity: 0 },
              ],
            },
          ],
        });
      }
      return undefined;
    });
    signIn({ permissions: perms });
    renderApp('/cnc_cutting/');
    fireEvent.click(await screen.findByText('Sac Stoğu'));
    expect(await screen.findByText('2 sac')).toBeInTheDocument();
    expect(screen.getByText('(1 kesime ayrılmış)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Sac ara'), { target: { value: 's26 12' } });
    await waitFor(() =>
      expect(calls.some((c) => c.url.searchParams.get('search') === 's26 12')).toBe(true),
    );
    expect(await screen.findByText('CNC-9 kesimine ayrılmış')).toBeInTheDocument();
    expect(screen.getByText('Boşta')).toBeInTheDocument();
  });
});
