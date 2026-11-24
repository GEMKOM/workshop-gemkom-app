import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './client';

// Kaynak Puantaj (the welder's daily timesheet), as the legacy
// welding/timesheet/timesheet.js used it. The office approves on the office app.

export interface TimesheetCell {
  start: string;
  end: string;
  hours: number | string;
}

export interface TimesheetRow {
  job_no: string;
  title?: string | null;
  cells: boolean[];
}

export interface SuggestedJob {
  job_no: string;
  title?: string | null;
  /** 'team' | 'recent' | 'general' */
  origin?: string | null;
  closed?: boolean | null;
}

export interface TimesheetDay {
  date: string;
  allowed_dates: string[];
  cells: TimesheetCell[];
  employee: { full_name?: string | null };
  locked?: boolean | null;
  kind?: string | null;
  kind_label?: string | null;
  rejection?: { reason?: string | null } | null;
  submission?: {
    blank_day?: boolean | null;
    note?: string | null;
    submitted_at?: string | null;
    rows?: TimesheetRow[] | null;
    flags?: { text: string }[] | null;
  } | null;
  suggested_jobs?: SuggestedJob[] | null;
}

export const timesheetKeys = {
  day: (date: string | null) => ['welding', 'timesheetDay', date ?? 'today'] as const,
};

export function timesheetDayQueryOptions(date: string | null) {
  return queryOptions({
    queryKey: timesheetKeys.day(date),
    queryFn: ({ signal }) =>
      apiFetch<TimesheetDay>('/welding/timesheets/mobile/day/', {
        params: date ? { date } : {},
        signal,
      }),
    // A day being edited must not be swapped under the welder's fingers.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export async function searchTimesheetJobs(
  q: string,
  signal?: AbortSignal,
): Promise<SuggestedJob[]> {
  const data = await apiFetch<{ results?: SuggestedJob[] }>('/welding/timesheets/mobile/jobs/', {
    params: { q },
    signal,
  });
  return data.results ?? [];
}

export interface TimesheetSubmit {
  date: string;
  blank_day: boolean;
  rows: { job_no: string; cells: boolean[] }[];
  note: string;
}

/** Sends the day; the server answers with the day as it now stands. */
export function submitTimesheet(body: TimesheetSubmit) {
  return apiFetch<TimesheetDay>('/welding/timesheets/mobile/submit/', { method: 'POST', body });
}
