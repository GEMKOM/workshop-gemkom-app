// --- task.js ---
// CNC Cutting task page using the generic timer page component

import { initNavbar } from '../../components/navbar.js';
import { guardRoute, navigateTo, ROUTES } from '../../authService.js';
import { TimerPage } from '../../components/timer-page/timer-page.js';
import { 
    getTaskKeyFromURL, 
    fetchTaskDetails
} from './taskApi.js';
import { 
    setCurrentIssueState,
    setCurrentTimerState,
    setCurrentMachineState
} from './taskState.js';
import { 
    handleStartStopClick, 
    handleMarkDoneClick, 
    handleManualLogClick, 
    handleBackClick, 
    handleFaultReportClick 
} from './taskActions.js';
import { fetchTimers } from '../cnc_cuttingTimers.js';
import { extractFirstResultFromResponse } from '../../generic/paginationHelper.js';
import { state } from '../cnc_cuttingService.js';

// ============================================================================
// TIMER PAGE COMPONENT INTEGRATION
// ============================================================================

let timerPageComponent = null;

async function initializeTaskView() {
    if (!guardRoute()) {
        return;
    }
    
    initNavbar();
    
    const taskKey = getTaskKeyFromURL();
    if (!taskKey) {
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    }

    await setCurrentMachineState();
    let issue = await fetchTaskDetails(taskKey);
    const activeTimer = extractFirstResultFromResponse(await fetchTimers(true, state.currentMachine.id, taskKey));
    setCurrentIssueState(issue);
    setCurrentTimerState(activeTimer);

    // Initialize timer page component
    initializeTimerPage(issue, activeTimer);
}

function initializeTimerPage(issue, activeTimer) {
    const hasActiveTimer = !!activeTimer;
    const isHoldTask = issue.is_hold_task;

    // Create timer page component
    timerPageComponent = new TimerPage('timer-page-container', {
        // Header configuration
        title: issue.key,
        subtitle: state.currentMachine.name,
        showBackButton: true,
        backButtonText: 'Geri',
        backButtonIcon: 'fas fa-arrow-left',

        // Timer configuration
        timerLabel: 'Geçen Süre',
        showTimer: true,

        // Button configuration
        buttons: {
            startStop: {
                enabled: true,
                startText: 'Başlat',
                stopText: 'Durdur',
                startIcon: 'fas fa-play',
                stopIcon: 'fas fa-stop'
            },
            manual: {
                enabled: true,
                text: 'Manuel',
                icon: 'fas fa-clock'
            },
            complete: {
                enabled: !isHoldTask, // Hide for hold tasks
                text: 'Tamamla',
                icon: 'fas fa-check'
            },
            fault: {
                enabled: true,
                text: 'Arıza',
                icon: 'fas fa-exclamation-triangle'
            }
        },

        // Task details configuration
        showTaskDetails: true,
        taskDetails: getTaskDetails(issue),

        // Generic cards configuration
        showGenericCards: true,
        genericCards: getGenericCards(issue),
        cardsGridOptions: {
            columns: 'auto',
            gap: '1.5rem',
            className: 'cnc-cutting-cards',
            responsive: true
        },

        // Warning configuration
        showWarning: issue.key === 'W-07' && hasActiveTimer,
        warningMessage: 'Zamanlayıcı arızanız bakım ekibi tarafından çözüldüğünde otomatik olarak durdurulacaktır.',
        warningIcon: 'fas fa-exclamation-circle',

        // Modal configuration
        modals: {
            manualTime: true,
            faultReport: true,
            machineStatus: true,
            redirectWarning: true
        },

        // Event handlers
        onBack: handleBackClick,
        onStart: () => handleStartStopClick(),
        onStop: () => handleStartStopClick(),
        onManual: handleManualTimeEntry,
        onComplete: handleMarkDoneClick,
        onFault: handleFaultReport,
        onTimerUpdate: (elapsed) => {
            // Optional: Handle timer updates
            console.log('Timer elapsed:', elapsed);
        }
    });

    // Set initial timer state
    if (hasActiveTimer) {
        timerPageComponent.startTimer();
    }

    // Setup additional handlers
    setupAdditionalHandlers();
}

function getTaskDetails(issue) {
    return [
        {
            icon: 'fas fa-layer-group',
            label: 'Nesting ID',
            value: issue.nesting_id || '-'
        },
        {
            icon: 'fas fa-cube',
            label: 'Malzeme',
            value: issue.material || '-'
        },
        {
            icon: 'fas fa-ruler',
            label: 'Boyutlar',
            value: issue.dimensions || '-'
        },
        {
            icon: 'fas fa-ruler-vertical',
            label: 'Kalınlık',
            value: issue.thickness_mm ? `${issue.thickness_mm} mm` : '-'
        },
        {
            icon: 'fas fa-cubes',
            label: 'Parça Sayısı',
            value: issue.parts ? issue.parts.length : (issue.parts_count || '-'),
            clickable: issue.parts && issue.parts.length > 0,
            id: 'parts-count-card',
            onClick: () => showPartsModal(issue)
        },
        {
            icon: 'fas fa-paperclip',
            label: 'Dosya Sayısı',
            value: issue.files ? issue.files.length : '0',
            clickable: issue.files && issue.files.length > 0,
            id: 'files-count-card',
            onClick: () => showFilesModal(issue)
        }
    ];
}

