import { initNavbar } from '../../../components/navbar.js';
import { guardRoute, navigateTo } from '../../../authService.js';
import { fetchMachineFault } from '../../../generic/machines.js';
import { fetchFaultTimers, startFaultTimer, stopFaultTimer, completeFault } from '../../../generic/faultTimers.js';
import { extractResultsFromResponse, extractFirstResultFromResponse } from '../../../generic/paginationHelper.js';
import { getSyncedNow, syncServerTime } from '../../../generic/timeService.js';
import { formatTime } from '../../../generic/formatters.js';
import { TimerWidget } from '../../../components/timerWidget.js';

const pageState = {
    fault: null,
    activeTimer: null,
    intervalId: null
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) return;
    initNavbar();

    try {
        const faultId = getFaultIdFromUrl();
        if (!faultId) {
            navigateTo('/maintenance/?tab=fault-requests');
            return;
        }

        pageState.fault = await fetchMachineFault(faultId);
        await refreshActiveTimer();

        setupDisplay();
        bindHandlers();

        // If there is an active timer, start ticking
        if (pageState.activeTimer?.start_time) {
            startTick();
        } else {
            updateTimerDisplay();
            updateButtonState();
            updateStatusBadge();
        }
    } catch (error) {
        console.error('Fault task init error:', error);
        alert('Sayfa yüklenirken hata oluştu.');
        navigateTo('/maintenance/?tab=fault-requests');
    }
});

function getFaultIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('fault_id');
}

async function refreshActiveTimer() {
    if (!pageState.fault?.id) {
        pageState.activeTimer = null;
        return;
    }

    const timersResponse = await fetchFaultTimers({ issue_key: String(pageState.fault.id) });
    const timers = extractResultsFromResponse(timersResponse);

    // Pick ONLY an active timer.
    // Do not fall back to the first timer; otherwise a finished timer can look "active" on refresh.
    // Some serializers may omit is_active, so also treat "no finish_time/end_time" as active.
    const activeByFlag = (timers || []).find(t => t.is_active === true);
    const activeByFinishTime = (timers || []).find(t => {
        const hasFinish = t.finish_time !== null && t.finish_time !== undefined;
        const hasEnd = t.end_time !== null && t.end_time !== undefined;
        return !hasFinish && !hasEnd;
    });
    pageState.activeTimer = activeByFlag || activeByFinishTime || null;
}

function setupDisplay() {
    const titleEl = document.getElementById('task-title');
    const machineEl = document.getElementById('machine-name');

    const machineName = pageState.fault.machine_name || pageState.fault.asset_name || 'Makine';
    const faultTitle = `ARIZA-${pageState.fault.id}`;

    if (titleEl) titleEl.textContent = faultTitle;
    if (machineEl) machineEl.textContent = machineName;

    renderDetailsGrid();
    updateStatusBadge();
    updateButtonState();
}

