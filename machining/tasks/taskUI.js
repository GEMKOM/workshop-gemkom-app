// --- taskUI.js ---
// UI management functions for task functionality

import { state} from '../machiningService.js';
import { getSyncedNow } from '../../generic/timeService.js';
import { 
    setupStartStopHandler, 
    setupStopOnlyHandler
} from './taskHandlers.js';
import { formatTime } from '../../generic/formatters.js';
import { setupAllHandlers } from './taskHandlers.js';

// ============================================================================
// UI MANAGEMENT
// ============================================================================

export function getUIElements() {
    return {
        startBtn: document.getElementById('start-stop'),
        stopOnlyBtn: document.getElementById('stop-only-button'),
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

export function setupTaskDisplay(hasActiveTimer, isHoldTask) {
    const { startBtn, stopOnlyBtn, manualBtn, doneBtn, faultBtn, backBtn, timerDisplay, taskTitle, machineName } = getUIElements();
    if (!taskTitle.textContent) {
        
        taskTitle.textContent = state.currentIssue.key;
        machineName.textContent = state.currentMachine.name;
        
        const right = document.querySelector('.task-right');
        
        right.innerHTML = `
            <div class="field-row"><span class="label">İş Emri:</span><span class="value">${state.currentIssue.job_no || '-'}</span></div>
            <div class="field-row"><span class="label">Resim No:</span><span class="value">${state.currentIssue.image_no || '-'}</span></div>
            <div class="field-row"><span class="label">Poz No:</span><span class="value">${state.currentIssue.position_no || '-'}</span></div>
            <div class="field-row"><span class="label">Adet:</span><span class="value">${state.currentIssue.quantity || '-'}</span></div>
        `
    }
    
    // Special handling for W-07 tasks
    if (state.currentIssue.key === 'W-07' && hasActiveTimer) {
        // Hide all buttons for W-07 tasks with active timer
        startBtn.style.display = 'none';
        stopOnlyBtn.classList.add('hidden');
        manualBtn.style.display = 'none';
        doneBtn.style.display = 'none';
        faultBtn.style.display = 'none';
        backBtn.style.display = 'none';
        
        // Add warning message
        const timerControls = document.querySelector('.timer-controls');
        if (timerControls) {
            // Remove any existing warning message
            const existingWarning = timerControls.querySelector('.w-07-warning');
            if (existingWarning) {
                existingWarning.remove();
            }
            
            // Add new warning message
            const warningDiv = document.createElement('div');
            warningDiv.className = 'w-07-warning';
            warningDiv.style.cssText = `
                color: #dc3545;
                font-weight: bold;
                text-align: center;
                margin-top: 10px;
                padding: 10px;
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 5px;
                width: 100%;
            `;
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
        
        if (!hasActiveTimer) {
            startBtn.style.display = 'block'; // Show start button
            startBtn.textContent = 'Başlat';
            startBtn.classList.remove('red');
            startBtn.classList.add('green');
            stopOnlyBtn.classList.add('hidden');
            manualBtn.style.display = 'block';
            faultBtn.style.display = 'block';
            backBtn.style.display = 'block';
            startBtn.disabled = false;
            stopOnlyBtn.disabled = false;
            timerDisplay.textContent = '00:00:00';
            setupAllHandlers();
        } else {
            // For hold tasks with active timer, hide start button, show stopOnlyBtn
            startBtn.style.display = 'none';
            stopOnlyBtn.classList.remove('hidden');
            manualBtn.style.display = 'none';
            faultBtn.style.display = 'none';
            backBtn.style.display = 'none';
            // Reattach handlers for visible buttons
            setupStopOnlyHandler();
        }
    } else {
        // Normal task behavior
        if (!hasActiveTimer) {
            startBtn.style.display = 'block'; // Show start button
            startBtn.textContent = 'Başlat';
            startBtn.classList.remove('red');
            startBtn.classList.add('green');
            stopOnlyBtn.classList.add('hidden');
            doneBtn.style.display = 'block';
            manualBtn.style.display = 'block';
            faultBtn.style.display = 'block';
            backBtn.style.display = 'block';
            startBtn.disabled = false;
            stopOnlyBtn.disabled = false;
            timerDisplay.textContent = '00:00:00';
            setupAllHandlers();
        } else {
            // Timer is running: hide start button, show stopOnlyBtn
            startBtn.style.display = 'none';
            stopOnlyBtn.classList.remove('hidden');
            manualBtn.style.display = 'none';
            doneBtn.style.display = 'none';
            faultBtn.style.display = 'none';
            backBtn.style.display = 'none';
            // Reattach handlers for visible buttons
            setupStopOnlyHandler();
        }
    }
} 