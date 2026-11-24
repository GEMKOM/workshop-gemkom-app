import { Outlet, useMatches } from 'react-router';
import classes from './AppLayout.module.css';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';

export interface RouteHandle {
  /** The page title in the top bar. */
  title?: string;
  /** Where the top bar's back arrow goes; none on top-level pages. */
  back?: string;
}

/** The phone shell: red top bar, the page, and the bottom tab bar. */
export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle as RouteHandle | undefined;

  return (
    <div className={classes.shell}>
      <TopBar title={handle?.title ?? 'GEMKOM Saha'} back={handle?.back} />
      <main className={classes.main}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
