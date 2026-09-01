// --- transfer-requests.js ---
// Malzeme Çekme Talepleri (Material Pull Requests) page

import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { TableComponent } from '../../components/table/table.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';
import {
    getMaterialPullRequests,
    getMaterialPullRequest,
    markMaterialPullRequestTransferred
} from '../../generic/materialPullRequests.js';
import { formatDecimalTurkish } from '../../generic/formatters.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

let confirmationModal;
let pendingRequestsTable;
let historyTable;
let historyFilters = {
    status: 'transferred'
};
let historyOrdering = '-confirmed_at';
let historyPage = 1;
let historyPageSize = 20;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();

    // Initialize header
    initializeHeader();

    // Initialize pending requests table
    initializePendingRequestsTable();

    // Initialize history filters
    initializeHistoryFilters();

    // Initialize history table
    initializeHistoryTable();

    // Initialize confirmation modal
    confirmationModal = new ConfirmationModal('confirmation-modal-container', {
        title: 'Onay',
        icon: 'fas fa-exclamation-triangle',
        confirmText: 'Evet',
        cancelText: 'İptal',
        confirmButtonClass: 'btn-primary'
    });

    // Load pending pull requests
    loadPendingRequests();

    // Load transfer history
    loadHistory();
});

// ============================================================================
// HEADER COMPONENT SETUP
// ============================================================================

function initializeHeader() {
    const header = new HeaderComponent({
        title: 'Malzeme Çekme Talepleri',
        subtitle: 'Taşeron ve kaynak ekiplerine yapılacak malzeme teslimatlarını yönetin',
        icon: 'dolly',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        backUrl: '../',
        onRefreshClick: () => {
            loadPendingRequests();
            loadHistory();
        }
    });
}

// ============================================================================
// PENDING REQUESTS SETUP
// ============================================================================

function initializePendingRequestsTable() {
    const pendingContainer = document.getElementById('pending-requests-container');

    pendingRequestsTable = new ResultsTable(pendingContainer, {
        title: 'Bekleyen Talepler',
        icon: 'fas fa-dolly',
        showFilters: false,
        emptyStateText: 'Bekleyen talep bulunamadı',
        emptyStateDescription: 'Teslimat bekleyen malzeme çekme talebi bulunmuyor.',
        loadingText: 'Talepler yükleniyor...'
    });
}

async function loadPendingRequests() {
    try {
        if (pendingRequestsTable) {
            pendingRequestsTable.showLoadingState();
        }

        const filters = {
            status: 'pending',
            ordering: '-requested_at',
            page_size: 200
        };

        const data = await getMaterialPullRequests(filters);
        const results = data.results || [];
        const totalCount = data.count || results.length;

        const transformedRequests = results.map(request => ({
            title: `${request.number} - ${request.destination_name || '-'}`,
            subtitle: `Talep Eden: ${request.requested_by_name || request.requested_by_username || '-'}`,
            icon: 'fas fa-dolly',
            iconColor: '#8b0000',
            iconBackground: '#ffe6e6',
            details: [
                {
                    label: 'Tarih',
                    value: formatDate(request.requested_at),
                    icon: 'fas fa-calendar-plus'
                },
                {
                    label: 'Hedef',
                    value: getDestinationText(request),
                    icon: request.destination_type === 'subcontractor' ? 'fas fa-industry' : 'fas fa-users'
                },
                {
                    label: 'Kalem Sayısı',
                    value: request.item_count ?? 0,
                    icon: 'fas fa-boxes'
                },
                {
                    label: 'İş Emirleri',
                    value: (request.job_nos || []).join(', ') || '-',
                    icon: 'fas fa-briefcase'
                }
            ],
            onClick: () => {
                showDetailModal(request.id);
            }
        }));

        if (pendingRequestsTable) {
            pendingRequestsTable.setItems(transformedRequests);
            pendingRequestsTable.updateResultsInfo(totalCount);
        }

        updatePendingOverflowWarning(totalCount - results.length);

    } catch (error) {
        console.error('Error loading pending pull requests:', error);

        if (pendingRequestsTable) {
            pendingRequestsTable.showErrorState(error);
        }
    }
}

