// --- taskActions.js ---
// Button action handlers for operation functionality

import { state } from '../operationsService.js';
import { navigateTo } from '../../authService.js';
import { markOperationCompleted, fetchDowntimeReasons, logReason } from '../../generic/machining/operations.js';
import { createMaintenanceRequest } from '../../generic/machines.js';
import { handleStartTimer, handleStopTimer } from './taskLogic.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';
import { TimerWidget } from '../../components/timerWidget.js';

function checkMaintenanceAndAlert() {
    if (state.currentMachine && state.currentMachine.is_under_maintenance) {
        alert('Bu makine bakımda. İşlem yapamazsınız.');
        navigateTo('/machining/');
        return true;
    }
    return false;
}

export async function handleStartStopClick() {
    if (state.currentMachine.is_under_maintenance) {
        alert('Bu makine bakımda. İşlem yapamazsınız.');
        navigateTo('/machining/');
        return;
    }
    if (!state.currentMachine.has_active_timer) {
        // Check if this is a break/downtime timer page (no operation to start)
        if (!state.currentIssue || !state.currentIssue.key || state.currentIssue.key.startsWith('TIMER-')) {
            alert('Bu sayfadan zamanlayıcı başlatılamaz. Lütfen operasyonlar sayfasından bir operasyon seçin.');
            navigateTo('/machining/');
            return;
        }
        await handleStartTimer();
    } else {
        // Check if this is a productive timer
        const isProductiveTimer = state.currentTimer && 
                                  state.currentTimer.timer_type === 'productive' && 
                                  state.currentTimer.issue_key &&
                                  state.currentIssue.key &&
                                  !state.currentIssue.key.startsWith('TIMER-');
        
        if (isProductiveTimer) {
            // Show downtime reason modal for productive timers
            await showDowntimeReasonModalForStop();
        } else {
            // For non-productive timers, just stop directly
            await handleStopTimer(true);
        }
    }
}

export async function handleMarkDoneClick() {
    if (checkMaintenanceAndAlert()) return;
    
    const confirmed = await showCompleteOperationModal();
    if (!confirmed) {
        return;
    }
    
    try {
        const marked = await markOperationCompleted(state.currentIssue.key);
        if (marked) {
            alert('Operasyon tamamlandı olarak işaretlendi.');
            navigateTo('/machining/');
        } else {
            alert("Hata oluştu. Lütfen tekrar deneyin.");
        }
    } catch (error) {
        console.error('Error marking operation as completed:', error);
        alert("Hata oluştu. Lütfen tekrar deneyin.");
    }
}

// Initialize confirmation modal instance
let confirmationModalInstance = null;

function getConfirmationModal() {
    if (!confirmationModalInstance) {
        confirmationModalInstance = new ConfirmationModal('confirmation-modal-container', {
            title: 'Operasyonu Tamamla',
            icon: 'fas fa-check-circle',
            confirmText: 'Evet',
            cancelText: 'İptal',
            confirmButtonClass: 'btn-success'
        });
    }
    return confirmationModalInstance;
}


export async function handleFaultReportClick() {
    if (!state.currentMachine.id) {
        navigateTo('/machining/');
        return;
    }
    
    const machineStatus = await showMachineStatusModal();
    
    if (machineStatus === true) {
        // If yes, show the description modal immediately
        await showNewFaultReportModal(state.currentMachine.id);
    } else if (machineStatus === 'no') {
        // Only show redirect warning if user explicitly clicked "No"
        const shouldRedirect = await showRedirectWarningModal();
        if (shouldRedirect) {
            // Redirect to operations page
            navigateTo('/machining/');
        }
    }
    // If machineStatus is false (user clicked X or backdrop), do nothing
}

export function handleBackClick() {
    if (state.currentTimer && state.currentTimer.id) {
        if (!confirm("Zamanlayıcı aktif. Geri dönmek istediğinize emin misiniz?")) {
            return;
        }
        clearInterval(state.intervalId);
    }
    navigateTo('/machining/');
}

// ============================================================================
// NEW MODAL FUNCTIONS
// ============================================================================

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
            message: 'Makine çalışmıyor olarak işaretlendi. Operasyonlar sayfasına yönlendirileceksiniz.',
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

