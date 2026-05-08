// --- inventory-allocation.js ---
import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { TableComponent } from '../../components/table/table.js';
import {
    getPlanningRequests,
    getPlanningRequest,
    updateInventoryQuantities,
    completeInventoryControl,
    getWarehouseRequests,
    createLinearCuttingStockBars,
    patchLinearCuttingSession
} from '../../generic/warehouse.js';
import { formatDecimalTurkish } from '../../generic/formatters.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Global confirmation modal instance
let confirmationModal;
const stockEntryIncompleteSessionKeys = new Set();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();
    
    // Initialize header
    initializeHeader();
    
    // Initialize results table
    initializeResultsTable();
    
    // Initialize warehouse requests table
    initializeWarehouseRequestsTable();
    
    // Initialize confirmation modal
    confirmationModal = new ConfirmationModal('confirmation-modal-container', {
        title: 'Onay',
        icon: 'fas fa-exclamation-triangle',
        confirmText: 'Evet',
        cancelText: 'İptal',
        confirmButtonClass: 'btn-primary'
    });
    
    // Load pending inventory requests
    loadPendingInventoryRequests();
    
    // Load warehouse requests
    loadWarehouseRequests();
});

// ============================================================================
// HEADER COMPONENT SETUP
// ============================================================================

function initializeHeader() {
    const header = new HeaderComponent({
        title: 'Envanter Tahsisi',
        subtitle: 'Envanter kontrolü bekleyen planlama taleplerini yönetin',
        icon: 'clipboard-check',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        backUrl: '../',
        onRefreshClick: () => {
            loadPendingInventoryRequests();
            loadWarehouseRequests();
        }
    });
}

// ============================================================================
// RESULTS TABLE SETUP
// ============================================================================

function initializeResultsTable() {
    const resultsContainer = document.getElementById('results-container');
    
    const resultsTable = new ResultsTable(resultsContainer, {
        title: 'Envanter Kontrolü Bekleyen Talepler',
        icon: 'fas fa-clipboard-check',
        showFilters: false,
        emptyStateText: 'Bekleyen talep bulunamadı',
        emptyStateDescription: 'Envanter kontrolü bekleyen planlama talebi bulunmuyor.',
        loadingText: 'Talepler yükleniyor...'
    });
    
    // Store reference for later use
    window.resultsTable = resultsTable;
}

