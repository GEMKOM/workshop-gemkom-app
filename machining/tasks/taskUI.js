// --- taskUI.js ---
// UI management functions for operation functionality

import { state} from '../operationsService.js';
import { getSyncedNow } from '../../generic/timeService.js';
import { formatTime } from '../../generic/formatters.js';

// ============================================================================
// UI MANAGEMENT
// ============================================================================

export function getUIElements() {
    return {
        startBtn: document.getElementById('start-stop'),
        backBtn: document.getElementById('back-button'),
        timerDisplay: document.getElementById('timer-display'),
        taskTitle: document.getElementById('task-title'),
        machineName: document.getElementById('machine-name'),
        taskStatus: document.getElementById('task-status'),
        taskDetailsGrid: document.getElementById('task-details-grid')
    };
}

export function updateTimerDisplay() {
    // Guard against missing or invalid start_time
    if (!state.currentTimer || !state.currentTimer.start_time) {
        document.getElementById('timer-display').textContent = '00:00:00';
        return;
    }
    
    const elapsed = Math.round((getSyncedNow() - state.currentTimer.start_time) / 1000);
    // Prevent negative elapsed time
    const safeElapsed = Math.max(0, elapsed);
    document.getElementById('timer-display').textContent = formatTime(safeElapsed);
}

export function resetTimerDisplay() {
    document.getElementById('timer-display').textContent = '00:00:00';
}

export function setupTaskDisplay(hasActiveTimer) {
    const { startBtn, backBtn, timerDisplay, taskTitle, machineName, taskStatus, taskDetailsGrid } = getUIElements();
    
    // Always update title to reflect current timer state (for break/downtime timers)
    let displayTitle;
    if (state.currentTimer && state.currentTimer.timer_type !== 'productive' && state.currentTimer.downtime_reason_name) {
        displayTitle = state.currentTimer.downtime_reason_name;
    } else if (state.currentIssue && state.currentIssue.part_task_key) {
        displayTitle = `${state.currentIssue.part_task_key} (${state.currentIssue.key})`;
    } else if (state.currentIssue && state.currentIssue.key) {
        displayTitle = state.currentIssue.key;
    } else {
        displayTitle = taskTitle.textContent || 'Görev';
    }
    taskTitle.textContent = displayTitle;
    
    if (!machineName.textContent) {
        machineName.textContent = state.currentMachine.name;
    }
    
    // Update task status
    updateTaskStatus(hasActiveTimer);
    
    // Update the new task details grid structure
    updateTaskDetailsGrid();
    
    // Update button states based on timer status
    updateButtonStates(hasActiveTimer);
    
    // Update timer card style (remove non-productive classes if not applicable)
    updateTimerCardStyle();
}

function updateTaskStatus(hasActiveTimer) {
    const taskStatus = document.getElementById('task-status');
    if (taskStatus) {
        if (hasActiveTimer) {
            taskStatus.innerHTML = '<i class="fas fa-play"></i><span>Çalışıyor</span>';
            taskStatus.classList.add('active');
        } else {
            taskStatus.innerHTML = '<i class="fas fa-clock"></i><span>Beklemede</span>';
            taskStatus.classList.remove('active');
        }
    }
}

function updateTaskDetailsGrid() {
    const taskDetailsGrid = document.getElementById('task-details-grid');
    if (!taskDetailsGrid) return;
    
    const details = [
        {
            icon: 'fas fa-sort-numeric-up',
            label: 'Sıra',
            value: state.currentIssue.order || '-'
        },
        {
            icon: 'fas fa-file-alt',
            label: 'İş Emri',
            value: state.currentIssue.job_no || '-'
        },
        {
            icon: 'fas fa-image',
            label: 'Resim No',
            value: state.currentIssue.image_no || '-'
        },
        {
            icon: 'fas fa-map-marker-alt',
            label: 'Poz No',
            value: state.currentIssue.position_no || '-'
        },
        {
            icon: 'fas fa-cubes',
            label: 'Adet',
            value: state.currentIssue.quantity || '-'
        }
    ];
    
    taskDetailsGrid.innerHTML = details.map(detail => `
        <div class="detail-card">
            <div class="detail-icon">
                <i class="${detail.icon}"></i>
            </div>
            <div class="detail-label">${detail.label}</div>
            <div class="detail-value">${detail.value}</div>
        </div>
    `).join('');
}