function updatePendingOverflowWarning(hiddenCount) {
    const pendingContainer = document.getElementById('pending-requests-container');
    if (!pendingContainer) return;

    let warning = document.getElementById('pending-overflow-warning');

    if (hiddenCount > 0) {
        if (!warning) {
            warning = document.createElement('p');
            warning.id = 'pending-overflow-warning';
            warning.className = 'text-muted mt-2 mb-0';
            pendingContainer.insertAdjacentElement('afterend', warning);
        }
        warning.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>+${hiddenCount} talep daha listelenemiyor — geçmiş bölümündeki filtreleri kullanın`;
    } else if (warning) {
        warning.remove();
    }
}

// ============================================================================
// HISTORY FILTERS SETUP
// ============================================================================

function initializeHistoryFilters() {
    const filtersContainer = document.getElementById('history-filters-container');
    if (!filtersContainer) return;

    filtersContainer.innerHTML = `
        <div class="tr-filters-container">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">
                    <i class="fas fa-filter me-2"></i>Filtreler
                </h5>
                <button type="button" class="btn btn-link p-0" id="toggle-filters-btn">
                    <i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle
                </button>
            </div>

            <div class="tr-filter-content" id="filter-content" style="display: block;">
                <div class="tr-filter-row">
                    <div class="tr-filter-group">
                        <label for="filter-status">
                            <i class="fas fa-info-circle me-2"></i>Durum
                        </label>
                        <select id="filter-status" class="form-select form-select-sm">
                            <option value="transferred" selected>Teslim Edildi</option>
                            <option value="cancelled">İptal Edildi</option>
                            <option value="">Tümü</option>
                        </select>
                    </div>

                    <div class="tr-filter-group">
                        <label for="filter-search">
                            <i class="fas fa-search me-2"></i>Arama
                        </label>
                        <input
                            type="text"
                            id="filter-search"
                            class="form-control form-control-sm"
                            placeholder="Talep no, hedef, iş no veya malzeme"
                        >
                    </div>
                </div>

                <div class="tr-filter-actions">
                    <button type="button" class="btn btn-primary btn-sm" id="apply-filters-btn">
                        <i class="fas fa-search me-2"></i>Filtrele
                    </button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="clear-filters-btn">
                        <i class="fas fa-times me-2"></i>Temizle
                    </button>
                </div>
            </div>
        </div>
    `;

    // Bind filter events
    const toggleBtn = document.getElementById('toggle-filters-btn');
    const filterContent = document.getElementById('filter-content');

    if (toggleBtn && filterContent) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = filterContent.style.display !== 'none';
            filterContent.style.display = isVisible ? 'none' : 'block';

            if (isVisible) {
                toggleBtn.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Filtreleri Göster';
            } else {
                toggleBtn.innerHTML = '<i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle';
            }
        });
    }

    const applyBtn = document.getElementById('apply-filters-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyHistoryFilters);
    }

    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearHistoryFilters);
    }

    // Apply filters on Enter key
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyHistoryFilters();
            }
        });
    }
}

function applyHistoryFilters() {
    currentHistoryFiltersFromInputs();
    historyPage = 1;
    loadHistory();
}

function clearHistoryFilters() {
    document.getElementById('filter-status').value = 'transferred';
    document.getElementById('filter-search').value = '';

    historyFilters = {
        status: 'transferred'
    };
    historyPage = 1;
    loadHistory();
}

function currentHistoryFiltersFromInputs() {
    historyFilters = {};

    const status = document.getElementById('filter-status')?.value;
    const search = document.getElementById('filter-search')?.value.trim();

    if (status) historyFilters.status = status;
    if (search) historyFilters.search = search;
}

// ============================================================================
// HISTORY TABLE SETUP
// ============================================================================

function initializeHistoryTable() {
    const historyContainer = document.getElementById('history-table-container');
    if (!historyContainer) return;

    historyTable = new TableComponent('history-table-container', {
        title: 'Geçmiş Transferler',
        icon: 'fas fa-history',
        columns: [
            {
                field: 'number',
                label: 'Talep No',
                sortable: true,
                formatter: (value) => `<span class="request-no">${escapeHtml(value || '-')}</span>`
            },
            {
                field: 'destination_name',
                label: 'Hedef',
                sortable: false,
                formatter: (value, row) => `${escapeHtml(value || '-')} ${getDestinationChipHTML(row.destination_type)}`
            },
            {
                field: 'item_count',
                label: 'Kalem',
                sortable: false,
                formatter: (value) => `<span class="quantity-badge primary">${value ?? 0}</span>`
            },
            {
                field: 'job_nos',
                label: 'İş Emirleri',
                sortable: false,
                formatter: (value) => `<span class="job-no">${escapeHtml((value || []).join(', ') || '-')}</span>`
            },
            {
                field: 'requested_by_name',
                label: 'Talep Eden',
                sortable: false,
                formatter: (value, row) => escapeHtml(value || row.requested_by_username || '-')
            },
            {
                field: 'requested_at',
                label: 'Talep Tarihi',
                sortable: true,
                formatter: (value) => formatDate(value)
            },
            {
                field: 'confirmed_by_name',
                label: 'Teslim Eden',
                sortable: false,
                formatter: (value, row) => escapeHtml(value || row.confirmed_by_username || '-')
            },
            {
                field: 'confirmed_at',
                label: 'Teslim Tarihi',
                sortable: true,
                formatter: (value) => formatDate(value)
            },
            {
                field: 'status',
                label: 'Durum',
                sortable: true,
                formatter: (value, row) => getStatusBadgeHTML(value, row.status_label)
            }
        ],
        data: [],
        pagination: true,
        serverSidePagination: true,
        itemsPerPage: 20,
        currentPage: 1,
        totalItems: 0,
        actions: [
            {
                key: 'detail',
                label: 'Detay',
                icon: 'fas fa-eye',
                class: 'btn-outline-primary btn-sm',
                onClick: (row) => showDetailModal(row.id)
            }
        ],
        onSort: (field, direction) => {
            historyOrdering = `${direction === 'desc' ? '-' : ''}${field}`;
            historyPage = 1;
            loadHistory();
        },
        onPageChange: (page) => {
            historyPage = page;
            loadHistory();
        },
        onPageSizeChange: (size) => {
            historyPageSize = size;
        }
    });
}

async function loadHistory() {
    try {
        if (historyTable) {
            historyTable.setLoading(true);
        }

        const filters = {
            ...historyFilters,
            ordering: historyOrdering,
            page: historyPage,
            page_size: historyPageSize
        };

        const data = await getMaterialPullRequests(filters);

        const rows = data.results || [];
        const totalItems = data.count || rows.length;

        if (historyTable) {
            historyTable.updateData(rows, totalItems, historyPage);
            historyTable.setLoading(false);
        }

    } catch (error) {
        console.error('Error loading transfer history:', error);

        if (historyTable) {
            historyTable.setLoading(false);
        }

        const historyContainer = document.getElementById('history-table-container');
        if (historyContainer) {
            historyContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${error.message || 'Geçmiş transferler yüklenirken bir hata oluştu.'}
                </div>
            `;
        }
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

async function showDetailModal(pullRequestId) {
    try {
        showLoadingDetailModal();

        const request = await getMaterialPullRequest(pullRequestId);

        const modalHTML = createDetailModalHTML(request);

        const existingModal = document.getElementById('pullRequestDetailModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        setupDetailModalEventListeners(request);

    } catch (error) {
        console.error('Error showing pull request detail modal:', error);
        alert('Talep detayı açılırken bir hata oluştu: ' + error.message);

        const loadingModal = document.getElementById('pullRequestDetailModal');
        if (loadingModal) {
            loadingModal.remove();
        }
    }
}

function showLoadingDetailModal() {
    const modalHTML = `
        <div class="modal fade show" id="pullRequestDetailModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-body text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Yükleniyor...</span>
                        </div>
                        <p class="mt-3">Talep detayları yükleniyor...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('pullRequestDetailModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function createDetailModalHTML(request) {
    const isPending = request.status === 'pending';
    const items = request.items || [];

    const metaRows = [
        { label: 'Talep Eden', value: escapeHtml(request.requested_by_name || request.requested_by_username || '-') },
        { label: 'Tarih', value: escapeHtml(formatDate(request.requested_at)) },
        { label: 'Hedef', value: escapeHtml(getDestinationText(request)) },
        { label: 'Durum', value: getStatusBadgeHTML(request.status, request.status_label) }
    ];

    if (request.status === 'transferred') {
        metaRows.push({ label: 'Teslim Eden', value: escapeHtml(request.confirmed_by_name || request.confirmed_by_username || '-') });
        metaRows.push({ label: 'Teslim Tarihi', value: escapeHtml(formatDate(request.confirmed_at)) });
    }

    if (request.status === 'cancelled') {
        metaRows.push({ label: 'İptal Eden', value: escapeHtml(request.cancelled_by_name || '-') });
        metaRows.push({ label: 'İptal Tarihi', value: escapeHtml(formatDate(request.cancelled_at)) });
    }

    if (request.note) {
        metaRows.push({ label: 'Not', value: escapeHtml(request.note), fullWidth: true });
    }

    const metaHTML = metaRows.map(row => `
        <div class="detail-item-compact ${row.fullWidth ? 'detail-item-full' : ''}">
            <span class="detail-label-compact">${row.label}</span>
            <span class="detail-value-compact">${row.value}</span>
        </div>
    `).join('');

    const itemsHTML = items.length > 0 ? `
        <div class="detail-items-table-wrapper">
            <table class="detail-items-table">
                <thead>
                    <tr>
                        <th>Ürün Kodu</th>
                        <th>Ürün Adı</th>
                        <th>İş No</th>
                        <th class="text-end">Miktar</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td class="item-code">${escapeHtml(item.item_code || '-')}</td>
                            <td>
                                ${escapeHtml(item.item_name || '-')}
                                ${item.is_delivered === true ? '<small class="text-success d-block"><i class="fas fa-check-circle me-1"></i>Teslim Alındı</small>' : ''}
                            </td>
                            <td class="job-no">${escapeHtml(item.job_no || '-')}</td>
                            <td class="text-end fw-bold">${formatDecimalTurkish(parseFloat(item.quantity || 0), 2)} ${escapeHtml(item.item_unit || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div class="text-center text-muted py-3">
            <i class="fas fa-inbox fa-2x mb-2"></i>
            <p>Bu talepte kalem bulunmuyor</p>
        </div>
    `;

    return `
        <div class="modal fade show" id="pullRequestDetailModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-dolly me-2"></i>${escapeHtml(request.number)} - ${escapeHtml(request.destination_name || '-')}
                        </h5>
                        <button type="button" class="btn-close" data-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="request-details-section">
                            <div class="detail-grid">
                                ${metaHTML}
                            </div>
                        </div>
                        <div class="items-table-section">
                            <h6 class="section-title mb-3">
                                <i class="fas fa-boxes me-2"></i>Kalemler (${items.length})
                            </h6>
                            ${itemsHTML}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Kapat
                        </button>
                        ${isPending ? `
                        <button type="button" class="btn btn-primary" id="mark-transferred-btn">
                            <i class="fas fa-check me-2"></i>Teslim Edildi Olarak İşaretle
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setupDetailModalEventListeners(request) {
    // Close button handler
    const closeButtons = document.querySelectorAll('#pullRequestDetailModal [data-dismiss="modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeDetailModal();
        });
    });

    // Mark transferred button handler
    const markTransferredBtn = document.getElementById('mark-transferred-btn');
    if (markTransferredBtn) {
        markTransferredBtn.addEventListener('click', async () => {
            await handleMarkTransferred(request);
        });
    }

    // Escape key to close modal
    document.addEventListener('keydown', handleEscapeKey);
}

async function handleMarkTransferred(request) {
    try {
        if (!confirmationModal) {
            alert('Onay penceresi kullanılamıyor. Lütfen sayfayı yenileyin.');
            return;
        }

        const itemCount = request.item_count ?? (request.items || []).length;

        await confirmationModal.show({
            title: 'Teslimatı Onayla',
            message: `${request.number} numaralı talep teslim edildi olarak işaretlenecek.`,
            description: `Hedef: ${getDestinationText(request)} | Kalem sayısı: ${itemCount}`,
            confirmText: 'Evet, Teslim Edildi',
            cancelText: 'İptal',
            confirmButtonClass: 'btn-primary',
            onConfirm: async () => {
                return await performMarkTransferred(request);
            }
        });

    } catch (error) {
        console.error('Error in mark transferred flow:', error);
        alert('Bir hata oluştu: ' + error.message);
    }
}

async function performMarkTransferred(request) {
    const confirmBtn = document.getElementById('confirm-action-btn');
    const originalConfirmBtnHTML = confirmBtn ? confirmBtn.innerHTML : '';

    try {
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
        }

        await markMaterialPullRequestTransferred(request.id);

        alert(`${request.number} numaralı talep teslim edildi olarak işaretlendi.`);

        // Close modals
        closeDetailModal();

        // Reload both sections
        loadPendingRequests();
        loadHistory();

        // Return true to allow confirmation modal to close
        return true;

    } catch (error) {
        console.error('Error marking pull request as transferred:', error);
        alert('Teslimat işaretlenirken bir hata oluştu: ' + error.message);

        // Return false to keep modal open on error
        return false;

    } finally {
        // Restore confirm button so later confirmations are not stuck disabled
        if (confirmBtn && confirmBtn.isConnected) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalConfirmBtnHTML;
        }
    }
}

function closeDetailModal() {
    const modal = document.getElementById('pullRequestDetailModal');
    if (modal) {
        modal.remove();
    }

    // Remove escape key listener
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(event) {
    // Bootstrap calls preventDefault() when the confirmation modal consumes Escape
    if (event.key === 'Escape' && !event.defaultPrevented) {
        closeDetailModal();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Format date to Turkish locale
 */
function formatDate(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            return dateString;
        }

        return date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function getDestinationText(request) {
    const name = request.destination_name || '-';
    return request.destination_type === 'subcontractor'
        ? `Taşeron: ${name}`
        : `Kaynak Ekibi: ${name}`;
}

function getDestinationChipHTML(destinationType) {
    return destinationType === 'subcontractor'
        ? '<span class="tr-dest-chip tr-subcontractor">Taşeron</span>'
        : '<span class="tr-dest-chip tr-team">Ekip</span>';
}

function getStatusBadgeHTML(status, statusLabel) {
    const labels = {
        'pending': 'Beklemede',
        'transferred': 'Teslim Edildi',
        'cancelled': 'İptal Edildi'
    };
    const icons = {
        'pending': 'fas fa-clock',
        'transferred': 'fas fa-check-circle',
        'cancelled': 'fas fa-ban'
    };
    const badgeClass = labels[status] ? status : 'pending';
    const label = statusLabel || labels[status] || status || '-';

    return `<span class="tr-status-badge tr-${badgeClass}"><i class="${icons[status] || 'fas fa-clock'} me-1"></i>${escapeHtml(label)}</span>`;
}