function initializeWarehouseRequestsTable() {
    const warehouseRequestsContainer = document.getElementById('warehouse-requests-container');
    
    const warehouseRequestsTable = new ResultsTable(warehouseRequestsContainer, {
        title: 'Depo Talepleri',
        icon: 'fas fa-warehouse',
        showFilters: false,
        emptyStateText: 'Talep bulunamadı',
        emptyStateDescription: 'Depo için planlama talebi bulunmuyor.',
        loadingText: 'Talepler yükleniyor...'
    });
    
    // Store reference for later use
    window.warehouseRequestsTable = warehouseRequestsTable;
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadPendingInventoryRequests() {
    try {
        // Show loading state
        if (window.resultsTable) {
            window.resultsTable.showLoadingState();
        }
        
        // Fetch planning requests with pending_inventory status
        const filters = {
            status: 'pending_inventory',
            ordering: '-created_at',
            page_size: 50
        };
        
        const data = await getPlanningRequests(filters);
        
        console.log('Fetched planning requests data:', data);
        
        // Handle different response structures
        let results = [];
        if (Array.isArray(data)) {
            // If data is directly an array
            results = data;
        } else if (data && data.results && Array.isArray(data.results)) {
            // If data has a results property (paginated response)
            results = data.results;
        } else if (data && typeof data === 'object') {
            // If data is an object but not the expected structure
            console.warn('Unexpected data structure:', data);
            results = [];
        }
        
        // Transform requests for display
        const transformedRequests = results.map(request => ({
            title: request.request_number || `Talep #${request.id}`,
            subtitle: request.title || request.department_request_number || 'Departman Talebi',
            icon: 'fas fa-clipboard-check',
            iconColor: '#8b0000',
            iconBackground: '#ffe6e6',
            details: [
                {
                    label: 'Talep No',
                    value: request.request_number || '-',
                    icon: 'fas fa-hashtag'
                },
                {
                    label: 'Departman Talebi',
                    value: request.department_request_number || '-',
                    icon: 'fas fa-building'
                },
                {
                    label: 'Öncelik',
                    value: formatPriority(request.priority),
                    icon: 'fas fa-exclamation-circle'
                },
                {
                    label: 'Ürün Sayısı',
                    value: request.items ? request.items.length : (request.items_count || 0),
                    icon: 'fas fa-boxes'
                },
                {
                    label: 'Oluşturan',
                    value: request.created_by_full_name || request.created_by_username || '-',
                    icon: 'fas fa-user'
                },
                {
                    label: 'Oluşturulma',
                    value: formatDate(request.created_at),
                    icon: 'fas fa-calendar-plus'
                }
            ],
            onClick: () => {
                showInventoryAllocationModal({
                    originalData: request,
                    isWarehouseRequest: false
                });
            }
        }));
        
        console.log('Transformed requests:', transformedRequests.length, 'items');
        
        // Update results table
        if (window.resultsTable) {
            window.resultsTable.setItems(transformedRequests);
            window.resultsTable.updateResultsInfo(transformedRequests.length);
        }
        
        // If no results, the ResultsTable component will show empty state automatically
        if (transformedRequests.length === 0) {
            console.log('No pending inventory requests found');
        }
        
    } catch (error) {
        console.error('Error loading pending inventory requests:', error);
        
        if (window.resultsTable) {
            window.resultsTable.showErrorState(error);
        }
    }
}

/**
 * Load warehouse requests using the warehouse_requests API endpoint
 */
async function loadWarehouseRequests() {
    try {
        // Show loading state
        if (window.warehouseRequestsTable) {
            window.warehouseRequestsTable.showLoadingState();
        }
        
        // Fetch warehouse requests (no status filter = shows all with check_inventory=True)
        const filters = {
            page_size: 50
        };
        
        const data = await getWarehouseRequests(filters);
        
        console.log('Fetched warehouse requests data:', data);
        
        // Handle different response structures
        let results = [];
        if (Array.isArray(data)) {
            // If data is directly an array
            results = data;
        } else if (data && data.results && Array.isArray(data.results)) {
            // If data has a results property (paginated response)
            results = data.results;
        } else if (data && typeof data === 'object') {
            // If data is an object but not the expected structure
            console.warn('Unexpected data structure:', data);
            results = [];
        }
        
        // Transform requests for display (same format as pending inventory requests)
        const transformedRequests = results.map(request => ({
            title: request.request_number || `Talep #${request.id}`,
            subtitle: request.title || request.department_request_number || 'Departman Talebi',
            icon: 'fas fa-warehouse',
            iconColor: '#8b0000',
            iconBackground: '#ffe6e6',
            details: [
                {
                    label: 'Talep No',
                    value: request.request_number || '-',
                    icon: 'fas fa-hashtag'
                },
                {
                    label: 'Departman Talebi',
                    value: request.department_request_number || '-',
                    icon: 'fas fa-building'
                },
                {
                    label: 'Durum',
                    value: getStatusText(request.status),
                    icon: 'fas fa-info-circle'
                },
                {
                    label: 'Öncelik',
                    value: formatPriority(request.priority),
                    icon: 'fas fa-exclamation-circle'
                },
                {
                    label: 'Ürün Sayısı',
                    value: request.items ? request.items.length : (request.items_count || 0),
                    icon: 'fas fa-boxes'
                },
                {
                    label: 'Oluşturan',
                    value: request.created_by_full_name || request.created_by_username || '-',
                    icon: 'fas fa-user'
                },
                {
                    label: 'Oluşturulma',
                    value: formatDate(request.created_at),
                    icon: 'fas fa-calendar-plus'
                }
            ],
            onClick: () => {
                showInventoryAllocationModal({
                    originalData: request,
                    isWarehouseRequest: true
                });
            }
        }));
        
        console.log('Transformed warehouse requests:', transformedRequests.length, 'items');
        
        // Update results table
        if (window.warehouseRequestsTable) {
            window.warehouseRequestsTable.setItems(transformedRequests);
            window.warehouseRequestsTable.updateResultsInfo(transformedRequests.length);
        }
        
        // If no results, the ResultsTable component will show empty state automatically
        if (transformedRequests.length === 0) {
            console.log('No warehouse requests found');
        }
        
    } catch (error) {
        console.error('Error loading warehouse requests:', error);
        
        if (window.warehouseRequestsTable) {
            window.warehouseRequestsTable.showErrorState(error);
        }
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

async function showInventoryAllocationModal(requestData) {
    const requestSummary = requestData.originalData || requestData;
    const isWarehouseRequest = requestData.isWarehouseRequest || false;
    
    try {
        // Show loading modal first
        showLoadingModal();
        
        // Fetch full request details from the API
        console.log('Fetching full request details for ID:', requestSummary.id);
        const requestDetails = await getPlanningRequest(requestSummary.id);
        const request = {
            ...requestDetails,
            is_from_cutting_session: requestDetails?.is_from_cutting_session ?? requestSummary?.is_from_cutting_session ?? false,
            cutting_session_key: requestDetails?.cutting_session_key || requestSummary?.cutting_session_key || null
        };

        if (Array.isArray(request.items) && request.is_from_cutting_session) {
            request.items = request.items.map(item => ({
                ...item,
                is_from_cutting_session: typeof item?.is_from_cutting_session === 'boolean'
                    ? item.is_from_cutting_session
                    : true,
                cutting_session_key: item?.cutting_session_key || request.cutting_session_key || null
            }));
        }
        
        console.log('Received full request data:', request);
        
        // Create and show the modal
        const modalHTML = createInventoryAllocationModalHTML(request, isWarehouseRequest);
        
        // Remove any existing modals
        const existingModal = document.getElementById('inventoryAllocationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Insert modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Initialize modal components
        initializeItemsTable(request, isWarehouseRequest);
        
        // Add event listeners
        if (isWarehouseRequest) {
            // Simple close handler for read-only modal
            setupReadOnlyModalEventListeners(request, isWarehouseRequest);
        } else {
            // Full event listeners for editable modal
            setupModalEventListeners(request, isWarehouseRequest);
        }
        
    } catch (error) {
        console.error('Error showing inventory allocation modal:', error);
        alert('Modal açılırken bir hata oluştu: ' + error.message);
        
        // Remove loading modal on error
        const loadingModal = document.getElementById('inventoryAllocationModal');
        if (loadingModal) {
            loadingModal.remove();
        }
    }
}

function showLoadingModal() {
    const modalHTML = `
        <div class="modal fade show" id="inventoryAllocationModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
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
    
    // Remove any existing modals
    const existingModal = document.getElementById('inventoryAllocationModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Creates the HTML for inventory allocation modal
 */
function createInventoryAllocationModalHTML(request, isWarehouseRequest = false) {
    const isCuttingRequest = isRequestFromCuttingSession(request);
    const modalTitle = isWarehouseRequest 
        ? `${request.request_number || `Talep #${request.id}`} - Envanter Durumu`
        : `${request.request_number || `Talep #${request.id}`} - ${isCuttingRequest ? 'Kesim Stok Girisi' : 'Envanter Tahsisi'}`;
    
    const sectionTitle = isWarehouseRequest
        ? 'Ürünler ve Envanter Miktarları'
        : 'Ürünler ve Envanter Miktarları';
    
    return `
        <div class="modal fade show" id="inventoryAllocationModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas ${isWarehouseRequest ? 'fa-warehouse' : 'fa-clipboard-check'} me-2"></i>${modalTitle}
                        </h5>
                        <button type="button" class="btn-close" data-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Items Table -->
                        <div class="items-table-section">
                            <h6 class="section-title mb-3">
                                <i class="fas fa-boxes me-2"></i>${sectionTitle}
                            </h6>
                            <div class="d-flex justify-content-end align-items-center mb-2">
                                <button type="button" class="btn btn-outline-secondary btn-sm" id="export-items-btn">
                                    <i class="fas fa-file-export me-2"></i>Dışa Aktar (CSV)
                                </button>
                            </div>
                            ${!isWarehouseRequest ? `
                            ${isCuttingRequest ? `
                            <div class="alert alert-info">
                                <i class="fas fa-ruler-combined me-2"></i>
                                <strong>Kesim Stok Girişi:</strong> Önce satırları girin ve <strong>Stok Satırlarını Kaydet</strong> butonuna basın. Tüm giriş bittiğinde <strong>Stok Girişini Tamamla</strong> ile oturumu kapatın.
                            </div>
                            ` : `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Önemli:</strong> Her ürün için envanterde bulunan miktarı girmeniz zorunludur. Hiç bulunamayanlar için "0" yazın.
                            </div>
                            <div id="progress-indicator" class="mb-3" style="display: none;">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="text-muted"><i class="fas fa-tasks me-2"></i>İlerleme</span>
                                    <span class="fw-bold" id="progress-text">0 / 0</span>
                                </div>
                                <div class="progress" style="height: 8px; border-radius: 4px;">
                                    <div id="progress-bar" class="progress-bar bg-success" role="progressbar" style="width: 0%"></div>
                                </div>
                            </div>
                            `}
                            ` : ''}
                            <div id="items-table-container"></div>
                        </div>
                    </div>
                    ${!isWarehouseRequest ? `
                    <div class="modal-footer">
                        ${isCuttingRequest ? `
                        <button type="button" class="btn btn-outline-primary" id="save-cutting-stock-btn">
                            <i class="fas fa-save me-2"></i>Stok Satırlarını Kaydet
                        </button>
                        <button type="button" class="btn btn-success" id="complete-cutting-entry-btn" disabled>
                            <i class="fas fa-check-circle me-2"></i>Stok Girişini Tamamla
                        </button>
                        ` : `
                        <button type="button" class="btn btn-primary" id="submit-allocation-btn">
                            <i class="fas fa-check me-2"></i>Envanter Miktarlarını Güncelle
                        </button>
                        `}
                    </div>
                    ` : `
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Kapat
                        </button>
                    </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

function isFromCuttingSession(item, request = null) {
    if (typeof item?.is_from_cutting_session === 'boolean') {
        return item.is_from_cutting_session;
    }
    return Boolean(request?.is_from_cutting_session);
}

function isRequestFromCuttingSession(request) {
    if (typeof request?.is_from_cutting_session === 'boolean') {
        return request.is_from_cutting_session;
    }
    return (request?.items || []).some(item => Boolean(item?.is_from_cutting_session));
}

function getCuttingSessionKey(item, request) {
    return item?.cutting_session_key || request?.cutting_session_key || null;
}

function extractIdFromValue(value) {
    if (typeof value === 'number' || typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;

    if (typeof value.id === 'number' || typeof value.id === 'string') return value.id;
    if (typeof value.pk === 'number' || typeof value.pk === 'string') return value.pk;
    if (typeof value.item_id === 'number' || typeof value.item_id === 'string') return value.item_id;
    return null;
}

function getStockItemId(item) {
    const candidates = [
        item?.item,
        item?.item_id,
        item?.item_pk,
        item?.material_item,
        item?.material_item_id,
        item?.stock_item,
        item?.stock_item_id,
        item?.inventory_item,
        item?.inventory_item_id,
        item?.product,
        item?.product_id
    ];

    for (const candidate of candidates) {
        const resolved = extractIdFromValue(candidate);
        if (resolved !== null && resolved !== undefined) {
            return resolved;
        }
    }

    return null;
}

function normalizeComparableId(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') {
        if (value.id !== undefined && value.id !== null) return String(value.id);
        return null;
    }
    return String(value);
}

function isStockBarLike(value) {
    if (!value || typeof value !== 'object') return false;
    const hasLength = value.length_mm !== undefined && value.length_mm !== null;
    const hasQuantity = value.quantity !== undefined && value.quantity !== null;
    return hasLength && hasQuantity;
}

function findStockBarsDeep(node, depth = 0, maxDepth = 5) {
    if (depth > maxDepth || node === null || node === undefined) return [];

    if (Array.isArray(node)) {
        if (node.length > 0 && node.every(isStockBarLike)) {
            return node;
        }

        for (const child of node) {
            const found = findStockBarsDeep(child, depth + 1, maxDepth);
            if (found.length > 0) return found;
        }
        return [];
    }

    if (typeof node !== 'object') return [];

    for (const value of Object.values(node)) {
        const found = findStockBarsDeep(value, depth + 1, maxDepth);
        if (found.length > 0) return found;
    }

    return [];
}

function getStockBarsFromRequest(request, item) {
    if (Array.isArray(request?.stock_bars)) return request.stock_bars;
    if (Array.isArray(request?.stockBars)) return request.stockBars;
    if (Array.isArray(request?.linear_cutting?.stock_bars)) return request.linear_cutting.stock_bars;
    if (Array.isArray(request?.cutting_session?.stock_bars)) return request.cutting_session.stock_bars;
    if (Array.isArray(request?.cutting?.stock_bars)) return request.cutting.stock_bars;
    if (Array.isArray(request?.session?.stock_bars)) return request.session.stock_bars;
    if (Array.isArray(item?.stock_bars)) return item.stock_bars;
    if (request?.stock_bars && Array.isArray(request.stock_bars.results)) return request.stock_bars.results;

    // Final fallback: discover any stock-bar-like array nested in detail response.
    return findStockBarsDeep(request);
}

function getExistingStockBarsForItem(item, request) {
    const stockBars = getStockBarsFromRequest(request, item);
    const stockItemId = getStockItemId(item);
    const normalizedStockItemId = normalizeComparableId(stockItemId);
    if (!normalizedStockItemId) {
        const cuttingItems = (request?.items || []).filter(row => isFromCuttingSession(row, request));
        if (cuttingItems.length === 1) {
            return stockBars;
        }
        return [];
    }

    // Match strictly by "item" as requested.
    const matchedBars = stockBars.filter(stockBar =>
        normalizeComparableId(stockBar?.item) === normalizedStockItemId
    );
    if (matchedBars.length > 0) return matchedBars;

    const cuttingItems = (request?.items || []).filter(row => isFromCuttingSession(row, request));
    if (cuttingItems.length === 1) {
        return stockBars;
    }

    return [];
}

function createCuttingStockRowHTML(itemId, rowIndex, values = {}) {
    const lengthValue = values.length_mm ?? '';
    const quantityValue = values.quantity ?? '';

    return `
        <div class="cutting-stock-row" data-item-id="${itemId}" data-row-index="${rowIndex}">
            <div class="cutting-stock-field">
                <label class="mobile-label">Uzunluk (mm)</label>
                <input type="number"
                       class="form-control cutting-length-input"
                       data-item-id="${itemId}"
                       data-row-index="${rowIndex}"
                       step="1"
                       min="1"
                       inputmode="numeric"
                       placeholder="Uzunluk (mm)"
                       aria-label="Uzunluk (mm)"
                       value="${lengthValue}">
            </div>
            <div class="cutting-stock-field">
                <label class="mobile-label">Adet</label>
                <input type="number"
                       class="form-control cutting-quantity-input"
                       data-item-id="${itemId}"
                       data-row-index="${rowIndex}"
                       step="1"
                       min="1"
                       inputmode="numeric"
                       placeholder="Adet"
                       aria-label="Adet"
                       value="${quantityValue}">
            </div>
            <button type="button"
                    class="btn btn-outline-danger btn-sm cutting-stock-remove-btn"
                    data-item-id="${itemId}"
                    title="Satırı sil">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
}

function createCuttingStockInputHTML(item, request) {
    const sessionKey = getCuttingSessionKey(item, request);
    const existingStockBars = getExistingStockBarsForItem(item, request);
    const sessionInfo = sessionKey
        ? `<small class="text-primary d-block mt-2"><i class="fas fa-ruler-combined me-1"></i>Kesim Oturumu: ${sessionKey}</small>`
        : `<small class="text-danger d-block mt-2"><i class="fas fa-exclamation-circle me-1"></i>Kesim oturumu bulunamadı</small>`;
    const rowsHTML = existingStockBars.length > 0
        ? existingStockBars.map((stockBar, index) => createCuttingStockRowHTML(item.id, index, {
            length_mm: stockBar.length_mm,
            quantity: stockBar.quantity
        })).join('')
        : createCuttingStockRowHTML(item.id, 0);
    const existingInfo = existingStockBars.length > 0
        ? `<small class="text-success d-block mt-1"><i class="fas fa-check-circle me-1"></i>${existingStockBars.length} kayıtlı stok satırı yüklendi.</small>`
        : '';

    return `
        <div class="cutting-stock-editor" data-item-id="${item.id}">
            <div class="cutting-stock-header">
                <span class="desktop-label">Kesim Stok Girisi</span>
                <small class="text-muted">Barları satır satır girin: Uzunluk (mm) + Adet.</small>
                ${sessionInfo}
                ${existingInfo}
            </div>
            <div class="cutting-stock-rows" data-item-id="${item.id}">
                ${rowsHTML}
            </div>
            <button type="button" class="btn btn-outline-primary btn-sm cutting-stock-add-btn" data-item-id="${item.id}">
                <i class="fas fa-plus me-1"></i>Satır Ekle
            </button>
        </div>
    `;
}

/**
 * Initialize items table with input fields for allocation or read-only view
 */
function initializeItemsTable(request, isWarehouseRequest = false) {
    const container = document.getElementById('items-table-container');
    if (!container) {
        console.error('Items table container not found');
        return;
    }
    
    const items = request.items || [];
    
    console.log('Initializing items table with', items.length, 'items', isWarehouseRequest ? '(read-only)' : '(editable)');
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>Bu talepte ürün bulunmuyor</p>
            </div>
        `;
        return;
    }
    
    if (isWarehouseRequest) {
        // Read-only view for warehouse requests
        const itemsHTML = `
            <div class="items-container items-container-readonly">
                <!-- Header row for desktop table view -->
                <div class="item-row header-row">
                    <div class="item-col item-number">
                        <span class="desktop-label">#</span>
                    </div>
                    <div class="item-col item-details">
                        <span class="desktop-label">Ürün</span>
                    </div>
                    <div class="item-col item-quantity">
                        <span class="desktop-label">Talep Edilen Miktar</span>
                    </div>
                    <div class="item-col item-inventory">
                        <span class="desktop-label">Envanterden Alınan</span>
                    </div>
                </div>
                ${items.map((item, index) => `
                    <div class="item-row" data-item-id="${item.id}">
                        <div class="item-col item-number">
                            <span class="desktop-label">#</span>
                            <span class="item-value">${index + 1}</span>
                        </div>
                        <div class="item-col item-details">
                            <span class="desktop-label">Ürün</span>
                            <div class="item-value">
                                <div class="fw-bold">${item.item_name || item.item_display || '-'}</div>
                                ${item.item_code ? `<small class="text-muted d-block">Kod: ${item.item_code}</small>` : ''}
                                ${item.item_description ? `<small class="text-muted d-block">${item.item_description}</small>` : ''}
                                ${item.job_no && item.job_no !== '1000' ? `<small class="text-primary d-block"><i class="fas fa-briefcase me-1"></i>İş No: ${item.job_no}</small>` : ''}
                            </div>
                        </div>
                        <div class="item-col item-quantity">
                            <span class="mobile-label">Talep Edilen</span>
                            <span class="desktop-label">Talep Edilen Miktar</span>
                            <span class="item-value text-end fw-bold">${formatDecimalTurkish(item.quantity || 0, 2)}</span>
                        </div>
                        <div class="item-col item-inventory">
                            <span class="mobile-label">Envanterden Alınan</span>
                            <span class="desktop-label">Envanterden Alınan</span>
                            <span class="item-value text-end fw-bold ${parseFloat(item.quantity_from_inventory || 0) > 0 ? 'text-success' : 'text-muted'}">${formatDecimalTurkish(item.quantity_from_inventory || 0, 2)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = itemsHTML;
    } else {
        // Editable view for pending inventory requests
        const hasCuttingItems = items.some(item => isFromCuttingSession(item, request));
        const itemsHTML = `
            <div class="items-container ${hasCuttingItems ? 'items-container-cutting' : ''}">
                <!-- Header row for desktop table view -->
                <div class="item-row header-row">
                    <div class="item-col item-number">
                        <span class="desktop-label">#</span>
                    </div>
                    <div class="item-col item-details">
                        <span class="desktop-label">Ürün</span>
                    </div>
                    <div class="item-col item-quantity">
                        <span class="desktop-label">Talep Edilen Miktar</span>
                    </div>
                    <div class="item-col item-unit">
                        <span class="desktop-label">Birim</span>
                    </div>
                    <div class="item-col item-input">
                        <span class="desktop-label">${hasCuttingItems ? 'Stok Girisi' : 'Bulunan Miktar'}</span>
                    </div>
                </div>
                ${items.map((item, index) => `
                    <div class="item-row" data-item-id="${item.id}">
                        <div class="item-col item-number">
                            <span class="desktop-label">#</span>
                            <span class="item-value">${index + 1}</span>
                        </div>
                        <div class="item-col item-details">
                            <span class="desktop-label">Ürün</span>
                            <div class="item-value">
                                <div class="fw-bold">${item.item_name || item.item_display || '-'}</div>
                                ${item.item_code ? `<small class="text-muted d-block">Kod: ${item.item_code}</small>` : ''}
                                ${item.item_description ? `<small class="text-muted d-block">${item.item_description}</small>` : ''}
                                ${item.job_no && item.job_no !== '1000' ? `<small class="text-primary d-block"><i class="fas fa-briefcase me-1"></i>İş No: ${item.job_no}</small>` : ''}
                            </div>
                        </div>
                        <div class="item-col item-quantity">
                            <span class="mobile-label">Talep Edilen</span>
                            <span class="desktop-label">Talep Edilen Miktar</span>
                            <span class="item-value text-end fw-bold">${formatDecimalTurkish(item.quantity || 0, 2)}</span>
                        </div>
                        <div class="item-col item-unit">
                            <span class="mobile-label">Birim</span>
                            <span class="desktop-label">Birim</span>
                            <span class="item-value">${item.item_unit || item.unit || 'Adet'}</span>
                        </div>
                        <div class="item-col item-input">
                            ${isFromCuttingSession(item, request) ? `
                                <label class="mobile-label">
                                    <i class="fas fa-ruler-combined me-2"></i>Bar Stok Girisi
                                </label>
                                ${createCuttingStockInputHTML(item, request)}
                            ` : `
                                <label for="qty-${item.id}" class="mobile-label">
                                    <i class="fas fa-box me-2"></i>Bulunan Miktar
                                </label>
                                <span class="desktop-label">Bulunan Miktar</span>
                                <input type="number" 
                                       id="qty-${item.id}"
                                       class="form-control quantity-found-input" 
                                       data-item-id="${item.id}"
                                       data-requested-quantity="${item.quantity || 0}"
                                       step="0.01"
                                       min="0"
                                       max="${item.quantity || 0}"
                                       placeholder="Miktar girin"
                                       inputmode="decimal"
                                       required>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = itemsHTML;
        
        setTimeout(() => {
            initializeEditableInputsBehavior(request);
        }, 100);
    }
}

function initializeEditableInputsBehavior(request) {
    const quantityInputs = document.querySelectorAll('.quantity-found-input');
    const progressIndicator = document.getElementById('progress-indicator');
    const totalItems = quantityInputs.length;

    if (progressIndicator) {
        progressIndicator.style.display = totalItems > 0 ? 'block' : 'none';
    }

    const updateProgress = () => {
        if (totalItems === 0) return;

        let filledCount = 0;
        quantityInputs.forEach(input => {
            if (input.value && input.value.trim() !== '') {
                filledCount++;
            }
        });

        const progressPercent = (filledCount / totalItems) * 100;
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        if (progressBar) {
            progressBar.style.width = progressPercent + '%';
            if (progressPercent === 100) {
                progressBar.className = 'progress-bar bg-success';
            } else if (progressPercent >= 50) {
                progressBar.className = 'progress-bar bg-info';
            } else {
                progressBar.className = 'progress-bar bg-warning';
            }
        }

        if (progressText) {
            progressText.textContent = `${filledCount} / ${totalItems}`;
        }
    };

    quantityInputs.forEach(input => {
        input.addEventListener('input', function () {
            this.classList.remove('is-invalid');
            const itemRow = this.closest('.item-row');
            if (itemRow) {
                itemRow.classList.remove('has-error');
            }
            updateProgress();
        });
    });

    const addButtons = document.querySelectorAll('.cutting-stock-add-btn');
    addButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const itemId = button.getAttribute('data-item-id');
            const rowsContainer = document.querySelector(`.cutting-stock-rows[data-item-id="${itemId}"]`);
            if (!rowsContainer) return;

            const rowCount = rowsContainer.querySelectorAll('.cutting-stock-row').length;
            rowsContainer.insertAdjacentHTML('beforeend', createCuttingStockRowHTML(itemId, rowCount));
            setCuttingCompleteButtonEnabled(false);
            await setSessionEntryIncompleteForItem(request, itemId);
        });
    });

    document.querySelectorAll('.cutting-stock-editor').forEach(editor => {
        editor.addEventListener('click', async (event) => {
            const removeBtn = event.target.closest('.cutting-stock-remove-btn');
            if (!removeBtn) return;

            const itemId = removeBtn.getAttribute('data-item-id');
            const row = removeBtn.closest('.cutting-stock-row');
            const rowsContainer = row?.closest('.cutting-stock-rows');
            if (!row || !rowsContainer) return;

            row.remove();

            // Keep one empty row available for fast entry.
            if (rowsContainer.querySelectorAll('.cutting-stock-row').length === 0) {
                rowsContainer.insertAdjacentHTML('beforeend', createCuttingStockRowHTML(itemId, 0));
            }

            setCuttingCompleteButtonEnabled(false);
            await setSessionEntryIncompleteForItem(request, itemId);
        });

        editor.addEventListener('input', (event) => {
            const isCuttingInput = event.target.classList.contains('cutting-length-input') ||
                event.target.classList.contains('cutting-quantity-input');

            if (!isCuttingInput) return;

            event.target.classList.remove('is-invalid');
            const itemRow = event.target.closest('.item-row');
            if (itemRow) {
                itemRow.classList.remove('has-error');
            }

            const itemId = event.target.getAttribute('data-item-id');
            setCuttingCompleteButtonEnabled(false);
            if (itemId) {
                setSessionEntryIncompleteForItem(request, itemId);
            }
        });
    });

    if (isRequestFromCuttingSession(request)) {
        setCuttingCompleteButtonEnabled(false);
    }

    updateProgress();
}

function setCuttingCompleteButtonEnabled(enabled) {
    const completeButton = document.getElementById('complete-cutting-entry-btn');
    if (!completeButton) return;
    completeButton.disabled = !enabled;
}

async function setSessionEntryIncompleteForItem(request, itemId) {
    const item = (request.items || []).find(x => String(x.id) === String(itemId));
    if (!item || !isFromCuttingSession(item, request)) return;

    const sessionKey = getCuttingSessionKey(item, request);
    if (!sessionKey) return;

    if (stockEntryIncompleteSessionKeys.has(sessionKey)) {
        return;
    }

    try {
        await patchLinearCuttingSession(sessionKey, { stock_entry_complete: false });
        stockEntryIncompleteSessionKeys.add(sessionKey);
    } catch (error) {
        console.warn(`Failed to reset stock entry completion for session ${sessionKey}:`, error);
    }
}

function parseIntegerInput(value) {
    const parsed = parseInt(String(value || '').trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function collectCuttingStockBars(request) {
    const stockBars = [];
    const invalidInputs = [];
    const missingSessionItems = [];
    const missingEntryItems = [];
    const missingItemFieldItems = [];
    const itemsWithEntries = new Set();

    (request.items || []).forEach(item => {
        if (!isFromCuttingSession(item, request)) return;

        const sessionKey = getCuttingSessionKey(item, request);
        if (!sessionKey) {
            missingSessionItems.push(item);
            return;
        }

        const stockItemId = getStockItemId(item);
        if (!stockItemId) {
            missingItemFieldItems.push(item);
            return;
        }

        const rows = document.querySelectorAll(`.cutting-stock-row[data-item-id="${item.id}"]`);
        rows.forEach(row => {
            const lengthInput = row.querySelector('.cutting-length-input');
            const quantityInput = row.querySelector('.cutting-quantity-input');
            if (!lengthInput || !quantityInput) return;

            const lengthValue = lengthInput.value.trim();
            const quantityValue = quantityInput.value.trim();
            const isEmptyRow = lengthValue === '' && quantityValue === '';
            if (isEmptyRow) return;

            const lengthMm = parseIntegerInput(lengthValue);
            const quantity = parseIntegerInput(quantityValue);
            const isValid = lengthMm && lengthMm > 0 && quantity && quantity > 0;

            if (!isValid) {
                invalidInputs.push(lengthInput, quantityInput);
                return;
            }

            stockBars.push({
                session: sessionKey,
                item: stockItemId,
                length_mm: lengthMm,
                quantity: quantity
            });
            itemsWithEntries.add(String(item.id));
        });

        if (!itemsWithEntries.has(String(item.id))) {
            missingEntryItems.push(item);
        }
    });

    return { stockBars, invalidInputs, missingSessionItems, missingEntryItems, missingItemFieldItems };
}

function getCuttingSessionKeys(request) {
    const keys = new Set();
    (request.items || []).forEach(item => {
        if (!isFromCuttingSession(item, request)) return;
        const sessionKey = getCuttingSessionKey(item, request);
        if (sessionKey) keys.add(sessionKey);
    });
    if (keys.size === 0 && request?.cutting_session_key) {
        keys.add(request.cutting_session_key);
    }
    return Array.from(keys);
}

async function handleCuttingStockSave(request) {
    const saveButton = document.getElementById('save-cutting-stock-btn');
    const originalButtonText = saveButton?.innerHTML;

    try {
        const { stockBars, invalidInputs, missingSessionItems, missingItemFieldItems } = collectCuttingStockBars(request);

        if (invalidInputs.length > 0) {
            invalidInputs.forEach((input, index) => {
                input.classList.add('is-invalid');
                const itemRow = input.closest('.item-row');
                if (itemRow) itemRow.classList.add('has-error');
                if (index === 0) {
                    input.focus();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            return;
        }

        if (missingSessionItems.length > 0) {
            alert('Bazı kesim ürünlerinde oturum anahtarı yok. Kayıt yapılamadı.');
            return;
        }

        if (missingItemFieldItems.length > 0) {
            alert('Bazı kesim ürünlerinde item alanı eksik. Kayıt yapılamadı.');
            return;
        }

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Kaydediliyor...';
        }

        const sessionKeys = getCuttingSessionKeys(request);
        if (sessionKeys.length > 0) {
            await Promise.all(sessionKeys.map(sessionKey =>
                patchLinearCuttingSession(sessionKey, { stock_entry_complete: false })
            ));
            sessionKeys.forEach(sessionKey => stockEntryIncompleteSessionKeys.add(sessionKey));
        }

        await createLinearCuttingStockBars(stockBars, sessionKeys[0] || null);
        setCuttingCompleteButtonEnabled(true);
        alert(
            stockBars.length === 0
                ? 'Boş stok satırı listesi kaydedildi.'
                : `${stockBars.length} stok satırı kaydedildi.`
        );
    } catch (error) {
        console.error('Error saving cutting stock bars:', error);
        alert('Stok satırları kaydedilirken hata oluştu: ' + error.message);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalButtonText || '<i class="fas fa-save me-2"></i>Stok Satırlarını Kaydet';
        }
    }
}

async function handleCuttingSessionComplete(request) {
    const completeButton = document.getElementById('complete-cutting-entry-btn');
    const originalButtonText = completeButton?.innerHTML;

    try {
        const sessionKeys = getCuttingSessionKeys(request);
        if (sessionKeys.length === 0) {
            alert('Tamamlanacak kesim oturumu bulunamadı.');
            return;
        }

        if (completeButton) {
            completeButton.disabled = true;
            completeButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Tamamlanıyor...';
        }

        await Promise.all(sessionKeys.map(sessionKey =>
            patchLinearCuttingSession(sessionKey, { stock_entry_complete: true })
        ));
        sessionKeys.forEach(sessionKey => stockEntryIncompleteSessionKeys.delete(sessionKey));

        alert('Kesim stok girişi tamamlandı.');
        closeModal();
        loadPendingInventoryRequests();
        loadWarehouseRequests();
    } catch (error) {
        console.error('Error completing cutting session stock entry:', error);
        alert('Stok girişi tamamlanırken hata oluştu: ' + error.message);
    } finally {
        if (completeButton) {
            completeButton.disabled = false;
            completeButton.innerHTML = originalButtonText || '<i class="fas fa-check-circle me-2"></i>Stok Girişini Tamamla';
        }
    }
}

// ============================================================================
// EXPORT (CSV)
// ============================================================================

function exportItemsListToCSV(request, isWarehouseRequest = false) {
    try {
        const items = request?.items || [];
        if (items.length === 0) {
            alert('Dışa aktarılacak ürün bulunmuyor.');
            return;
        }

        const delimiter = ';'; // TR locale friendly (comma used as decimal separator)
        const header = isWarehouseRequest
            ? [
                '#',
                'Ürün',
                'Kod',
                'Açıklama',
                'İş No',
                'Talep Edilen Miktar',
                'Envanterden Alınan'
            ]
            : [
                '#',
                'Ürün',
                'Kod',
                'Açıklama',
                'İş No',
                'Talep Edilen Miktar',
                'Birim',
                'Bulunan Miktar'
            ];

        const escapeCell = (value) => {
            const s = value === null || value === undefined ? '' : String(value);
            const needsQuotes = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
            const escaped = s.replace(/"/g, '""');
            return needsQuotes ? `"${escaped}"` : escaped;
        };

        // Excel (TR) can auto-convert values like "12.5" to a date (12.May).
        // Ensure numeric fields are serialized with Turkish separators (comma decimal).
        const formatNumericForCsvTR = (value, decimals = 2) => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'number' && Number.isFinite(value)) {
                return formatDecimalTurkish(value, decimals);
            }
            if (typeof value === 'string') {
                const raw = value.trim();
                if (raw === '') return '';

                // Remove spaces and try to parse both "12,5" and "12.5" styles.
                const normalized = raw.replace(/\s+/g, '').replace(',', '.');
                const n = Number(normalized);
                if (Number.isFinite(n)) return formatDecimalTurkish(n, decimals);

                // As a last resort, try to avoid date coercion by normalizing dot to comma
                // for simple decimal-like strings (e.g. "12.5" -> "12,5").
                if (/^\d+(\.\d+)+$/.test(raw)) return raw.replace(/\./g, ',');
                return raw;
            }
            const n = Number(value);
            if (Number.isFinite(n)) return formatDecimalTurkish(n, decimals);
            return String(value);
        };

        const getFoundQuantityForItem = (item) => {
            const input = document.querySelector(`.quantity-found-input[data-item-id="${item.id}"]`);
            const raw = input?.value?.trim();
            if (raw === '' || raw === undefined) return '';
            const n = parseFloat(raw);
            if (Number.isNaN(n)) return raw;
            return formatDecimalTurkish(n, 2);
        };

        const rows = items.map((item, index) => {
            const name = item.item_name || item.item_display || '-';
            const code = item.item_code || '';
            const desc = item.item_description || '';
            const jobNo = (item.job_no && item.job_no !== '1000') ? item.job_no : '';
            const requested = formatNumericForCsvTR(item.quantity ?? 0, 2);

            if (isWarehouseRequest) {
                const fromInventory = formatNumericForCsvTR(item.quantity_from_inventory ?? 0, 2);
                return [
                    index + 1,
                    name,
                    code,
                    desc,
                    jobNo,
                    requested,
                    fromInventory
                ].map(escapeCell).join(delimiter);
            }

            const unit = item.item_unit || item.unit || 'Adet';
            const found = getFoundQuantityForItem(item);
            return [
                index + 1,
                name,
                code,
                desc,
                jobNo,
                requested,
                unit,
                found
            ].map(escapeCell).join(delimiter);
        });

        const csv = [header.map(escapeCell).join(delimiter), ...rows].join('\r\n');
        const bom = '\uFEFF'; // helps Excel open UTF-8 correctly
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

        const safeRequestNo = (request.request_number || `talep-${request.id || ''}`).toString().replace(/[^\w\-]+/g, '_');
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const filename = `${safeRequestNo}-urunler-${dateStamp}.csv`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting items list to CSV:', error);
        alert('Dışa aktarma sırasında bir hata oluştu: ' + error.message);
    }
}

/**
 * Setup event listeners for read-only modal
 */
function setupReadOnlyModalEventListeners(request, isWarehouseRequest = true) {
    // Close button handler
    const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });

    // Export button handler
    const exportBtn = document.getElementById('export-items-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportItemsListToCSV(request, isWarehouseRequest));
    }
    
    // Escape key to close modal
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Setup event listeners for modal
 */
function setupModalEventListeners(request, isWarehouseRequest = false) {
    // Close button handler
    const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });

    // Export button handler
    const exportBtn = document.getElementById('export-items-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportItemsListToCSV(request, isWarehouseRequest));
    }
    
    const isCuttingRequest = isRequestFromCuttingSession(request);
    if (isCuttingRequest) {
        const saveCuttingBtn = document.getElementById('save-cutting-stock-btn');
        if (saveCuttingBtn) {
            saveCuttingBtn.addEventListener('click', async () => {
                await handleCuttingStockSave(request);
            });
        }

        const completeCuttingBtn = document.getElementById('complete-cutting-entry-btn');
        if (completeCuttingBtn) {
            completeCuttingBtn.addEventListener('click', async () => {
                await handleCuttingSessionComplete(request);
            });
        }
    } else {
        // Submit button handler
        const submitBtn = document.getElementById('submit-allocation-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                await handleAllocationSubmit(request);
            });
        }
    }
    
    // Escape key to close modal
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Handle allocation submission
 */
async function handleAllocationSubmit(request) {
    try {
        console.log('handleAllocationSubmit called');
        console.log('confirmationModal:', confirmationModal);
        
        // Collect quantity found data for normal items
        const quantityInputs = document.querySelectorAll('.quantity-found-input');
        const inventoryItems = [];
        let totalWithInventory = 0;
        let totalWithoutInventory = 0;
        let emptyFields = [];
        
        quantityInputs.forEach(input => {
            const itemId = input.getAttribute('data-item-id');
            const value = input.value.trim();
            
            // Check if field is empty
            if (value === '' || value === null || value === undefined) {
                emptyFields.push(input);
                return;
            }
            
            const quantityFound = parseFloat(value);
            
            // Validate that it's a valid number
            if (isNaN(quantityFound)) {
                emptyFields.push(input);
                return;
            }
            
            const requestedQuantity = parseFloat(input.getAttribute('data-requested-quantity')) || 0;
            
            if (quantityFound > 0) {
                totalWithInventory++;
            } else {
                totalWithoutInventory++;
            }
            
            // Include all items (even with 0 quantity)
            inventoryItems.push({
                planning_request_item_id: parseInt(itemId),
                quantity_found: quantityFound.toFixed(2)
            });
        });

        const { stockBars, invalidInputs, missingSessionItems, missingEntryItems, missingItemFieldItems } = collectCuttingStockBars(request);
        const totalCuttingItems = (request.items || []).filter(item => isFromCuttingSession(item, request)).length;
        
        // Check if there are empty quantity fields (non-cutting items)
        if (emptyFields.length > 0 || invalidInputs.length > 0) {
            // Highlight empty fields with visual feedback only
            const allInvalidInputs = [...emptyFields, ...invalidInputs];
            allInvalidInputs.forEach((input, index) => {
                input.classList.add('is-invalid');
                
                // Mark parent item row as having error
                const itemRow = input.closest('.item-row');
                if (itemRow) {
                    itemRow.classList.add('has-error');
                }
                
                // Focus on the first empty field
                if (index === 0) {
                    input.focus();
                    // Scroll to the first invalid field
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            
            return;
        }

        if (missingSessionItems.length > 0) {
            alert('Bazı kesim ürünlerinde oturum anahtarı bulunamadı. Lütfen yöneticinizle iletişime geçin.');
            return;
        }

        if (missingItemFieldItems.length > 0) {
            alert('Bazı kesim ürünlerinde item alanı bulunamadı. Lütfen yöneticinizle iletişime geçin.');
            return;
        }

        if (missingEntryItems.length > 0) {
            const firstMissingItem = missingEntryItems[0];
            const firstRow = document.querySelector(`.cutting-stock-row[data-item-id="${firstMissingItem.id}"]`);
            const firstLengthInput = firstRow?.querySelector('.cutting-length-input');
            const firstQuantityInput = firstRow?.querySelector('.cutting-quantity-input');

            if (firstLengthInput) firstLengthInput.classList.add('is-invalid');
            if (firstQuantityInput) firstQuantityInput.classList.add('is-invalid');

            const itemRow = firstRow?.closest('.item-row');
            if (itemRow) itemRow.classList.add('has-error');

            if (firstLengthInput) {
                firstLengthInput.focus();
                firstLengthInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        
        // Remove any previous validation classes
        document.querySelectorAll('.quantity-found-input, .cutting-length-input, .cutting-quantity-input').forEach(input => {
            input.classList.remove('is-invalid');
            // Remove error from item row
            const itemRow = input.closest('.item-row');
            if (itemRow) {
                itemRow.classList.remove('has-error');
            }
        });
        
        // Prepare summary for confirmation
        const totalItems = (request.items || []).length;
        const detailsHTML = `
            <div class="text-start">
                <p class="mb-2"><strong>Talep No:</strong> ${request.request_number || '-'}</p>
                <p class="mb-2"><strong>Toplam Ürün:</strong> ${totalItems}</p>
                <p class="mb-2"><strong>Envanterde Bulunan:</strong> ${totalWithInventory} ürün</p>
                <p class="mb-2"><strong>Envanterde Bulunmayan:</strong> ${totalWithoutInventory} ürün</p>
                <p class="mb-0"><strong>Kesim Stok Satırı:</strong> ${stockBars.length} ${totalCuttingItems > 0 ? `(Kesim Ürünü: ${totalCuttingItems})` : ''}</p>
            </div>
        `;
        
        console.log('About to show confirmation modal');
        console.log('Items to update:', inventoryItems.length);
        console.log('Cutting stock rows to save:', stockBars.length);
        
        // Check if confirmation modal is available
        if (!confirmationModal) {
            console.error('Confirmation modal not initialized!');
            alert('Confirmation modal is not available. Please refresh the page.');
            return;
        }
        
        // Show confirmation modal
        console.log('Showing confirmation modal...');
        await confirmationModal.show({
            title: 'Envanter Miktarlarını Güncelle',
            message: 'Bu işlemi onaylıyor musunuz?',
            description: 'Envanter miktarları güncellenecek ve sistem otomatik olarak stoktan alınacak ve satın alınacak miktarları hesaplayacaktır.',
            details: detailsHTML,
            confirmText: 'Güncelle',
            cancelText: 'İptal',
            confirmButtonClass: 'btn-primary',
            onConfirm: async () => {
                // This will be executed when user confirms
                console.log('User confirmed, performing update...');
                return await performInventoryUpdate(request, inventoryItems, stockBars);
            },
            onCancel: (reason) => {
                console.log('User cancelled, reason:', reason);
            }
        });
        
        console.log('Confirmation modal show completed');
        
    } catch (error) {
        console.error('Error in allocation submit:', error);
        console.error('Error stack:', error.stack);
        alert('Bir hata oluştu: ' + error.message);
    }
}

/**
 * Perform the actual inventory update after confirmation
 */
async function performInventoryUpdate(request, inventoryItems, stockBars) {
    try {
        // Disable the confirm button in the confirmation modal
        const confirmBtn = document.getElementById('confirm-action-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
        }

        let inventoryResponse = null;
        if (inventoryItems.length > 0) {
            const updateData = {
                items: inventoryItems
            };

            console.log('Updating inventory quantities:', updateData);
            inventoryResponse = await updateInventoryQuantities(request.id, updateData);
        }

        const touchedSessionKeys = new Set();
        if (stockBars.length > 0) {
            stockBars.forEach(stockBar => {
                if (stockBar.session) touchedSessionKeys.add(stockBar.session);
            });

            await Promise.all(Array.from(touchedSessionKeys).map(sessionKey =>
                patchLinearCuttingSession(sessionKey, { stock_entry_complete: false })
            ));

            console.log('Creating cutting stock bars:', stockBars);
            await createLinearCuttingStockBars(stockBars);
        }

        if (touchedSessionKeys.size > 0) {
            await Promise.all(Array.from(touchedSessionKeys).map(sessionKey =>
                patchLinearCuttingSession(sessionKey, { stock_entry_complete: true })
            ));
            touchedSessionKeys.forEach(sessionKey => stockEntryIncompleteSessionKeys.delete(sessionKey));
        }

        const updatedCount = inventoryResponse?.updated_count ?? inventoryItems.length;
        const cuttingCount = stockBars.length;
        alert(
            `Kayit basariyla tamamlandi!\n\n` +
            `Envanter guncellenen urun: ${updatedCount}\n` +
            `Kaydedilen kesim stok satırı: ${cuttingCount}`
        );
        
        // Close modals
        closeModal();
        
        // Reload the lists
        loadPendingInventoryRequests();
        loadWarehouseRequests();
        
        // Return true to allow confirmation modal to close
        return true;
        
    } catch (error) {
        console.error('Error updating inventory quantities:', error);
        alert('Kayit sirasinda bir hata olustu: ' + error.message);
        
        // Re-enable confirm button
        const confirmBtn = document.getElementById('confirm-action-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Güncelle';
        }
        
        // Return false to keep modal open on error
        return false;
    }
}

/**
 * Close modal
 */
function closeModal() {
    const modal = document.getElementById('inventoryAllocationModal');
    if (modal) {
        modal.remove();
    }
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleEscapeKey);
}

/**
 * Handle escape key press
 */
function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format date to Turkish locale
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        
        // Check if date is invalid
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        // Check if it's a date-only string (no time component)
        const isDateOnly = !dateString.includes('T') && !dateString.includes(':');
        
        if (isDateOnly) {
            // Format as date only
            return date.toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else {
            // Format with time
            return date.toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch (error) {
        return dateString;
    }
}

/**
 * Format priority text
 */
function formatPriority(priority) {
    const priorityMap = {
        'low': 'Düşük',
        'normal': 'Normal',
        'high': 'Yüksek',
        'urgent': 'Acil',
        'critical': 'Kritik'
    };
    return priorityMap[priority] || priority || 'Normal';
}

/**
 * Get priority CSS class
 */
function getPriorityClass(priority) {
    const classMap = {
        'low': 'text-secondary',
        'normal': 'text-primary',
        'high': 'text-warning',
        'urgent': 'text-danger',
        'critical': 'text-danger fw-bold'
    };
    return classMap[priority] || 'text-primary';
}

/**
 * Get status text
 */
function getStatusText(status) {
    const statusMap = {
        'draft': 'Taslak',
        'pending_inventory': 'Envanter Kontrolü Bekliyor',
        'ready': 'Satın Alma İçin Hazır',
        'completed': 'Tamamlandı',
        'cancelled': 'İptal Edildi'
    };
    return statusMap[status] || status || 'Bilinmiyor';
}

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(status) {
    const variantMap = {
        'draft': 'secondary',
        'pending_inventory': 'warning',
        'ready': 'info',
        'completed': 'success',
        'cancelled': 'danger'
    };
    return variantMap[status] || 'secondary';
}


