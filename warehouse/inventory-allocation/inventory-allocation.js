// --- inventory-allocation.js ---
import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { TableComponent } from '../../components/table/table.js';
import { getPlanningRequests, allocateInventory, completeInventoryControl } from '../../generic/warehouse.js';
import { formatDecimalTurkish } from '../../generic/formatters.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();
    
    // Initialize header
    initializeHeader();
    
    // Initialize results table
    initializeResultsTable();
    
    // Load pending inventory requests
    loadPendingInventoryRequests();
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
                    originalData: request
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

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

async function showInventoryAllocationModal(requestData) {
    const request = requestData.originalData || requestData;
    
    try {
        // Show loading modal first
        showLoadingModal();
        
        // Fetch full request details if needed
        // For now, we'll use the data we have
        
        // Create and show the modal
        const modalHTML = createInventoryAllocationModalHTML(request);
        
        // Remove any existing modals
        const existingModal = document.getElementById('inventoryAllocationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Insert modal into DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Initialize modal components
        initializeItemsTable(request);
        
        // Add event listeners
        setupModalEventListeners(request);
        
    } catch (error) {
        console.error('Error showing inventory allocation modal:', error);
        alert('Modal açılırken bir hata oluştu: ' + error.message);
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
function createInventoryAllocationModalHTML(request) {
    return `
        <div class="modal fade show" id="inventoryAllocationModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-clipboard-check me-2"></i>${request.request_number || `Talep #${request.id}`} - Envanter Tahsisi
                        </h5>
                        <button type="button" class="btn-close" data-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Section 1: Request Details -->
                        <div class="request-details-section mb-3">
                            <h6 class="section-title mb-2">
                                <i class="fas fa-info-circle me-2"></i>Talep Bilgileri
                            </h6>
                            <div class="row g-2">
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Talep No:</span>
                                        <span class="detail-value-compact fw-bold">${request.request_number || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Başlık:</span>
                                        <span class="detail-value-compact">${request.title || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Departman Talebi:</span>
                                        <span class="detail-value-compact">${request.department_request_number || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Öncelik:</span>
                                        <span class="detail-value-compact ${getPriorityClass(request.priority)}">${formatPriority(request.priority)}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Durum:</span>
                                        <span class="detail-value-compact">${getStatusText(request.status)}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Oluşturulma:</span>
                                        <span class="detail-value-compact">${request.created_at ? formatDate(request.created_at) : '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Oluşturan:</span>
                                        <span class="detail-value-compact">${request.created_by_full_name || request.created_by_username || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Gerekli Tarih:</span>
                                        <span class="detail-value-compact">${request.needed_date ? formatDate(request.needed_date) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${request.description ? `
                        <!-- Section 2: Description -->
                        <div class="request-details-section mb-3">
                            <h6 class="section-title mb-2">
                                <i class="fas fa-align-left me-2"></i>Açıklama
                            </h6>
                            <p class="mb-0">${request.description}</p>
                        </div>
                        ` : ''}
                        
                        <!-- Section 3: Items Table -->
                        <div class="items-table-section">
                            <h6 class="section-title mb-3">
                                <i class="fas fa-boxes me-2"></i>Ürünler ve Envanter Miktarları
                            </h6>
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                Her ürün için envanterde mevcut olan miktarı girin. Boş bırakılan alanlar 0 olarak işlenecektir.
                            </div>
                            <div id="items-table-container"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="submit-allocation-btn">
                            <i class="fas fa-check me-2"></i>Envanter Tahsisini Tamamla
                        </button>
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize items table with input fields for allocation
 */
function initializeItemsTable(request) {
    const container = document.getElementById('items-table-container');
    if (!container) {
        console.error('Items table container not found');
        return;
    }
    
    const items = request.items || [];
    
    console.log('Initializing items table with', items.length, 'items');
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>Bu talepte ürün bulunmuyor</p>
            </div>
        `;
        return;
    }
    
    // Create table HTML
    const tableHTML = `
        <div class="table-responsive">
            <table class="table table-bordered table-hover" id="items-allocation-table">
                <thead class="table-dark">
                    <tr>
                        <th style="width: 5%;">#</th>
                        <th style="width: 30%;">Ürün</th>
                        <th style="width: 15%;">Talep Edilen Miktar</th>
                        <th style="width: 10%;">Birim</th>
                        <th style="width: 20%;">Envanter Miktarı</th>
                        <th style="width: 20%;">Notlar</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => `
                        <tr data-item-id="${item.id}">
                            <td class="text-center">${index + 1}</td>
                            <td>
                                <div class="fw-bold">${item.item_name || item.item_display || '-'}</div>
                                ${item.item_code ? `<small class="text-muted d-block">Kod: ${item.item_code}</small>` : ''}
                                ${item.item_description ? `<small class="text-muted d-block">${item.item_description}</small>` : ''}
                                ${item.job_no && item.job_no !== '1000' ? `<small class="text-primary d-block"><i class="fas fa-briefcase me-1"></i>İş No: ${item.job_no}</small>` : ''}
                            </td>
                            <td class="text-end fw-bold">${formatDecimalTurkish(item.quantity || 0, 2)}</td>
                            <td>${item.item_unit || item.unit || 'Adet'}</td>
                            <td>
                                <input type="number" 
                                       class="form-control allocation-input" 
                                       data-item-id="${item.id}"
                                       data-requested-quantity="${item.quantity || 0}"
                                       step="0.01"
                                       min="0"
                                       max="${item.quantity || 0}"
                                       placeholder="0.00">
                            </td>
                            <td>
                                <input type="text" 
                                       class="form-control allocation-notes" 
                                       data-item-id="${item.id}"
                                       placeholder="İsteğe bağlı not">
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
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
        const submitBtn = document.getElementById('submit-allocation-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
        }
        
        // Collect allocation data from inputs
        const allocationInputs = document.querySelectorAll('.allocation-input');
        const allocations = [];
        
        allocationInputs.forEach(input => {
            const itemId = input.getAttribute('data-item-id');
            const allocatedQuantity = parseFloat(input.value) || 0;
            const notesInput = document.querySelector(`.allocation-notes[data-item-id="${itemId}"]`);
            const notes = notesInput ? notesInput.value.trim() : '';
            
            // Only include items with allocated quantity > 0
            if (allocatedQuantity > 0) {
                allocations.push({
                    planning_request_item_id: parseInt(itemId),
                    allocated_quantity: allocatedQuantity.toFixed(2),
                    notes: notes || undefined
                });
            }
        });
        
        // Prepare data for API
        const allocationData = {
            allocations: allocations
        };
        
        // Call complete inventory control endpoint
        // This will create allocations and complete the inventory control process
        const response = await completeInventoryControl(request.id, allocationData);
        
        // Show success message
        alert(`Envanter tahsisi başarıyla tamamlandı!\n\nDurum: ${response.status}\nTam Envanter: ${response.fully_from_inventory ? 'Evet' : 'Hayır'}`);
        
        // Close modal
        closeModal();
        
        // Reload the list
        loadPendingInventoryRequests();
        
    } catch (error) {
        console.error('Error submitting allocation:', error);
        alert('Envanter tahsisi yapılırken bir hata oluştu: ' + error.message);
        
        // Re-enable submit button
        const submitBtn = document.getElementById('submit-allocation-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check me-2"></i>Envanter Tahsisini Tamamla';
        }
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


