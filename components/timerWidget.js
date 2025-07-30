// --- timerWidget.js ---
import { formatTime } from '../generic/formatters.js';
import { syncServerTime, getSyncedNow } from '../generic/timeService.js';
import { backendBase } from '../base.js';
import { authedFetch, navigateTo, ROUTES } from '../authService.js';
import { extractResultsFromResponse } from '../generic/paginationHelper.js';
import { fetchTimers } from '../generic/timers.js';

/* <button class="timer-widget-stop" onclick="window.timerWidget.stopTimer(${timer.id})">
    Durdur
</button> */ //STOP BUTTON FOR FUTURE USE


export class TimerWidget {
    constructor() {
        this.isVisible = true; // Start visible
        this.activeTimers = [];
        this.updateInterval = null;
        this.adminPollingInterval = null;
        this.lastSyncTime = 0;
        this.init();
    }

    async init() {
        // Always create the widget first
        this.createWidget();
        
        // Ensure time is synchronized when widget initializes
        await this.loadActiveTimers();
        if (this.activeTimers.length === 0) {
            // If no active timers, just render empty state
            this.renderTimers();
            return;
        }    
        await this.ensureTimeSync();
        this.renderTimers();
        this.startUpdateInterval();
        this.startAdminStopPolling();
    }

    async ensureTimeSync() {
        // Sync time if it hasn't been synced recently (within last 5 minutes)
        const now = Date.now();
        if (now - this.lastSyncTime > 5 * 60 * 1000) {
            try {
                await syncServerTime();
                this.lastSyncTime = now;
            } catch (error) {
                console.warn('Failed to sync time for timer widget:', error);
            }
        }
    }

    createWidget() {
        // Create the main widget container
        const widget = document.createElement('div');
        widget.id = 'timer-widget';
        widget.className = 'timer-widget';
        widget.innerHTML = `
            <div class="timer-widget-header">
                <span class="timer-widget-title">⏱️ Aktif Zamanlayıcılar</span>
                <span class="timer-widget-toggle" id="timer-widget-toggle">−</span>
            </div>
            <div class="timer-widget-content" id="timer-widget-content">
                <div class="timer-widget-loading">Yükleniyor...</div>
            </div>
            <div class="timer-widget-footer">
                <button class="timer-widget-new" id="timer-widget-new">+ Yeni Zamanlayıcı</button>
            </div>
        `;

        document.body.appendChild(widget);

        // Add event listeners
        document.getElementById('timer-widget-new').addEventListener('click', () => {
            navigateTo(ROUTES.MACHINING);
        });

        // Make widget draggable and handle header clicks
        this.makeDraggable(widget);
        
        // Add click outside to minimize functionality
        this.setupClickOutsideToMinimize(widget);
    }

    makeDraggable(widget) {
        let isDragging = false;
        let hasDragged = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        let dragThreshold = 5; // Minimum distance to consider as dragging
        let startX, startY;

        const header = widget.querySelector('.timer-widget-header');

        header.addEventListener('mousedown', (e) => {
            hasDragged = false;
            startX = e.clientX;
            startY = e.clientY;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            
            // Add dragging class for visual feedback
            widget.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                // Check if we've moved enough to consider it dragging
                const distance = Math.sqrt(
                    Math.pow(e.clientX - startX, 2) + 
                    Math.pow(e.clientY - startY, 2)
                );
                
                if (distance > dragThreshold) {
                    hasDragged = true;
                }
                
                xOffset = currentX;
                yOffset = currentY;

                // Use requestAnimationFrame for smoother updates
                requestAnimationFrame(() => {
                    widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
                });
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                
                // Remove dragging class
                widget.classList.remove('dragging');
                
                // If we dragged, prevent the click event from toggling
                if (hasDragged) {
                    setTimeout(() => {
                        hasDragged = false;
                    }, 100);
                }
            }
        });

