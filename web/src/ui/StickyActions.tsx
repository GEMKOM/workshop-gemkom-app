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
  rows = 1,
}: {
  children: ReactNode;
  /** CSS grid columns for the buttons. */
  columns?: string;
  /** Two rows of buttons make the bar (and the room kept for it) taller. */
  rows?: 1 | 2;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.stickyActions = String(rows);
    return () => {
      delete root.dataset.stickyActions;
    };
  }, [rows]);
  return (
    <div className={classes.bar}>
      <div className={classes.buttons} style={{ gridTemplateColumns: columns }}>
        {children}
      </div>
    </div>
  );
}
