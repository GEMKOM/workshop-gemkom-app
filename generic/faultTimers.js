import { backendBase } from '../base.js';
import { authedFetch } from '../authService.js';

function buildUrlWithParams(baseUrl, paramsObj = {}) {
    const params = new URLSearchParams();
    Object.entries(paramsObj || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') {
            params.append(k, String(v));
        }
    });
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
}

/**
 * GET /machines/faults/timers/
 * Supports filtering by ?issue_key=<fault_id> (and other shared timer filters if backend supports)
 */
export async function fetchFaultTimers(params = {}) {
    const url = buildUrlWithParams(`${backendBase}/machines/faults/timers/`, params);
    const res = await authedFetch(url);
    if (!res.ok) {
        throw new Error('Failed to fetch fault timers');
    }
    return await res.json();
}

/**
 * POST /machines/faults/timers/start/
 * { task_key, task_type: "machine_fault", start_time, machine_fk?: number }
 */
export async function startFaultTimer({ taskKey, startTime, machineFk = null }) {
    const body = {
        task_key: String(taskKey),
        task_type: 'machine_fault',
        start_time: startTime
    };
    if (machineFk !== null && machineFk !== undefined && machineFk !== '') {
        body.machine_fk = machineFk;
    }

    const res = await authedFetch(`${backendBase}/machines/faults/timers/start/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const data = await safeJson(res);
        const msg = data?.error || data?.detail || 'Failed to start fault timer';
        const err = new Error(msg);
        err.data = data;
        throw err;
    }
    return await res.json();
}

/**
 * POST /machines/faults/timers/stop/
 * { timer_id, finish_time }
 */
export async function stopFaultTimer({ timerId, finishTime }) {
    const res = await authedFetch(`${backendBase}/machines/faults/timers/stop/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timer_id: timerId,
            finish_time: finishTime
        })
    });
    if (!res.ok) {
        const data = await safeJson(res);
        const msg = data?.error || data?.detail || 'Failed to stop fault timer';
        const err = new Error(msg);
        err.data = data;
        throw err;
    }
    return await res.json().catch(() => ({}));
}

/**
 * POST /machines/faults/<id>/complete/
 * { resolution_description }
 */
export async function completeFault({ faultId, resolutionDescription }) {
    const res = await authedFetch(`${backendBase}/machines/faults/${faultId}/complete/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resolution_description: resolutionDescription
        })
    });
    if (!res.ok) {
        const data = await safeJson(res);
        const msg = data?.error || data?.detail || 'Failed to complete fault';
        const err = new Error(msg);
        err.data = data;
        throw err;
    }
    return await res.json().catch(() => ({}));
}

async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