        // Handle header clicks for toggle functionality
        header.addEventListener('click', (e) => {
            // If we just dragged, don't toggle
            if (hasDragged) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            
            // Otherwise, toggle the widget
            this.toggleWidget();
        });
    }

    setupClickOutsideToMinimize(widget) {
        document.addEventListener('click', (e) => {
            // Only minimize if widget is currently visible and click is outside the widget
            if (this.isVisible && !widget.contains(e.target)) {
                // Don't minimize if clicking on interactive elements
                const target = e.target;
                const isInteractive = target.tagName === 'BUTTON' || 
                                     target.tagName === 'A' || 
                                     target.tagName === 'INPUT' || 
                                     target.tagName === 'SELECT' || 
                                     target.tagName === 'TEXTAREA' ||
                                     target.closest('button') ||
                                     target.closest('a') ||
                                     target.closest('input') ||
                                     target.closest('select') ||
                                     target.closest('textarea') ||
                                     target.onclick ||
                                     target.getAttribute('onclick') ||
                                     target.classList.contains('clickable') ||
                                     target.closest('.clickable') ||
                                     target.hasAttribute('data-action') ||
                                     target.closest('[data-action]');
                
                if (!isInteractive) {
                    this.toggleWidget();
                }
            }
        });
    }

    async loadActiveTimers() {
        try {
            const response = await fetchTimers(true);
            this.activeTimers = extractResultsFromResponse(response);
            return true;
        } catch (error) {
            console.error('Error loading active timers:', error);
            return false;
        }
    }

    renderTimers() {
        const content = document.getElementById('timer-widget-content');
        
        if (this.activeTimers.length === 0) {
            content.innerHTML = `
                <div class="timer-widget-empty">
                </div>
            `;
            return;
        }

        content.innerHTML = this.activeTimers.map(timer => {
            // Build URL with hold parameter if issue_is_hold_task is true
            let url = `/machining/tasks/?machine_id=${timer.machine_fk}&key=${timer.issue_key}`;
            if (timer.issue_is_hold_task) {
                url += '&hold=1';
            }
            
            return `
                <div class="timer-widget-item" data-timer-id="${timer.id}" onclick="window.location.href='${url}'">
                    <div class="timer-widget-item-header">
                        <span class="timer-widget-issue">${timer.issue_key}</span>
                        <span class="timer-widget-machine">${timer.machine_name || 'Bilinmeyen'}</span>
                    </div>
                    <div class="timer-widget-time" id="timer-display-${timer.id}">
                        ${this.formatDuration(timer.start_time)}
                    </div>
                </div>
            `;
        }).join('');
    }

    formatDuration(startTime) {
        try {
            const currentTime = getSyncedNow();
            const elapsed = Math.round((currentTime - startTime) / 1000);
            
            // Prevent negative time display
            if (elapsed < 0) {
                console.warn('Negative elapsed time detected, using 0:', elapsed);
                return formatTime(0);
            }
            
            return formatTime(elapsed);
        } catch (error) {
            console.error('Error formatting duration:', error);
            return '00:00:00';
        }
    }

    startUpdateInterval() {
        this.updateInterval = setInterval(async () => {
            try {
                // Periodically ensure time sync (every 30 seconds)
                const now = Date.now();
                if (now - this.lastSyncTime > 30 * 1000) {
                    await this.ensureTimeSync();
                }
                
                this.activeTimers.forEach(timer => {
                    const displayElement = document.getElementById(`timer-display-${timer.id}`);
                    if (displayElement) {
                        displayElement.textContent = this.formatDuration(timer.start_time);
                    }
                });
            } catch (error) {
                console.error('Error in timer update interval:', error);
            }
        }, 1000);
    }

    async stopTimer(timerId) {
        try {
            // Ensure time sync before stopping timer
            await this.ensureTimeSync();
            
            const response = await authedFetch(`${backendBase}/machining/timers/stop/`, {
                method: 'POST',
                body: JSON.stringify({
                    timer_id: timerId,
                    finish_time: getSyncedNow(),
                    synced_to_jira: false
                })
            });

            if (response.ok) {
                // Remove timer from local list
                this.activeTimers = this.activeTimers.filter(t => t.id !== timerId);
                this.renderTimers();
            }
        } catch (error) {
            console.error('Error stopping timer:', error);
            alert('Zamanlayıcı durdurulurken hata oluştu.');
        }
    }

    toggleWidget() {
        const content = document.getElementById('timer-widget-content');
        const footer = document.querySelector('.timer-widget-footer');
        const toggle = document.getElementById('timer-widget-toggle');
        
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            content.style.display = 'block';
            footer.style.display = 'block';
            toggle.textContent = '−';
        } else {
            content.style.display = 'none';
            footer.style.display = 'none';
            toggle.textContent = '+';
        }
    }

    minimizeWidget() {
        const content = document.getElementById('timer-widget-content');
        const footer = document.querySelector('.timer-widget-footer');
        const toggle = document.getElementById('timer-widget-toggle');
        
        this.isVisible = false;
        
        content.style.display = 'none';
        footer.style.display = 'none';
        toggle.textContent = '+';
    }

    destroy() {
        this.stopUpdateInterval();
        this.stopAdminPolling();
        const widget = document.getElementById('timer-widget');
        if (widget) {
            document.body.removeChild(widget);
        }
        // Remove the global instance if it exists
        if (window.timerWidget === this) {
            window.timerWidget = null;
        }
    }

    startAdminStopPolling() {
        this.adminPollingInterval = setInterval(async () => {
            // Only poll if there are active timers to monitor
            if (this.activeTimers.length === 0) {
                return;
            }
            
            try {
                const now = Date.now(); // milliseconds
                const startAfterTs = Math.floor((now - 24 * 60 * 60 * 1000) / 1000); // 24 hours ago, in seconds
                const response = await fetchTimers(null, null, null, startAfterTs);
                if (response.ok) {
                    const latestTimers = extractResultsFromResponse(response);
                    // Get current user information
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    
                    // Check for any timer in this.activeTimers that is missing or finished in latestTimers
                    for (const timer of this.activeTimers) {
                        const latest = latestTimers.find(t => t.id === timer.id);
                        if (!latest || latest.finish_time) {
                            // Check if the timer was stopped by someone else
                            const stoppedBySomeoneElse = latest && latest.stopped_by && 
                                latest.stopped_by !== currentUser?.id && 
                                latest.stopped_by !== currentUser?.username;
                            
                            if (stoppedBySomeoneElse) {
                                let name = latest.username;
                                if (latest && (latest.stopped_by_first_name || latest.stopped_by_last_name)) {
                                    name = `${latest.stopped_by_first_name || ''} ${latest.stopped_by_last_name || ''}`.trim();
                                }
                                // Automatically reload the page without confirmation
                                alert(`Zamanlayıcı ${name} tarafından durduruldu. Sayfa yenileniyor...`);
                                window.location.reload();
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error polling user timers:', error);
            }
        }, 6000);
    }

    async reloadActiveTimers() {
        const hadActiveTimers = this.activeTimers.length > 0;
        await this.loadActiveTimers();
        
        // If we now have active timers but didn't before, start polling and update interval
        if (this.activeTimers.length > 0 && !hadActiveTimers) {
            this.startAdminStopPolling();
            this.startUpdateInterval();
        }
        // If we no longer have active timers but did before, stop polling and update interval
        else if (this.activeTimers.length === 0 && hadActiveTimers) {
            this.stopAdminPolling();
            this.stopUpdateInterval();
        }
        
        this.renderTimers();
    }

    async refreshTimerWidget() {
        await this.reloadActiveTimers();
    }

    stopAdminPolling() {
        if (this.adminPollingInterval) {
            clearInterval(this.adminPollingInterval);
            this.adminPollingInterval = null;
        }
    }

    stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Static method to trigger timer updates globally
    static triggerUpdate() {
        window.dispatchEvent(new CustomEvent('timerUpdated'));
    }
}
 