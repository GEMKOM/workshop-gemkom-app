// --- taskOverview.js ---
// Task overview tab functionality with machine columns

import { fetchMachines } from '../generic/machines.js';
import { HeaderComponent } from '../components/header/header.js';
import { GenericCard } from '../components/genericCard/genericCard.js';
import { fetchAllTasks, fetchTaskById } from '../generic/tasks.js';
import { FileAttachments } from '../components/file-attachments/file-attachments.js';
import { FileViewer } from '../components/file-viewer/file-viewer.js';

// ============================================================================
// TASK OVERVIEW TAB FUNCTIONALITY
// ============================================================================

// Global instances
let allMachines = [];
let allTasks = [];

export function loadTaskOverviewContent() {
    createTaskOverviewHTML();
    loadMachinesAndTasks();
    bindTaskOverviewEvents();
}

/**
 * Creates and inserts the HTML structure for the task overview page
 */
function createTaskOverviewHTML() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="task-overview-view">
            <div class="section-header">
                <h3 class="section-title">
                    <i class="fas fa-columns me-2"></i>
                    Görev Genel Bakış
                </h3>
                <p class="section-subtitle">Görevleri makine bazında görüntüleyin</p>
            </div>
            
            <!-- Loading State -->
            <div id="loading-state" class="loading-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Yükleniyor...</span>
                </div>
                <p class="loading-text">Görevler yükleniyor...</p>
            </div>
            
            <!-- Task Columns Container -->
            <div id="task-columns-container" class="task-columns-container" style="display: none;">
                <!-- Columns will be dynamically generated here -->
            </div>
        </div>
    `;
}

/**
 * Loads machines and tasks data
 */
async function loadMachinesAndTasks() {
    try {
        // Show loading state
        showLoadingState();
        
        // Load machines
        allMachines = await fetchMachines({ used_in: "cutting", is_active: true });
        
        // Load tasks using generic function
        allTasks = await fetchAllTasks('cnc_cutting');
        
        // Render the columns
        renderTaskColumns();
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading task overview data:', error);
        showErrorState('Görevler yüklenirken bir hata oluştu.');
    }
}

/**
 * Renders task columns based on machine assignments
 */
function renderTaskColumns() {
    const container = document.getElementById('task-columns-container');
    
    // Group tasks by machine and plan status
    const taskGroups = groupTasksByMachine(allTasks);
    
    // Create columns HTML
    const columnsHTML = createColumnsHTML(taskGroups);
    
    container.innerHTML = columnsHTML;
    
    // Initialize cards for each column
    initializeTaskCards();
}

/**
 * Groups tasks by machine and plan status
 */
function groupTasksByMachine(tasks) {
    const groups = {
        noMachineNotInPlan: [],
        noMachineInPlan: [],
        machines: {}
    };
    
    // Initialize all machines with empty arrays
    allMachines.forEach(machine => {
        groups.machines[machine.id] = [];
    });
    
    // Group tasks
    tasks.forEach(task => {
        if (!task.machine_fk) {
            // No machine assigned
            if (task.in_plan === false) {
                groups.noMachineNotInPlan.push(task);
            } else {
                groups.noMachineInPlan.push(task);
            }
        } else {
            // Has machine assigned
            if (task.in_plan === false) {
                // Even with machine, if not in plan, add to noMachineNotInPlan
                groups.noMachineNotInPlan.push(task);
            } else {
                // Has machine and is in plan
                const machineId = task.machine_fk;
                if (groups.machines[machineId]) {
                    groups.machines[machineId].push(task);
                } else {
                    // Machine not in our list, but has tasks
                    groups.machines[machineId] = [task];
                }
            }
        }
    });
    
    // Sort all groups by plan_order (ascending: 1, 2, 3, 4...)
    // Tasks without plan_order will be placed at the end
    function sortByPlanOrder(a, b) {
        const orderA = a.plan_order ?? Infinity;
        const orderB = b.plan_order ?? Infinity;
        return orderA - orderB;
    }
    
    groups.noMachineNotInPlan.sort(sortByPlanOrder);
    groups.noMachineInPlan.sort(sortByPlanOrder);
    
    // Sort tasks for each machine
    Object.keys(groups.machines).forEach(machineId => {
        groups.machines[machineId].sort(sortByPlanOrder);
    });
    
    return groups;
}

/**
 * Creates HTML for all columns
 */
function createColumnsHTML(taskGroups) {
    let columnsHTML = '<div class="task-overview-columns">';
    
    // Column 1: No Machine, Not In Plan
    columnsHTML += createColumnHTML(
        'no-machine-not-plan',
        'Rezerv (Plan Dışı)',
        'fas fa-exclamation-triangle',
        'warning',
        taskGroups.noMachineNotInPlan
    );
    
    // Column 2: No Machine, In Plan
    columnsHTML += createColumnHTML(
        'no-machine-in-plan',
        'Yapılacaklar (Planlı)',
        'fas fa-clock',
        'info',
        taskGroups.noMachineInPlan
    );
    
    // Machine columns - show all machines in order
    allMachines.forEach(machine => {
        const machineId = machine.id;
        const tasks = taskGroups.machines[machineId] || [];
        
        columnsHTML += createColumnHTML(
            `machine-${machineId}`,
            machine.name,
            'fas fa-cog',
            'primary',
            tasks
        );
    });
    
    columnsHTML += '</div>';
    return columnsHTML;
}

/**
 * Creates HTML for a single column
 */
function createColumnHTML(columnId, title, icon, colorClass, tasks) {
    return `
        <div class="task-column ${colorClass}" id="${columnId}" data-tasks='${JSON.stringify(tasks)}'>
            <div class="column-header">
                <div class="column-header-content">
                    <div class="column-title">
                        <h4>${title}</h4>
                    </div>
                    <span class="task-count">${tasks.length}</span>
                </div>
            </div>
            <div class="column-content">
                <div class="task-cards-container" id="${columnId}-cards">
                    ${tasks.length === 0 ? 
                        '<div class="no-tasks"><i class="fas fa-inbox"></i><p>Görev bulunamadı</p></div>' : 
                        ''
                    }
                </div>
            </div>
        </div>
    `;
}

/**
 * Creates a task card using GenericCard component
 */
function createTaskCard(task, container) {
    const partsCount = task.parts_count || (task.parts ? task.parts.length : 0);
    const material = task.material || '-';
    const dimensions = task.dimensions || '-';
    const nestingId = task.nesting_id || '-';
    const thickness = task.thickness_mm ? `${task.thickness_mm} mm` : '-';
    
    const cardOptions = {
        title: nestingId,
        subtitle: task.key,
        icon: 'fas fa-tasks',
        iconColor: '#3b82f6',
        iconBackground: '#dbeafe',
        status: null, // No status badge needed
        details: [
            {
                icon: 'fas fa-cube',
                label: 'Malzeme:',
                value: material
            },
            {
                icon: 'fas fa-ruler',
                label: 'Boyut:',
                value: dimensions
            },
            {
                icon: 'fas fa-arrows-alt-v',
                label: 'Kalınlık:',
                value: thickness
            },
            {
                icon: 'fas fa-cubes',
                label: 'Parça:',
                value: partsCount.toString()
            }
        ],
        itemsPerRow: 1, // Show each field on its own row
        clickable: true,
        onClick: () => {
            // Open task details modal
            openTaskDetailsModal(task.key);
        },
        className: 'task-overview-card'
    };
    
    return new GenericCard(container, cardOptions);
}

/**
 * Opens a modal with task details, files, and parts
 */
async function openTaskDetailsModal(taskKey) {
    try {
        // Show loading modal
        showLoadingModal();
        
        // Fetch task details
        const taskDetails = await fetchTaskById(taskKey, 'cnc_cutting');
        
        if (!taskDetails) {
            showErrorModal('Görev detayları yüklenemedi');
            return;
        }
        
        // Create and show modal with task details
        showTaskDetailsModal(taskDetails);
        
    } catch (error) {
        console.error('Error loading task details:', error);
        showErrorModal('Görev detayları yüklenirken bir hata oluştu');
    }
}

/**
 * Shows loading modal
 */
function showLoadingModal() {
    const modalHTML = `
        <div class="modal fade show" id="taskDetailsModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-body text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Yükleniyor...</span>
                        </div>
                        <p class="mt-3">Görev detayları yükleniyor...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Shows error modal
 */
