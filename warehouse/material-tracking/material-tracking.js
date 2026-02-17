// --- material-tracking.js ---
// Malzeme Takibi (Material Tracking) page

import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { TableComponent } from '../../components/table/table.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';
import { getPlanningRequestItems, markItemDelivered, bulkMarkItemsDelivered } from '../../generic/planningRequestItems.js';
import { formatDecimalTurkish } from '../../generic/formatters.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

let itemsTable;
let confirmationModal;
let currentFilters = {
    is_delivered: false,  // Default filter: only show undelivered items
    item_type_exclude: 'expenditure'  // Default filter: exclude expenditure items (cannot be changed)
};
let currentPage = 1;
let totalItems = 0;
let selectedItems = new Set();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();
    
    // Initialize header
    initializeHeader();
    
    // Initialize filters
    initializeFilters();
    
    // Initialize table
    initializeTable();
    
    // Initialize confirmation modal
    confirmationModal = new ConfirmationModal('confirmation-modal-container', {
        title: 'Onay',
        icon: 'fas fa-exclamation-triangle',
        confirmText: 'Evet',
        cancelText: 'İptal',
        confirmButtonClass: 'btn-primary'
    });
    
    // Load initial data
    loadItems();
});

// ============================================================================
// HEADER COMPONENT SETUP
// ============================================================================

function initializeHeader() {
    const header = new HeaderComponent({
        title: 'Malzeme Takibi',
        subtitle: 'Planlama talebi öğelerini görüntüleyin ve teslim durumunu yönetin',
        icon: 'boxes',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        backUrl: '../',
        onRefreshClick: () => {
            loadItems();
        }
    });
}

// ============================================================================
// FILTERS SETUP
// ============================================================================

