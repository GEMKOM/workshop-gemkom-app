import { createContext, use, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import {
  getStoredUser,
  hasPermission,
  hasRouteAccess,
  isLoggedIn,
  mustResetPassword,
  sessionVersion,
  subscribe,
  type SessionUser,
} from './authService';

export interface AuthValue {
  loggedIn: boolean;
  mustReset: boolean;
  user: SessionUser | null;
  can: (codename: string) => boolean;
  canRoute: (pathname: string, search?: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

/** The session, re-read whenever authService reports a change (here or in another tab). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const version = useSyncExternalStore(subscribe, sessionVersion);
  const value = useMemo<AuthValue>(
    () => ({
      loggedIn: isLoggedIn(),
      mustReset: mustResetPassword(),
      user: getStoredUser(),
      can: hasPermission,
      canRoute: hasRouteAccess,
    }),
    // A new snapshot per session change; the functions read storage themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth needs an AuthProvider');
  return value;
}

/** "Ad Soyad", else the username. */
export function displayName(user: SessionUser | null): string {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return name || user?.username || '';
}