export async function showCompleteOperationModal() {
    return new Promise((resolve) => {
        const modal = getConfirmationModal();
        
        modal.show({
            message: 'Bu operasyonu tamamladınız mı?',
            onConfirm: () => {
                resolve(true);
            },
            onCancel: (dismissReason) => {
                resolve(false);
            }
        });
    });
}

// ============================================================================
// DOWNTIME REASON MODAL FOR STOPPING PRODUCTIVE TIMERS
// ============================================================================

let downtimeReasonsCacheForStop = null;

function renderDowntimeReasonsListForStop(reasons) {
    const listContainer = document.getElementById('downtime-reasons-list');
    if (!listContainer) return;
    
    // Show ALL reasons (not just creates_timer: true)
    const allReasons = reasons.filter(reason => reason.is_active);
    
    if (allReasons.length === 0) {
        listContainer.innerHTML = '<p class="text-muted text-center">Durma nedeni bulunamadı.</p>';
        return;
    }
    
    listContainer.innerHTML = allReasons.map(reason => `
        <div class="downtime-reason-item" data-reason-id="${reason.id}" data-reason-code="${reason.code || ''}">
            <div class="downtime-reason-content">
                <span class="downtime-reason-name">${reason.name}</span>
            </div>
            <div class="downtime-reason-select">
                <i class="fas fa-check-circle"></i>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    listContainer.querySelectorAll('.downtime-reason-item').forEach(item => {
        item.addEventListener('click', () => {
            // Remove previous selection
            listContainer.querySelectorAll('.downtime-reason-item').forEach(i => {
                i.classList.remove('selected');
            });
            // Add selection to clicked item
            item.classList.add('selected');
            
            // Update description field requirement based on selected reason
            updateDescriptionFieldRequirementForStop();
            
            // Enable submit button
            const submitBtn = document.getElementById('downtime-reason-modal-submit');
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        });
    });
}

function getSelectedDowntimeReasonForStop() {
    const selectedItem = document.querySelector('.downtime-reason-item.selected');
    if (!selectedItem) return null;
    
    return parseInt(selectedItem.getAttribute('data-reason-id'));
}

function getSelectedDowntimeReasonObjectForStop() {
    const reasonId = getSelectedDowntimeReasonForStop();
    if (!reasonId || !downtimeReasonsCacheForStop) return null;
    
    return downtimeReasonsCacheForStop.find(reason => reason.id === reasonId);
}

function updateDescriptionFieldRequirementForStop() {
    const commentInput = document.getElementById('downtime-reason-comment');
    const commentLabel = document.querySelector('label[for="downtime-reason-comment"]');
    
    if (!commentInput || !commentLabel) return;
    
    const selectedReason = getSelectedDowntimeReasonObjectForStop();
    
    if (!selectedReason) {
        // No selection - reset to optional
        commentLabel.textContent = 'Açıklama (Opsiyonel):';
        commentInput.removeAttribute('required');
        commentInput.classList.remove('is-invalid');
        return;
    }
    
    const reasonCode = selectedReason.code || '';
    const reasonName = selectedReason.name || '';
    
    // WORK_COMPLETE and END_SHIFT don't require description
    // LUNCH (Yemek Molası) and BREAK (Kısa mola) don't require description
    // URGENT_TASK requires description
    // Others require description
    const isOptional = reasonCode === 'WORK_COMPLETE' || 
                       reasonCode === 'END_SHIFT' ||
                       reasonCode === 'LUNCH' ||
                       reasonCode === 'BREAK' ||
                       reasonName === 'Yemek Molası' || 
                       reasonName === 'Yemek Molasi' ||
                       reasonName === 'Kısa mola' ||
                       reasonName === 'Kisa Mola';
    
    if (isOptional) {
        commentLabel.textContent = 'Açıklama (Opsiyonel):';
        commentInput.removeAttribute('required');
        commentInput.classList.remove('is-invalid');
    } else {
        commentLabel.innerHTML = 'Açıklama <span class="text-danger">*</span>:';
        commentInput.setAttribute('required', 'required');
        // Remove invalid class if it was set, but don't add it yet (wait for validation)
        if (commentInput.value.trim()) {
            commentInput.classList.remove('is-invalid');
        }
    }
}

export async function showDowntimeReasonModalForStop() {
    const modal = document.getElementById('downtime-reason-modal');
    const backdrop = document.getElementById('downtime-reason-modal-backdrop');
    const closeBtn = document.getElementById('downtime-reason-modal-close');
    const cancelBtn = document.getElementById('downtime-reason-modal-cancel');
    const submitBtn = document.getElementById('downtime-reason-modal-submit');
    const commentInput = document.getElementById('downtime-reason-comment');
    
    if (!modal) {
        console.error('Downtime reason modal not found');
        return;
    }
    
    // Fetch downtime reasons if not cached
    if (!downtimeReasonsCacheForStop) {
        try {
            downtimeReasonsCacheForStop = await fetchDowntimeReasons();
        } catch (error) {
            console.error('Error fetching downtime reasons:', error);
            alert('Durma nedenleri yüklenirken hata oluştu.');
            return;
        }
    }
    
    // Reset state
    submitBtn.disabled = true;
    if (commentInput) {
        commentInput.value = '';
        commentInput.removeAttribute('required');
        commentInput.classList.remove('is-invalid');
    }
    
    // Reset label to optional
    const commentLabel = document.querySelector('label[for="downtime-reason-comment"]');
    if (commentLabel) {
        commentLabel.textContent = 'Açıklama (Opsiyonel):';
    }
    
    // Render reasons (show all, not just creates_timer: true)
    renderDowntimeReasonsListForStop(downtimeReasonsCacheForStop);
    
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    async function handleSubmit() {
        const reasonId = getSelectedDowntimeReasonForStop();
        if (!reasonId) {
            alert('Lütfen bir durma nedeni seçin.');
            return;
        }
        
        if (!state.currentTimer || !state.currentTimer.id) {
            alert('Zamanlayıcı bilgisi bulunamadı.');
            return;
        }
        
        // Get selected reason to check if description is required
        const selectedReason = getSelectedDowntimeReasonObjectForStop();
        const reasonCode = selectedReason ? (selectedReason.code || '') : '';
        const reasonName = selectedReason ? (selectedReason.name || '') : '';
        
        // WORK_COMPLETE and END_SHIFT don't require description
        // LUNCH (Yemek Molası) and BREAK (Kısa mola) don't require description
        // URGENT_TASK requires description
        // Others require description
        const isOptional = reasonCode === 'WORK_COMPLETE' || 
                           reasonCode === 'END_SHIFT' ||
                           reasonCode === 'LUNCH' ||
                           reasonCode === 'BREAK' ||
                           reasonName === 'Yemek Molası' || 
                           reasonName === 'Yemek Molasi' ||
                           reasonName === 'Kısa mola' ||
                           reasonName === 'Kisa Mola';
        
        const comment = commentInput ? commentInput.value.trim() : '';
        
        // Validate description requirement
        if (!isOptional && !comment) {
            alert('Lütfen açıklama giriniz.');
            if (commentInput) {
                commentInput.classList.add('is-invalid');
                commentInput.focus();
            }
            return;
        }
        
        // Remove invalid class if description is provided
        if (commentInput && comment) {
            commentInput.classList.remove('is-invalid');
        }
        
        // Prepare log data - pass current_timer_id to stop the current timer
        const logData = {
            current_timer_id: state.currentTimer.id,
            reason_id: reasonId
        };
        
        if (comment) {
            logData.comment = comment;
        }
        
        // Disable submit button during request
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Kaydediliyor...';
        
        try {
            const result = await logReason(logData);
            
            // Close modal
            closeModal();
            
            // Refresh timer widget to reflect changes
            if (window.timerWidget) {
                await window.timerWidget.refreshTimerWidget();
            } else {
                TimerWidget.triggerUpdate();
            }
            
            // Always redirect back to operations list after stopping timer
            navigateTo('/machining/');
            
        } catch (error) {
            console.error('Error logging reason:', error);
            const errorMessage = error.data?.error || error.message || 'Durma nedeni kaydedilirken hata oluştu.';
            alert(errorMessage);
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
    
    // Event listeners
    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', handleSubmit);
    
    // Remove invalid class when user types in description field
    if (commentInput) {
        commentInput.addEventListener('input', () => {
            if (commentInput.value.trim()) {
                commentInput.classList.remove('is-invalid');
            }
        });
    }
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

