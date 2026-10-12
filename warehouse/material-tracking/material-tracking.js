// --- material-tracking.js ---
// Malzeme Takibi (Material Tracking) page

import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { TableComponent } from '../../components/table/table.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';
import { getPlanningRequestItems, markItemDelivered, unmarkItemDelivered, bulkMarkItemsDelivered, getPlanningItemDeliveries } from '../../generic/planningRequestItems.js';
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
                            <option value="partial">Kısmi Teslim</option>
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
                formatter: (value, row) => renderDeliveryStatus(row)
            },
            {
                field: 'delivered_at',
                label: 'Teslim Tarihi',
                sortable: true,
                // Fully delivered lines carry the completion stamp; partial
                // lines show when the last shipment landed.
                formatter: (value, row) => formatDateTimeTr(value || row.last_delivered_at)
            },
            {
                field: 'delivered_by_username',
                label: 'Teslim Eden',
                sortable: true,
                formatter: (value, row) => value || lastReceiptUser(row) || '-'
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
                onClick: (row) => openDeliveryModal([row])
            },
            {
                key: 'unmark-delivered',
                label: 'Teslimi Geri Al',
                icon: 'fas fa-undo',
                class: 'btn-outline-danger btn-sm',
                visible: (row) => row.is_delivered || row.is_partially_delivered,
                onClick: (row) => handleUnmarkDelivered(row)
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
        delete currentFilters.is_delivered;   // Tümü
    } else if (isDelivered === 'partial') {
        currentFilters.is_delivered = false;  // some of it arrived, still waiting for the rest
        currentFilters.partially_delivered = true;
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
// DELIVERY STATE HELPERS
// ============================================================================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toNumber(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

// Quantities are shown with as many decimals as they need (12 kg, 600,5 kg), never "12,00".
function fmtQty(value) {
    const n = toNumber(value);
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTimeTr(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
}

// Who booked the latest shipment of a partial line (fields=simple embeds the receipts).
function lastReceiptUser(row) {
    const receipts = Array.isArray(row.deliveries) ? row.deliveries : [];
    const last = receipts.length ? receipts[receipts.length - 1] : null;
    return last ? (last.delivered_by_name || last.delivered_by_username || '') : '';
}

function remainingOf(row) {
    const remaining = toNumber(row.quantity) - toNumber(row.delivered_quantity);
    return Math.max(Math.round(remaining * 100) / 100, 0);
}

function renderDeliveryStatus(row) {
    if (row.is_delivered) {
        return '<span class="status-badge delivered"><i class="fas fa-check-circle me-1"></i>Teslim Edildi</span>';
    }
    const delivered = toNumber(row.delivered_quantity);
    if (delivered > 0) {
        const unit = escapeHtml(row.item_unit || '');
        return `<span class="status-badge partial"><i class="fas fa-adjust me-1"></i>Kısmi Teslim</span>
            <div class="delivery-progress">${fmtQty(delivered)} / ${fmtQty(row.quantity)} ${unit} alındı · kalan ${fmtQty(remainingOf(row))} ${unit}</div>`;
    }
    return '<span class="status-badge pending"><i class="fas fa-clock me-1"></i>Beklemede</span>';
}

// ============================================================================
// MARK DELIVERED (receipt modal: one amount per line, default = what is left)
// ============================================================================

async function handleUnmarkDelivered(row) {
    const partial = !row.is_delivered && toNumber(row.delivered_quantity) > 0;
    const message = partial
        ? `Bu öğenin son teslimat kaydı geri alınacak (şu an ${fmtQty(row.delivered_quantity)} ${row.item_unit || ''} alınmış görünüyor). Devam edilsin mi?`
        : 'Bu öğenin son teslimat kaydı geri alınacak ve öğe yeniden bekliyor durumuna geçecek. Devam edilsin mi?';
    try {
        await confirmationModal.show({
            message,
            onConfirm: async () => {
                try {
                    await unmarkItemDelivered(row.id);
                    loadItems();
                } catch (error) {
                    console.error('Error unmarking item as delivered:', error);
                    alert(error.message || 'Öğenin teslim durumu geri alınırken bir hata oluştu.');
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
    const ids = Array.from(selectedItems);
    const rows = itemsTable.options.data.filter(item => ids.includes(item.id));
    openDeliveryModal(rows);
}

function deliveryItemCardHtml(row) {
    const unit = escapeHtml(row.item_unit || '');
    const remaining = remainingOf(row);
    const delivered = toNumber(row.delivered_quantity);
    return `
        <div class="delivery-item-card" data-item-id="${row.id}">
            <div class="delivery-item-head">
                <div>
                    <strong class="item-code">${escapeHtml(row.item_code || '-')}</strong>
                    <span class="item-name ms-2">${escapeHtml(row.item_name || '-')}</span>
                </div>
                ${delivered > 0 ? '<span class="status-badge partial">Kısmi Teslim</span>' : ''}
            </div>
            <div class="delivery-grid">
                <div><small>İş No</small><div class="job-no">${escapeHtml(row.job_no || '-')}</div></div>
                <div><small>Planlama Talebi</small><div>${escapeHtml(row.planning_request_number || '-')}</div></div>
                <div><small>Planlanan</small><div>${fmtQty(row.quantity)} ${unit}</div></div>
                <div><small>Daha Önce Alınan</small><div>${fmtQty(delivered)} ${unit}</div></div>
                <div><small>Kalan</small><div class="delivery-remaining">${fmtQty(remaining)} ${unit}</div></div>
            </div>
            <div class="delivery-qty-row">
                <label for="delivery-qty-${row.id}">Teslim alınan miktar (${unit || 'birim'})</label>
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control delivery-qty" id="delivery-qty-${row.id}"
                           data-item-id="${row.id}" data-remaining="${remaining}"
                           value="${remaining}" min="0.01" max="${remaining}" step="0.01" inputmode="decimal">
                    <button type="button" class="btn btn-outline-secondary delivery-fill-btn" data-item-id="${row.id}"
                            title="Kalanın tamamını teslim al">Tamamı</button>
                </div>
                <div class="delivery-qty-error text-danger small" style="display:none;"></div>
            </div>
            <div class="delivery-history" id="delivery-history-${row.id}"></div>
        </div>
    `;
}

function deliveryHistoryHtml(receipts) {
    if (!receipts || !receipts.length) return '';
    const rows = receipts.map((r) => `
        <li>
            <span>${formatDateTimeTr(r.delivered_at)}</span>
            <strong>${fmtQty(r.quantity)}</strong>
            <span class="text-muted">${escapeHtml(r.delivered_by_name || r.delivered_by_username || '-')}</span>
            ${r.note ? `<span class="text-muted">· ${escapeHtml(r.note)}</span>` : ''}
        </li>`).join('');
    return `<small class="text-muted">Önceki teslimatlar</small><ul class="delivery-history-list">${rows}</ul>`;
}

/**
 * Receipt modal for one or many lines. Each line shows its full data and an
 * amount field preset to what is still outstanding; the warehouse lowers it
 * for a partial shipment.
 */
function openDeliveryModal(rows) {
    if (!rows || !rows.length) return;
    const many = rows.length > 1;
    const modalHtml = `
        <div class="modal fade" id="deliveryModal" tabindex="-1" style="z-index: 10060;">
            <div class="modal-dialog modal-lg modal-dialog-scrollable" style="z-index: 10061;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-${many ? 'check-double' : 'check'} me-2"></i>
                            ${many ? `Seçilen Öğeleri Teslim Al (${rows.length})` : 'Öğeyi Teslim Al'}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted small mb-3">
                            <i class="fas fa-info-circle me-1"></i>
                            Malzemenin tamamı gelmediyse miktarı düşürün; kalan kısım beklemede kalır ve
                            sonraki teslimatta yeniden teslim alınabilir.
                        </p>
                        <div class="delivery-items-list">
                            ${rows.map(deliveryItemCardHtml).join('')}
                        </div>
                        <div class="mt-3">
                            <label for="delivery-note" class="form-label small mb-1">Not (isteğe bağlı)</label>
                            <input type="text" id="delivery-note" class="form-control form-control-sm"
                                   maxlength="255" placeholder="Örn: irsaliye no, eksik gelen parti...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                        <button type="button" class="btn btn-success" id="confirm-delivery-btn">
                            <i class="fas fa-check me-2"></i>Teslim Al
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existing = document.getElementById('deliveryModal');
    if (existing) existing.remove();
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.getElementById('deliveryModal');
    const modal = new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: true, focus: true });

    // "Tamamı" resets a line to its outstanding amount
    modalElement.querySelectorAll('.delivery-fill-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = modalElement.querySelector(`.delivery-qty[data-item-id="${btn.dataset.itemId}"]`);
            if (input) {
                input.value = input.dataset.remaining;
                validateDeliveryInput(input);
            }
        });
    });
    modalElement.querySelectorAll('.delivery-qty').forEach((input) => {
        input.addEventListener('input', () => validateDeliveryInput(input));
        input.addEventListener('focus', () => input.select());
    });

    // Single partial line: show what already came in
    if (!many && toNumber(rows[0].delivered_quantity) > 0) {
        const box = modalElement.querySelector(`#delivery-history-${rows[0].id}`);
        if (box) {
            box.innerHTML = '<small class="text-muted"><i class="fas fa-spinner fa-spin me-1"></i>Teslimat geçmişi yükleniyor...</small>';
            getPlanningItemDeliveries(rows[0].id)
                .then((receipts) => { box.innerHTML = deliveryHistoryHtml(receipts); })
                .catch(() => { box.innerHTML = ''; });
        }
    }

    const confirmBtn = modalElement.querySelector('#confirm-delivery-btn');
    confirmBtn.addEventListener('click', async () => {
        const entries = [];
        let valid = true;
        modalElement.querySelectorAll('.delivery-qty').forEach((input) => {
            if (!validateDeliveryInput(input)) valid = false;
            entries.push({ id: parseInt(input.dataset.itemId, 10), quantity: toNumber(input.value) });
        });
        if (!valid) return;

        const note = (modalElement.querySelector('#delivery-note')?.value || '').trim();
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
        try {
            if (entries.length === 1) {
                await markItemDelivered(entries[0].id, { quantity: entries[0].quantity, note });
            } else {
                await bulkMarkItemsDelivered({ items: entries, note });
            }
            modal.hide();
            loadItems();
        } catch (error) {
            console.error('Error recording delivery:', error);
            alert(error.message || 'Teslimat kaydedilirken bir hata oluştu.');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Teslim Al';
        }
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
        modalElement.remove();
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }, { once: true });

    modal.show();
    setTimeout(() => {
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.style.zIndex = '10059';
        const first = modalElement.querySelector('.delivery-qty');
        if (first) first.focus();
    }, 10);
}

function validateDeliveryInput(input) {
    const remaining = toNumber(input.dataset.remaining);
    const value = toNumber(input.value);
    const errorBox = input.closest('.delivery-qty-row')?.querySelector('.delivery-qty-error');
    let message = '';
    if (!(value > 0)) {
        message = 'Miktar 0\'dan büyük olmalıdır.';
    } else if (value > remaining + 1e-9) {
        message = `Kalan miktardan fazlası teslim alınamaz (kalan: ${fmtQty(remaining)}).`;
    }
    input.classList.toggle('is-invalid', !!message);
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.style.display = message ? 'block' : 'none';
    }
    return !message;
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