function showErrorModal(message) {
    closeTaskDetailsModal();
    
    const modalHTML = `
        <div class="modal fade show" id="taskDetailsModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Hata</h5>
                        <button type="button" class="btn-close" onclick="closeTaskDetailsModal()"></button>
                    </div>
                    <div class="modal-body text-center py-4">
                        <i class="fas fa-exclamation-triangle text-warning fa-3x mb-3"></i>
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeTaskDetailsModal()">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

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

/**
 * Gets status type for task (for GenericCard component)
 */
function getStatusType(task) {
    if (task.in_plan) return 'info';
    if (task.machine_fk) return 'success';
    return 'warning';
}

/**
 * Gets status text for task
 */
function getStatusText(task) {
    if (task.in_plan) return 'Planlı';
    if (task.machine_fk) return 'Atanmış';
    return 'Atanmamış';
}

/**
 * Initializes task cards using GenericCard component
 */
function initializeTaskCards() {
    // Find all columns and create cards for their tasks
    document.querySelectorAll('.task-column').forEach(column => {
        const tasksData = column.getAttribute('data-tasks');
        if (tasksData) {
            try {
                const tasks = JSON.parse(tasksData);
                const cardsContainer = column.querySelector('.task-cards-container');
                
                if (tasks.length > 0 && cardsContainer) {
                    // Clear the container
                    cardsContainer.innerHTML = '';
                    
                    // Create a card for each task
                    tasks.forEach(task => {
                        const cardWrapper = document.createElement('div');
                        cardsContainer.appendChild(cardWrapper);
                        createTaskCard(task, cardWrapper);
                    });
                }
            } catch (error) {
                console.error('Error parsing tasks data:', error);
            }
        }
    });
}

/**
 * Event binding for task overview
 */
function bindTaskOverviewEvents() {
    // Add any specific event handlers here
    console.log('Task overview events bound');
}

/**
 * Shows loading state
 */
function showLoadingState() {
    document.getElementById('loading-state').style.display = 'block';
    document.getElementById('task-columns-container').style.display = 'none';
}

/**
 * Hides loading state
 */
function hideLoadingState() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('task-columns-container').style.display = 'block';
}

/**
 * Shows error state
 */
function showErrorState(message) {
    const container = document.getElementById('task-columns-container');
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="error-message">${message}</div>
            <button class="btn btn-primary" onclick="location.reload()">Tekrar Dene</button>
        </div>
    `;
    hideLoadingState();
}

// Note: fetchAllTasks is now imported from generic/tasks.js
