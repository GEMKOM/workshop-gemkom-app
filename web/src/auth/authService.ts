// The session, ported from the legacy blue-app authService.js. Same storage
// keys and the same rules, so a phone signed in on the legacy pages stays
// signed in here (and back), through the pilot and the cutover:
//   - localStorage is the only copy of the tokens; every tab shares it.
//   - One token refresh per tab at a time; a newer token another tab already
//     got is used instead of refreshing again.
//   - Only a refresh token the server rejects (400/401) ends the session.
//   - A login without workshop_access is refused.
// Where the legacy code reloaded or redirected the page, this notifies the
// subscribers (AuthProvider), and the route guard re-renders.

import { backendBase } from '@/lib/backend';

export const STORAGE_KEYS = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  USER: 'user',
  PERMISSIONS: 'permissions',
  PERMISSIONS_REFRESHED_AT: 'permissions_refreshed_at',
  LEGACY_ACCESS: 'accessToken',
  LEGACY_REFRESH: 'refreshToken',
} as const;

export const ROUTES = {
  LOGIN: '/login/',
  RESET_PASSWORD: '/login/reset-password/',
  UNAUTHORIZED: '/unauthorized/',
  HOME: '/',
} as const;

export interface SessionUser {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_superuser?: boolean;
  is_admin?: boolean;
  is_lead?: boolean;
  must_reset_password?: boolean;
  [key: string]: unknown;
}

export type PermissionMap = Record<string, { granted?: boolean } | undefined>;

// ---- change notifications (this tab and others) ------------------------------

const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Called whenever the session (tokens, user, permissions) changes. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes with every session change (for useSyncExternalStore). */
export function sessionVersion(): number {
  return version;
}

if (typeof window !== 'undefined') {
  // Another tab logged in or out, refreshed permissions or edited the profile.
  const watched = new Set<string>([
    STORAGE_KEYS.REFRESH,
    STORAGE_KEYS.LEGACY_REFRESH,
    STORAGE_KEYS.USER,
    STORAGE_KEYS.PERMISSIONS,
  ]);
  window.addEventListener('storage', (event) => {
    if (event.key === null || watched.has(event.key)) notify();
  });
}

// ---- storage ------------------------------------------------------------------

function currentAccessToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.ACCESS) || localStorage.getItem(STORAGE_KEYS.LEGACY_ACCESS)
  );
}

function currentRefreshToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.REFRESH) || localStorage.getItem(STORAGE_KEYS.LEGACY_REFRESH)
  );
}

function setTokens(access: string, refresh?: string | null) {
  localStorage.setItem(STORAGE_KEYS.ACCESS, access);
  localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS);
  if (refresh) {
    localStorage.setItem(STORAGE_KEYS.REFRESH, refresh);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH);
  }
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS);
  localStorage.removeItem(STORAGE_KEYS.REFRESH);
  localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS);
  localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.PERMISSIONS);
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getStoredUser(): SessionUser | null {
  return readJson<SessionUser>(STORAGE_KEYS.USER);
}

export function setStoredUser(user: SessionUser) {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  notify();
}

export function isLoggedIn(): boolean {
  return !!currentRefreshToken();
}

export function mustResetPassword(): boolean {
  return !!getStoredUser()?.must_reset_password;
}

export function isAdmin(): boolean {
  const user = getStoredUser();
  return !!(user?.is_superuser || user?.is_admin);
}

export function hasPermission(codename: string): boolean {
  // Superusers are never blocked client-side.
  if (isAdmin()) return true;
  if (!codename) return false;
  return readJson<PermissionMap>(STORAGE_KEYS.PERMISSIONS)?.[codename]?.granted === true;
}

// ---- route permissions --------------------------------------------------------

/** getRoutePermissionCodename's map, without the discontinued warehouse pages. */
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/cnc_cutting/': 'access_cnc_cutting',
  '/cnc_cutting/tasks/': 'access_cnc_cutting_tasks',
  '/department-requests/': 'access_department_requests',
  '/department-requests/create/': 'access_department_requests_create',
  '/machining/': 'access_machining',
  '/machining/tasks/': 'access_machining_tasks',
  '/maintenance/': 'access_maintenance',
  '/maintenance/create/': 'access_maintenance_create',
  '/maintenance/list/': 'access_maintenance_list',
  '/welding/timesheet/': 'access_welding_timesheet',
};

