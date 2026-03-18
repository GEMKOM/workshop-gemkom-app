import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { fetchMachineFaults } from '../../generic/machines.js';
import { extractResultsFromResponse } from '../../generic/paginationHelper.js';

let resultsTableInstance = null;
let allResolved = [];

export function loadResolvedRequestsTab({ containerId = 'main-view' } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="active-timers-view">
            <div id="header-placeholder"></div>

            <!-- Machine Selection Section (kept for identical layout, but no selection) -->
            <div class="machine-selection-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-check-circle me-2"></i>
                        Çözülen Talepler
                    </h3>
                    <p class="section-subtitle">Çözülmüş bakım ve arıza talepleri listelenir</p>
                </div>
            </div>

            <div class="search-section">
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="search-input" class="form-control search-input"
                               placeholder="Makine adı, açıklama veya çözüm ile ara...">
                    </div>
                </div>
            </div>

            <div id="results-table-container"></div>
        </div>
    `;

    createHeader();
    createResultsTable();
    setupSearchInput();
    loadResolvedData();
}

function createHeader() {
    new HeaderComponent({
        title: 'Çözülen Talepler',
        subtitle: 'Çözülmüş bakım/arıza taleplerini görüntüleyin',
        icon: 'check-circle',
        containerId: 'header-placeholder',
        showBackButton: 'none',
        showCreateButton: 'none',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        onRefreshClick: () => loadResolvedData()
    });
}

function createResultsTable() {
    const container = document.getElementById('results-table-container');
    if (!container) return;

    if (resultsTableInstance) {
        resultsTableInstance.destroy();
    }

    resultsTableInstance = new ResultsTable(container, {
        title: 'Çözülen Talepler',
        icon: 'fas fa-check-circle',
        showFilters: false
    });
}

function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    searchInput.addEventListener('input', () => filterAndDisplay());
}

async function loadResolvedData() {
    if (resultsTableInstance) {
        resultsTableInstance.showLoadingState();
    }

    try {
        // Server-side filtering: unresolved = false lists resolved faults only
        const response = await fetchMachineFaults({ unresolved: false });
        const requests = extractResultsFromResponse(response) || [];
        allResolved = requests;
        filterAndDisplay();
    } catch (error) {
        console.error('Error loading resolved requests:', error);
        if (resultsTableInstance) {
            resultsTableInstance.showErrorState(error);
        }
    }
}

function filterAndDisplay() {
    if (!resultsTableInstance) return;

    const searchInput = document.getElementById('search-input');
    const term = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const filtered = term
        ? allResolved.filter(r => {
            const machine = (r.machine_name || r.asset_name || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            const res = (r.resolution_description || '').toLowerCase();
            return machine.includes(term) || desc.includes(term) || res.includes(term);
        })
        : allResolved;

    const items = filtered.map(toItem);
    resultsTableInstance.setItems(items);
    resultsTableInstance.updateResultsInfo(items.length);
}

function toItem(request) {
    const machineTitle = request.machine_name || request.asset_name || 'Makine';
    const isMaintenance = request.is_maintenance === true;
    const typeText = isMaintenance ? 'Bakım' : 'Arıza';

    const resolvedAt = request.resolved_at
        ? new Date(request.resolved_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
        : '-';

    return {
        title: machineTitle,
        subtitle: `${typeText} - ${request.description || 'Açıklama yok'}`,
        icon: 'fas fa-check-circle',
        iconColor: '#ffffff',
        iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
        details: [
            {
                icon: 'fas fa-calendar-check',
                label: 'Çözüm:',
                value: resolvedAt
            },
            ...(request.resolution_description ? [{
                icon: 'fas fa-comment-dots',
                label: 'Açıklama:',
                value: request.resolution_description
            }] : [])
        ],
        clickable: false
    };
}

