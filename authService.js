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

let accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS) || localStorage.getItem(STORAGE_KEYS.LEGACY_ACCESS);
let refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH) || localStorage.getItem(STORAGE_KEYS.LEGACY_REFRESH);

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
    accessToken = newAccessToken;
    refreshToken = newRefreshToken;
    localStorage.setItem(STORAGE_KEYS.ACCESS, newAccessToken);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ACCESS);
    if (newRefreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH, newRefreshToken);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_REFRESH);
    }
}

function clearTokens() {
    accessToken = null;
    refreshToken = null;
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
        '/warehouse/weight-reduction/': 'access_warehouse_weight_reduction'
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

async function refreshAccessToken() {
    if (!refreshToken) {
        logout();
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(`${API_URL}/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!response.ok) {
           throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        setTokens(data.access, refreshToken);
        return accessToken;
    } catch(e) {
        clearAuthStorage();
        navigateTo(ROUTES.LOGIN);
        throw e;
    }
}

export async function authedFetch(url, options = {}) {
    if (!accessToken) {
       clearAuthStorage();
       navigateTo(ROUTES.LOGIN);
       throw new Error('Not authenticated');
    }

    options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
    };

    let response = await fetch(url, options);

    if (response.status === 401) {
        try {
            await refreshAccessToken();
            options.headers['Authorization'] = `Bearer ${accessToken}`;
            response = await fetch(url, options);
        } catch (e) {
            clearAuthStorage();
            navigateTo(ROUTES.LOGIN);
            throw e;
        }
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