function initializeFilters() {
    const filtersContainer = document.getElementById('filters-container');
    if (!filtersContainer) return;
    
    filtersContainer.innerHTML = `
        <div class="filters-container">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">
                    <i class="fas fa-filter me-2"></i>Filtreler
                </h5>
                <button type="button" class="btn btn-link p-0" id="toggle-filters-btn">
                    <i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle
                </button>
            </div>
            
            <div class="filter-content" id="filter-content" style="display: block;">
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="filter-job-no">
                            <i class="fas fa-hashtag me-2"></i>İş No
                        </label>
                        <input 
                            type="text" 
                            id="filter-job-no" 
                            class="form-control form-control-sm" 
                            placeholder="Örn: 284-07"
                        >
                    </div>
                    
                    <div class="filter-group">
                        <label for="filter-item-code">
                            <i class="fas fa-barcode me-2"></i>Malzeme Kodu
                        </label>
                        <input 
                            type="text" 
                            id="filter-item-code" 
                            class="form-control form-control-sm" 
                            placeholder="Örn: 0010 0002 0000 0001"
                        >
                    </div>
                    
                    <div class="filter-group">
                        <label for="filter-item-name">
                            <i class="fas fa-tag me-2"></i>Malzeme Adı
                        </label>
                        <input 
                            type="text" 
                            id="filter-item-name" 
                            class="form-control form-control-sm" 
                            placeholder="Örn: 140 mm 42CrMo4 MİL"
                        >
                    </div>
                    
                    <div class="filter-group">
                        <label for="filter-is-delivered">
                            <i class="fas fa-check-circle me-2"></i>Teslim Durumu
                        </label>
                        <select id="filter-is-delivered" class="form-select form-select-sm">
                            <option value="">Tümü</option>
                            <option value="false" selected>Teslim Edilmedi</option>
                            <option value="true">Teslim Edildi</option>
                        </select>
                    </div>
                </div>
                
                <div class="filter-actions">
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
            
            const icon = toggleBtn.querySelector('i');
            if (isVisible) {
                icon.className = 'fas fa-chevron-down me-1';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Filtreleri Göster';
            } else {
                icon.className = 'fas fa-chevron-up me-1';
                toggleBtn.innerHTML = '<i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle';
            }
        });
    }
    
    const applyBtn = document.getElementById('apply-filters-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyFilters);
    }
    
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearFilters);
    }
    
    // Apply filters on Enter key
    const filterInputs = ['filter-job-no', 'filter-item-code', 'filter-item-name'];
    filterInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
    });
}

// ============================================================================
// TABLE SETUP
// ============================================================================

function initializeTable() {
    const resultsContainer = document.getElementById('results-container');
    const bulkActionsContainer = document.getElementById('bulk-actions-container');
    if (!resultsContainer) return;
    
    itemsTable = new TableComponent('results-container', {
        title: 'Planlama Talebi Öğeleri',
        columns: [
            {
                field: 'id',
                label: '',
                sortable: false,
                formatter: (value, row) => {
                    return `<input type="checkbox" class="form-check-input item-checkbox" data-item-id="${row.id}" ${row.is_delivered ? 'disabled' : ''}>`;
                }
            },
            {
                field: 'item_code',
                label: 'Malzeme Kodu',
                sortable: true,
                formatter: (value) => `<span class="item-code">${value || '-'}</span>`
            },
            {
                field: 'item_name',
                label: 'Malzeme Adı',
                sortable: true,
                formatter: (value) => `<span class="item-name">${value || '-'}</span>`
            },
            {
                field: 'job_no',
                label: 'İş No',
                sortable: true,
                width: '150px',
                formatter: (value) => `<span class="job-no">${value || '-'}</span>`
            },
            {
                field: 'quantity',
                label: 'Miktar',
                sortable: true,
                formatter: (value, row) => {
                    const qty = parseFloat(value || 0);
                    return `<span class="quantity-badge primary">${formatDecimalTurkish(qty)} ${row.item_unit || ''}</span>`;
                }
            },
            {
                field: 'quantity_to_purchase',
                label: 'Satın Alınacak',
                sortable: true,
                formatter: (value, row) => {
                    const qty = parseFloat(value || 0);
                    const badgeClass = qty > 0 ? 'warning' : 'success';
                    return `<span class="quantity-badge ${badgeClass}">${formatDecimalTurkish(qty)} ${row.item_unit || ''}</span>`;
                }
            },
            {
                field: 'is_delivered',
                label: 'Durum',
                sortable: true,
                formatter: (value) => {
                    return value 
                        ? '<span class="status-badge delivered"><i class="fas fa-check-circle me-1"></i>Teslim Edildi</span>'
                        : '<span class="status-badge pending"><i class="fas fa-clock me-1"></i>Beklemede</span>';
                }
            },
            {
                field: 'delivered_at',
                label: 'Teslim Tarihi',
                sortable: true,
                formatter: (value) => {
                    if (!value) return '-';
                    const date = new Date(value);
                    return date.toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            },
            {
                field: 'delivered_by_username',
                label: 'Teslim Eden',
                sortable: true,
                formatter: (value) => value || '-'
            }
        ],
        data: [],
        pagination: true,
        serverSidePagination: true,  // Enable server-side pagination
        itemsPerPage: 20,
        currentPage: 1,
        totalItems: 0,
        actions: [
            {
                key: 'mark-delivered',
                label: 'Teslim Al',
                icon: 'fas fa-check',
                class: 'btn-outline-success btn-sm',
                visible: (row) => !row.is_delivered,
                onClick: (row) => handleMarkDelivered(row.id)
            }
        ],
        onPageChange: (page) => {
            currentPage = page;
            loadItems();
        }
    });
    
    // Handle row clicks for selection using event delegation
    // Attach to results container so it works even after table re-renders
    setupRowClickHandler();
    
    // Bind checkbox events for bulk selection using event delegation
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('item-checkbox')) {
            const itemId = parseInt(e.target.dataset.itemId);
            const row = itemsTable.options.data.find(item => item.id === itemId);
            
            // Only allow selection of non-delivered items
            if (row && !row.is_delivered) {
                if (e.target.checked) {
                    selectedItems.add(itemId);
                } else {
                    selectedItems.delete(itemId);
                }
                updateBulkActions();
            } else {
                e.target.checked = false;
            }
        }
    });
    
    // Add bulk actions to container (always visible, buttons disabled until selection)
    if (bulkActionsContainer) {
        bulkActionsContainer.innerHTML = `
            <div class="bulk-actions" id="bulk-actions">
                <div class="bulk-actions-info">
                    <i class="fas fa-check-square me-2"></i>
                    <span id="selected-count">0</span> öğe seçildi
                </div>
                <button type="button" class="btn btn-success btn-sm" id="bulk-mark-delivered-btn" disabled>
                    <i class="fas fa-check-double me-2"></i>Seçilenleri Teslim Al
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="clear-selection-btn" disabled>
                    <i class="fas fa-times me-2"></i>Seçimi Temizle
                </button>
            </div>
        `;
        
        const bulkMarkBtn = document.getElementById('bulk-mark-delivered-btn');
        if (bulkMarkBtn) {
            bulkMarkBtn.addEventListener('click', handleBulkMarkDelivered);
        }
        
        const clearSelectionBtn = document.getElementById('clear-selection-btn');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                selectedItems.clear();
                document.querySelectorAll('.item-checkbox').forEach(cb => {
                    cb.checked = false;
                });
                updateBulkActions();
            });
        }
    }
}

// ============================================================================
// ROW CLICK HANDLER SETUP
// ============================================================================

function setupRowClickHandler() {
    // Initial setup - will be re-attached after each render
    attachRowClickHandler();
}

function attachRowClickHandler() {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    
    // Find the tbody element
    const tbody = resultsContainer.querySelector('tbody');
    if (!tbody) return;
    
    // Remove any existing listener by cloning and replacing (clean way to remove listeners)
    const newTbody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newTbody, tbody);
    
    // Attach click handler directly to tbody
    newTbody.addEventListener('click', (e) => {
        // Find the clicked row
        const row = e.target.closest('tr');
        if (!row) return;
        
        // Only exclude clicks on action buttons (the last column with buttons)
        const target = e.target;
        const clickedCell = target.closest('td');
        
        // Check if we clicked in the action buttons column (last column)
        if (clickedCell) {
            const allCells = row.querySelectorAll('td');
            const lastCell = allCells[allCells.length - 1];
            if (clickedCell === lastCell && target.closest('button')) {
                // Clicked on action button, don't toggle selection
                return;
            }
        }
        
        // Also exclude checkbox clicks (they have their own handler)
        if (target.classList.contains('item-checkbox') || target.closest('.item-checkbox')) {
            return;
        }
        
        // Get the row index
        const rowIndex = Array.from(newTbody.querySelectorAll('tr')).indexOf(row);
        if (rowIndex === -1 || !itemsTable) return;
        
        // Get the row data from the current page's data
        const rowData = itemsTable.options.data[rowIndex];
        if (!rowData) return;
        
        // Only allow selection of non-delivered items
        if (!rowData.is_delivered) {
            const itemId = rowData.id;
            if (selectedItems.has(itemId)) {
                selectedItems.delete(itemId);
            } else {
                selectedItems.add(itemId);
            }
            
            // Update checkbox state
            const checkbox = row.querySelector(`.item-checkbox[data-item-id="${itemId}"]`);
            if (checkbox) {
                checkbox.checked = selectedItems.has(itemId);
            }
            
            updateBulkActions();
        }
    });
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadItems() {
    try {
        if (itemsTable) {
            itemsTable.setLoading(true);
        }
        
        // Build filters
        const filters = {
            ...currentFilters,
            page: currentPage,
            page_size: 20,  // Items per page
            ordering: 'job_no'
        };
        
        const data = await getPlanningRequestItems(filters);
        
        // Handle paginated response
        const items = data.results || [];
        totalItems = data.count || items.length;
        
        // Update table (updateData calls render automatically)
        if (itemsTable) {
            itemsTable.updateData(items, totalItems, currentPage);
            // Explicitly clear loading state
            itemsTable.setLoading(false);
        }
        
        // Clear selection after reload
        selectedItems.clear();
        updateBulkActions();
        
        // Re-attach row click handler after table re-renders
        setTimeout(() => {
            attachRowClickHandler();
            
            // Re-bind checkbox states after render
            document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                const itemId = parseInt(checkbox.dataset.itemId);
                checkbox.checked = selectedItems.has(itemId);
            });
        }, 100);
        
    } catch (error) {
        console.error('Error loading items:', error);
        
        if (itemsTable) {
            itemsTable.setLoading(false);
        }
        
        // Show error message
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
            const errorHtml = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${error.message || 'Öğeler yüklenirken bir hata oluştu.'}
                </div>
            `;
            resultsContainer.innerHTML = errorHtml;
        }
    }
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function applyFilters() {
    // Always include default filters that cannot be changed
    currentFilters = {
        is_delivered: false,  // Default: only undelivered items
        item_type_exclude: 'expenditure'  // Always exclude expenditure items
    };
    currentPage = 1;
    
    // Collect filter values
    const jobNo = document.getElementById('filter-job-no')?.value.trim();
    const itemCode = document.getElementById('filter-item-code')?.value.trim();
    const itemName = document.getElementById('filter-item-name')?.value.trim();
    const isDelivered = document.getElementById('filter-is-delivered')?.value;
    
    if (jobNo) currentFilters.job_no = jobNo;
    if (itemCode) currentFilters.item_code = itemCode;
    if (itemName) currentFilters.item_name = itemName;
    
    // Handle is_delivered filter - default to false if not explicitly set
    if (isDelivered === '') {
        currentFilters.is_delivered = false;  // Default: only undelivered items
    } else {
        currentFilters.is_delivered = isDelivered === 'true';
    }
    
    loadItems();
}

