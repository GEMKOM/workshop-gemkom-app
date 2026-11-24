import { useEffect, type ReactNode } from 'react';
import classes from './StickyActions.module.css';

/**
 * A page's main buttons in a bar that stays above the bottom tab bar (form
 * submit, a timer's start/stop). While it is on screen the timer bubble moves
 * up so it never covers them.
 */
export function StickyActions({
  children,
  columns = '1fr 2fr',
}: {
  children: ReactNode;
  /** CSS grid columns for the buttons. */
  columns?: string;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.stickyActions = '';
    return () => {
      delete root.dataset.stickyActions;
    };
  }, []);
  return (
    <div className={classes.bar}>
      <div className={classes.buttons} style={{ gridTemplateColumns: columns }}>
        {children}
      </div>
    </div>
  );
}
