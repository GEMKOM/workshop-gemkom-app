import { useEffect, useState } from 'react';
import { apiFetch } from './client';

// Server time, as the legacy generic/timeService.js: the offset between the
// phone's clock and the server's (GET /now/ → { now: epoch ms }). Elapsed
// times and finish_time are computed with it, so a phone whose clock is off
// still shows and books the right durations.

let offsetMs = 0;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

/** Re-sync when the last sync is older than this (the legacy widget's 5 minutes). */
export const SYNC_MAX_AGE_MS = 5 * 60 * 1000;

/** Now, on the server's clock. Use instead of Date.now() for timers. */
export function syncedNow(): number {
  return Date.now() + offsetMs;
}

/**
 * Syncs with the server. Without `force`, only when the last sync is older
 * than SYNC_MAX_AGE_MS. A failed sync falls back to the phone's clock, as the
 * legacy code did.
 */
export function syncServerTime({ force = false } = {}): Promise<void> {
  if (!force && Date.now() - lastSyncAt < SYNC_MAX_AGE_MS) return Promise.resolve();
  if (!inFlight) {
    inFlight = apiFetch<{ now: number }>('/now/')
      .then(({ now }) => {
        offsetMs = now - Date.now();
        lastSyncAt = Date.now();
      })
      .catch((error: unknown) => {
        console.error('Failed to sync server time, using client time.', error);
        offsetMs = 0;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Tests only. */
export function resetServerTime() {
  offsetMs = 0;
  lastSyncAt = 0;
  inFlight = null;
}

/** Server time, re-rendering every `intervalMs` while `active`. */
export function useSyncedNow(active = true, intervalMs = 1000): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((tick) => tick + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  // Read at render: always current, also on the render that turns it active.
  return syncedNow();
}

/** "HH:MM:SS" for a number of seconds (legacy formatTime); negative shows 00:00:00. */
export function formatElapsed(seconds: number): string {
  const secs = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}
