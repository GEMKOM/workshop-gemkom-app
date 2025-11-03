// --- taskActions.js ---
// Button action handlers for task functionality

import { state } from '../cnc_cuttingService.js';
import { navigateTo, ROUTES } from '../../authService.js';
import { markTaskAsDoneShared } from '../../generic/tasks.js';
import { showCommentModal } from '../../components/taskTimerModals.js';
import { createMaintenanceRequest } from '../../generic/machines.js';
import { checkMachineMaintenance } from '../../generic/machines.js';
import { createManualTimeEntryShared } from '../../generic/timers.js';
import { stopTimerShared, startTimerShared } from '../../generic/timers.js';
import { getSyncedNow, syncServerTime } from '../../generic/timeService.js';
import { setCurrentTimerState, setCurrentMachineState } from './taskState.js';
import { TimerWidget } from '../../components/timerWidget.js';
import { getTimerPageComponent } from './task.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';

// ============================================================================
// TIMER FUNCTIONS (IMPLEMENTED FROM DELETED taskLogic.js)
// ============================================================================

async function handleStartTimer(comment = null) {
    if (!state.currentMachine.id || !state.currentIssue.key){
        alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    }
    
    try {
        await syncServerTime();
        const timerData = {
            issue_key: state.currentIssue.key,
            start_time: getSyncedNow(),
            machine_fk: state.currentMachine.id,
        }
        
        // Add comment if provided
        if (comment) {
            timerData.comment = comment;
        }
        
        const timer = await startTimerShared(timerData, 'cnc_cutting');
        if (!timer) {
            alert("Bir sorun oluştu. Sayfa yeniden yükleniyor.");
            navigateTo(ROUTES.CNC_CUTTING);
            return;
        }
        
        timerData.id = timer.id;
        setCurrentTimerState(timerData);
        setCurrentMachineState(state.currentMachine.id);
        state.currentMachine.has_active_timer = true;
        
        // Update TimerPage component state to reflect running timer
        const timerPageComponent = getTimerPageComponent();
        if (timerPageComponent) {
            // Convert start_time to milliseconds if needed
            const startTime = typeof timerData.start_time === 'string' 
                ? parseInt(timerData.start_time) 
                : timerData.start_time;
            const startTimeMs = startTime > 1000000000000 ? startTime : startTime * 1000;
            timerPageComponent.resumeTimer(startTimeMs);
        }
        
        // Trigger timer widget update
        TimerWidget.triggerUpdate();
        return timer;
    } catch (error) {
        console.error('Error starting timer:', error);
        alert('Zamanlayıcı başlatılırken bir hata oluştu.');
    }
}

async function handleStopTimer(syncToJira = true) {
    try {
        if (!state.currentTimer.id) {
            console.error('No active timer to stop');
            return;
        }
        
        const success = await stopTimerShared({
            timerId: state.currentTimer.id,
            finishTime: Date.now(),
            syncToJira: syncToJira
        }, 'cnc_cutting');
        
        if (success) {
            // Clear timer state
            state.currentTimer = { id: null, start_time: null };
            state.currentMachine.has_active_timer = false;
            
            // Reset timer display in TimerPage component
            const timerPageComponent = getTimerPageComponent();
            if (timerPageComponent) {
                timerPageComponent.resetTimer();
            }
            
            // Trigger timer widget update
            TimerWidget.triggerUpdate();
            return true;
        } else {
            alert('Zamanlayıcı durdurulurken bir hata oluştu.');
            return false;
        }
    } catch (error) {
        console.error('Error stopping timer:', error);
        alert('Zamanlayıcı durdurulurken bir hata oluştu.');
        return false;
    }
}

async function checkMaintenanceAndAlert() {
    if (await checkMachineMaintenance(state.currentMachine.id)) {
        alert('Bu makine bakımda. İşlem yapamazsınız.');
        navigateTo(ROUTES.CNC_CUTTING);
        return true;
    }
    return false;
}

