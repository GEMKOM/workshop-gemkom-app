import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { apiFetch, isApiError } from './client';
import type { MachineOption } from './machining';

// CNC cutting (CNC Kesim), as the legacy cnc_cutting pages and generic/tasks.js,
// generic/machines.js and generic/platePieces.js used it.

export interface CncPart {
  id?: number;
  job_no?: string | null;
  image_no?: string | null;
  position_no?: string | null;
  weight_kg?: string | number | null;
  quantity?: number | null;
}

export interface CncFile {
  id?: number;
  file_url?: string | null;
  file_name?: string | null;
  name?: string | null;
  uploaded_by_username?: string | null;
  uploaded_at?: string | null;
}

export interface CncTask {
  key: string;
  name?: string | null;
  nesting_id?: string | null;
  machine_fk?: number | null;
  machine_name?: string | null;
  in_plan?: boolean | null;
  plan_order?: number | null;
  material?: string | null;
  dimensions?: string | null;
  thickness_mm?: string | number | null;
  quantity?: number | null;
  parts?: CncPart[] | null;
  parts_count?: number | null;
  files?: CncFile[] | null;
  finish_time?: number | string | null;
  estimated_hours?: number | string | null;
  total_hours_spent?: number | null;
  sheets_waiting?: number | null;
  [key: string]: unknown;
}

export interface HoldTask {
  key: string;
  name?: string | null;
  job_no?: string | null;
}

export interface PieceReservation {
  quantity?: number | string | null;
  cnc_task?: string | null;
  pull_request?: string | number | null;
}

export interface PlatePiece {
  id: number;
  code?: string | null;
  item_code?: string | null;
  item_name?: string | null;
  shape?: string | null;
  width_mm?: string | number | null;
  length_mm?: string | number | null;
  area_m2?: string | number | null;
  plate_thickness_mm?: string | number | null;
  quantity?: number | string | null;
  reserved_quantity?: number | string | null;
  available_quantity?: number | string | null;
  total_kg?: string | number | null;
  heat_number?: string | null;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  supplier_name?: string | null;
  job_no?: string | null;
  origin_label?: string | null;
  parent_code?: string | null;
  reservations?: PieceReservation[] | null;
}

