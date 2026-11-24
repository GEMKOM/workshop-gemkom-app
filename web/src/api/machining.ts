import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { apiFetch } from './client';
import { ACTIVE_TIMERS_POLL_MS } from './timers';

// Machining (Talaşlı İmalat), as the legacy generic/machining/operations.js,
// generic/machines.js and generic/timers.js used it. Shared bits (machines,
// downtime reasons, module timers) also serve the CNC pages.

export type TimerArea = 'machining' | 'cnc_cutting';

export interface MachineOption {
  id: number;
  name: string;
  has_active_timer?: boolean | null;
  is_under_maintenance?: boolean | null;
  [key: string]: unknown;
}

export interface MachineDetail extends MachineOption {
  [key: string]: unknown;
}

export interface Operation {
  key: string;
  name?: string | null;
  part_task_key?: string | null;
  part_key?: string | null;
  part_name?: string | null;
  part_job_no?: string | null;
  part_image_no?: string | null;
  part_position_no?: string | null;
  part_quantity?: number | string | null;
  part_job_allocations?: { job_no: string; quantity: number | string }[] | null;
  plan_order?: number | null;
  order?: number | null;
  due_date?: string | null;
  projected_late?: boolean | null;
  [key: string]: unknown;
}

export interface ModuleTimer {
  id: number;
  start_time: number | string;
  finish_time?: number | string | null;
  machine_fk?: number | null;
  machine_name?: string | null;
  issue_key?: string | null;
  issue_name?: string | null;
  issue_is_hold_task?: boolean | null;
  timer_type?: string | null;
  downtime_reason_name?: string | null;
  can_be_stopped_by_user?: boolean | null;
  username?: string | null;
  duration?: number | string | null;
  job_no?: string | null;
  [key: string]: unknown;
}

export interface DowntimeReason {
  id: number;
  name: string;
  code?: string | null;
  creates_timer?: boolean | null;
}

interface Page<T> {
  count?: number;
  next?: string | null;
  results: T[];
}

function results<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export const machiningKeys = {
  machineOptions: (usedIn: string) => ['machines', 'dropdown', usedIn] as const,
  machine: (id: string) => ['machines', 'detail', id] as const,
  operations: (machineId: string, search: string) =>
    ['machining', 'operations', machineId, search] as const,
  operation: (key: string) => ['machining', 'operation', key] as const,
  downtimeReasons: ['machining', 'downtimeReasons'] as const,
  moduleTimers: (area: TimerArea) => ['moduleTimers', area] as const,
  activeOnMachine: (area: TimerArea, machineId: string, issueKey: string | null) =>
    ['moduleTimers', area, 'active', machineId, issueKey ?? ''] as const,
  finished: (area: TimerArea, page: number, start: string, end: string) =>
    ['moduleTimers', area, 'finished', page, start, end] as const,
};

/** The machines of an area with whether each is busy or under maintenance. */
export function machineOptionsQueryOptions(usedIn: string) {
  return queryOptions({
    queryKey: machiningKeys.machineOptions(usedIn),
    queryFn: async ({ signal }) =>
      results<MachineOption>(
        await apiFetch<unknown>('/machines/dropdown/', {
          params: { used_in: usedIn, include_availability: true },
          signal,
        }),
      ),
  });
}

export function machineQueryOptions(id: string) {
  return queryOptions({
    queryKey: machiningKeys.machine(id),
    queryFn: ({ signal }) => apiFetch<MachineDetail>(`/machines/${id}/`, { signal }),
  });
}

/** Open, planned operations of a machine; the search runs on the server. */
export function operationsQueryOptions(machineId: string, search: string) {
  return queryOptions({
    queryKey: machiningKeys.operations(machineId, search),
    queryFn: async ({ signal }) =>
      results<Operation>(
        await apiFetch<unknown>('/tasks/operations/', {
          params: {
            view: 'operator',
            machine_fk: machineId,
            completion_date__isnull: true,
            in_plan: true,
            search: search || undefined,
          },
          signal,
        }),
      ),
    // A new search shows the previous list until it answers; an older answer
    // never replaces a newer one (the query key carries the search).
    placeholderData: keepPreviousData,
  });
}

