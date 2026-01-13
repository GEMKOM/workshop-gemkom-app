// --- inventory-allocation.js ---
import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { TableComponent } from '../../components/table/table.js';
import { getPlanningRequests, getPlanningRequest, updateInventoryQuantities, completeInventoryControl, getWarehouseRequests } from '../../generic/warehouse.js';
import { formatDecimalTurkish } from '../../generic/formatters.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Global confirmation modal instance
let confirmationModal;

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
        const request = await getPlanningRequest(requestSummary.id);
        
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
            setupReadOnlyModalEventListeners();
        } else {
            // Full event listeners for editable modal
            setupModalEventListeners(request);
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
    const modalTitle = isWarehouseRequest 
        ? `${request.request_number || `Talep #${request.id}`} - Envanter Durumu`
        : `${request.request_number || `Talep #${request.id}`} - Envanter Tahsisi`;
    
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
                            ${!isWarehouseRequest ? `
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
                            ` : ''}
                            <div id="items-table-container"></div>
                        </div>
                    </div>
                    ${!isWarehouseRequest ? `
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="submit-allocation-btn">
                            <i class="fas fa-check me-2"></i>Envanter Miktarlarını Güncelle
                        </button>
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
        const itemsHTML = `
            <div class="items-container">
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
                        <span class="desktop-label">Bulunan Miktar</span>
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
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = itemsHTML;
        
        // Add event listeners to remove validation errors and update progress
        setTimeout(() => {
            const inputs = document.querySelectorAll('.quantity-found-input');
            const totalItems = inputs.length;
            
            // Show progress indicator if there are items
            if (totalItems > 0) {
                const progressIndicator = document.getElementById('progress-indicator');
                if (progressIndicator) {
                    progressIndicator.style.display = 'block';
                }
            }
            
            // Function to update progress
            const updateProgress = () => {
                let filledCount = 0;
                inputs.forEach(input => {
                    if (input.value && input.value.trim() !== '') {
                        filledCount++;
                    }
                });
                
                const progressPercent = (filledCount / totalItems) * 100;
                const progressBar = document.getElementById('progress-bar');
                const progressText = document.getElementById('progress-text');
                
                if (progressBar) {
                    progressBar.style.width = progressPercent + '%';
                    // Change color based on progress
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
            
            inputs.forEach(input => {
                input.addEventListener('input', function() {
                    this.classList.remove('is-invalid');
                    // Remove error from item row
                    const itemRow = this.closest('.item-row');
                    if (itemRow) {
                        itemRow.classList.remove('has-error');
                    }
                    
                    // Update progress
                    updateProgress();
                });
            });
            
            // Initial progress update
            updateProgress();
        }, 100);
    }
}

/**
 * Setup event listeners for read-only modal
 */
function setupReadOnlyModalEventListeners() {
    // Close button handler
    const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Setup event listeners for modal
 */
function setupModalEventListeners(request) {
    // Close button handler
    const closeButtons = document.querySelectorAll('[data-dismiss="modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });
    
    // Submit button handler
    const submitBtn = document.getElementById('submit-allocation-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            await handleAllocationSubmit(request);
        });
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
        
        // Collect quantity found data from inputs
        const quantityInputs = document.querySelectorAll('.quantity-found-input');
        const items = [];
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
            items.push({
                planning_request_item_id: parseInt(itemId),
                quantity_found: quantityFound.toFixed(2)
            });
        });
        
        // Check if there are empty fields
        if (emptyFields.length > 0) {
            // Highlight empty fields with visual feedback only
            emptyFields.forEach((input, index) => {
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
        
        // Remove any previous validation classes
        quantityInputs.forEach(input => {
            input.classList.remove('is-invalid');
            // Remove error from item row
            const itemRow = input.closest('.item-row');
            if (itemRow) {
                itemRow.classList.remove('has-error');
            }
        });
        
        // Prepare summary for confirmation
        const totalItems = items.length;
        const detailsHTML = `
            <div class="text-start">
                <p class="mb-2"><strong>Talep No:</strong> ${request.request_number || '-'}</p>
                <p class="mb-2"><strong>Toplam Ürün:</strong> ${totalItems}</p>
                <p class="mb-2"><strong>Envanterde Bulunan:</strong> ${totalWithInventory} ürün</p>
                <p class="mb-0"><strong>Envanterde Bulunmayan:</strong> ${totalWithoutInventory} ürün</p>
            </div>
        `;
        
        console.log('About to show confirmation modal');
        console.log('Items to update:', items.length);
        
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
                return await performInventoryUpdate(request, items);
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
async function performInventoryUpdate(request, items) {
    try {
        // Disable the confirm button in the confirmation modal
        const confirmBtn = document.getElementById('confirm-action-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
        }
        
        // Prepare data for API
        const updateData = {
            items: items
        };
        
        console.log('Updating inventory quantities:', updateData);
        
        // Call update inventory quantities endpoint
        const response = await updateInventoryQuantities(request.id, updateData);
        
        // Show success message
        alert(`Envanter miktarları başarıyla güncellendi!\n\n${response.updated_count} ürün güncellendi.`);
        
        // Close modals
        closeModal();
        
        // Reload the lists
        loadPendingInventoryRequests();
        loadWarehouseRequests();
        
        // Return true to allow confirmation modal to close
        return true;
        
    } catch (error) {
        console.error('Error updating inventory quantities:', error);
        alert('Envanter miktarları güncellenirken bir hata oluştu: ' + error.message);
        
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


