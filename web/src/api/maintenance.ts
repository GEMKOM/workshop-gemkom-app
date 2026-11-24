import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './client';

// Maintenance and fault requests, as the legacy generic/machines.js and
// generic/faultTimers.js used them.

export interface Machine {
  id: number;
  name?: string | null;
  code?: string | null;
  machine_type_label?: string | null;
  assigned_users?: { username?: string | null }[] | null;
  [key: string]: unknown;
}

export interface Fault {
  id: number;
  machine?: number | null;
  machine_fk?: number | null;
  machine_name?: string | null;
  asset_name?: string | null;
  location?: string | null;
  description?: string | null;
  is_breaking?: boolean | null;
  is_maintenance?: boolean | null;
  reported_at?: string | null;
  reported_by_username?: string | null;
  resolved_at?: string | null;
  resolution_description?: string | null;
  [key: string]: unknown;
}

export interface FaultTimer {
  id: number;
  start_time?: number | string | null;
  finish_time?: number | null;
  end_time?: number | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

function results<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export const maintenanceKeys = {
  machines: ['maintenance', 'machines'] as const,
  faults: (unresolved: boolean) => ['maintenance', 'faults', { unresolved }] as const,
  allFaults: ['maintenance', 'faults'] as const,
  fault: (id: string) => ['maintenance', 'fault', id] as const,
  faultTimers: (id: string) => ['maintenance', 'faultTimers', id] as const,
};

/** The machines a request can be for (not IT equipment). */
export function maintenanceMachinesQueryOptions() {
  return queryOptions({
    queryKey: maintenanceKeys.machines,
    queryFn: async ({ signal }) =>
      results<Machine>(
        await apiFetch<unknown>('/machines/', {
          params: { page_size: 1000, compact: true, exclude_used_in: 'it' },
          signal,
        }),
      ),
    staleTime: 5 * 60 * 1000,
  });
}

/** Open (unresolved) or resolved faults and maintenance requests. */
export function faultsQueryOptions(unresolved: boolean) {
  return queryOptions({
    queryKey: maintenanceKeys.faults(unresolved),
    queryFn: async ({ signal }) =>
      results<Fault>(
        await apiFetch<unknown>('/machines/faults/', {
          params: { page_size: 1000, unresolved },
          signal,
        }),
      ),
  });
}

export function faultQueryOptions(id: string) {
  return queryOptions({
    queryKey: maintenanceKeys.fault(id),
    queryFn: ({ signal }) => apiFetch<Fault>(`/machines/faults/${id}/`, { signal }),
  });
}

/** The fault's running timer: flagged active, or without a finish/end time. */
export function activeFaultTimer(timers: FaultTimer[]): FaultTimer | null {
  return (
    timers.find((t) => t.is_active === true) ??
    timers.find((t) => t.finish_time == null && t.end_time == null) ??
    null
  );
}

export function faultTimerQueryOptions(faultId: string) {
  return queryOptions({
    queryKey: maintenanceKeys.faultTimers(faultId),
    queryFn: async ({ signal }) =>
      activeFaultTimer(
        results<FaultTimer>(
          await apiFetch<unknown>('/machines/faults/timers/', {
            params: { issue_key: faultId },
            signal,
          }),
        ),
      ),
  });
}

export interface NewMaintenanceRequest {
  kind: 'maintenance' | 'fault';
  description: string;
  /** For faults; maintenance requests are always operable. */
  operable: boolean;
  machineId?: number | null;
  /** Equipment not in the machine list. */
  custom?: { assetName: string; location: string } | null;
}

/** The legacy create payload. */
export function maintenanceRequestBody(request: NewMaintenanceRequest) {
  const body: Record<string, unknown> = {
    is_maintenance: request.kind === 'maintenance',
    description: request.description,
    is_breaking: request.kind === 'fault' ? !request.operable : false,
  };
  if (request.custom) {
    body.asset_name = request.custom.assetName;
    body.location = request.custom.location;
  } else {
    body.machine = request.machineId;
  }
  return body;
}

export function createMaintenanceRequest(request: NewMaintenanceRequest) {
  return apiFetch<Fault>('/machines/faults/', {
    method: 'POST',
    body: maintenanceRequestBody(request),
  });
}

export function startFaultTimer(fault: Fault, startTime: number) {
  const machineFk = fault.machine ?? fault.machine_fk ?? null;
  return apiFetch<unknown>('/machines/faults/timers/start/', {
    method: 'POST',
    body: {
      task_key: String(fault.id),
      task_type: 'machine_fault',
      start_time: startTime,
      ...(machineFk != null ? { machine_fk: machineFk } : {}),
    },
  });
}

export function stopFaultTimer(timerId: number, finishTime: number) {
  return apiFetch<unknown>('/machines/faults/timers/stop/', {
    method: 'POST',
    body: { timer_id: timerId, finish_time: finishTime },
  });
}

export function completeFault(faultId: number, resolution: string) {
  return apiFetch<unknown>(`/machines/faults/${faultId}/complete/`, {
    method: 'POST',
    body: { resolution_description: resolution },
  });
}
