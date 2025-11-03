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

export async function handleMarkDoneClick() {
    if (await checkMaintenanceAndAlert()) return;
    
    if (!confirm(`${state.currentIssue.parts_count} parçanın hepsini tamamladınız mı?`)) {
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
        const modal = document.getElementById('fault-modal');
        const backdrop = document.getElementById('fault-modal-backdrop');
        const closeBtn = document.getElementById('fault-modal-close');
        const cancelBtn = document.getElementById('fault-modal-cancel');
        const submitBtn = document.getElementById('fault-modal-submit');
        
        function closeModal() {
            modal.classList.remove('show');
            document.getElementById('fault-description').value = '';
            resolve();
        }
        
        async function handleSubmit() {
            const description = document.getElementById('fault-description').value.trim();
            
            if (!description) {
                alert("Lütfen arıza açıklaması girin.");
                return;
            }
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Gönderiliyor...';
                
                if (!machineId || machineId === -1) {
                    alert("Lütfen önce bir makine seçin.");
                    return;
                }
                
                const success = await createMaintenanceRequest({
                    machine: machineId,
                    is_maintenance: false,
                    description: description,
                    is_breaking: false
                });
                
                if (success) {
                    alert('Arıza bildirimi başarıyla gönderildi.');
                    closeModal();
                } else {
                    alert('Arıza bildirimi gönderilemedi.');
                }
            } catch (error) {
                console.error('Error reporting fault:', error);
                alert("Arıza bildirimi gönderilirken hata oluştu.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Gönder';
            }
        }
        
        // Event listeners
        backdrop.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        submitBtn.addEventListener('click', handleSubmit);
        
        // Show modal
        modal.classList.add('show');
    });
}

export async function showMachineStatusModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('machine-status-modal');
        const backdrop = document.getElementById('machine-status-modal-backdrop');
        const closeBtn = document.getElementById('machine-status-modal-close');
        const noBtn = document.getElementById('machine-status-no');
        const yesBtn = document.getElementById('machine-status-yes');
        
        function closeModal(result) {
            modal.classList.remove('show');
            resolve(result);
        }
        
        function handleNoClick() {
            modal.classList.remove('show');
            resolve('no'); // Special result for explicit "No" click
        }
        
        // Event listeners
        backdrop.addEventListener('click', () => closeModal(false));
        closeBtn.addEventListener('click', () => closeModal(false));
        noBtn.addEventListener('click', handleNoClick);
        yesBtn.addEventListener('click', () => closeModal(true));
        
        // Show modal
        modal.classList.add('show');
    });
}

export async function showRedirectWarningModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('redirect-warning-modal');
        const okBtn = document.getElementById('redirect-warning-ok');
        
        function handleRedirect() {
            modal.classList.remove('show');
            resolve(true); // User confirmed redirect
        }
        
        // Event listeners - only OK button works
        okBtn.addEventListener('click', handleRedirect);
        
        // Show modal
        modal.classList.add('show');
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
