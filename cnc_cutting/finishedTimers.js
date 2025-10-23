// --- finishedTimers.js ---
import { fetchTimers } from './cnc_cuttingTimers.js';
import { Pagination } from '../components/pagination/pagination.js';
import { formatDateTime, formatDurationFromHoursToMinutes } from '../generic/formatters.js';
import { HeaderComponent } from '../components/header/header.js';
import { ResultsTable } from '../components/resultsTable/resultsTable.js';

// ============================================================================
// FINISHED TIMERS TAB FUNCTIONALITY
// ============================================================================

// Global instances
let paginationInstance = null;
let resultsTableInstance = null;

/**
 * Main entry point - loads the finished timers content and initializes the page
 */
export function loadFinishedTimersContent() {
    createFinishedTimersHTML();
    setDefaultDateFilters();
    loadFinishedTimersData();
    bindFinishedTimersEvents();
}

/**
 * Creates and inserts the HTML structure for the finished timers page
 */
function createFinishedTimersHTML() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="finished-timers-view">
            <!-- Header placeholder -->
            <div id="header-placeholder"></div>
            
            <!-- Results Table Container -->
            <div id="results-table-container"></div>
            
            <!-- Pagination Section -->
            <div class="pagination-section">
                <div id="pagination-container"></div>
            </div>
        </div>
    `;
    
    // Create header component
    createHeader();
    
    // Create results table component
    createResultsTable();
}

/**
 * Creates the header component for finished timers
 */
function createHeader() {
    new HeaderComponent({
        title: 'Tamamlanan Zamanlayıcılar',
        subtitle: 'Tamamlanan işleri görüntüleyin ve analiz edin',
        icon: 'check-circle',
        containerId: 'header-placeholder',
        showBackButton: 'none',
        showCreateButton: 'none',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        onRefreshClick: () => {
            loadFinishedTimersData(1);
        }
    });
}

/**
 * Creates the results table component for finished timers
 */
function createResultsTable() {
    const container = document.getElementById('results-table-container');
    if (!container) return;
    
    // Destroy existing instance if it exists
    if (resultsTableInstance) {
        resultsTableInstance.destroy();
    }
    
    resultsTableInstance = new ResultsTable(container, {
        title: 'Tamamlanan Zamanlayıcılar',
        icon: 'fas fa-check-circle',
        showFilters: true,
        filters: [
            {
                id: 'start-date',
                label: 'Başlangıç Tarihi',
                type: 'date'
            },
            {
                id: 'end-date',
                label: 'Bitiş Tarihi',
                type: 'date'
            }
        ],
        onFilterApply: (filterValues) => {
            loadFinishedTimersData(1);
        },
        onFilterClear: () => {
            loadFinishedTimersData(1);
        }
    });
}

/**
 * Sets default date filters to last 30 days
 */
function setDefaultDateFilters() {
    if (!resultsTableInstance) return;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    // Set default values in the results table filters
    const endDateInput = resultsTableInstance.container.querySelector('#end-date');
    const startDateInput = resultsTableInstance.container.querySelector('#start-date');
    
    if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
    if (startDateInput) startDateInput.value = startDate.toISOString().split('T')[0];
}

/**
 * Loads finished timers data from the API and displays it
 * @param {number} page - Page number for pagination
 */
async function loadFinishedTimersData(page = 1) {
    if (resultsTableInstance) {
        resultsTableInstance.showLoadingState();
    }
    
    try {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', 20);
        params.append('ordering', '-finish_time');
        params.append('is_active', false);
        
        // Get filter values from results table
        if (resultsTableInstance) {
            const filterValues = resultsTableInstance.getFilterValues();
            if (filterValues['start-date']) params.append('start_date', filterValues['start-date']);
            if (filterValues['end-date']) params.append('end_date', filterValues['end-date']);
        }
        
        const apiData = await fetchTimers(params);
        const data = apiData.results || apiData;
        
        // Convert timers to ResultsTable format
        const formattedTimers = data.map(timer => ({
            title: timer.issue_key || 'Bilinmeyen İş',
            subtitle: timer.issue_name || 'Açıklama yok',
            icon: 'fas fa-check-circle',
            iconColor: '#28a745',
            iconBackground: '#d4edda',
            details: [
                {
                    icon: 'fas fa-cut',
                    label: 'Makine:',
                    value: timer.machine_name || 'Bilinmeyen'
                },
                {
                    icon: 'fas fa-user',
                    label: 'Kullanıcı:',
                    value: timer.username || 'Bilinmeyen'
                },
                {
                    icon: 'fas fa-play',
                    label: 'Başlangıç:',
                    value: formatDateTime(timer.start_time)
                },
                {
                    icon: 'fas fa-stop',
                    label: 'Bitiş:',
                    value: formatDateTime(timer.finish_time)
                },
                {
                    icon: 'fas fa-clock',
                    label: 'Süre:',
                    value: formatDurationFromHoursToMinutes(timer.duration),
                    valueClass: 'duration'
                },
                {
                    icon: 'fas fa-hashtag',
                    label: 'İş Emri:',
                    value: timer.job_no || '-'
                }
            ]
        }));
        
        if (resultsTableInstance) {
            resultsTableInstance.setItems(formattedTimers);
            resultsTableInstance.updateResultsInfo(apiData.count || data.length);
        }
        
        createPaginationComponent(apiData.count, page);
        
    } catch (error) {
        if (resultsTableInstance) {
            resultsTableInstance.showErrorState(error);
        }
    }
}



/**
 * Creates pagination component for the results
 * @param {number} count - Total number of records
 * @param {number} currentPage - Current page number
 */
function createPaginationComponent(count, currentPage) {
    const paginationContainer = document.getElementById('pagination-container');
    
    if (!paginationContainer) return;
    
    if (!count || count <= 20) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(count / 20);
    
    // Destroy existing pagination if it exists
    if (paginationInstance) {
        paginationInstance.destroy();
    }
    
    // Create new pagination component
    paginationInstance = new Pagination(paginationContainer, {
        currentPage: currentPage,
        totalPages: totalPages,
        totalCount: count,
        pageSize: 20,
        showInfo: true,
        showFirstLast: true,
        maxVisiblePages: 5,
        onPageChange: loadFinishedTimersData
    });
}

/**
 * Binds all event listeners for the finished timers page
 */
function bindFinishedTimersEvents() {
    // Events are now handled by the ResultsTable component
    // No additional event binding needed
}


// Make the function globally accessible
window.loadFinishedTimersData = loadFinishedTimersData;