function getGenericCards(issue) {
    const cards = [];

    // Files Card
    cards.push({
        title: 'Dosyalar',
        subtitle: `${issue.files ? issue.files.length : 0} dosya`,
        icon: 'fas fa-paperclip',
        iconColor: '#ffffff',
        iconBackground: 'linear-gradient(135deg, #007bff, #0056b3)',
        details: [
            { 
                icon: 'fas fa-file', 
                label: 'Dosya Sayısı:', 
                value: issue.files ? issue.files.length : '0' 
            },
            { 
                icon: 'fas fa-calendar', 
                label: 'Son Yükleme:', 
                value: issue.files && issue.files.length > 0 
                    ? new Date(issue.files[0].uploaded_at).toLocaleDateString('tr-TR')
                    : '-' 
            },
            { 
                icon: 'fas fa-user', 
                label: 'Yükleyen:', 
                value: issue.files && issue.files.length > 0 
                    ? issue.files[0].uploaded_by_username 
                    : '-' 
            }
        ],
        buttons: [
            { 
                text: 'Dosyaları Görüntüle', 
                icon: 'fas fa-eye', 
                class: 'btn-outline-primary', 
                onClick: () => showFilesModal(issue)
            }
        ]
    });

    // Parts Card
    cards.push({
        title: 'Parçalar',
        subtitle: `${issue.parts ? issue.parts.length : 0} parça`,
        icon: 'fas fa-cubes',
        iconColor: '#ffffff',
        iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
        details: [
            { 
                icon: 'fas fa-cube', 
                label: 'Parça Sayısı:', 
                value: issue.parts ? issue.parts.length : '0' 
            },
            { 
                icon: 'fas fa-weight', 
                label: 'Toplam Ağırlık:', 
                value: calculateTotalWeight(issue) 
            },
            { 
                icon: 'fas fa-tasks', 
                label: 'İş Emri Sayısı:', 
                value: getUniqueJobCount(issue) 
            }
        ],
        buttons: [
            { 
                text: 'Parça Listesi', 
                icon: 'fas fa-list', 
                class: 'btn-outline-success', 
                onClick: () => showPartsModal(issue)
            }
        ]
    });

    // Task Details Card
    cards.push({
        title: 'Görev Detayları',
        subtitle: issue.key,
        icon: 'fas fa-info-circle',
        iconColor: '#ffffff',
        iconBackground: 'linear-gradient(135deg, #6c757d, #495057)',
        details: [
            { 
                icon: 'fas fa-layer-group', 
                label: 'Nesting ID:', 
                value: issue.nesting_id || '-' 
            },
            { 
                icon: 'fas fa-cube', 
                label: 'Malzeme:', 
                value: issue.material || '-' 
            },
            { 
                icon: 'fas fa-ruler', 
                label: 'Boyutlar:', 
                value: issue.dimensions || '-' 
            },
            { 
                icon: 'fas fa-ruler-vertical', 
                label: 'Kalınlık:', 
                value: issue.thickness_mm ? `${issue.thickness_mm} mm` : '-' 
            },
            { 
                icon: 'fas fa-clock', 
                label: 'Tahmini Süre:', 
                value: issue.estimated_hours ? `${issue.estimated_hours} saat` : '-' 
            },
            { 
                icon: 'fas fa-cog', 
                label: 'Makine:', 
                value: issue.machine_name || '-' 
            }
        ],
        buttons: []
    });

    return cards;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupAdditionalHandlers() {
    // Add any additional event handlers specific to CNC cutting
    console.log('Additional handlers setup for CNC cutting');
}

async function handleManualTimeEntry(data) {
    // Handle manual time entry
    console.log('Manual time entry:', data);
    // Call the existing manual time handler
    await handleManualLogClick();
}

async function handleFaultReport(data) {
    // Handle fault report
    console.log('Fault report:', data);
    // Call the existing fault report handler
    await handleFaultReportClick();
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function showPartsModal(issue) {
    if (!issue.parts || issue.parts.length === 0) {
        timerPageComponent.showMessage('Parça bilgisi bulunamadı.', 'error');
        return;
    }
    
    // Create parts modal content
    const partsTable = issue.parts.map(part => `
        <tr>
            <td>${part.job_no || '-'}</td>
            <td>${part.image_no || '-'}</td>
            <td>${part.position_no || '-'}</td>
            <td>${part.weight_kg || '-'}</td>
        </tr>
    `).join('');

    const modalContent = `
        <div class="modal fade" id="partsModal" tabindex="-1" aria-labelledby="partsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="partsModalLabel">
                            <i class="fas fa-cubes me-2"></i>Parça Listesi - ${issue.key}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>İş Emri</th>
                                        <th>Resim No</th>
                                        <th>Pozisyon</th>
                                        <th>Ağırlık (kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${partsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('partsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('partsModal'));
    modal.show();
    
    // Clean up when modal is hidden
    document.getElementById('partsModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

function showFilesModal(issue) {
    if (!issue.files || issue.files.length === 0) {
        timerPageComponent.showMessage('Dosya bilgisi bulunamadı.', 'error');
        return;
    }
    
    // Create files modal content with file-attachments component
    const filesList = issue.files.map(file => `
        <div class="file-item d-flex align-items-center p-3 border rounded mb-2">
            <div class="file-icon me-3">
                <i class="fas fa-file text-primary fs-4"></i>
            </div>
            <div class="file-info flex-grow-1">
                <div class="file-name fw-bold">${file.file_name.split('/').pop()}</div>
                <div class="file-meta text-muted small">
                    <span class="me-3"><i class="fas fa-user me-1"></i>${file.uploaded_by_username}</span>
                    <span><i class="fas fa-calendar me-1"></i>${new Date(file.uploaded_at).toLocaleDateString('tr-TR')}</span>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-outline-primary btn-sm" onclick="viewFile('${file.file_url}', '${file.file_name}')">
                    <i class="fas fa-eye me-1"></i>Görüntüle
                </button>
            </div>
        </div>
    `).join('');

    const modalContent = `
        <div class="modal fade" id="filesModal" tabindex="-1" aria-labelledby="filesModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="filesModalLabel">
                            <i class="fas fa-paperclip me-2"></i>Dosyalar - ${issue.key}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="files-container">
                            ${filesList}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('filesModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('filesModal'));
    modal.show();
    
    // Clean up when modal is hidden
    document.getElementById('filesModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// Global function for viewing files (called from modal)
window.viewFile = function(fileUrl, fileName) {
    // Create file viewer modal
    const fileViewerContent = `
        <div class="modal fade" id="fileViewerModal" tabindex="-1" aria-labelledby="fileViewerModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="fileViewerModalLabel">
                            <i class="fas fa-file me-2"></i>${fileName.split('/').pop()}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="file-viewer-container">
                            <iframe src="${fileUrl}" width="100%" height="600px" frameborder="0"></iframe>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <a href="${fileUrl}" target="_blank" class="btn btn-primary">
                            <i class="fas fa-download me-1"></i>İndir
                        </a>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing file viewer modal if any
    const existingFileViewer = document.getElementById('fileViewerModal');
    if (existingFileViewer) {
        existingFileViewer.remove();
    }

    // Add file viewer modal to body
    document.body.insertAdjacentHTML('beforeend', fileViewerContent);
    
    // Show file viewer modal
    const fileViewerModal = new bootstrap.Modal(document.getElementById('fileViewerModal'));
    fileViewerModal.show();
    
    // Clean up when modal is hidden
    document.getElementById('fileViewerModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
};

function showMachineDetails() {
    timerPageComponent.showMessage('Makine detayları gösteriliyor...', 'info');
}

function showProductionProgress() {
    timerPageComponent.showMessage('Üretim ilerlemesi gösteriliyor...', 'info');
}

function showQualityReport() {
    timerPageComponent.showMessage('Kalite raporu açılıyor...', 'info');
}

function showAllAlerts() {
    timerPageComponent.showMessage('Tüm bildirimler gösteriliyor...', 'info');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateTotalWeight(issue) {
    if (!issue.parts || issue.parts.length === 0) return '0 kg';
    
    const totalWeight = issue.parts.reduce((sum, part) => {
        return sum + parseFloat(part.weight_kg || 0);
    }, 0);
    
    return `${totalWeight.toFixed(2)} kg`;
}

function getUniqueJobCount(issue) {
    if (!issue.parts || issue.parts.length === 0) return '0';
    
    const uniqueJobs = new Set(issue.parts.map(part => part.job_no));
    return uniqueJobs.size.toString();
}

function calculateEstimatedTime(issue) {
    // Simple calculation based on parts count
    const baseTime = 30; // minutes per part
    const totalMinutes = issue.parts_count * baseTime;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}s ${minutes}dk`;
}

function calculateProgress(issue) {
    // Simple progress calculation
    const completed = Math.floor(Math.random() * issue.parts_count);
    const percentage = Math.round((completed / issue.parts_count) * 100);
    return `${percentage}%`;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTaskView);
