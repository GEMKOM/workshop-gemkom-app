// --- taskActions.js ---
// Button action handlers for task functionality

import { state } from '../machiningService.js';
import { navigateTo, ROUTES } from '../../authService.js';
import { markTaskAsDone } from './taskApi.js';
import { showManualTimeModal, createFaultReportModal, showCommentModal } from '../../components/taskTimerModals.js';
import { checkMachineMaintenance, createManualTimeEntry } from './taskApi.js';
import { handleStartTimer, handleStopTimer } from './taskLogic.js';

async function checkMaintenanceAndAlert() {
    if (await checkMachineMaintenance(state.currentMachine.id)) {
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
    if (await checkMaintenanceAndAlert()) return;
    
    if (!confirm(`${state.currentIssue.quantity} adetin hepsini tamamladınız mı?`)) {
        return;
    }
    
    try {
        const marked = await markTaskAsDone();
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


export async function handleManualLogClick() {
    if (await checkMaintenanceAndAlert()) return;
    
    // For hold tasks, show comment modal first
    if (state.currentIssue.is_hold_task && state.currentIssue.key !== 'W-14' && state.currentIssue.key !== 'W-02') {
        const comment = await showCommentModal("Bekletme Görevi Manuel Giriş");
        if (comment) {
            await showManualTimeModal({
                createManualTimeEntry,
                comment: comment
            });
        }
    } else {
        await showManualTimeModal({
            createManualTimeEntry
        });
    }
}


export async function handleFaultReportClick() {
    if (!state.currentMachine.id) {
        navigateTo(ROUTES.MACHINING);
        return;
    }
    const isMachineOperable = await showCustomConfirm("Makine çalışır durumda mı?", "Evet", "Hayır");
    
    if (isMachineOperable) {
        // If yes, show the description modal and proceed as before
        await createFaultReportModal(state.currentMachine.id);
    } else {
        // If no, redirect to the specified URL
        window.location.href = "/machining/tasks/?machine_id=7&key=W-07&name=Makine%20Ar%C4%B1zas%C4%B1%20Nedeniyle%20Bekleme&hold=1";
    }
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