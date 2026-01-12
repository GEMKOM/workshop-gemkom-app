// --- taskActions.js ---
// Button action handlers for operation functionality

import { state } from '../operationsService.js';
import { navigateTo } from '../../authService.js';
import { markOperationCompleted } from '../../generic/machining/operations.js';
import { createMaintenanceRequest } from '../../generic/machines.js';
import { handleStartTimer, handleStopTimer } from './taskLogic.js';
import { ConfirmationModal } from '../../components/confirmation-modal/confirmation-modal.js';

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
        await handleStartTimer();
    } else {
        await handleStopTimer(true);
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

