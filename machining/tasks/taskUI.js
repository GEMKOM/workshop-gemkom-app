// --- taskUI.js ---
// UI management functions for task functionality

import { state} from '../machiningService.js';
import { getSyncedNow } from '../../generic/timeService.js';
import { formatTime } from '../../generic/formatters.js';

// ============================================================================
// UI MANAGEMENT
// ============================================================================

export function getUIElements() {
    return {
        startBtn: document.getElementById('start-stop'),
        manualBtn: document.getElementById('manual-log-button'),
        doneBtn: document.getElementById('mark-done-button'),
        faultBtn: document.getElementById('fault-report-button'),
        backBtn: document.getElementById('back-button'),
        timerDisplay: document.getElementById('timer-display'),
        taskTitle: document.getElementById('task-title'),
        machineName: document.getElementById('machine-name'),
        taskStatus: document.getElementById('task-status'),
        taskDetailsGrid: document.getElementById('task-details-grid'),
        w07Warning: document.getElementById('w-07-warning')
    };
}

export function updateTimerDisplay() {
    const elapsed = Math.round((getSyncedNow() - state.currentTimer.start_time) / 1000);
    document.getElementById('timer-display').textContent = formatTime(elapsed);
}

export function resetTimerDisplay() {
    document.getElementById('timer-display').textContent = '00:00:00';
}

export function setupTaskDisplay(hasActiveTimer, isHoldTask) {
    const { startBtn, manualBtn, doneBtn, faultBtn, backBtn, timerDisplay, taskTitle, machineName, taskStatus, taskDetailsGrid, w07Warning } = getUIElements();
    
    if (!taskTitle.textContent) {
        taskTitle.textContent = state.currentIssue.key;
        machineName.textContent = state.currentMachine.name;
        
        // Update task status
        updateTaskStatus(hasActiveTimer);
        
        // Update the new task details grid structure
        updateTaskDetailsGrid();
    }
    
    // Special handling for W-07 tasks
    if (state.currentIssue.key === 'W-07' && hasActiveTimer) {
        // Hide all buttons for W-07 tasks with active timer
        startBtn.style.display = 'none';
        manualBtn.style.display = 'none';
        doneBtn.style.display = 'none';
        faultBtn.style.display = 'none';
        
        // Show warning message
        if (w07Warning) {
            w07Warning.style.display = 'block';
        }
        return;
    }
    
    // Hide W-07 warning for other cases
    if (w07Warning) {
        w07Warning.style.display = 'none';
    }
    
    // Handle hold task restrictions
    if (isHoldTask) {
        // Hide "Tamamlandı" button for hold tasks
        doneBtn.style.display = 'none';
    } else {
        doneBtn.style.display = 'flex';
    }
    
    // Update button states based on timer status
    updateButtonStates(hasActiveTimer);
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
    const { startBtn, manualBtn, doneBtn, faultBtn } = getUIElements();
    
    if (hasActiveTimer) {
        // Timer is running
        startBtn.innerHTML = '<i class="fas fa-stop"></i><span>Durdur</span>';
        startBtn.classList.remove('btn-primary');
        startBtn.classList.add('btn-danger', 'running');
        
        // Disable other buttons while timer is running
        manualBtn.disabled = true;
        doneBtn.disabled = true;
        faultBtn.disabled = true;
        
        manualBtn.classList.add('disabled');
        doneBtn.classList.add('disabled');
        faultBtn.classList.add('disabled');
    } else {
        // Timer is stopped
        startBtn.innerHTML = '<i class="fas fa-play"></i><span>Başlat</span>';
        startBtn.classList.remove('btn-danger', 'running');
        startBtn.classList.add('btn-primary');
        startBtn.disabled = false; // Explicitly enable the start button
        
        // Enable other buttons
        manualBtn.disabled = false;
        doneBtn.disabled = false;
        faultBtn.disabled = false;
        
        manualBtn.classList.remove('disabled');
        doneBtn.classList.remove('disabled');
        faultBtn.classList.remove('disabled');
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