export interface PlateGroup {
  item_code?: string | null;
  shape?: string | null;
  width_mm?: string | number | null;
  length_mm?: string | number | null;
  quantity?: number | string | null;
  pieces?: PlatePiece[] | null;
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

export const cncKeys = {
  machines: ['cnc', 'machines'] as const,
  machineTasks: (machineId: string) => ['cnc', 'tasks', 'machine', machineId] as const,
  openTasks: ['cnc', 'tasks', 'open'] as const,
  task: (key: string) => ['cnc', 'task', key] as const,
  holdTasks: ['cnc', 'holdTasks'] as const,
  plateGroups: (page: number, search: string) => ['cnc', 'plateGroups', page, search] as const,
};

/** The active cutting machines (with whether each is busy or under maintenance). */
export function cncMachinesQueryOptions() {
  return queryOptions({
    queryKey: cncKeys.machines,
    queryFn: async ({ signal }) =>
      results<MachineOption>(
        await apiFetch<unknown>('/machines/', {
          params: { used_in: 'cutting', is_active: true, page_size: 1000 },
          signal,
        }),
      ),
  });
}

/** A machine's next planned cuts, in plan order (the legacy list showed the first 10). */
export function machineCutsQueryOptions(machineId: string) {
  return queryOptions({
    queryKey: cncKeys.machineTasks(machineId),
    queryFn: async ({ signal }) =>
      results<CncTask>(
        await apiFetch<unknown>('/cnc_cutting/tasks/', {
          params: {
            machine_fk: machineId,
            completion_date__isnull: true,
            in_plan: true,
            ordering: 'plan_order',
            page_size: 10,
          },
          signal,
        }),
      ),
  });
}

/** Every open cut (the overview). */
export function openCutsQueryOptions() {
  return queryOptions({
    queryKey: cncKeys.openTasks,
    queryFn: async ({ signal }) =>
      results<CncTask>(
        await apiFetch<unknown>('/cnc_cutting/tasks/', {
          params: { completion_date__isnull: true, page_size: 1000 },
          signal,
        }),
      ),
  });
}

export function cncTaskQueryOptions(key: string) {
  return queryOptions({
    queryKey: cncKeys.task(key),
    queryFn: ({ signal }) => apiFetch<CncTask>(`/cnc_cutting/tasks/${key}/`, { signal }),
  });
}

export function holdTasksQueryOptions() {
  return queryOptions({
    queryKey: cncKeys.holdTasks,
    queryFn: async ({ signal }) =>
      results<HoldTask>(await apiFetch<unknown>('/cnc_cutting/hold-tasks/', { signal })),
    staleTime: 10 * 60 * 1000,
  });
}

export const PLATE_PAGE_SIZE = 50;

/** Plate stock grouped by size; a page past the end (after a search narrowed it) falls back to page 1. */
export function plateGroupsQueryOptions(page: number, search: string) {
  return queryOptions({
    queryKey: cncKeys.plateGroups(page, search),
    queryFn: async ({ signal }): Promise<Page<PlateGroup> & { page: number }> => {
      const get = (p: number) =>
        apiFetch<Page<PlateGroup>>('/warehouse/pieces/groups/', {
          params: {
            kind: 'plate',
            page: p,
            page_size: PLATE_PAGE_SIZE,
            search: search || undefined,
          },
          signal,
        });
      try {
        return { ...(await get(page)), page };
      } catch (error) {
        if (isApiError(error) && error.status === 404 && page > 1)
          return { ...(await get(1)), page: 1 };
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });
}

/** The overview's columns: Rezerv (no machine, not in plan), Yapılacaklar (no machine, in plan), each machine. */
export function groupCuts(tasks: CncTask[]) {
  const byPlan = (a: CncTask, b: CncTask) =>
    (a.plan_order ?? Number.POSITIVE_INFINITY) - (b.plan_order ?? Number.POSITIVE_INFINITY);
  const reserve: CncTask[] = [];
  const planned: CncTask[] = [];
  const machines = new Map<number, CncTask[]>();
  for (const task of tasks) {
    if (task.in_plan === false) reserve.push(task);
    else if (!task.machine_fk) planned.push(task);
    else machines.set(task.machine_fk, [...(machines.get(task.machine_fk) ?? []), task]);
  }
  reserve.sort(byPlan);
  planned.sort(byPlan);
  for (const list of machines.values()) list.sort(byPlan);
  return { reserve, planned, machines };
}

// ---- the task screen ----

export interface StartCncTimer {
  issue_key: string;
  start_time: number;
  machine_fk: number | string;
  comment?: string;
}

/** Starts a cut's timer; a refusal (e.g. sheets not received) carries the server's message. */
export function startCncTimer(body: StartCncTimer) {
  return apiFetch<{ id?: number }>('/cnc_cutting/timers/start/', { method: 'POST', body });
}

export interface ManualCncTime {
  issue_key: string;
  start_time: number;
  finish_time: number;
  machine_fk: number | string;
  comment?: string;
}

export function createCncManualTime(body: ManualCncTime) {
  return apiFetch<unknown>('/cnc_cutting/manual-time/', { method: 'POST', body });
}

export interface BookedRemnant {
  item_code?: string | null;
  item_name?: string | null;
  shape?: string | null;
  width_mm?: string | number | null;
  length_mm?: string | number | null;
  area_m2?: string | number | null;
  sheets?: { code?: string | null; heat_number?: string | null }[] | null;
}

/** Finishes a cut with its remnants (or none); the answer lists the remnant sheets' codes. */
export function finishCncTask(key: string, payload: { remnants: unknown[]; no_remnant: boolean }) {
  return apiFetch<{ booked?: { remnants?: BookedRemnant[] | null } | null }>(
    '/cnc_cutting/tasks/mark-completed/',
    { method: 'POST', body: { key, ...payload } },
  );
}

/** Hold tasks (W-…) that start without a comment (lunch and the like). */
export const HOLD_TASKS_WITHOUT_COMMENT = new Set(['W-14', 'W-02']);

/** The hold task the fault button opens when the machine has stopped. */
export const MACHINE_FAULT_HOLD = {
  machineId: '7',
  key: 'W-07',
  name: 'Makine Arızası Nedeniyle Bekleme',
};
