import {
  IconClipboardList,
  IconCut,
  IconFlame,
  IconSettings,
  IconTool,
  type Icon,
} from '@tabler/icons-react';

// The workshop's areas, in the legacy navbar's order. Each needs its route's
// permission (auth/authService.ts routePermission); the home cards and the
// bottom bar show only the ones the user can open.

export interface Area {
  key: string;
  label: string;
  /** Shorter, for the bottom bar. */
  short: string;
  description?: string;
  /** The area's pages all start with it. */
  root: string;
  path: string;
  icon: Icon;
  /** Shortcuts on the home card (legacy "features"). */
  shortcuts?: { label: string; path: string }[];
  /** On the home page as a card (department requests were only in the navbar). */
  homeCard: boolean;
}

export const AREAS: Area[] = [
  {
    key: 'welding',
    label: 'Kaynak Puantaj',
    short: 'Puantaj',
    description: 'Bugün hangi işlerde kaç saat çalıştığınızı girin.',
    root: '/welding/',
    path: '/welding/timesheet/',
    icon: IconFlame,
    homeCard: true,
  },
  {
    key: 'machining',
    label: 'Talaşlı İmalat',
    short: 'Talaşlı',
    description:
      'Makine görevlerini yönetin, zamanlayıcıları kullanın ve üretim süreçlerini takip edin.',
    root: '/machining/',
    path: '/machining/',
    icon: IconSettings,
    homeCard: true,
  },
  {
    key: 'cnc',
    label: 'CNC Kesim',
    short: 'CNC',
    description:
      'CNC kesim görevlerini yönetin, zamanlayıcıları kullanın ve kesim süreçlerini takip edin.',
    root: '/cnc_cutting/',
    path: '/cnc_cutting/',
    icon: IconCut,
    homeCard: true,
  },
  {
    key: 'maintenance',
    label: 'Bakım',
    short: 'Bakım',
    description:
      'Bakım taleplerini yönetin, planlı bakımları takip edin ve ekipman durumlarını izleyin.',
    root: '/maintenance/',
    path: '/maintenance/',
    icon: IconTool,
    shortcuts: [
      { label: 'Yeni Talep Oluştur', path: '/maintenance/?tab=create-request' },
      { label: 'Bakım Talepleri', path: '/maintenance/?tab=fault-requests' },
    ],
    homeCard: true,
  },
  {
    key: 'requests',
    label: 'Departman Talepleri',
    short: 'Talepler',
    root: '/department-requests/',
    path: '/department-requests/',
    icon: IconClipboardList,
    homeCard: false,
  },
];

/**
 * The areas already ported to React. During the pilot the others are still the
 * legacy pages: their links leave the /beta/ app with a full page load.
 */
export const PORTED_AREAS = new Set<string>(['requests']);

/** Whether a path is a page of this app (pages outside every area, like home, are). */
export function isPorted(path: string): boolean {
  const pathname = path.split('?')[0] ?? path;
  const area = AREAS.find((a) => pathname.startsWith(a.root));
  return !area || PORTED_AREAS.has(area.key);
}