export async function handleStartStopClick() {
    if (state.currentMachine.is_under_maintenance) {
        alert('Bu makine bakımda. İşlem yapamazsınız.');
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    }
    if (!state.currentMachine.has_active_timer) {
        // For hold tasks, show comment modal first
        if (state.currentIssue.is_hold_task && state.currentIssue.key !== 'W-14' && state.currentIssue.key !== 'W-02') {
            const comment = await showCommentModal("Bekletme Görevi Başlatma");
            if (comment) {
                await handleStartTimer(comment);
            }
        } else {
            await handleStartTimer();
        }
    } else {
        await handleStopTimer(true);
    }
}

// Initialize confirmation modal instance
let confirmationModalInstance = null;

function getConfirmationModal() {
    if (!confirmationModalInstance) {
        confirmationModalInstance = new ConfirmationModal('confirmation-modal-container', {
            title: 'Görevi Tamamla',
            icon: 'fas fa-check-circle',
            confirmText: 'Evet',
            cancelText: 'İptal',
            confirmButtonClass: 'btn-success'
        });
    }
    return confirmationModalInstance;
}

export async function handleMarkDoneClick() {
    if (await checkMaintenanceAndAlert()) return;
    
    const confirmed = await showCompleteTaskModal();
    if (!confirmed) {
        return;
    }
    
    try {
        const marked = await markTaskAsDoneShared(state.currentIssue.key, 'cnc_cutting');
        if (marked) {
            alert('Görev tamamlandı olarak işaretlendi.');
            navigateTo(ROUTES.CNC_CUTTING);
        } else {
            alert("Hata oluştu. Lütfen tekrar deneyin.");
        }
    } catch (error) {
        console.error('Error marking as done:', error);
        alert("Hata oluştu. Lütfen tekrar deneyin.");
    }
}

export async function showCompleteTaskModal() {
    return new Promise((resolve) => {
        const modal = getConfirmationModal();
        
        const nestingId = state.currentIssue.nesting_id || 'Bu nesting';
        
        modal.show({
            message: `${nestingId} tamamen kesildi, markalandı ve makineden kaldırıldı mı?`,
            onConfirm: () => {
                resolve(true);
            },
            onCancel: (dismissReason) => {
                resolve(false);
            }
        });
    });
}


export async function handleManualLogClick() {
    if (await checkMaintenanceAndAlert()) return;
    
    // For hold tasks, show comment modal first
    if (state.currentIssue.is_hold_task && state.currentIssue.key !== 'W-14' && state.currentIssue.key !== 'W-02') {
        const comment = await showCommentModal("Bekletme Görevi Manuel Giriş");
        if (comment) {
            await showNewManualTimeModal(comment);
        }
    } else {
        await showNewManualTimeModal();
    }
}


export async function handleFaultReportClick() {
    if (!state.currentMachine.id) {
        navigateTo(ROUTES.CNC_CUTTING);
        return;
    }
    
    const machineStatus = await showMachineStatusModal();
    
    if (machineStatus === true) {
        // If yes, show the description modal and proceed as before
        await showNewFaultReportModal(state.currentMachine.id);
    } else if (machineStatus === 'no') {
        // Only show redirect warning if user explicitly clicked "No"
        const shouldRedirect = await showRedirectWarningModal();
        if (shouldRedirect) {
            // Only redirect if user explicitly clicked OK
            window.location.href = "/cnc_cutting/tasks/?machine_id=7&key=W-07&name=Makine%20Ar%C4%B1zas%C4%B1%20Nedeniyle%20Bekleme&hold=1";
        }
    }
    // If machineStatus is false (user clicked X or backdrop), do nothing
}


export function handleBackClick() {
    if (state.timerActive) {
        if (!confirm("Zamanlayıcı aktif. Geri dönmek istediğinize emin misiniz?")) {
            return;
        }
        clearInterval(state.intervalId);
        setInactiveTimerUI();
    }
    navigateTo(ROUTES.CNC_CUTTING);
}

// ============================================================================
// NEW MODAL FUNCTIONS
// ============================================================================