function clearFilters() {
    document.getElementById('filter-job-no').value = '';
    document.getElementById('filter-item-code').value = '';
    document.getElementById('filter-item-name').value = '';
    document.getElementById('filter-is-delivered').value = 'false';  // Reset to default: undelivered
    
    // Reset to default filters (only undelivered items, exclude expenditure)
    currentFilters = {
        is_delivered: false,
        item_type_exclude: 'expenditure'
    };
    currentPage = 1;
    loadItems();
}

// ============================================================================
// MARK DELIVERED FUNCTIONS
// ============================================================================

async function handleMarkDelivered(itemId) {
    try {
        await confirmationModal.show({
            message: 'Bu öğeyi teslim almak istediğinizden emin misiniz?',
            onConfirm: async () => {
                try {
                    await markItemDelivered(itemId);
                    // Reload items
                    loadItems();
                } catch (error) {
                    console.error('Error marking item as delivered:', error);
                    alert(error.message || 'Öğe teslim alınırken bir hata oluştu.');
                }
            }
        });
    } catch (error) {
        console.error('Error showing confirmation:', error);
    }
}

async function handleBulkMarkDelivered() {
    if (selectedItems.size === 0) {
        alert('Lütfen en az bir öğe seçin.');
        return;
    }
    
    try {
        const ids = Array.from(selectedItems);
        // Get selected items data for display
        const selectedItemsData = itemsTable.options.data.filter(item => ids.includes(item.id));
        
        // Show modal with selected items list
        showBulkConfirmModal(selectedItemsData, ids);
    } catch (error) {
        console.error('Error showing confirmation:', error);
    }
}

