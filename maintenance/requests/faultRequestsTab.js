import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { fetchMachineFaults } from '../../generic/machines.js';
import { extractResultsFromResponse } from '../../generic/paginationHelper.js';
import { navigateTo } from '../../authService.js';

let resultsTableInstance = null;
let allFaults = [];

export function loadFaultRequestsTab({ containerId = 'main-view' } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="active-timers-view">
            <!-- Header placeholder (same as machining/activeTimers.js) -->
            <div id="header-placeholder"></div>

            <!-- Machine Selection Section (kept for identical layout, but no selection) -->
            <div class="machine-selection-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Arıza Talepleri
                    </h3>
                    <p class="section-subtitle">Makine seçimi olmadan tüm açık arızalar listelenir</p>
                </div>
            </div>

            <!-- Search Section -->
            <div class="search-section">
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="search-input" class="form-control search-input" 
                               placeholder="Makine adı veya açıklama ile ara...">
                    </div>
                </div>
            </div>
            
            <!-- Results Table Container -->
            <div id="results-table-container"></div>
        </div>
    `;

    createHeader();
    createResultsTable();
    setupSearchInput();
    loadFaultsData();
}

function createHeader() {
    new HeaderComponent({
        title: 'Bakım Talepleri',
        subtitle: 'Makine arızalarını görüntüleyin ve arıza zamanlayıcılarını yönetin',
        icon: 'list',
        containerId: 'header-placeholder',
        showBackButton: 'none',
        showCreateButton: 'none',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        onRefreshClick: () => loadFaultsData()
    });
}

function createResultsTable() {
    const container = document.getElementById('results-table-container');
    if (!container) return;

    if (resultsTableInstance) {
        resultsTableInstance.destroy();
    }

    resultsTableInstance = new ResultsTable(container, {
        title: 'Arıza Talepleri',
        icon: 'fas fa-exclamation-triangle',
        showFilters: false
    });
}

function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    searchInput.addEventListener('input', () => filterAndDisplayFaults());
}

async function loadFaultsData() {
    if (resultsTableInstance) {
        resultsTableInstance.showLoadingState();
    }

    try {
        const faultsResponse = await fetchMachineFaults();
        const faults = extractResultsFromResponse(faultsResponse);

        // Only show unresolved machine faults (not maintenance requests)
        allFaults = (faults || []).filter(f => !f.resolved_at && f.is_maintenance === false);
        filterAndDisplayFaults();
    } catch (error) {
        console.error('Error loading faults:', error);
        if (resultsTableInstance) {
            resultsTableInstance.showErrorState(error);
        }
    }
}

function filterAndDisplayFaults() {
    if (!resultsTableInstance) return;

    const searchInput = document.getElementById('search-input');
    const term = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const filtered = term
        ? allFaults.filter(f => {
            const machine = (f.machine_name || f.asset_name || '').toLowerCase();
            const desc = (f.description || '').toLowerCase();
            return machine.includes(term) || desc.includes(term);
        })
        : allFaults;

    const items = (filtered || []).map(faultToItem);
    resultsTableInstance.setItems(items);
    resultsTableInstance.updateResultsInfo(items.length);
}

function faultToItem(fault) {
    const machineTitle = fault.machine_name || fault.asset_name || 'Makine';
    const subtitle = fault.description || 'Açıklama yok';

    const reportedAt = fault.reported_at
        ? new Date(fault.reported_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
        : '-';

    const isBreaking = !!fault.is_breaking;

    return {
        title: machineTitle,
        subtitle,
        icon: isBreaking ? 'fas fa-stop-circle' : 'fas fa-exclamation-triangle',
        iconColor: '#ffffff',
        iconBackground: isBreaking
            ? 'linear-gradient(135deg, rgb(214, 9, 9), rgb(120, 3, 3))'
            : 'linear-gradient(135deg, #ffc107, #e0a800)',
        details: [
            {
                icon: 'fas fa-calendar',
                label: 'Bildirim:',
                value: reportedAt
            },
            ...(isBreaking ? [{
                icon: 'fas fa-exclamation-triangle',
                label: 'Durum:',
                value: 'Makine duruşta'
            }] : [])
        ],
        clickable: true,
        onClick: () => {
            navigateTo(`/maintenance/faults/task/?fault_id=${encodeURIComponent(fault.id)}`);
        }
    };
}

