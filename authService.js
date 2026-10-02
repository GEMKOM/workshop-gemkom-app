import { backendBase } from './base.js';

const API_URL = backendBase;

const STORAGE_KEYS = {
    ACCESS: 'access',
    REFRESH: 'refresh',
    USER: 'user',
    PERMISSIONS: 'permissions',
    LEGACY_ACCESS: 'accessToken',
    LEGACY_REFRESH: 'refreshToken'
};

// localStorage is the only copy of the tokens. Every tab shares it; a tab that
// kept its own copy from page load would keep sending -- and, once rejected,
// wipe -- tokens another tab has since refreshed or replaced with a new login.
function currentAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS) || localStorage.getItem(STORAGE_KEYS.LEGACY_ACCESS);
}

function currentRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH) || localStorage.getItem(STORAGE_KEYS.LEGACY_REFRESH);
}

// Centralized routing to prevent infinite redirects
export const ROUTES = {
    LOGIN: '/login/',
    RESET_PASSWORD: '/login/reset-password/',
    UNAUTHORIZED: '/unauthorized/',
    HOME: '/',
    ADMIN: '/admin/',
    MACHINING: '/machining/',
    MACHINING_TASKS: '/machining/tasks/',
    CNC_CUTTING: '/cnc_cutting/',
    CNC_CUTTING_TASKS: '/cnc_cutting/tasks/',
    MAINTENANCE: '/maintenance/',
    MAINTENANCE_LIST: '/maintenance/?tab=fault-requests'
};

// Track if we're currently redirecting to prevent loops
let isRedirecting = false;

export async function getUser() {
    const user_data = await authedFetch(`${backendBase}/users/me/`);
    return await user_data.json();
}

export async function getPermissions() {
    const response = await authedFetch(`${backendBase}/users/me/permissions/`);
    return await response.json();
}

function setTokens(newAccessToken, newRefreshToken) {
    localStorage.setItem(STORAGE_KEYS.ACCESS, newAccessToken);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS);
    if (newRefreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH, newRefreshToken);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH);
    }
}

function clearTokens() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.REFRESH);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH);
}

function clearAuthStorage() {
    clearTokens();
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.PERMISSIONS);
}