export async function showNewManualTimeModal(comment = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('manual-time-modal');
        if (!modal) {
            console.error('Manual time modal not found');
            resolve();
            return;
        }
        
        const backdrop = document.getElementById('manual-time-modal-backdrop');
        const closeBtn = document.getElementById('manual-time-modal-close');
        const cancelBtn = document.getElementById('manual-time-modal-cancel');
        const submitBtn = document.getElementById('manual-time-modal-submit');
        
        // Set default values
        const now = new Date();
        const endDateTime = new Date(now.getTime() + 60 * 60 * 1000);
        
        // Format datetime-local inputs (YYYY-MM-DDTHH:MM)
        const formatDateTimeLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        document.getElementById('start-datetime').value = formatDateTimeLocal(now);
        document.getElementById('end-datetime').value = formatDateTimeLocal(endDateTime);
        
        // Setup duration preview
        updateDurationPreview();
        
        function closeModal() {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
            resolve();
        }
        
        // Escape key handler
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        async function handleSubmit() {
            const startDateTime = document.getElementById('start-datetime').value;
            const endDateTime = document.getElementById('end-datetime').value;
            
            if (!startDateTime || !endDateTime) {
                alert("Lütfen tüm alanları doldurun.");
                return;
            }
            
            try {
                const startDate = new Date(startDateTime);
                const endDate = new Date(endDateTime);
                
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    alert("Geçersiz tarih/saat formatı.");
                    return;
                }
                
                if (endDate <= startDate) {
                    alert("Bitiş zamanı başlangıç zamanından sonra olmalıdır.");
                    return;
                }
                
                // Create manual time entry
                if (!state.currentMachine.id || !state.currentIssue.key) {
                    navigateTo(ROUTES.CNC_CUTTING);
                    return;
                }
                const timerData = {
                    issue_key: state.currentIssue.key,
                    start_time: startDate.getTime(),
                    finish_time: endDate.getTime(),
                    machine_fk: state.currentMachine.id
                };
                if (comment) {
                    timerData.comment = comment;
                }
                await createManualTimeEntryShared(timerData, 'cnc_cutting');
                closeModal();
                resolve();
            } catch (error) {
                console.error('Error creating manual time entry:', error);
                alert("Hata oluştu. Lütfen tekrar deneyin.");
            }
        }
        
        // Event listeners - prevent duplicate listeners by using once option
        if (backdrop) backdrop.addEventListener('click', closeModal, { once: true });
        if (closeBtn) closeBtn.addEventListener('click', closeModal, { once: true });
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal, { once: true });
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit, { once: true });
        document.addEventListener('keydown', handleEscape);
        
        // Show modal and prevent body scroll
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Setup input change listeners for duration preview
        const inputs = ['start-datetime', 'end-datetime'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', updateDurationPreview);
            }
        });
    });
}

