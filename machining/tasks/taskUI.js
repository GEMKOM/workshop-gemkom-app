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
        machineName: document.getElementById('machine-name')
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
    const { startBtn, manualBtn, doneBtn, faultBtn, backBtn, timerDisplay, taskTitle, machineName } = getUIElements();
    if (!taskTitle.textContent) {
        
        taskTitle.textContent = state.currentIssue.key;
        machineName.textContent = state.currentMachine.name;
        
        // Update the new compact task-details structure
        const taskDetails = document.getElementById('task-details-compact');
        
        taskDetails.innerHTML = `
            <div class="detail-item-compact">
                <span class="detail-label-compact">İş Emri</span>
                <span class="detail-value-compact">${state.currentIssue.job_no || '-'}</span>
            </div>
            <div class="detail-item-compact">
                <span class="detail-label-compact">Resim No</span>
                <span class="detail-value-compact">${state.currentIssue.image_no || '-'}</span>
            </div>
            <div class="detail-item-compact">
                <span class="detail-label-compact">Poz No</span>
                <span class="detail-value-compact">${state.currentIssue.position_no || '-'}</span>
            </div>
            <div class="detail-item-compact">
                <span class="detail-label-compact">Adet</span>
                <span class="detail-value-compact">${state.currentIssue.quantity || '-'}</span>
            </div>
        `;
    }
    
    // Special handling for W-07 tasks
    if (state.currentIssue.key === 'W-07' && hasActiveTimer) {
        // Hide all buttons for W-07 tasks with active timer
        startBtn.style.display = 'none';
        manualBtn.style.display = 'none';
        doneBtn.style.display = 'none';
        faultBtn.style.display = 'none';
        backBtn.style.display = 'none';
        
        // Add warning message
        const timerControls = document.querySelector('.timer-controls-main');
        if (timerControls) {
            // Remove any existing warning message
            const existingWarning = timerControls.querySelector('.w-07-warning');
            if (existingWarning) {
                existingWarning.remove();
            }
            
            // Add new warning message
            const warningDiv = document.createElement('div');
            warningDiv.className = 'w-07-warning';
            warningDiv.textContent = 'Zamanlayıcı arızanız bakım ekibi tarafından çözüldüğünde otomatik olarak durdurulacaktır.';
            timerControls.appendChild(warningDiv);
        }
        return;
    }
    
    // Remove any existing W-07 warning message for other cases
    const existingWarning = document.querySelector('.w-07-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    // Handle hold task restrictions
    if (isHoldTask) {
        // Hide "Tamamlandı" button for hold tasks
        doneBtn.style.display = 'none';
    } else {
        // Show "Tamamlandı" button for non-hold tasks
        doneBtn.style.display = 'flex';
    }
    
    // Update button states based on timer status
    if (hasActiveTimer) {
        // Timer is running
        startBtn.innerHTML = '<i class="fas fa-stop me-2"></i>Durdur';
        startBtn.className = 'btn btn-danger action-button-main';
        startBtn.disabled = false;
        
        // Update button colors for running state
        startBtn.classList.remove('btn-success');
        startBtn.classList.add('btn-danger');
        
    } else {
        // Timer is stopped - reset display and make start button active
        startBtn.innerHTML = '<i class="fas fa-play me-2"></i>Başlat';
        startBtn.className = 'btn btn-success action-button-main';
        startBtn.disabled = false;
        
        // Reset timer display
        resetTimerDisplay();
        
        // Update button colors for stopped state
        startBtn.classList.remove('btn-danger');
        startBtn.classList.add('btn-success');
    }
    
    // Ensure all other buttons are visible
    manualBtn.style.display = 'flex';
    faultBtn.style.display = 'flex';
    backBtn.style.display = 'flex';
    
    // Update button styles to use flexbox for consistent alignment
    [startBtn, manualBtn, doneBtn, faultBtn, backBtn].forEach(btn => {
        if (btn && btn.style.display !== 'none') {
            btn.style.display = 'flex';
        }
    });
}

// ============================================================================
// TIMER UPDATE FUNCTIONS
// ============================================================================

export function startTimerUpdate() {
    // Clear any existing interval
    if (window.timerUpdateInterval) {
        clearInterval(window.timerUpdateInterval);
    }
    
    // Start new interval
    window.timerUpdateInterval = setInterval(() => {
        if (state.currentTimer && state.currentTimer.start_time) {
            updateTimerDisplay();
        }
    }, 1000);
}

export function stopTimerUpdate() {
    if (window.timerUpdateInterval) {
        clearInterval(window.timerUpdateInterval);
        window.timerUpdateInterval = null;
    }
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // Add click outside to close functionality
        const backdrop = modal.querySelector('.fault-modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => hideModal(modalId));
        }
        
        // Add focus trap for accessibility
        const firstFocusable = modal.querySelector('button, input, textarea, select');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        
        // Clear any input fields
        const textarea = modal.querySelector('textarea');
        if (textarea) {
            textarea.value = '';
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function showLoadingState(button) {
    const originalContent = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Yükleniyor...';
    button.disabled = true;
    return originalContent;
}

export function restoreButtonState(button, originalContent) {
    button.innerHTML = originalContent;
    button.disabled = false;
}

export function showSuccessMessage(message, duration = 3000) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success position-fixed';
    successDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 1050;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>
        ${message}
    `;
    
    document.body.appendChild(successDiv);
    
    // Remove after duration
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, duration);
}

export function showErrorMessage(message, duration = 5000) {
    // Create a temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger position-fixed';
    errorDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 1050;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        ${message}
    `;
    
    document.body.appendChild(errorDiv);
    
    // Remove after duration
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, duration);
} 