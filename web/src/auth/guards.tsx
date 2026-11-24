import { Center, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { refreshPermissions, ROUTES } from './authService';

function Checking() {
  return (
    <Center mih="60dvh" aria-busy="true">
      <Loader />
    </Center>
  );
}

/**
 * The legacy guardRoute for every signed-in page, in its order:
 * not signed in → login; must reset the password → the reset page; no access
 * to this route → ask the server once more (the cache may be stale), then the
 * unauthorized page. Otherwise permissions refresh in the background, at most
 * once a minute; a changed grant re-renders.
 */
export function RequireSession() {
  const auth = useAuth();
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const allowed =
    auth.loggedIn && !auth.mustReset && auth.canRoute(location.pathname, location.search);
  // The route the forced refresh finished for; until then a refused route waits.
  const [checked, setChecked] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.loggedIn || auth.mustReset) return;
    let cancelled = false;
    if (allowed) {
      void refreshPermissions();
    } else {
      void refreshPermissions({ force: true }).finally(() => {
        if (!cancelled) setChecked(routeKey);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [auth.loggedIn, auth.mustReset, allowed, routeKey]);

  if (!auth.loggedIn) return <Navigate to={ROUTES.LOGIN} replace />;
  if (auth.mustReset) return <Navigate to={ROUTES.RESET_PASSWORD} replace />;
  if (!allowed) {
    return checked === routeKey ? <Navigate to={ROUTES.UNAUTHORIZED} replace /> : <Checking />;
  }
  return <Outlet />;
}

/** The login page: a signed-in user goes on to the reset page or home. */
export function LoginOnly() {
  const auth = useAuth();
  if (auth.loggedIn) {
    return <Navigate to={auth.mustReset ? ROUTES.RESET_PASSWORD : ROUTES.HOME} replace />;
  }
  return <Outlet />;
}

/** The reset page: only for a signed-in user who must reset; others go home (or to login). */
export function ResetOnly() {
  const auth = useAuth();
  if (!auth.loggedIn) return <Navigate to={ROUTES.LOGIN} replace />;
  if (!auth.mustReset) return <Navigate to={ROUTES.HOME} replace />;
  return <Outlet />;
}
