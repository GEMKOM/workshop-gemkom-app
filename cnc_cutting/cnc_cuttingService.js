// --- cnc_cuttingService.js ---
import { backendBase } from '../base.js';
import { authedFetch } from '../authService.js';

export const state = {
    intervalId: null,
    currentIssue: {
        key: null,
        name: null,
        job_no: null,
        image_no: null,
        position_no: null,
        quantity: null,
        machine_id: null,
        machine_name: null
    },
    currentTimer: {
        id: null,
        start_time: null
    },
    currentMachine: null
};

export async function stopTimerShared({ timerId, finishTime, syncToJira }) {
    const response = await authedFetch(`${backendBase}/cnc_cutting/timers/stop/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timer_id: timerId,
            finish_time: finishTime,
            synced_to_jira: syncToJira
        })
    });
    return response.ok;
}