export function operationQueryOptions(key: string) {
  return queryOptions({
    queryKey: machiningKeys.operation(key),
    queryFn: ({ signal }) => apiFetch<Operation>(`/tasks/operations/${key}/`, { signal }),
  });
}

export function downtimeReasonsQueryOptions() {
  return queryOptions({
    queryKey: machiningKeys.downtimeReasons,
    queryFn: async ({ signal }) =>
      results<DowntimeReason>(await apiFetch<unknown>('/tasks/downtime-reasons/', { signal })),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * The running timers on a machine (optionally for one task), as the legacy
 * task pages loaded them. Re-checked on wake and every 15 minutes, so a timer
 * stopped elsewhere doesn't stay on screen.
 */
export function activeOnMachineQueryOptions(
  area: TimerArea,
  machineId: string,
  issueKey: string | null,
) {
  return queryOptions({
    queryKey: machiningKeys.activeOnMachine(area, machineId, issueKey),
    queryFn: async ({ signal }) =>
      results<ModuleTimer>(
        await apiFetch<unknown>(`/${area}/timers/`, {
          params: { is_active: true, machine_fk: machineId, issue_key: issueKey ?? undefined },
          signal,
        }),
      ),
    refetchOnWindowFocus: true,
    refetchInterval: ACTIVE_TIMERS_POLL_MS,
  });
}

export const FINISHED_PAGE_SIZE = 20;

export function finishedTimersQueryOptions(
  area: TimerArea,
  page: number,
  start: string,
  end: string,
) {
  return queryOptions({
    queryKey: machiningKeys.finished(area, page, start, end),
    queryFn: async ({ signal }): Promise<Page<ModuleTimer>> => {
      const data = await apiFetch<Page<ModuleTimer> | ModuleTimer[]>(`/${area}/timers/`, {
        params: {
          page,
          page_size: FINISHED_PAGE_SIZE,
          ordering: '-finish_time',
          is_active: false,
          start_date: start || undefined,
          end_date: end || undefined,
        },
        signal,
      });
      return Array.isArray(data) ? { results: data } : data;
    },
    placeholderData: keepPreviousData,
  });
}

export function startOperationTimer(key: string) {
  return apiFetch<{ timer_id?: number }>(`/tasks/operations/${key}/start-timer/`, {
    method: 'POST',
    body: {},
  });
}

export interface LogReasonBody {
  reason_id: number;
  /** From the operations list: the machine the reason is for. */
  machine_id?: number | string;
  /** From a running productive timer: the timer the reason stops. */
  current_timer_id?: number;
  comment?: string;
}

export interface LogReasonResult {
  new_timer_id?: number | null;
  timer?: ModuleTimer | null;
}

export function logReason(body: LogReasonBody) {
  return apiFetch<LogReasonResult>('/tasks/log-reason/', { method: 'POST', body });
}

/** Stops a (non-productive) timer with a server-clock finish time. */
export function stopModuleTimer(
  area: TimerArea,
  timerId: number,
  finishTime: number,
  syncToJira: boolean,
) {
  return apiFetch<unknown>(`/${area}/timers/stop/`, {
    method: 'POST',
    body: { timer_id: timerId, finish_time: finishTime, synced_to_jira: syncToJira },
  });
}

/** The legacy rule: lunch and short breaks need no comment; every other reason does. */
export function reasonCommentOptional(reason: Pick<DowntimeReason, 'code' | 'name'>): boolean {
  const code = reason.code ?? '';
  const name = reason.name ?? '';
  return (
    code === 'LUNCH' ||
    code === 'BREAK' ||
    ['Yemek Molası', 'Yemek Molasi', 'Kısa mola', 'Kisa Mola'].includes(name)
  );
}

/** The task page of a timer that log-reason started (legacy redirect). */
export function timerTaskPath(area: TimerArea, timer: ModuleTimer): string {
  const params = new URLSearchParams({ machine_id: String(timer.machine_fk ?? '') });
  if (timer.timer_type === 'productive' && timer.issue_key) params.set('key', timer.issue_key);
  else params.set('timer_id', String(timer.id));
  return `/${area}/tasks/?${params.toString()}`;
}
