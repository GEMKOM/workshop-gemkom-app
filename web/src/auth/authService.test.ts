import {
  authedFetch,
  hasPermission,
  isLoggedIn,
  login,
  NoWorkshopAccessError,
  refreshPermissions,
  routePermission,
} from './authService';

const API = 'http://127.0.0.1:8001';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function mockFetch(handler: Handler) {
  const fn = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

const authHeader = (init: RequestInit) => new Headers(init.headers).get('Authorization');

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('login', () => {
  it('stores the session under the legacy keys', async () => {
    mockFetch((url) => {
      if (url === `${API}/token/`) return json({ access: 'a1', refresh: 'r1' });
      if (url === `${API}/users/me/`) return json({ id: 3, username: 'ali' });
      if (url === `${API}/users/me/permissions/`) {
        return json({ workshop_access: { granted: true }, access_machining: { granted: true } });
      }
      return json({}, 404);
    });
    localStorage.setItem('accessToken', 'old');
    await login('ali', 'secret');
    expect(localStorage.getItem('access')).toBe('a1');
    expect(localStorage.getItem('refresh')).toBe('r1');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ username: 'ali' });
    expect(hasPermission('access_machining')).toBe(true);
    expect(isLoggedIn()).toBe(true);
  });

  it('refuses a user without workshop_access and clears the session', async () => {
    mockFetch((url) => {
      if (url === `${API}/token/`) return json({ access: 'a1', refresh: 'r1' });
      if (url === `${API}/users/me/`) return json({ id: 3 });
      return json({ workshop_access: { granted: false } });
    });
    await expect(login('ali', 'secret')).rejects.toBeInstanceOf(NoWorkshopAccessError);
    expect(isLoggedIn()).toBe(false);
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('sends no X-Subdomain header', async () => {
    const fetchMock = mockFetch(() => json({}));
    localStorage.setItem('access', 'a1');
    localStorage.setItem('refresh', 'r1');
    await authedFetch(`${API}/machines/`);
    const headers = new Headers(fetchMock.mock.calls[0]![1]!.headers);
    expect(headers.get('X-Subdomain')).toBeNull();
    expect(headers.get('Authorization')).toBe('Bearer a1');
  });
});

describe('authedFetch', () => {
  beforeEach(() => {
    localStorage.setItem('access', 'expired');
    localStorage.setItem('refresh', 'r1');
  });

  it('refreshes once for parallel 401s and keeps the rotated refresh token', async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url === `${API}/token/refresh/`) return json({ access: 'fresh', refresh: 'r2' });
      return authHeader(init) === 'Bearer fresh' ? json({ ok: true }) : json({}, 401);
    });
    const [a, b] = await Promise.all([authedFetch(`${API}/a/`), authedFetch(`${API}/b/`)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(
      fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/token/refresh/')),
    ).toHaveLength(1);
    expect(localStorage.getItem('access')).toBe('fresh');
    expect(localStorage.getItem('refresh')).toBe('r2');
  });

  it('logs out when the server rejects the refresh token', async () => {
    mockFetch((url) => (url.endsWith('/token/refresh/') ? json({}, 401) : json({}, 401)));
    await expect(authedFetch(`${API}/a/`)).rejects.toThrow('Session expired');
    expect(isLoggedIn()).toBe(false);
  });

  it('keeps the session when the refresh fails with a 5xx or the network', async () => {
    mockFetch((url) => (url.endsWith('/token/refresh/') ? json({}, 502) : json({}, 401)));
    await expect(authedFetch(`${API}/a/`)).rejects.toThrow('Token refresh failed (502)');
    expect(isLoggedIn()).toBe(true);
  });

  it('uses a token another tab already got instead of refreshing', async () => {
    const fetchMock = mockFetch((_url, init) => {
      if (authHeader(init) === 'Bearer expired') {
        // Meanwhile another tab refreshed.
        localStorage.setItem('access', 'from-other-tab');
        return json({}, 401);
      }
      return json({ ok: true });
    });
    const response = await authedFetch(`${API}/a/`);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/token/refresh/'))).toBe(false);
  });
});

describe('permissions', () => {
  it('admins pass every check', () => {
    localStorage.setItem('user', JSON.stringify({ is_admin: true }));
    expect(hasPermission('access_cnc_cutting')).toBe(true);
  });

  it('maps routes to their permission as the legacy guard did', () => {
    expect(routePermission('/machining/tasks/')).toBe('access_machining_tasks');
    expect(routePermission('/machining/tasks')).toBe('access_machining_tasks');
    expect(routePermission('/maintenance/', '?tab=fault-requests')).toBe('access_maintenance_list');
    expect(routePermission('/maintenance/', '?tab=create-request')).toBe('access_maintenance');
    expect(routePermission('/maintenance/faults/task/')).toBeNull();
    expect(routePermission('/')).toBeNull();
  });

  it('refreshes at most once a minute unless forced, and reports a change', async () => {
    localStorage.setItem('access', 'a1');
    localStorage.setItem('refresh', 'r1');
    localStorage.setItem('permissions', JSON.stringify({ x: { granted: true } }));
    localStorage.setItem('permissions_refreshed_at', String(Date.now()));
    const fetchMock = mockFetch(() => json({ x: { granted: true }, y: { granted: true } }));
    expect(await refreshPermissions()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await refreshPermissions({ force: true })).toBe(true);
    expect(hasPermission('y')).toBe(true);
  });
});
