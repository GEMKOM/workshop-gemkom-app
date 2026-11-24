import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createRequestBody } from '@/api/departmentRequests';
import { renderApp, signIn } from '@/test/render';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const REQUESTS = [
  {
    id: 1,
    request_number: 'DT-101',
    title: 'Kaynak teli',
    status: 'submitted',
    status_label: 'Onay Bekliyor',
    priority: 'urgent',
    requestor_full_name: 'Ahmet Yılmaz',
    department: 'Kaynak',
    needed_date: '2026-11-30',
    created_at: '2026-11-24T08:00:00Z',
    items: [{}, {}],
  },
  {
    id: 2,
    request_number: 'DT-099',
    title: 'Eldiven',
    status: 'approved',
    status_label: 'Onaylandı',
    priority: 'normal',
  },
];

type Call = { url: URL; init: RequestInit };

function serve(handler: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const call = { url: new URL(String(input)), init };
      calls.push(call);
      return Promise.resolve(handler(call) ?? json({}));
    }),
  );
  return calls;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('department request list', () => {
  it('shows all of the user’s requests by default and filters by status on the phone', async () => {
    serve(({ url }) =>
      url.pathname === '/planning/department-requests/my_requests/'
        ? json({ count: 2, next: null, results: REQUESTS })
        : undefined,
    );
    signIn({ permissions: { access_department_requests: true } });
    renderApp('/department-requests/');
    expect(await screen.findByText('Kaynak teli')).toBeInTheDocument();
    expect(screen.getByText('Eldiven')).toBeInTheDocument();
    expect(screen.getByText('2 ürün')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'approved' } });
    expect(screen.queryByText('Kaynak teli')).not.toBeInTheDocument();
    expect(screen.getByText('Eldiven')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'rejected' } });
    expect(screen.getByText('Seçili filtrelerle eşleşen talep bulunamadı.')).toBeInTheDocument();
  });

  it('loads the next page on "Daha fazla"', async () => {
    const calls = serve(({ url }) => {
      if (url.pathname !== '/planning/department-requests/my_requests/') return undefined;
      return url.searchParams.get('page') === '2'
        ? json({ next: null, results: [{ ...REQUESTS[1], id: 3, title: 'Eski talep' }] })
        : json({ next: 'page=2', results: [REQUESTS[0]] });
    });
    signIn({ permissions: { access_department_requests: true } });
    renderApp('/department-requests/');
    fireEvent.click(await screen.findByRole('button', { name: 'Daha fazla' }));
    expect(await screen.findByText('Eski talep')).toBeInTheDocument();
    expect(calls.map((c) => c.url.searchParams.get('page'))).toContain('2');
  });
});

describe('create department request', () => {
  it('builds the legacy payload from the type and items', () => {
    expect(
      createRequestBody({
        title: 'Rulman',
        neededDate: '2026-12-01',
        description: 'Torna için',
        priority: 'critical',
        requestType: '730.06.005',
        items: [{ name: 'SKF 6205', quantity: 4, unit: 'adet', description: 'link' }],
      }),
    ).toEqual({
      title: 'Rulman',
      needed_date: '2026-12-01',
      description: 'Torna için',
      priority: 'critical',
      items: [
        {
          name: 'FABRİKA MAKİNE BAKIM ONARIM GİDERİ',
          item_code: '730.06.005',
          item_description: 'SKF 6205',
          quantity: 4,
          unit: 'adet',
          item_specifications: 'link',
        },
      ],
    });
  });

  it('asks for the request type, then creates and goes back to the list', async () => {
    const calls = serve(({ url, init }) => {
      if (url.pathname === '/planning/department-requests/' && init.method === 'POST') {
        return json({ id: 9, request_number: 'DT-110' }, 201);
      }
      if (url.pathname === '/planning/department-requests/my_requests/') {
        return json({ next: null, results: [] });
      }
      return undefined;
    });
    signIn({
      permissions: { access_department_requests: true, access_department_requests_create: true },
    });
    const { router } = renderApp('/department-requests/create/');
    fireEvent.change(await screen.findByLabelText(/Talep Başlığı/), {
      target: { value: 'Rulman' },
    });
    fireEvent.change(screen.getByLabelText(/Detaylı Açıklama/), { target: { value: 'Torna' } });
    fireEvent.change(screen.getByLabelText(/Ürün Adı/), { target: { value: 'SKF 6205' } });
    fireEvent.click(screen.getByRole('button', { name: 'Talep Oluştur' }));
    expect(await screen.findByText('Lütfen talep tipini seçin.')).toBeInTheDocument();

    const types = screen.getByRole('radiogroup', { name: 'Talep Tipi' });
    fireEvent.click(within(types).getByRole('radio', { name: /Makine Kiralama/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Talep Oluştur' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/department-requests/'));
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toMatchObject({
      title: 'Rulman',
      priority: 'normal',
      items: [{ item_code: '730.10.004', item_description: 'SKF 6205', quantity: 1, unit: 'adet' }],
    });
  });

  it('refuses an item without a name', async () => {
    serve(() => undefined);
    signIn({
      permissions: { access_department_requests: true, access_department_requests_create: true },
    });
    renderApp('/department-requests/create/');
    fireEvent.change(await screen.findByLabelText(/Talep Başlığı/), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/Detaylı Açıklama/), { target: { value: 'Y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ürün Ekle' }));
    expect(screen.getByText('Ürün 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Talep Oluştur' }));
    expect(
      await screen.findByText('Lütfen tüm ürün bilgilerini eksiksiz doldurun.'),
    ).toBeInTheDocument();
  });
});
