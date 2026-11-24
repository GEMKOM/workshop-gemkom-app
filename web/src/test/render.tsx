import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { routes } from '@/routes/router';
import { theme } from '@/theme';

/** The whole app (its real routes) at a path, in memory. */
export function renderApp(path = '/', appRoutes: RouteObject[] = routes) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const view = render(
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ModalsProvider labels={{ confirm: 'Onayla', cancel: 'İptal' }}>
            <Notifications />
            <RouterProvider router={router} />
          </ModalsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>,
  );
  return { ...view, router, queryClient };
}

/** Puts a signed-in session in localStorage, as the legacy app leaves it. */
export function signIn({
  permissions = {},
  user = {},
}: {
  permissions?: Record<string, boolean>;
  user?: Record<string, unknown>;
} = {}) {
  localStorage.setItem('access', 'access-1');
  localStorage.setItem('refresh', 'refresh-1');
  localStorage.setItem(
    'user',
    JSON.stringify({ id: 7, username: 'ahmet', first_name: 'Ahmet', last_name: 'Yılmaz', ...user }),
  );
  localStorage.setItem(
    'permissions',
    JSON.stringify(
      Object.fromEntries(
        Object.entries({ workshop_access: true, ...permissions }).map(([k, v]) => [
          k,
          { granted: v },
        ]),
      ),
    ),
  );
  // Fresh, so the guard doesn't refetch permissions in every test.
  localStorage.setItem('permissions_refreshed_at', String(Date.now()));
}
