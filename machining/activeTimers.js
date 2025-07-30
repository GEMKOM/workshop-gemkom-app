// --- activeTimers.js ---
import { fetchMachines } from '../generic/machines.js';

// ============================================================================
// ACTIVE TIMERS TAB FUNCTIONALITY
// ============================================================================

export function loadActiveTimersContent() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="loading-container text-center py-5">
            <div class="loading-spinner"></div>
            <p class="mt-3 text-muted">Aktif zamanlayıcılar yükleniyor...</p>
        </div>
    `;
    
    // Import and use the machine task view
    import('../components/machineTaskView.js').then(({ createMachineTaskView }) => {
        createMachineTaskView({
            containerId: 'main-view',
            fetchMachines: async () => {
                const data = await fetchMachines("machining");
                return data.results || data;
            },
            fetchTasks: async (machineId) => {
                const { backendBase } = await import('../base.js');
                const { authedFetch } = await import('../authService.js');
                const resp = await authedFetch(`${backendBase}/machining/tasks/?machine_fk=${machineId}`);
                const data = await resp.json();
                return data.results || data;
            },
            machineLabel: 'Makine Seçimi',
            searchPlaceholder: 'TI numarası ile ara...',
            taskDetailBasePath: '/machining/tasks/'
        });
    });
} 