function renderDetailsGrid() {
    const grid = document.getElementById('task-details-grid');
    if (!grid || !pageState.fault) return;

    const reportedAt = pageState.fault.reported_at
        ? new Date(pageState.fault.reported_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
        : '-';

    const details = [
        { icon: 'fas fa-calendar-alt', label: 'Bildirim', value: reportedAt },
        { icon: 'fas fa-user', label: 'Bildiren', value: pageState.fault.reported_by_username || 'Bilinmiyor' },
        { icon: 'fas fa-exclamation-triangle', label: 'Duruş', value: pageState.fault.is_breaking ? 'Evet' : 'Hayır' },
        { icon: 'fas fa-align-left', label: 'Açıklama', value: pageState.fault.description || '-' }
    ];

    grid.innerHTML = details.map(d => `
        <div class="detail-card">
            <div class="detail-icon"><i class="${d.icon}"></i></div>
            <div class="detail-label">${d.label}</div>
            <div class="detail-value">${escapeHtml(d.value)}</div>
        </div>
    `).join('');
}

function bindHandlers() {
    const backBtn = document.getElementById('back-button');
    const startStopBtn = document.getElementById('start-stop');
    const completeBtn = document.getElementById('complete-fault');

    backBtn?.addEventListener('click', () => {
        if (pageState.activeTimer?.id) {
            if (!confirm('Zamanlayıcı aktif. Geri dönmek istediğinize emin misiniz?')) {
                return;
            }
        }
        stopTick();
        navigateTo('/maintenance/?tab=fault-requests');
    });

    startStopBtn?.addEventListener('click', async () => {
        try {
            startStopBtn.disabled = true;
            if (!pageState.activeTimer?.id) {
                await syncServerTime();
                await startFaultTimer({
                    taskKey: pageState.fault.id,
                    startTime: getSyncedNow(),
                    machineFk: pageState.fault.machine || pageState.fault.machine_fk || null
                });
                await refreshActiveTimer();
                if (!pageState.activeTimer?.start_time) {
                    // Timers might not include start_time immediately; refresh once more
                    await refreshActiveTimer();
                }
                if (pageState.activeTimer?.id) {
                    startTick();
                } else {
                    // Start succeeded but active timer not visible yet; don't show stop state incorrectly
                    updateTimerDisplay();
                    updateButtonState();
                    updateStatusBadge();
                }
                TimerWidget.triggerUpdate();
            } else {
                await stopFaultTimer({
                    timerId: pageState.activeTimer.id,
                    finishTime: getSyncedNow()
                });
                stopTick();
                // Re-check active timers from server to avoid stale UI on refresh
                await refreshActiveTimer();
                updateTimerDisplay();
                updateButtonState();
                updateStatusBadge();
                TimerWidget.triggerUpdate();
            }
        } catch (error) {
            console.error('Start/stop fault timer error:', error);
            const msg = error?.data?.error || error?.message || 'İşlem sırasında hata oluştu.';
            alert(msg);
        } finally {
            startStopBtn.disabled = false;
        }
    });

    completeBtn?.addEventListener('click', () => openResolveModal());
    wireResolveModal();
}

function startTick() {
    stopTick();
    updateTimerDisplay();
    pageState.intervalId = setInterval(updateTimerDisplay, 1000);
    updateButtonState();
    updateStatusBadge();
}

function stopTick() {
    if (pageState.intervalId) {
        clearInterval(pageState.intervalId);
        pageState.intervalId = null;
    }
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;

    if (!pageState.activeTimer?.start_time) {
        display.textContent = '00:00:00';
        return;
    }

    const elapsed = Math.round((getSyncedNow() - parseInt(pageState.activeTimer.start_time, 10)) / 1000);
    display.textContent = formatTime(Math.max(0, elapsed));
}

function updateButtonState() {
    const btn = document.getElementById('start-stop');
    if (!btn) return;

    // Match machining behavior: if we have an active timer object/id, treat it as running
    const hasActive = !!pageState.activeTimer?.id;
    if (hasActive) {
        btn.innerHTML = '<i class="fas fa-stop"></i><span>Durdur</span>';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger', 'running');
        btn.disabled = false;
    } else {
        btn.innerHTML = '<i class="fas fa-play"></i><span>Başlat</span>';
        btn.classList.remove('btn-danger', 'running');
        btn.classList.add('btn-primary');
        btn.disabled = false;
    }
}

function updateStatusBadge() {
    const badge = document.getElementById('task-status');
    if (!badge) return;

    const hasActive = !!pageState.activeTimer?.id;
    if (hasActive) {
        badge.innerHTML = '<i class="fas fa-play"></i><span>Çalışıyor</span>';
        badge.classList.add('active');
    } else {
        badge.innerHTML = '<i class="fas fa-clock"></i><span>Beklemede</span>';
        badge.classList.remove('active');
    }
}

function wireResolveModal() {
    const modal = document.getElementById('resolve-modal');
    const backdrop = document.getElementById('resolve-modal-backdrop');
    const closeBtn = document.getElementById('resolve-modal-close');
    const cancelBtn = document.getElementById('resolve-modal-cancel');
    const submitBtn = document.getElementById('resolve-modal-submit');

    const close = () => {
        if (!modal) return;
        modal.style.display = 'none';
        document.body.style.overflow = '';
        const textarea = document.getElementById('resolution-description');
        if (textarea) textarea.value = '';
    };

    backdrop?.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);

    submitBtn?.addEventListener('click', async () => {
        const textarea = document.getElementById('resolution-description');
        const desc = (textarea?.value || '').trim();
        if (!desc) {
            alert('Lütfen çözüm açıklaması girin.');
            textarea?.focus();
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
            await completeFault({ faultId: pageState.fault.id, resolutionDescription: desc });
            TimerWidget.triggerUpdate();
            close();
            alert('Arıza başarıyla tamamlandı.');
            navigateTo('/maintenance/?tab=fault-requests');
        } catch (error) {
            console.error('Complete fault error:', error);
            const msg = error?.data?.error || error?.message || 'Arıza tamamlanırken hata oluştu.';
            alert(msg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check me-2"></i>Tamamla';
        }
    });
}

function openResolveModal() {
    const modal = document.getElementById('resolve-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('resolution-description')?.focus(), 50);
}

function escapeHtml(value) {
    const str = String(value ?? '');
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

