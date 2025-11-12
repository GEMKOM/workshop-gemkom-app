import { initNavbar } from '../components/navbar.js';
import { guardRoute } from '../authService.js';
import { getMyDepartmentRequests } from '../generic/purchaseRequest.js';
import { ModernDropdown } from '../components/dropdown/dropdown.js';
import { extractResultsFromResponse } from '../generic/paginationHelper.js';
import { HeaderComponent } from '../components/header/header.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    requests: [],
    filteredRequests: [],
    filters: {
        status: 'submitted', // Default to 'submitted' (onay bekliyor)
        priority: ''
    },
    isLoading: false
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!guardRoute()) {
        return;
    }

    initNavbar();
    setupHeader();
    setupFilters();
    loadRequests();
});

// ============================================================================
// HEADER SETUP
// ============================================================================

function setupHeader() {
    const headerConfig = {
        title: 'Departman Talepleri',
        subtitle: 'Departman taleplerini görüntüleyin ve yönetin',
        icon: 'clipboard-list',
        containerId: 'header-placeholder',
        showBackButton: 'none',
        showCreateButton: 'block',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'block',
        createUrl: './create/',
        createButtonText: 'Yeni Talep',
        onRefresh: async () => {
            await loadRequests();
        }
    };

    new HeaderComponent(headerConfig);
}

// ============================================================================
// FILTERS SETUP
// ============================================================================

function setupFilters() {
    const filtersSection = document.getElementById('filters-section');

    filtersSection.innerHTML = `
        <div class="filters-header">
            <i class="fas fa-filter"></i>
            <h5>Filtrele</h5>
        </div>
        <div class="row g-3">
            <div class="col-md-6">
                <div class="filter-group">
                    <label>
                        <i class="fas fa-info-circle"></i>
                        Durum
                    </label>
                    <div id="status-filter"></div>
                </div>
            </div>
        </div>
    `;

    // Setup status filter
    const statusFilterContainer = document.getElementById('status-filter');
    const statusFilter = new ModernDropdown(statusFilterContainer, {
        placeholder: 'Tümü',
        allowClear: true
    });

    const statusItems = [
        { value: '', text: 'Tümü' },
        { value: 'draft', text: 'Taslak' },
        { value: 'submitted', text: 'Onay Bekliyor' },
        { value: 'approved', text: 'Onaylandı' },
        { value: 'rejected', text: 'Reddedildi' },
        { value: 'transferred', text: 'Satın Almaya Aktarıldı' },
        { value: 'cancelled', text: 'İptal Edildi' }
    ];

    statusFilter.setItems(statusItems);
    statusFilter.setValue('submitted'); // Set default to 'submitted'
    statusFilterContainer.addEventListener('dropdown:select', (e) => {
        state.filters.status = e.detail.value;
        // Reload from API when status filter changes
        loadRequests();
    });
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadRequests() {
    const contentContainer = document.getElementById('requests-list-content');

    // Show loading state
    contentContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="text-muted">Talepler yükleniyor...</p>
        </div>
    `;

    try {
        state.isLoading = true;
        // Pass the current status filter to the API (only if not empty)
        const apiFilters = {};
        if (state.filters.status) {
            apiFilters.status = state.filters.status;
        }
        const response = await getMyDepartmentRequests(apiFilters);
        const requests = extractResultsFromResponse(response);

        state.requests = requests;
        state.filteredRequests = requests;

        renderRequests();
    } catch (error) {
        console.error('Error loading requests:', error);
        contentContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-4">
                    <i class="fas fa-exclamation-triangle text-danger" style="font-size: 4rem;"></i>
                </div>
                <h4 class="text-danger mb-2">Hata Oluştu</h4>
                <p class="text-muted">Talepler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</p>
                <button class="btn btn-primary mt-3" onclick="location.reload()">
                    <i class="fas fa-redo me-2"></i>Yenile
                </button>
            </div>
        `;
    } finally {
        state.isLoading = false;
    }
}

// ============================================================================
// FILTERING
// ============================================================================

function applyFilters() {
    let filtered = [...state.requests];

    // Apply status filter
    if (state.filters.status) {
        filtered = filtered.filter(req => req.status === state.filters.status);
    }

    // Apply priority filter
    if (state.filters.priority) {
        filtered = filtered.filter(req => req.priority === state.filters.priority);
    }

    state.filteredRequests = filtered;
    renderRequests();
}

// ============================================================================
// RENDERING
// ============================================================================