export async function login(username, password) {
    const response = await fetch(`${API_URL}/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        throw new Error('Login failed');
    }

    const data = await response.json();
    setTokens(data.access, data.refresh);
    const user_data = await getUser();
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user_data));

    const permissions = await getPermissions();
    localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions));

    if (!hasPermission('workshop_access')) {
        clearAuthStorage();
        throw new Error('No workshop access');
    }

    return data;
}

export function logout() {
    clearAuthStorage();
    navigateTo(ROUTES.LOGIN);
}

export function isLoggedIn() {
    return !!(localStorage.getItem(STORAGE_KEYS.REFRESH) || localStorage.getItem(STORAGE_KEYS.LEGACY_REFRESH));
}

export function mustResetPassword() {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER));
    if (user) {
        return user.must_reset_password;
    } else {
        return false;
    }
}

export function isAdmin() {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER));
    if (user) { 
        return user?.is_superuser || user?.is_admin;
    } else {
        return false;
    }
}

export function isLead() {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER));
    if (user) { 
        return user?.is_lead;
    } else {
        return false;
    }
}

// Enhanced navigation with optional soft reload
export function navigateTo(path, options = {}) {
    if (isRedirecting) return; // Prevent multiple simultaneous redirects
    
    isRedirecting = true;
    window.location.href = path;
    
    // Reset redirecting flag after a short delay
    setTimeout(() => {
        isRedirecting = false;
    }, 100);
}

export function hasPermission(codename) {
    // Safety: superusers should never be blocked client-side.
    if (isAdmin()) return true;

    const raw = localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
    if (!raw || !codename) return false;
    try {
        const perms = JSON.parse(raw);
        return perms?.[codename]?.granted === true;
    } catch (_) {
        return false;
    }
}

export function getRoutePermissionCodename(pathname = window.location.pathname) {
    const rawPath = String(pathname || '').split('#')[0];
    const [pathOnly, query = ''] = rawPath.split('?');
    const normalizedPath = `/${String(pathOnly || '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');

    const routePermissionMap = {
        '/cnc_cutting/': 'access_cnc_cutting',
        '/cnc_cutting/tasks/': 'access_cnc_cutting_tasks',
        '/department-requests/': 'access_department_requests',
        '/department-requests/create/': 'access_department_requests_create',
        '/machining/': 'access_machining',
        '/machining/tasks/': 'access_machining_tasks',
        '/maintenance/': 'access_maintenance',
        '/maintenance/create/': 'access_maintenance_create',
        '/maintenance/list/': 'access_maintenance_list',
        '/warehouse/': 'access_warehouse',
        '/warehouse/inventory-allocation/': 'access_warehouse_inventory_allocation',
        '/warehouse/material-tracking/': 'access_warehouse_material_tracking',
        '/warehouse/weight-reduction/': 'access_warehouse_weight_reduction',
        '/warehouse/accounting-export/': 'access_warehouse',
        '/warehouse/transfer-requests/': 'access_warehouse'
    };

    // Legacy compatibility: maintenance tab URL behaves like list page.
    if (normalizedPath === '/maintenance/' && query.includes('tab=fault-requests')) {
        return routePermissionMap['/maintenance/list/'];
    }

    return routePermissionMap[normalizedPath] || null;
}

export function hasRouteAccess(pathname = window.location.pathname) {
    const codename = getRoutePermissionCodename(pathname);
    if (!codename) return true;
    return hasPermission(codename);
}

export function navigateByPermissions() {
    navigateTo(ROUTES.HOME);
}


// Route guard function

export function shouldBeOnResetPasswordPage() {
    return isLoggedIn() && mustResetPassword();
}

export function shouldBeOnMainPage() {
    return isLoggedIn() && !mustResetPassword();
}

// Route guard utility for pages
export function guardRoute() {
    const currentPath = window.location.pathname;
    const normalizedPath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    
    // If we're already redirecting, don't do anything
    if (isRedirecting) {
        return false;
    }
    
    // If not logged in, should be on login page
    if (!isLoggedIn()) {
        if (normalizedPath !== ROUTES.LOGIN) {
            navigateTo(ROUTES.LOGIN);
            return false;
        }
        return true;
    }
    
    // If logged in but must reset password, should be on reset password page
    if (mustResetPassword()) {
        if (normalizedPath !== ROUTES.RESET_PASSWORD) {
            navigateTo(ROUTES.RESET_PASSWORD);
            return false;
        }
        return true;
    }
    
    // If logged in and doesn't need password reset, should be on main page
    // (not on login or reset password pages)
    if (normalizedPath === ROUTES.LOGIN || normalizedPath === ROUTES.RESET_PASSWORD) {
        navigateTo(ROUTES.HOME);
        return false;
    }

    if (normalizedPath !== ROUTES.UNAUTHORIZED && !hasRouteAccess(currentPath)) {
        navigateTo(ROUTES.UNAUTHORIZED);
        return false;
    }
    
    // If we get here, user is authenticated and on the right page
    document.body.classList.remove('pre-auth');
    return true;
}

// Enhanced enforceAuth with better logic
export function enforceAuth() {
    return guardRoute();
}

// One refresh per tab at a time: when the access token lapses, every request in
// flight gets a 401, and they should all wait on the same refresh.
let refreshInFlight = null;

function refreshAccessToken() {
    if (!refreshInFlight) {
        refreshInFlight = requestNewAccessToken().finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

// Only a refresh token the server actually rejects (401/400) ends the session.
// A network blip or a 5xx -- or the retried request failing -- used to log the
// user out as well; now just this request fails and the next one tries again.
async function requestNewAccessToken() {
    const sentRefresh = currentRefreshToken();
    if (!sentRefresh) {
        logout();
        throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_URL}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: sentRefresh }),
    });

    if (response.status === 401 || response.status === 400) {
        // Another tab may have logged in again while this was out -- typically
        // right after the same expiry sent it to the login screen. Carry on
        // with its tokens instead of wiping them.
        const latestRefresh = currentRefreshToken();
        if (latestRefresh && latestRefresh !== sentRefresh) {
            return requestNewAccessToken();
        }
        logout();
        throw new Error('Session expired');
    }
    if (!response.ok) {
        throw new Error(`Token refresh failed (${response.status})`);
    }

    const data = await response.json();
    if (!currentRefreshToken()) {
        // Signed out in another tab while this was out: don't revive the session.
        logout();
        throw new Error('Not authenticated');
    }
    // The backend hands back a new refresh token on every refresh; keeping it is
    // what lets an active session outlive the refresh token's 7-day lifetime.
    setTokens(data.access, data.refresh || sentRefresh);
    return data.access;
}

export async function authedFetch(url, options = {}) {
    if (!currentRefreshToken()) {
       logout();
       throw new Error('Not authenticated');
    }

    const sentAccess = currentAccessToken() || await refreshAccessToken();

    options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sentAccess}`,
    };

    let response = await fetch(url, options);

    if (response.status === 401) {
        // A parallel request or another tab may already have replaced the token
        // this one went out with; use that rather than refreshing again.
        const latestAccess = currentAccessToken();
        const freshAccess = latestAccess && latestAccess !== sentAccess
            ? latestAccess
            : await refreshAccessToken();
        options.headers['Authorization'] = `Bearer ${freshAccess}`;
        response = await fetch(url, options);
    }

    return response;
}

export async function forgotPassword(username) {
    const resp = await fetch(`${backendBase}/users/forgot-password/request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    return resp;
}