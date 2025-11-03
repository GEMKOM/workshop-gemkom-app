// --- machiningService.js ---

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