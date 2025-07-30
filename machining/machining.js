// --- machining.js ---
import { createMachineTaskView } from '../components/machineTaskView.js';
import { fetchMachines } from '../generic/machines.js';
import { fetchTasksForMachining } from './machiningService.js';
import { guardRoute, authedFetch } from '../authService.js';
import { backendBase } from '../base.js';
import { GenericReport } from '../components/genericReport.js';
import { createHeader, populateUserInfo } from '../components/header.js';
import { createFooter } from '../components/footer.js';

// ============================================================================
// MOBILE NAVIGATION
// ============================================================================

function setupMobileNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const section = tab.dataset.section;
            
            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Load appropriate content
            switch(section) {
                case 'active-timers':
                    showActiveTimers();
                    break;
                case 'finished-timers':
                    showFinishedTimers();
                    break;
            }
        });
    });
}

// ============================================================================
// CONTENT FUNCTIONS
// ============================================================================

async function showActiveTimers() {
    const mainView = document.getElementById('main-view');
    await createMachineTaskView({
        containerId: 'main-view',
        fetchMachines: () => fetchMachines('machining'),
        fetchTasks: fetchTasksForMachining,
        title: 'Talaşlı İmalat',
        machineLabel: 'Makine Seçimi',
        searchPlaceholder: 'TI numarası ile ara...',
        taskDetailBasePath: '/machining/tasks/'
    });
}

async function showFinishedTimers() {
    const mainView = document.getElementById('main-view');
    if (!mainView) return;

    // Clear the main view and create container for the generic report
    mainView.innerHTML = '<div id="machining-finished-timers-report" class="generic-report-container"></div>';

    // All possible columns from API
    const allColumns = [
        { key: 'username', label: 'Kullanıcı' },
        { key: 'issue_key', label: 'TI No' },
        { key: 'job_no', label: 'İş No' },
        { key: 'machine_name', label: 'Makine' },
        { key: 'start_time', label: 'Başlangıç' },
        { key: 'finish_time', label: 'Bitiş' },
        { key: 'duration', label: 'Süre (saat)' },
        { key: 'synced_to_jira', label: 'Jira Senkronize' },
        { key: 'comment', label: 'Yorum' },
        { key: 'image_no', label: 'Resim No' },
        { key: 'position_no', label: 'Pozisyon No' },
        { key: 'quantity', label: 'Adet' },
        { key: 'manual_entry', label: 'Manuel Giriş' },
        { key: 'stopped_by', label: 'Durduran' },
        { key: 'id', label: 'ID' },
    ];

    // Default columns
    const defaultColumns = ['username', 'issue_key', 'job_no', 'machine_name', 'start_time', 'finish_time', 'duration'];

    // Set default values for date inputs (today for finish, 7 days ago for start)
    const today = new Date();

    // Configure the generic report
    const report = new GenericReport({
        title: 'Biten Zamanlayıcılar',
        containerId: 'machining-finished-timers-report',
        apiEndpoint: `${backendBase}/machining/timers/`,
        defaultColumns: defaultColumns,
        allColumns: allColumns,
        showEditButton: false, // No edit buttons
        showDeleteButton: false, // No delete buttons
        pageSize: 10, // Show 10 records per page
        defaultParams: {
            is_active: 'false'
        },
        filters: [
            {
                key: 'issue_key',
                label: 'TI Numarası',
                type: 'text',
                placeholder: 'TI-123'
            },
            {
                key: 'job_no',
                label: 'İş No',
                type: 'text',
                placeholder: 'İş No'
            },
            {
                key: 'start_after',
                label: 'Başlangıç Tarihi',
                type: 'datetime',
                defaultValue: today.toISOString().slice(0, 10),
                defaultTime: '07:00'
            },
            {
                key: 'start_before',
                label: 'Bitiş Tarihi',
                type: 'datetime',
                defaultValue: today.toISOString().slice(0, 10),
                defaultTime: '17:15'
            }
        ],
        onDataTransform: (row, col, val) => {
            // Custom data transformation for duration calculation
            if (col === 'duration') {
                if (row.finish_time && row.start_time) {
                    return ((row.finish_time - row.start_time) / 3600000).toFixed(2);
                }
                return '';
            }
            return val;
        }
    });
}


// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) {
        return;
    }
    
    // Insert header and footer
    const headerContainer = document.getElementById('header-container');
    const footerContainer = document.getElementById('footer-container');
    
    if (headerContainer) {
        headerContainer.innerHTML = createHeader();
    }
    
    if (footerContainer) {
        footerContainer.innerHTML = createFooter();
    }
    
    // Populate user info
    populateUserInfo();
    
    // Setup mobile navigation
    setupMobileNavigation();
    
    // Initialize the default view (Active Timers)
    await showActiveTimers();
});


// state.currentMachine = {
//     id: selectedOption.dataset.machineId,
//     name: selectedOption.textContent
// }