function updateButtonStates(hasActiveTimer) {
    const { startBtn } = getUIElements();
    
    if (hasActiveTimer) {
        // Timer is running
        startBtn.innerHTML = '<i class="fas fa-stop"></i><span>Durdur</span>';
        startBtn.classList.remove('btn-primary');
        startBtn.classList.add('btn-danger', 'running');
        
        // Check if timer can be stopped by user (for break/downtime timers linked to faults)
        if (state.currentTimer && state.currentTimer.can_be_stopped_by_user === false) {
            startBtn.disabled = true;
            startBtn.title = 'Bu zamanlayıcı manuel olarak durdurulamaz. Arıza çözüldüğünde otomatik olarak durdurulacaktır.';
            startBtn.classList.add('disabled');
        } else {
            startBtn.disabled = false;
            startBtn.title = '';
            startBtn.classList.remove('disabled');
        }
    } else {
        // Timer is stopped
        startBtn.innerHTML = '<i class="fas fa-play"></i><span>Başlat</span>';
        startBtn.classList.remove('btn-danger', 'running');
        startBtn.classList.add('btn-primary');
        startBtn.disabled = false; // Explicitly enable the start button
        startBtn.title = '';
    }
}

export function startTimerUpdate() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }
    
    state.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);
    
    // Update button states
    updateButtonStates(true);
    updateTaskStatus(true);
    updateTimerCardStyle();
}

function updateTimerCardStyle() {
    const timerCard = document.querySelector('.timer-card');
    const headerSection = document.querySelector('.task-header-section');
    
    // Check if this is a break/downtime timer
    // Only apply non-productive styling if:
    // 1. We have a current timer
    // 2. The timer type is explicitly NOT 'productive' (could be 'break', 'downtime', etc.)
    const isNonProductive = state.currentTimer && 
                            state.currentTimer.timer_type && 
                            state.currentTimer.timer_type !== 'productive';
    
    if (timerCard) {
        if (isNonProductive) {
            timerCard.classList.add('non-productive-timer');
        } else {
            timerCard.classList.remove('non-productive-timer');
        }
    }
    
    if (headerSection) {
        if (isNonProductive) {
            headerSection.classList.add('non-productive-header');
        } else {
            headerSection.classList.remove('non-productive-header');
        }
    }
}

export function stopTimerUpdate() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    
    // Reset timer display
    resetTimerDisplay();
    
    // Update button states
    updateButtonStates(false);
    updateTaskStatus(false);
    updateTimerCardStyle();
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Focus management
        const firstFocusable = modal.querySelector('button, input, textarea, select');
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        // Close on backdrop click
        const backdrop = modal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => hideModal(modalId));
        }
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                hideModal(modalId);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Clear any form inputs
        const inputs = modal.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.type !== 'submit') {
                input.value = '';
            }
        });
    }
}

// ============================================================================
// LOADING STATES
// ============================================================================

export function showLoadingState(button) {
    const originalContent = button.innerHTML;
    button.innerHTML = '<span class="loading-spinner"></span> Yükleniyor...';
    button.disabled = true;
    button.classList.add('loading');
    return originalContent;
}

export function restoreButtonState(button, originalContent) {
    button.innerHTML = originalContent;
    button.disabled = false;
    button.classList.remove('loading');
}

// ============================================================================
// MESSAGE DISPLAY
// ============================================================================

export function showSuccessMessage(message, duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    messageDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 1060;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    messageDiv.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after duration
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, duration);
}

export function showErrorMessage(message, duration = 5000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    messageDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 1060;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    messageDiv.innerHTML = `
        <i class="fas fa-exclamation-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after duration
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, duration);
}


