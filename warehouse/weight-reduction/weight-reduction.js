// --- weight-reduction.js ---
import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { TableComponent } from '../../components/table/table.js';
import { fetchTasks, fetchTaskById } from '../../generic/tasks.js';
import { FileAttachments } from '../../components/file-attachments/file-attachments.js';
import { FileViewer } from '../../components/file-viewer/file-viewer.js';
import { markAsWareHouseProcessed } from '../../generic/tasks.js';
import { calculatePlateWeight } from './plate-weight-calculator.js';
import { showExportModal } from './parts-export.js';
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
    
    // Load completed CNC cutting tasks
    loadCompletedTasks();
});

// ============================================================================
// HEADER COMPONENT SETUP
// ============================================================================

function initializeHeader() {
    const header = new HeaderComponent({
        title: 'Ağırlık Düşüşü',
        subtitle: 'Tamamlanan CNC kesim görevlerinden kaynaklanan ağırlık düşüşleri',
        icon: 'weight-hanging',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        backUrl: '../',
        onRefreshClick: () => {
            loadCompletedTasks();
        }
    });
}

// ============================================================================
// RESULTS TABLE SETUP
// ============================================================================

function initializeResultsTable() {
    const resultsContainer = document.getElementById('results-container');
    
    const resultsTable = new ResultsTable(resultsContainer, {
        title: 'Tamamlanan CNC Kesim Görevleri',
        icon: 'fas fa-weight-hanging',
        showFilters: false,
        emptyStateText: 'Tamamlanan görev bulunamadı',
        emptyStateDescription: 'Henüz tamamlanmış CNC kesim görevi bulunmuyor.',
        loadingText: 'Tamamlanan görevler yükleniyor...',
        onItemClick: (task) => {
            // Handle task click - could show details or navigate to task page
            console.log('Task clicked:', task);
        }
    });
    
    // Store reference for later use
    window.resultsTable = resultsTable;
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadCompletedTasks() {
    try {
        // Show loading state
        if (window.resultsTable) {
            window.resultsTable.showLoadingState();
        }
        
        // Build query options for completed CNC cutting tasks
        const options = {
            completionDateIsNull: false,
            isWarehouseProcessed: false, // Only completed tasks
            ordering: '-completion_date', // Most recent first
            pageSize: 50
        };
        
        // Fetch completed tasks
        const data = await fetchTasks(options, 'cnc_cutting');
        
        // Transform tasks for display
        const transformedTasks = data.results.map(task => ({
            title: task.key || 'Görev Kodu Yok',
            subtitle: task.name || 'Görev Adı Yok',
            icon: 'fas fa-weight-hanging',
            iconColor: '#6f42c1',
            iconBackground: '#e2d9f3',
            details: [
                {
                    label: 'Nesting ID',
                    value: task.nesting_id || 'Bilinmiyor',
                    icon: 'fas fa-layer-group'
                },
                {
                    label: 'Malzeme',
                    value: task.material || 'Bilinmiyor',
                    icon: 'fas fa-cube'
                },
                {
                    label: 'Boyutlar',
                    value: task.dimensions || 'Bilinmiyor',
                    icon: 'fas fa-ruler'
                },
                {
                    label: 'Kalınlık',
                    value: task.thickness_mm ? `${task.thickness_mm} mm` : 'Bilinmiyor',
                    icon: 'fas fa-ruler-vertical'
                },
                {
                    label: 'Parça Sayısı',
                    value: task.parts_count || '0',
                    icon: 'fas fa-cubes'
                },
                {
                    label: 'Plaka Sayısı',
                    value: task.quantity !== null && task.quantity !== undefined ? task.quantity : 1,
                    icon: 'fas fa-layer-group'
                },
                {
                    label: 'Tamamlanma Tarihi',
                    value: formatDate(task.completion_date),
                    icon: 'fas fa-calendar-check'
                }
            ],
            onClick: async () => {
                // Handle task click - fetch full task details and show modal
                try {
                    const fullTask = await fetchTaskById(task.key, 'cnc_cutting');
                    showTaskDetailsModal(fullTask);
                } catch (error) {
                    console.error('Error fetching task details:', error);
                    // Fallback to showing basic task info
                    showTaskDetailsModal(task);
                }
            }
        }));
        
        // Update results table
        if (window.resultsTable) {
            window.resultsTable.setItems(transformedTasks);
            window.resultsTable.updateResultsInfo(transformedTasks.length);
        }
        
    } catch (error) {
        console.error('Error loading completed tasks:', error);
        
        if (window.resultsTable) {
            window.resultsTable.showErrorState(error);
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(dateString) {
    if (!dateString) return 'Bilinmiyor';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}


// ============================================================================
// TASK DETAILS MODAL FUNCTIONS
// ============================================================================

/**
 * Shows task details modal with all sections
 */
function showTaskDetailsModal(task) {
    closeTaskDetailsModal();
    
    const modalHTML = createTaskDetailsModalHTML(task);
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize file attachments component
    initializeFileAttachments(task);
    
    // Calculate plate weight for remnant calculations
    let plateWeight = null;
    if (task.dimensions && task.thickness_mm) {
        try {
            const dimensionsStr = String(task.dimensions).trim();
            const separators = ['*', 'x', 'X', '×'];
            let width = null;
            let length = null;
            
            for (const sep of separators) {
                if (dimensionsStr.includes(sep)) {
                    const parts = dimensionsStr.split(sep).map(p => p.trim());
                    if (parts.length === 2) {
                        width = parseFloat(parts[0]);
                        length = parseFloat(parts[1]);
                        if (!isNaN(width) && !isNaN(length)) {
                            break;
                        }
                    }
                }
            }
            
            if (width === null || length === null || isNaN(width) || isNaN(length)) {
                const dimensionsMatch = dimensionsStr.match(/(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/);
                if (dimensionsMatch && dimensionsMatch.length >= 3) {
                    width = parseFloat(dimensionsMatch[1]);
                    length = parseFloat(dimensionsMatch[2]);
                }
            }
            
            if (width !== null && length !== null && !isNaN(width) && !isNaN(length) && width > 0 && length > 0) {
                const thickness = parseFloat(task.thickness_mm);
                if (!isNaN(thickness) && thickness > 0) {
                    plateWeight = calculatePlateWeight(width, length, thickness);
                }
            }
        } catch (error) {
            console.warn('Could not calculate plate weight for remnants:', error);
        }
    }
    
    // Get task quantity (plaka sayisi) - default to 1 if null/undefined
    const taskQuantity = (task.quantity !== null && task.quantity !== undefined) 
        ? parseInt(task.quantity) 
        : 1;
    
    // Render parts table with plate weight for remnant calculation
    renderPartsTable(task.parts || [], plateWeight, taskQuantity);
    
    // Bind modal events
    bindModalEvents();
    
    // Store task for later use
    const modal = document.getElementById('taskDetailsModal');
    if (modal) {
        modal.currentTask = task;
    }
}

/**
 * Creates the HTML for task details modal
 */
function createTaskDetailsModalHTML(task) {
    // Calculate plate weight if dimensions and thickness are available
    let plateWeight = null;
    let plateWeightError = null;
    
    if (task.dimensions && task.thickness_mm) {
        try {
            // Parse dimensions (format: "300X550", "300x550", "300*550", "300 X 550", etc.)
            const dimensionsStr = String(task.dimensions).trim();
            
            // Try splitting by common separators
            let width = null;
            let length = null;
            
            // Try splitting by asterisk, x, X, or ×
            const separators = ['*', 'x', 'X', '×'];
            for (const sep of separators) {
                if (dimensionsStr.includes(sep)) {
                    const parts = dimensionsStr.split(sep).map(p => p.trim());
                    if (parts.length === 2) {
                        width = parseFloat(parts[0]);
                        length = parseFloat(parts[1]);
                        if (!isNaN(width) && !isNaN(length)) {
                            break;
                        }
                    }
                }
            }
            
            // If splitting didn't work, try regex as fallback
            if (width === null || length === null || isNaN(width) || isNaN(length)) {
                const dimensionsMatch = dimensionsStr.match(/(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)/);
                if (dimensionsMatch && dimensionsMatch.length >= 3) {
                    width = parseFloat(dimensionsMatch[1]);
                    length = parseFloat(dimensionsMatch[2]);
                }
            }
            
            if (width !== null && length !== null && !isNaN(width) && !isNaN(length) && width > 0 && length > 0) {
                const thickness = parseFloat(task.thickness_mm);
                
                console.log('Calculating plate weight:', { 
                    dimensions: task.dimensions, 
                    dimensionsStr,
                    width, 
                    length, 
                    thickness 
                });
                
                if (!isNaN(thickness) && thickness > 0) {
                    plateWeight = calculatePlateWeight(width, length, thickness);
                    console.log('Plate weight calculated:', plateWeight);
                } else {
                    plateWeightError = 'Geçersiz kalınlık değeri';
                    console.warn('Invalid thickness:', thickness);
                }
            } else {
                plateWeightError = 'Boyut formatı tanınmadı';
                console.warn('Could not parse dimensions:', { 
                    original: task.dimensions, 
                    trimmed: dimensionsStr,
                    width,
                    length
                });
            }
        } catch (error) {
            plateWeightError = 'Hesaplama hatası';
            console.error('Could not calculate plate weight:', error);
        }
    } else {
        plateWeightError = 'Boyut veya kalınlık bilgisi eksik';
        console.warn('Missing dimensions or thickness:', { dimensions: task.dimensions, thickness: task.thickness_mm });
    }
    
    return `
        <div class="modal fade show" id="taskDetailsModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-tasks me-2"></i>${task.key} - Görev Detayları
                        </h5>
                        <button type="button" class="btn-close" data-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Section 1: Task Details -->
                        <div class="task-details-section mb-3">
                            <h6 class="section-title mb-2">
                                <i class="fas fa-info-circle me-2"></i>Görev Bilgileri
                            </h6>
                            <div class="row g-2">
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Görev:</span>
                                        <span class="detail-value-compact fw-bold">${task.key}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Makine:</span>
                                        <span class="detail-value-compact">${task.machine_name || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Nesting:</span>
                                        <span class="detail-value-compact">${task.nesting_id || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Malzeme:</span>
                                        <span class="detail-value-compact">${task.material || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Boyutlar:</span>
                                        <span class="detail-value-compact">${task.dimensions || '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Kalınlık:</span>
                                        <span class="detail-value-compact">${task.thickness_mm ? task.thickness_mm + ' mm' : '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Levha Ağırlığı:</span>
                                        <span class="detail-value-compact fw-bold">
                                            ${plateWeight !== null ? formatDecimalTurkish(plateWeight, 2) + ' kg' : (plateWeightError || '-')}
                                        </span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Tahmini:</span>
                                        <span class="detail-value-compact">${task.estimated_hours ? task.estimated_hours + ' sa' : '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Harcanan:</span>
                                        <span class="detail-value-compact">${task.total_hours_spent ? formatDecimalTurkish(task.total_hours_spent, 2) + ' sa' : '0 sa'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Plaka Sayısı:</span>
                                        <span class="detail-value-compact">${task.quantity !== null && task.quantity !== undefined ? task.quantity : 1}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Section 2: File Attachments -->
                        <div class="file-attachments-section mb-4">
                            <h6 class="section-title mb-3">
                                <i class="fas fa-paperclip me-2"></i>Dosya Ekleri
                            </h6>
                            <div id="task-file-attachments"></div>
                        </div>
                        
                        <!-- Section 3: Parts Table -->
                        <div class="parts-table-section">
                            <div id="task-parts-table"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="submit-warehouse-btn">
                            <i class="fas fa-check me-2"></i>Depo İşlemini Tamamla
                        </button>
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize file attachments component
 */
function initializeFileAttachments(task) {
    const files = task.files || [];
    
    if (files.length === 0) {
        document.getElementById('task-file-attachments').innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>Henüz dosya eklenmemiş</p>
            </div>
        `;
        return;
    }
    
    const fileAttachments = new FileAttachments('task-file-attachments', {
        title: '',
        showTitle: false,
        layout: 'grid',
        onFileClick: (file) => {
            const fileName = file.file_name || file.name || 'file';
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const fileViewer = new FileViewer();
            fileViewer.openFile(file.file_url, fileName, fileExtension);
        }
    });
    
    fileAttachments.setFiles(files);
}

/**
 * Calculate remnants for parts
 * @param {Array} parts - Array of part objects
 * @param {number} plateWeight - Total plate weight in kg
 * @returns {Array} Array of remnant values for each part
 */
function calculateRemnants(parts, plateWeight) {
    if (!parts || parts.length === 0 || !plateWeight || plateWeight <= 0) {
        return parts.map(() => 0);
    }
    
    // Calculate total weight of all parts (quantity × weight)
    let totalPartsWeight = 0;
    const partWeights = parts.map(part => {
        const weight = parseFloat(part.weight_kg) || 0;
        const quantity = parseInt(part.quantity) || 0;
        const totalWeight = weight * quantity;
        totalPartsWeight += totalWeight;
        return totalWeight;
    });
    
    // Calculate initial remnants (10% of each part's total weight)
    const initialRemnants = partWeights.map(weight => weight * 0.1);
    const totalInitialRemnants = initialRemnants.reduce((sum, rem) => sum + rem, 0);
    
    // Calculate total with initial remnants
    const totalWithRemnants = totalPartsWeight + totalInitialRemnants;
    
    // If total exceeds plate weight, scale down remnants proportionally
    if (totalWithRemnants > plateWeight) {
        // Calculate available weight for remnants
        const availableRemnantWeight = plateWeight - totalPartsWeight;
        
        // If we can't fit even the parts, return zero remnants
        if (availableRemnantWeight <= 0) {
            return parts.map(() => 0);
        }
        
        // Calculate scale factor
        const scaleFactor = availableRemnantWeight / totalInitialRemnants;
        
        // Scale down all remnants
        return initialRemnants.map(rem => rem * scaleFactor);
    }
    
    // If total doesn't exceed, return initial 10% remnants
    return initialRemnants;
}

/**
 * Render parts table
 */
function renderPartsTable(parts, plateWeight = null, taskQuantity = 1) {
    const container = document.getElementById('task-parts-table');
    
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    if (!parts || parts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>Henüz parça eklenmemiş</p>
            </div>
        `;
        return;
    }
    
    // Ensure taskQuantity is a valid number
    taskQuantity = (taskQuantity !== null && taskQuantity !== undefined) ? parseInt(taskQuantity) : 1;
    
    // Calculate remnants
    const remnants = calculateRemnants(parts, plateWeight);
    
    // Prepare data for table
    const tableData = parts.map((part, index) => {
        const weight = parseFloat(part.weight_kg) || 0;
        const quantity = parseInt(part.quantity) || 0;
        const remnant = remnants[index] || 0;
        const weightToReduce = taskQuantity * ((quantity * weight) + remnant);
        
        return {
            index: index + 1,
            job_no: part.job_no || '-',
            image_no: part.image_no || '-',
            position_no: part.position_no || '-',
            weight: weight > 0 ? formatDecimalTurkish(weight, 2) : '-',
            quantity: quantity > 0 ? quantity : '-',
            weightToReduce: weightToReduce > 0 ? formatDecimalTurkish(weightToReduce, 2) : '-',
            remnant: remnant > 0 ? formatDecimalTurkish(remnant, 2) : '-',
            _rawWeight: weight,
            _rawQuantity: quantity,
            _rawWeightToReduce: weightToReduce,
            _rawRemnant: remnant
        };
    });
    
    // Initialize table component
    const partsTable = new TableComponent('task-parts-table', {
        title: `Parçalar (${parts.length})`,
        icon: 'fas fa-cubes',
        columns: [
            { field: 'index', label: '#', sortable: false },
            { field: 'job_no', label: 'İş Emri No', sortable: true },
            { field: 'image_no', label: 'Resim No', sortable: true },
            { field: 'position_no', label: 'Pozisyon No', sortable: true },
            { field: 'weight', label: 'Ağırlık (kg)', sortable: true },
            { field: 'remnant', label: 'Fire (kg)', sortable: true },
            { field: 'quantity', label: 'Miktar', sortable: true },
            { 
                field: 'weightToReduce', 
                label: 'Düşülecek Ağırlık (kg)', 
                sortable: true,
                formatter: (value) => `<strong>${value}</strong>`
            },
            
        ],
        data: tableData,
        sortable: true,
        bordered: true,
        small: true,
        tableClass: 'table table-hover table-bordered table-sm',
        emptyMessage: 'Henüz parça eklenmemiş',
        emptyIcon: 'fas fa-inbox',
        headerButtons: parts && parts.length > 0 ? [
            {
                id: 'export-parts-btn',
                label: 'CSV Dışa Aktar',
                icon: 'fas fa-file-csv',
                class: 'btn btn-sm btn-outline-success',
                onClick: () => {
                    // Use taskQuantity from renderPartsTable scope
                    // Append weightToReduce to each part before exporting
                    const partsWithWeightToReduce = parts.map((part, index) => {
                        const weight = parseFloat(part.weight_kg) || 0;
                        const quantity = parseInt(part.quantity) || 0;
                        const remnant = remnants[index] || 0;
                        const weightToReduce = taskQuantity * ((quantity * weight) + remnant);
                        return {
                            ...part,
                            weightToReduce: weightToReduce
                        };
                    });
                    showExportModal(partsWithWeightToReduce);
                }
            }
        ] : []
    });
    
    // Store table instance for potential cleanup
    if (container) {
        container.partsTable = partsTable;
    }
}


/**
 * Bind modal events
 */
function bindModalEvents() {
    const modal = document.getElementById('taskDetailsModal');
    if (!modal) return;
    
    // Close button
    const closeButtons = modal.querySelectorAll('[data-dismiss="modal"], .btn-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeTaskDetailsModal);
    });
    
    // Submit warehouse processed button
    const submitBtn = modal.querySelector('#submit-warehouse-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleWarehouseSubmit);
    }
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTaskDetailsModal();
        }
    });
    
    // Escape key to close
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeTaskDetailsModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Store handler for cleanup
    modal.escapeHandler = escapeHandler;
}

/**
 * Handle warehouse submit button click
 */
async function handleWarehouseSubmit() {
    const modal = document.getElementById('taskDetailsModal');
    if (!modal || !modal.currentTask) return;
    
    const task = modal.currentTask;
    const taskKey = task.key;
    
    // Show warning confirmation
    const confirmed = confirm(
        `Bu görevi (${taskKey}) depo işlemi olarak işaretlemek istediğinizden emin misiniz?\n\n` +
        `Bu işlem geri alınamaz.`
    );
    
    if (!confirmed) {
        return;
    }
    
    // Disable button during processing
    const submitBtn = document.getElementById('submit-warehouse-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
    }
    
    try {
        const success = await markAsWareHouseProcessed(taskKey);
        
        if (success) {
            alert(`${taskKey} görevi depo işlemi olarak başarıyla işaretlendi.`);
            closeTaskDetailsModal();
            // Reload tasks to reflect the change
            loadCompletedTasks();
        } else {
            alert('Bir hata oluştu. Lütfen tekrar deneyin.');
            // Re-enable button on error
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check me-2"></i>Depo İşlemi Tamamla';
            }
        }
    } catch (error) {
        console.error('Error marking as warehouse processed:', error);
        alert('Bir hata oluştu. Lütfen tekrar deneyin.');
        // Re-enable button on error
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check me-2"></i>Depo İşlemi Tamamla';
        }
    }
}

/**
 * Close task details modal
 */
function closeTaskDetailsModal() {
    const modal = document.getElementById('taskDetailsModal');
    if (modal) {
        // Clean up escape handler
        if (modal.escapeHandler) {
            document.removeEventListener('keydown', modal.escapeHandler);
        }
        modal.remove();
    }
}

// Make closeTaskDetailsModal available globally for onclick handlers
window.closeTaskDetailsModal = closeTaskDetailsModal;
