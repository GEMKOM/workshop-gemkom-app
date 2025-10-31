// --- weight-reduction.js ---
import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { ResultsTable } from '../../components/resultsTable/resultsTable.js';
import { fetchTasks, fetchTaskById } from '../../generic/tasks.js';
import { FileAttachments } from '../../components/file-attachments/file-attachments.js';
import { FileViewer } from '../../components/file-viewer/file-viewer.js';
import { markAsWareHouseProcessed } from '../../cnc_cutting/tasks/taskApi.js';

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
            module: 'cnc_cutting',
            completionDateIsNull: false,
            isWarehouseProcessed: false, // Only completed tasks
            ordering: '-completion_date', // Most recent first
            pageSize: 50
        };
        
        // Fetch completed tasks
        const data = await fetchTasks(options);
        
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

function formatDuration(seconds) {
    if (!seconds) return 'Bilinmiyor';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}s ${minutes}dk ${secs}sn`;
    } else if (minutes > 0) {
        return `${minutes}dk ${secs}sn`;
    } else {
        return `${secs}sn`;
    }
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
    
    // Render parts table
    renderPartsTable(task.parts || []);
    
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
                                        <span class="detail-label-compact">Tahmini:</span>
                                        <span class="detail-value-compact">${task.estimated_hours ? task.estimated_hours + ' sa' : '-'}</span>
                                    </div>
                                </div>
                                <div class="col-md-3 col-sm-6">
                                    <div class="detail-item-compact">
                                        <span class="detail-label-compact">Harcanan:</span>
                                        <span class="detail-value-compact">${task.total_hours_spent ? task.total_hours_spent.toFixed(2) + ' sa' : '0 sa'}</span>
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
                            <h6 class="section-title mb-3">
                                <i class="fas fa-cubes me-2"></i>Parçalar (${task.parts_count || 0})
                            </h6>
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
 * Render parts table
 */
function renderPartsTable(parts) {
    const container = document.getElementById('task-parts-table');
    
    if (!parts || parts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-inbox fa-2x mb-2"></i>
                <p>Henüz parça eklenmemiş</p>
            </div>
        `;
        return;
    }
    
    const tableHTML = `
        <div class="table-responsive">
            <table class="table table-hover table-bordered table-sm">
                <thead class="table-light">
                    <tr>
                        <th>#</th>
                        <th>İş Emri No</th>
                        <th>Resim No</th>
                        <th>Pozisyon No</th>
                        <th>Ağırlık (kg)</th>
                    </tr>
                </thead>
                <tbody>
                    ${parts.map((part, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${part.job_no || '-'}</td>
                            <td>${part.image_no || '-'}</td>
                            <td>${part.position_no || '-'}</td>
                            <td>${part.weight_kg ? parseFloat(part.weight_kg).toFixed(2) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot class="table-light">
                    <tr>
                        <th colspan="4" class="text-end">Toplam Ağırlık:</th>
                        <th>${calculateTotalWeight(parts)} kg</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

/**
 * Calculate total weight of parts
 */
function calculateTotalWeight(parts) {
    const total = parts.reduce((sum, part) => {
        const weight = parseFloat(part.weight_kg) || 0;
        return sum + weight;
    }, 0);
    return total.toFixed(2);
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