/**
 * Show confirmation modal with list of selected items
 */
function showBulkConfirmModal(selectedItems, ids) {
    // Create modal HTML with items list
    const itemsListHtml = selectedItems.map(item => `
        <div class="selected-item-row">
            <div class="selected-item-info">
                <strong>${item.item_code || '-'}</strong>
                <span class="text-muted ms-2">${item.item_name || '-'}</span>
            </div>
            <div class="selected-item-details">
                <small class="text-muted">
                    İş No: ${item.job_no || '-'} | 
                    Miktar: ${item.quantity || '0'} ${item.item_unit || ''}
                </small>
            </div>
        </div>
    `).join('');
    
    const modalHtml = `
        <div class="modal fade" id="bulkConfirmModal" tabindex="-1" style="z-index: 10060;">
            <div class="modal-dialog modal-lg" style="z-index: 10061;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-check-double me-2"></i>
                            Seçilen Öğeleri Teslim Al
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-3">
                            <strong>${ids.length}</strong> öğeyi teslim almak istediğinizden emin misiniz?
                        </p>
                        <div class="selected-items-list">
                            ${itemsListHtml}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                        <button type="button" class="btn btn-success" id="confirm-bulk-delivery-btn">
                            <i class="fas fa-check me-2"></i>Teslim Al
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal and any backdrops if any
    const existingModal = document.getElementById('bulkConfirmModal');
    if (existingModal) {
        const existingBackdrop = document.querySelector('.modal-backdrop');
        if (existingBackdrop) {
            existingBackdrop.remove();
        }
        existingModal.remove();
    }
    
    // Check if there's a confirmation modal open and wait for it to close
    const confirmationModalElement = document.getElementById('confirmationModal');
    if (confirmationModalElement && confirmationModalElement.classList.contains('show')) {
        // Wait for confirmation modal to close first
        confirmationModalElement.addEventListener('hidden.bs.modal', () => {
            showBulkModalAfterDelay(modalHtml, ids);
        }, { once: true });
        return;
    }
    
    // Clean up any orphaned backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    
    // Clean up body classes
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    showBulkModalAfterDelay(modalHtml, ids);
}

function showBulkModalAfterDelay(modalHtml, ids) {
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Wait for DOM to be ready
    setTimeout(() => {
        // Initialize Bootstrap modal
        const modalElement = document.getElementById('bulkConfirmModal');
        if (!modalElement) return;
        
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // Ensure modal has proper z-index (higher than ConfirmationModal)
        modalElement.style.zIndex = '10060';
        
        // Handle confirm button click
        const confirmBtn = document.getElementById('confirm-bulk-delivery-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
                
                try {
                    const result = await bulkMarkItemsDelivered(ids);
                    modal.hide();
                    
                    // Reload items
                    loadItems();
                } catch (error) {
                    console.error('Error bulk marking items as delivered:', error);
                    alert(error.message || 'Öğeler teslim alınırken bir hata oluştu.');
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Teslim Al';
                }
            });
        }
        
        // Clean up modal when hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            // Remove backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            // Remove modal
            modalElement.remove();
            // Clean up body
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, { once: true });
        
        // Show modal
        modal.show();
        
        // Ensure backdrop z-index is correct after showing (higher than ConfirmationModal backdrop)
        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.style.zIndex = '10059';
            }
            // Also ensure modal dialog is on top
            const modalDialog = modalElement.querySelector('.modal-dialog');
            if (modalDialog) {
                modalDialog.style.zIndex = '10061';
            }
        }, 10);
    }, 50);
}

function updateBulkActions() {
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');
    const bulkMarkBtn = document.getElementById('bulk-mark-delivered-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    
    if (!bulkActions || !selectedCount) return;
    
    const count = selectedItems.size;
    selectedCount.textContent = count;
    
    // Enable/disable buttons based on selection count
    if (bulkMarkBtn) {
        bulkMarkBtn.disabled = count === 0;
    }
    if (clearSelectionBtn) {
        clearSelectionBtn.disabled = count === 0;
    }
}
