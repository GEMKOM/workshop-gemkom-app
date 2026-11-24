import { createBrowserRouter, type RouteObject } from 'react-router';
import { LoginOnly, RequireSession, ResetOnly } from '@/auth/guards';
import { BASENAME } from '@/lib/basename';
import { AppLayout, type RouteHandle } from '@/shell/AppLayout';
import { RouteError } from './RouteError';

// Paths match the legacy pages (with or without the trailing slash), so links,
// bookmarks and the timer bubble's deep links keep working. Each page is its
// own chunk.

const handle = (value: RouteHandle) => value;

export const routes: RouteObject[] = [
  {
    ErrorBoundary: RouteError,
    children: [
      {
        Component: LoginOnly,
        children: [
          {
            path: 'login',
            lazy: async () => ({
              Component: (await import('@/pages/auth/LoginPage')).LoginPage,
            }),
          },
        ],
      },
      {
        Component: ResetOnly,
        children: [
          {
            path: 'login/reset-password',
            lazy: async () => ({
              Component: (await import('@/pages/auth/ResetPasswordPage')).ResetPasswordPage,
            }),
          },
        ],
      },
      {
        Component: RequireSession,
        children: [
          {
            Component: AppLayout,
            children: [
              {
                index: true,
                handle: handle({ title: 'GEMKOM Saha' }),
                lazy: async () => ({
                  Component: (await import('@/pages/home/HomePage')).HomePage,
                }),
              },
              {
                path: 'department-requests',
                handle: handle({ title: 'Departman Talepleri' }),
                lazy: async () => ({
                  Component: (await import('@/pages/department-requests/RequestsListPage'))
                    .RequestsListPage,
                }),
              },
              {
                path: 'department-requests/create',
                handle: handle({ title: 'Yeni Talep', back: '/department-requests/' }),
                lazy: async () => ({
                  Component: (await import('@/pages/department-requests/RequestCreatePage'))
                    .RequestCreatePage,
                }),
              },
              {
                path: 'maintenance',
                handle: handle({ title: 'Bakım' }),
                lazy: async () => ({
                  Component: (await import('@/pages/maintenance/MaintenancePage')).MaintenancePage,
                }),
              },
              {
                path: 'maintenance/faults/task',
                handle: handle({ title: 'Arıza', back: '/maintenance/?tab=fault-requests' }),
                lazy: async () => ({
                  Component: (await import('@/pages/maintenance/FaultTaskPage')).FaultTaskPage,
                }),
              },
              {
                path: 'welding/timesheet',
                handle: handle({ title: 'Kaynak Puantaj' }),
                lazy: async () => ({
                  Component: (await import('@/pages/welding/TimesheetPage')).TimesheetPage,
                }),
              },
              {
                path: 'machining',
                handle: handle({ title: 'Talaşlı İmalat' }),
                lazy: async () => ({
                  Component: (await import('@/pages/machining/MachiningPage')).MachiningPage,
                }),
              },
              {
                path: 'machining/tasks',
                handle: handle({ title: 'Operasyon', back: '/machining/' }),
                lazy: async () => ({
                  Component: (await import('@/pages/machining/MachiningTaskPage'))
                    .MachiningTaskPage,
                }),
              },
              {
                path: 'cnc_cutting',
                handle: handle({ title: 'CNC Kesim' }),
                lazy: async () => ({
                  Component: (await import('@/pages/cnc/CncPage')).CncPage,
                }),
              },
              {
                path: 'cnc_cutting/tasks',
                handle: handle({ title: 'Kesim', back: '/cnc_cutting/' }),
                lazy: async () => ({
                  Component: (await import('@/pages/cnc/CncTaskPage')).CncTaskPage,
                }),
              },
              {
                path: 'unauthorized',
                handle: handle({ title: 'Yetkisiz Erişim' }),
                lazy: async () => ({
                  Component: (await import('@/pages/StatusPages')).UnauthorizedPage,
                }),
              },
              {
                path: '*',
                handle: handle({ title: 'Sayfa Bulunamadı' }),
                lazy: async () => ({
                  Component: (await import('@/pages/StatusPages')).NotFoundPage,
                }),
              },
            ],
          },
        ],
      },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes, { basename: BASENAME || undefined });
}
