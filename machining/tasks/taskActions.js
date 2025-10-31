// --- taskActions.js ---
// Button action handlers for task functionality

import { state } from '../machiningService.js';
import { navigateTo, ROUTES } from '../../authService.js';
import { markTaskAsDoneShared } from '../../generic/tasks.js';
import { showCommentModal } from '../../components/taskTimerModals.js';
import { createMaintenanceRequest } from '../../generic/machines.js';
import { createManualTimeEntryShared } from '../../generic/timers.js';
import { handleStartTimer, handleStopTimer } from './taskLogic.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';

function checkMaintenanceAndAlert() {
    if (state.currentMachine && state.currentMachine.is_under_maintenance) {
        alert('Bu makine bakımda. İşlem yapamazsınız.');
        navigateTo(ROUTES.MACHINING);
        return true;
    }
    return false;
}

export async function handleStartStopClick() {
    if (state.currentMachine.is_under_maintenance) {
        alert('Bu makine bakımda. İşlem yapamazsınız.');
        navigateTo(ROUTES.MACHINING);
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

export async function handleMarkDoneClick() {
    if (checkMaintenanceAndAlert()) return;
    
    const confirmed = await showCompleteTaskModal();
    if (!confirmed) {
        return;
    }
    
    try {
        const marked = await markTaskAsDoneShared(state.currentIssue.key, 'machining');
        if (marked) {
            alert('Görev tamamlandı olarak işaretlendi.');
            navigateTo(ROUTES.MACHINING);
        } else {
            alert("Hata oluştu. Lütfen tekrar deneyin.");
        }
    } catch (error) {
        console.error('Error marking as done:', error);
        alert("Hata oluştu. Lütfen tekrar deneyin.");
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


export async function handleManualLogClick() {
    if (checkMaintenanceAndAlert()) return;
    
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
        navigateTo(ROUTES.MACHINING);
        return;
    }
    
    const machineStatus = await showMachineStatusModal();
    
    if (machineStatus === true) {
        // If yes, show the description modal (modal is already closed)
        await showNewFaultReportModal(state.currentMachine.id);
    } else if (machineStatus === 'no') {
        // Only show redirect warning if user explicitly clicked "No"
        const shouldRedirect = await showRedirectWarningModal();
        if (shouldRedirect) {
            // Only redirect if user explicitly clicked OK
            window.location.href = "/machining/tasks/?machine_id=7&key=W-07&name=Makine%20Ar%C4%B1zas%C4%B1%20Nedeniyle%20Bekleme&hold=1";
        }
    }
    // If machineStatus is false (user clicked X or backdrop), do nothing
}

// Custom confirmation dialog function
function showCustomConfirm(message, yesText = "Evet", noText = "Hayır") {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <p style="margin-bottom: 20px; font-size: 16px;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirm-yes" style="
                        padding: 10px 20px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${yesText}</button>
                    <button id="confirm-no" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${noText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const yesBtn = modal.querySelector('#confirm-yes');
        const noBtn = modal.querySelector('#confirm-no');
        
        function closeModal(result) {
            document.body.removeChild(modal);
            resolve(result);
        }
        
        yesBtn.onclick = () => closeModal(true);
        noBtn.onclick = () => closeModal(false);
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal(false);
            }
        };
        
        // Focus on yes button by default
        yesBtn.focus();
        
        // Handle Enter and Escape keys
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                closeModal(true);
            } else if (e.key === 'Escape') {
                closeModal(false);
            }
        };
        
        document.addEventListener('keydown', handleKeydown);
        
        // Clean up event listener when modal closes
        const originalCloseModal = closeModal;
        closeModal = (result) => {
            document.removeEventListener('keydown', handleKeydown);
            originalCloseModal(result);
        };
    });
}

export function handleBackClick() {
    if (state.timerActive) {
        if (!confirm("Zamanlayıcı aktif. Geri dönmek istediğinize emin misiniz?")) {
            return;
        }
        clearInterval(state.intervalId);
        setInactiveTimerUI();
    }
    navigateTo(ROUTES.MACHINING);
}

// ============================================================================
// NEW MODAL FUNCTIONS
// ============================================================================

export async function showNewManualTimeModal(comment = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('manual-time-modal');
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
            resolve();
        }
        
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
                    navigateTo(ROUTES.MACHINING);
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
                await createManualTimeEntryShared(timerData, 'machining');
                closeModal();
                resolve();
            } catch (error) {
                console.error('Error creating manual time entry:', error);
                alert("Hata oluştu. Lütfen tekrar deneyin.");
            }
        }
        
        // Event listeners
        backdrop.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        submitBtn.addEventListener('click', handleSubmit);
        
        // Show modal
        modal.classList.add('show');
        
        // Setup input change listeners for duration preview
        const inputs = ['start-datetime', 'end-datetime'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('change', updateDurationPreview);
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
            
            const descriptionInput = document.getElementById('fault-description');
            if (!descriptionInput) {
                resolve();
                return true; // Close modal
            }
            
            const description = descriptionInput.value.trim();
            
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
            onConfirm: async () => {
                // Wait for modal to close before resolving
                await new Promise(resolveClose => {
                    modal.modal.addEventListener('hidden.bs.modal', () => {
                        resolveClose();
                    }, { once: true });
                });
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

export async function showCompleteTaskModal() {
    return new Promise((resolve) => {
        const modal = getConfirmationModal();
        
        modal.show({
            message: `${state.currentIssue.quantity} adetin hepsini tamamladınız mı?`,
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