function normalizePath(pathname: string): string {
  return `/${pathname.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
}

/** The permission a page needs, or null when it is open to every signed-in user. */
export function routePermission(pathname: string, search = ''): string | null {
  const path = normalizePath(pathname);
  // The maintenance list tab needs the list permission, as /maintenance/list/.
  if (path === '/maintenance/' && search.includes('tab=fault-requests')) {
    return ROUTE_PERMISSIONS['/maintenance/list/'] ?? null;
  }
  return ROUTE_PERMISSIONS[path] ?? null;
}

export function hasRouteAccess(pathname: string, search = ''): boolean {
  const codename = routePermission(pathname, search);
  return !codename || hasPermission(codename);
}

// ---- requests -----------------------------------------------------------------

let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function requestNewAccessToken(): Promise<string> {
  const sentRefresh = currentRefreshToken();
  if (!sentRefresh) {
    logout();
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${backendBase}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: sentRefresh }),
  });

  if (response.status === 401 || response.status === 400) {
    // Another tab may have logged in again meanwhile: carry on with its tokens.
    const latestRefresh = currentRefreshToken();
    if (latestRefresh && latestRefresh !== sentRefresh) return requestNewAccessToken();
    logout();
    throw new Error('Session expired');
  }
  if (!response.ok) {
    // A network blip or a 5xx fails this request only; the next one tries again.
    throw new Error(`Token refresh failed (${response.status})`);
  }

  const data = (await response.json()) as { access: string; refresh?: string };
  if (!currentRefreshToken()) {
    // Signed out in another tab while this was out: don't revive the session.
    logout();
    throw new Error('Not authenticated');
  }
  // The backend rotates the refresh token; keeping it lets an active session
  // outlive the refresh token's lifetime.
  setTokens(data.access, data.refresh || sentRefresh);
  return data.access;
}

/** fetch with the session's Bearer token and one refresh on a 401. */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!currentRefreshToken()) {
    logout();
    throw new Error('Not authenticated');
  }

  const sentAccess = currentAccessToken() || (await refreshAccessToken());
  const headers = new Headers(options.headers);
  // The legacy app sent JSON on every request; a FormData body needs the
  // browser's multipart boundary instead.
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${sentAccess}`);

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // A parallel request or another tab may already have replaced the token.
    const latestAccess = currentAccessToken();
    const freshAccess =
      latestAccess && latestAccess !== sentAccess ? latestAccess : await refreshAccessToken();
    headers.set('Authorization', `Bearer ${freshAccess}`);
    response = await fetch(url, { ...options, headers });
  }
  return response;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await authedFetch(`${backendBase}${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

// ---- login / logout -------------------------------------------------------------

export class NoWorkshopAccessError extends Error {
  constructor() {
    super('No workshop access');
    this.name = 'NoWorkshopAccessError';
  }
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${backendBase}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error('Login failed');

  const data = (await response.json()) as { access: string; refresh: string };
  setTokens(data.access, data.refresh);
  const user = await getJson<SessionUser>('/users/me/');
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  const permissions = await getJson<PermissionMap>('/users/me/permissions/');
  localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions));
  localStorage.setItem(STORAGE_KEYS.PERMISSIONS_REFRESHED_AT, String(Date.now()));

  if (!hasPermission('workshop_access')) {
    clearAuthStorage();
    notify();
    throw new NoWorkshopAccessError();
  }
  notify();
}

export function logout() {
  clearAuthStorage();
  notify();
}

/** Re-reads /users/me/ into the stored user (after a password reset or profile edit). */
export async function reloadUser(): Promise<SessionUser> {
  const user = await getJson<SessionUser>('/users/me/');
  setStoredUser(user);
  return user;
}

// ---- permission refresh -----------------------------------------------------------

// Permissions used to be cached at login only, so a phone that stayed signed in
// never learned about pages granted afterwards. Refetch at most once a minute
// (or now, with force); a changed grant re-renders the cards, the navigation
// and the route guard.
const PERMISSIONS_REFRESH_INTERVAL_MS = 60 * 1000;

/** Resolves true when the stored permissions changed. */
export async function refreshPermissions({ force = false } = {}): Promise<boolean> {
  if (!isLoggedIn()) return false;
  const last = Number(localStorage.getItem(STORAGE_KEYS.PERMISSIONS_REFRESHED_AT) || 0);
  if (!force && Date.now() - last < PERMISSIONS_REFRESH_INTERVAL_MS) return false;
  localStorage.setItem(STORAGE_KEYS.PERMISSIONS_REFRESHED_AT, String(Date.now()));
  try {
    const response = await authedFetch(`${backendBase}/users/me/permissions/`);
    if (!response.ok) return false;
    const fresh = JSON.stringify(await response.json());
    const changed = fresh !== localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, fresh);
      notify();
    }
    return changed;
  } catch (error) {
    console.warn('Permission refresh failed:', error);
    return false;
  }
}

// ---- password -------------------------------------------------------------------

export function forgotPassword(username: string): Promise<Response> {
  return fetch(`${backendBase}/users/forgot-password/request/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
}
