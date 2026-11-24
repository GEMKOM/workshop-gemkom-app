import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

// The running timers of the signed-in user across the workshop's three timer
// kinds, as the legacy timer widget loaded them (components/timerWidget.js).

export type TimerModule = 'machining' | 'cnc_cutting' | 'maintenance_fault';

export interface ActiveTimer {
  id: number;
  module: TimerModule;
  start_time: number;
  finish_time?: number | null;
  machine_fk?: number | null;
  machine_name?: string | null;
  issue_key?: string | null;
  issue_is_hold_task?: boolean | null;
  /** 'productive', or a downtime kind (break, downtime...). */
  timer_type?: string | null;
  downtime_reason_name?: string | null;
  /** CNC: the kesim kodu. */
  nesting_id?: string | null;
  /** Fault timers: the fault id. */
  task_key?: string | number | null;
  end_time?: number | null;
  fault_is_resolved?: boolean | null;
  [key: string]: unknown;
}

function results<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

/** All running timers: machining, CNC and fault timers, de-duplicated by id. */
export async function fetchActiveTimers(signal?: AbortSignal): Promise<ActiveTimer[]> {
  const [machining, cnc, faults] = await Promise.all([
    apiFetch<unknown>('/machining/timers/', { params: { is_active: true }, signal }),
    apiFetch<unknown>('/cnc_cutting/timers/', { params: { is_active: true }, signal }),
    apiFetch<unknown>('/machines/faults/timers/', { signal }),
  ]);
  const tagged = [
    ...results<ActiveTimer>(machining)
      .filter((t) => !t.finish_time)
      .map((t) => ({ ...t, module: 'machining' as const })),
    ...results<ActiveTimer>(cnc)
      .filter((t) => !t.finish_time)
      .map((t) => ({ ...t, module: 'cnc_cutting' as const })),
    // A fault timer is running while it has no finish/end time and its fault is open.
    ...results<ActiveTimer>(faults)
      .filter((t) => t.finish_time == null && t.end_time == null && t.fault_is_resolved !== true)
      .map((t) => ({ ...t, module: 'maintenance_fault' as const })),
  ];
  const seen = new Set<number>();
  return tagged.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

export const timerKeys = {
  active: ['timers', 'active'] as const,
};

/** Re-checked every 15 minutes while timers run (legacy "admin stop" poll), and on wake. */
export const ACTIVE_TIMERS_POLL_MS = 15 * 60 * 1000;

export function activeTimersQueryOptions() {
  return queryOptions({
    queryKey: timerKeys.active,
    queryFn: ({ signal }) => fetchActiveTimers(signal),
    refetchInterval: (query) => (query.state.data?.length ? ACTIVE_TIMERS_POLL_MS : false),
    refetchOnWindowFocus: true,
  });
}

/** After starting or stopping a timer (legacy `timerUpdated` event). */
export function timersChanged(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: timerKeys.active });
}

/** The page a timer belongs to (legacy widget links). */
export function timerPath(timer: ActiveTimer): string {
  if (timer.module === 'maintenance_fault') {
    const faultId = timer.task_key ?? timer.issue_key;
    return `/maintenance/faults/task/?fault_id=${encodeURIComponent(String(faultId ?? ''))}`;
  }
  const area = timer.module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
  const params = new URLSearchParams({ machine_id: String(timer.machine_fk ?? '') });
  if (timer.timer_type === 'productive' && timer.issue_key) {
    params.set('key', timer.issue_key);
    if (timer.issue_is_hold_task) params.set('hold', '1');
  } else {
    // A break or downtime timer has no task: its page is found by the timer.
    params.set('timer_id', String(timer.id));
  }
  return `/${area}/tasks/?${params.toString()}`;
}

/** What a timer is called in the list (legacy widget). */
export function timerLabel(timer: ActiveTimer): string {
  if (timer.module === 'maintenance_fault') {
    return `ARIZA-${timer.task_key ?? timer.issue_key ?? timer.id}`;
  }
  if (timer.module === 'cnc_cutting' && timer.nesting_id) return timer.nesting_id;
  if (timer.timer_type !== 'productive' && timer.downtime_reason_name) {
    return timer.downtime_reason_name;
  }
  return timer.issue_key || `Timer ${timer.id}`;
}
