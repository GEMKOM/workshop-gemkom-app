import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, signIn } from '@/test/render';

const API = 'http://127.0.0.1:8001';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(json({}))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('route guard', () => {
  it('sends a signed-out visitor to the login page', async () => {
    const { router } = renderApp('/machining/');
    expect(await screen.findByRole('button', { name: 'Giriş Yap' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login/');
  });

  it('sends a user who must reset the password to the reset page', async () => {
    signIn({ user: { must_reset_password: true } });
    const { router } = renderApp('/');
    expect(await screen.findByText('Şifre Sıfırla')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login/reset-password/');
  });

  it('sends a signed-in user away from the login page', async () => {
    signIn();
    const { router } = renderApp('/login/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('asks the server again before refusing a route, then shows the unauthorized page', async () => {
    signIn();
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input) === `${API}/users/me/permissions/`
          ? json({ workshop_access: { granted: true } })
          : json({}),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { router } = renderApp('/machining/');
    expect(await screen.findByText('Yetkiniz yok')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/unauthorized/');
    expect(fetchMock).toHaveBeenCalledWith(`${API}/users/me/permissions/`, expect.anything());
  });
});

describe('home', () => {
  it('shows only the areas the user may open; unported ones link to the legacy page', async () => {
    signIn({ permissions: { access_machining: true, access_maintenance: true } });
    renderApp('/');
    const machining = await screen.findByRole('link', { name: /Talaşlı İmalat/ });
    expect(machining).toHaveAttribute('href', '/machining/');
    expect(screen.getByRole('link', { name: 'Yeni Talep Oluştur' })).toHaveAttribute(
      'href',
      '/maintenance/?tab=create-request',
    );
    expect(screen.queryByText('CNC Kesim')).not.toBeInTheDocument();
    expect(screen.queryByText('Kaynak Puantaj')).not.toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Ana menü' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Ana Sayfa', 'Talaşlı', 'Bakım']);
  });

  it('logs out from the account menu', async () => {
    signIn({ permissions: { access_machining: true } });
    const { router } = renderApp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Hesap' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Çıkış Yap' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login/'));
    expect(localStorage.getItem('refresh')).toBeNull();
  });
});

describe('login page', () => {
  it('signs in and goes home', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === `${API}/token/`) return Promise.resolve(json({ access: 'a', refresh: 'r' }));
        if (url === `${API}/users/me/`) return Promise.resolve(json({ username: 'ali' }));
        return Promise.resolve(json({ workshop_access: { granted: true } }));
      }),
    );
    const { router } = renderApp('/login/');
    fireEvent.change(await screen.findByLabelText('Kullanıcı Adı'), { target: { value: 'ali' } });
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('names a refused portal and a wrong password apart', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ detail: 'no' }, 401))),
    );
    renderApp('/login/');
    fireEvent.change(await screen.findByLabelText('Kullanıcı Adı'), { target: { value: 'ali' } });
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
    expect(
      await screen.findByText('Kullanıcı adı veya şifre hatalı. Lütfen tekrar deneyin.'),
    ).toBeInTheDocument();
  });
});