export async function showNewFaultReportModal(machineId) {
    return new Promise((resolve) => {
        const modal = getConfirmationModal();
        
        // Create form HTML
        const formHtml = `
            <div class="form-group">
                <label for="fault-description">Arıza Açıklaması:</label>
                <textarea id="fault-description" rows="4" placeholder="Arıza detaylarını buraya yazın..." required></textarea>
            </div>
        `;
        
        let isSubmitting = false;
        
        // Define the submit handler
        const handleSubmit = async (formData) => {
            if (isSubmitting) return false; // Prevent closing
            
            // Get description from formData (passed by confirmation modal) or directly from DOM
            let description = '';
            
            // First try formData (preferred - collected by confirmation modal)
            if (formData && typeof formData === 'object') {
                description = (formData['fault-description'] || '').trim();
            }
            
            // If not found in formData, try getting it directly from the form
            if (!description) {
                const customForm = document.getElementById('confirmation-custom-form');
                if (customForm) {
                    const descriptionInput = customForm.querySelector('#fault-description');
                    if (descriptionInput) {
                        description = descriptionInput.value.trim();
                    }
                }
                
                // Fallback to global search (less reliable)
                if (!description) {
                    const descriptionInput = document.getElementById('fault-description');
                    if (descriptionInput) {
                        description = descriptionInput.value.trim();
                    }
                }
            }
            
            if (!description) {
                alert("Lütfen arıza açıklaması girin.");
                return false; // Keep modal open
            }
            
            if (!machineId || machineId === -1) {
                alert("Lütfen önce bir makine seçin.");
                resolve();
                return true; // Close modal
            }
            
            try {
                isSubmitting = true;
                const confirmBtn = document.getElementById('confirm-action-btn');
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Gönderiliyor...';
                }
                
                const success = await createMaintenanceRequest({
                    machine: machineId,
                    is_maintenance: false,
                    description: description,
                    is_breaking: false
                });
                
                if (success) {
                    alert('Arıza bildirimi başarıyla gönderildi.');
                    resolve();
                    return true; // Close modal
                } else {
                    alert('Arıza bildirimi gönderilemedi.');
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Gönder';
                    }
                    isSubmitting = false;
                    return false; // Keep modal open
                }
            } catch (error) {
                console.error('Error reporting fault:', error);
                alert("Arıza bildirimi gönderilirken hata oluştu.");
                const confirmBtn = document.getElementById('confirm-action-btn');
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Gönder';
                }
                isSubmitting = false;
                return false; // Keep modal open
            }
        };
        
        modal.show({
            title: 'Arıza Bildirimi',
            icon: 'fas fa-exclamation-triangle',
            message: 'Arıza detaylarını giriniz',
            customFormContent: formHtml,
            confirmText: 'Gönder',
            confirmButtonClass: 'btn-danger',
            cancelText: 'İptal',
            showCancelButton: true,
            onConfirm: handleSubmit,
            onCancel: (dismissReason) => {
                resolve();
            }
        });
    });
}

export async function showMachineStatusModal() {
    return new Promise((resolve) => {
        const modal = getConfirmationModal();
        
        // Show modal with cancel button labeled as "Hayır"
        modal.show({
            title: 'Makine Durumu',
            icon: 'fas fa-question-circle',
            message: 'Makine çalışır durumda mı?',
            confirmText: 'Evet',
            cancelText: 'Hayır',
            confirmButtonClass: 'btn-primary',
            showCancelButton: true,
            onConfirm: () => {
                // Resolve immediately to allow the flow to continue
                resolve(true);
            },
            onCancel: (dismissReason) => {
                // Distinguish between cancel button click and other close actions
                if (dismissReason === 'cancel-button') {
                    resolve('no'); // Explicit "No" button click
                } else {
                    resolve(false); // Closed via X, backdrop, or ESC
                }
            }
        });
    });
}

export async function showRedirectWarningModal() {
    return new Promise((resolve) => {
        const modal = getConfirmationModal();
        
        modal.show({
            title: 'Yönlendirme Uyarısı',
            icon: 'fas fa-exclamation-triangle',
            message: 'Makine çalışmıyor olarak işaretlendi. Bekletme sayfasına yönlendirileceksiniz.',
            confirmText: 'Tamam',
            confirmButtonClass: 'btn-primary',
            showCancelButton: false,
            onConfirm: () => {
                resolve(true);
            },
            onCancel: (dismissReason) => {
                resolve(false);
            }
        });
    });
}

function updateDurationPreview() {
    try {
        const startDateTime = document.getElementById('start-datetime').value;
        const endDateTime = document.getElementById('end-datetime').value;
        
        if (startDateTime && endDateTime) {
            const startDate = new Date(startDateTime);
            const endDate = new Date(endDateTime);
            
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate > startDate) {
                const elapsedSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
                const hours = Math.floor(elapsedSeconds / 3600);
                const minutes = Math.floor((elapsedSeconds % 3600) / 60);
                const seconds = elapsedSeconds % 60;
                const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                document.getElementById('duration-preview').textContent = durationStr;
            } else {
                document.getElementById('duration-preview').textContent = '00:00:00';
            }
        } else {
            document.getElementById('duration-preview').textContent = '00:00:00';
        }
    } catch (error) {
        document.getElementById('duration-preview').textContent = '00:00:00';
    }
}
