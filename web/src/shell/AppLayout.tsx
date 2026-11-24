import { Outlet, useLocation, useMatches } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import classes from './AppLayout.module.css';
import { BottomNav } from './BottomNav';
import { TIMER_PERMISSIONS, TimerBubble } from './TimerBubble';
import { TopBar } from './TopBar';
import { useWakeResync } from './useWakeResync';

export interface RouteHandle {
  /** The page title in the top bar. */
  title?: string;
  /** Where the top bar's back arrow goes; none on top-level pages. */
  back?: string;
}

/** The phone shell: red top bar, the page, the timer bubble and the bottom tab bar. */
export function AppLayout() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle as RouteHandle | undefined;
  useWakeResync();

  // As the legacy widget: for users of a timer area, on every page but welding.
  const showTimers =
    TIMER_PERMISSIONS.some((p) => auth.can(p)) && !pathname.startsWith('/welding/');

  return (
    <div className={classes.shell}>
      <TopBar title={handle?.title ?? 'GEMKOM Saha'} back={handle?.back} />
      <main className={classes.main}>
        <Outlet />
      </main>
      {showTimers ? <TimerBubble /> : null}
      <BottomNav />
    </div>
  );
}