function renderRequests() {
    const contentContainer = document.getElementById('requests-list-content');

    if (state.filteredRequests.length === 0) {
        contentContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-clipboard-list"></i>
                </div>
                <h3 class="empty-state-title">Talep Bulunamadı</h3>
                <p class="empty-state-text">
                    ${state.requests.length === 0
                        ? 'Henüz hiç departman talebi oluşturulmamış.'
                        : 'Seçili filtrelerle eşleşen talep bulunamadı.'}
                </p>
                ${state.requests.length === 0 ? `
                    <a href="./create/" class="btn btn-primary">
                        <i class="fas fa-plus me-2"></i>
                        İlk Talebi Oluştur
                    </a>
                ` : ''}
            </div>
        `;
        return;
    }

    contentContainer.innerHTML = `
        <div class="requests-grid">
            ${state.filteredRequests.map(request => createRequestCard(request)).join('')}
        </div>
    `;
}

function createRequestCard(request) {
    const statusIcon = getStatusIcon(request.status);
    const priorityIcon = getPriorityIcon(request.priority);

    return `
        <div class="request-card" data-request-id="${request.id}">
            <div class="request-card-header">
                <div class="request-header-row">
                    <div class="request-number">
                        <i class="fas fa-hashtag"></i>
                        ${request.request_number}
                    </div>
                    ${createStatusBadge(request.status, request.status_label)}
                </div>
                <h3 class="request-title">${request.title || 'Başlıksız Talep'}</h3>
            </div>
            <div class="request-card-body">
                <div class="request-info-grid">
                    <div class="info-item">
                        <div class="info-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="info-content">
                            <div class="info-label">Talep Eden</div>
                            <div class="info-value">${request.requestor_full_name || request.requestor_username}</div>
                        </div>
                    </div>

                    <div class="info-item">
                        <div class="info-icon">
                            <i class="fas fa-building"></i>
                        </div>
                        <div class="info-content">
                            <div class="info-label">Departman</div>
                            <div class="info-value">${request.department || '-'}</div>
                        </div>
                    </div>

                    <div class="info-item">
                        <div class="info-icon">
                            <i class="fas fa-calendar"></i>
                        </div>
                        <div class="info-content">
                            <div class="info-label">İhtiyaç Tarihi</div>
                            <div class="info-value">${formatDate(request.needed_date)}</div>
                        </div>
                    </div>

                    <div class="info-item">
                        <div class="info-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="info-content">
                            <div class="info-label">Oluşturulma Tarihi</div>
                            <div class="info-value">${formatDateTime(request.created_at)}</div>
                        </div>
                    </div>

                    ${request.items && request.items.length > 0 ? `
                        <div class="info-item">
                            <div class="info-icon">
                                <i class="fas fa-box"></i>
                            </div>
                            <div class="info-content">
                                <div class="info-label">Ürün Sayısı</div>
                                <div class="info-value">${request.items.length} ürün</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                ${request.description ? `
                    <div class="request-description">
                        ${request.description}
                    </div>
                ` : ''}
            </div>
            <div class="request-card-footer">
                ${createPriorityBadge(request.priority)}
                ${request.status === 'submitted' ? `
                    <span class="text-muted small">
                        <i class="fas fa-hourglass-half me-1"></i>
                        Onay Bekliyor
                    </span>
                ` : ''}
            </div>
        </div>
    `;
}

function createStatusBadge(status, label) {
    const icon = getStatusIcon(status);
    return `<span class="status-badge ${status}">
        <i class="fas ${icon}"></i>
        ${label}
    </span>`;
}

function createPriorityBadge(priority) {
    const icon = getPriorityIcon(priority);
    const label = getPriorityLabel(priority);
    return `<span class="priority-badge ${priority}">
        <i class="fas ${icon}"></i>
        ${label}
    </span>`;
}

function getStatusIcon(status) {
    const icons = {
        'draft': 'fa-file',
        'submitted': 'fa-hourglass-half',
        'approved': 'fa-check-circle',
        'rejected': 'fa-times-circle',
        'transferred': 'fa-exchange-alt',
        'cancelled': 'fa-ban'
    };
    return icons[status] || 'fa-question-circle';
}

function getPriorityIcon(priority) {
    const icons = {
        'normal': 'fa-info-circle',
        'urgent': 'fa-exclamation-triangle',
        'critical': 'fa-exclamation-circle'
    };
    return icons[priority] || 'fa-info-circle';
}

function getPriorityLabel(priority) {
    const labels = {
        'normal': 'Normal',
        'urgent': 'Acil',
        'critical': 'Kritik'
    };
    return labels[priority] || 'Normal';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
