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
            // If no active timers, keep as icon only
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
            <div class="timer-widget-icon">
                <i class="fas fa-clock"></i>
                <div class="timer-widget-badge" id="timer-widget-badge" style="display: none;">0</div>
            </div>
            <div class="timer-widget-header" style="display: none;">
                <span class="timer-widget-title">
                    <i class="fas fa-clock"></i>
                    Aktif Zamanlayıcılar
                </span>
                <span class="timer-widget-toggle" id="timer-widget-toggle">×</span>
            </div>
            <div class="timer-widget-content" id="timer-widget-content" style="display: none;">
                <div class="timer-widget-loading">Yükleniyor...</div>
            </div>
            <div class="timer-widget-footer" style="display: none;">
                <button class="timer-widget-new" id="timer-widget-new">+ Yeni Zamanlayıcı</button>
            </div>
        `;

        document.body.appendChild(widget);

        // Add event listeners
        document.getElementById('timer-widget-new').addEventListener('click', () => {
            // Navigate to the appropriate module based on user's team
            const user = JSON.parse(localStorage.getItem('user'));
            const userTeam = user?.team;
            if (userTeam === 'cutting') {
                navigateTo(ROUTES.CNC_CUTTING);
            } else {
                navigateTo(ROUTES.MACHINING);
            }
        });

        // Make widget draggable and handle icon clicks
        this.makeDraggable(widget);
        
        // Add click outside to minimize functionality
        this.setupClickOutsideToMinimize(widget);
        
        // Add window resize handler to keep widget within bounds
        this.setupResizeHandler(widget);
        
        // Add click handler for the icon
        this.setupIconClickHandler(widget);
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
        let initialPosition = null; // Store initial position

        const icon = widget.querySelector('.timer-widget-icon');
        const header = widget.querySelector('.timer-widget-header');

        // Make both icon and header draggable
        [icon, header].forEach(element => {
            if (element) {
                element.addEventListener('mousedown', (e) => {
                    hasDragged = false;
                    startX = e.clientX;
                    startY = e.clientY;
                    
                    // Get current transform values to calculate the actual initial position
                    const transform = widget.style.transform;
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    let currentTransformX = 0;
                    let currentTransformY = 0;
                    
                    if (match) {
                        currentTransformX = parseFloat(match[1]);
                        currentTransformY = parseFloat(match[2]);
                    }
                    
                    // Calculate the actual initial position by subtracting the current transform
                    const rect = widget.getBoundingClientRect();
                    initialPosition = {
                        x: rect.left - currentTransformX,
                        y: rect.top - currentTransformY
                    };
                    
                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                    isDragging = true;
                    
                    // Add dragging class for visual feedback
                    widget.classList.add('dragging');
                    
                    // Prevent text selection during drag
                    document.body.style.userSelect = 'none';
                    document.body.style.webkitUserSelect = 'none';
                    document.body.style.mozUserSelect = 'none';
                    document.body.style.msUserSelect = 'none';
                });
            }
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
                
                // Get widget dimensions and viewport dimensions
                const widgetRect = widget.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Calculate boundaries based on initial position
                // Allow movement from initial position to full viewport
                const minX = -(initialPosition.x); // Allow moving left from initial position
                const maxX = viewportWidth - widgetRect.width - initialPosition.x; // Allow moving right
                const minY = -(initialPosition.y); // Allow moving up from initial position
                const maxY = viewportHeight - widgetRect.height - initialPosition.y; // Allow moving down
                
                // Constrain the position within viewport boundaries
                currentX = Math.max(minX, Math.min(maxX, currentX));
                currentY = Math.max(minY, Math.min(maxY, currentY));
                
                xOffset = currentX;
                yOffset = currentY;

                // Use requestAnimationFrame for smoother updates
                requestAnimationFrame(() => {
                    widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
                });
            }
        });

        const stopDragging = () => {
            if (isDragging) {
                isDragging = false;
                
                // Remove dragging class
                widget.classList.remove('dragging');
                
                // Restore text selection
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                document.body.style.mozUserSelect = '';
                document.body.style.msUserSelect = '';
                
                // If we dragged, prevent the click event from toggling
                if (hasDragged) {
                    setTimeout(() => {
                        hasDragged = false;
                    }, 100);
                }
            }
        };

        // Handle mouseup on document
        document.addEventListener('mouseup', stopDragging);
        
        // Also handle mouseleave to stop dragging if mouse leaves window
        document.addEventListener('mouseleave', stopDragging);
        
        // Store dragging state on widget for access by other methods
        widget.hasDragged = () => hasDragged;
        widget.setHasDragged = (value) => { hasDragged = value; };
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

    setupResizeHandler(widget) {
        let resizeTimeout;
        let initialPosition = null;
        
        const handleResize = () => {
            // Clear existing timeout
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            
            // Debounce the resize handler
            resizeTimeout = setTimeout(() => {
                const widgetRect = widget.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Get current transform values to calculate the actual initial position
                const transform = widget.style.transform;
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                let currentTransformX = 0;
                let currentTransformY = 0;
                
                if (match) {
                    currentTransformX = parseFloat(match[1]);
                    currentTransformY = parseFloat(match[2]);
                }
                
                // Calculate the actual initial position by subtracting the current transform
                initialPosition = {
                    x: widgetRect.left - currentTransformX,
                    y: widgetRect.top - currentTransformY
                };
                
                if (match) {
                    let currentX = parseFloat(match[1]);
                    let currentY = parseFloat(match[2]);
                    
                    // Calculate boundaries using the updated initial position
                    const minX = -(initialPosition.x);
                    const maxX = viewportWidth - widgetRect.width - initialPosition.x;
                    const minY = -(initialPosition.y);
                    const maxY = viewportHeight - widgetRect.height - initialPosition.y;
                    
                    // Constrain the position within viewport boundaries
                    currentX = Math.max(minX, Math.min(maxX, currentX));
                    currentY = Math.max(minY, Math.min(maxY, currentY));
                    
                    // Apply the constrained position
                    widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
                }
            }, 100); // Debounce delay
        };
        
        // Add resize event listener
        window.addEventListener('resize', handleResize);
        
        // Store the handler for cleanup
        this.resizeHandler = handleResize;
    }

    async loadActiveTimers() {
        try {
            // Fetch timers from both modules
            const [machiningResponse, cncCuttingResponse] = await Promise.all([
                fetchTimers({ is_active: true }, 'machining'),
                fetchTimers({ is_active: true }, 'cnc_cutting')
            ]);
            
            const machiningTimers = extractResultsFromResponse(machiningResponse);
            const cncCuttingTimers = extractResultsFromResponse(cncCuttingResponse);
            
            // Mark each timer with its module
            const machiningTimersWithModule = machiningTimers.map(timer => ({ ...timer, module: 'machining' }));
            const cncCuttingTimersWithModule = cncCuttingTimers.map(timer => ({ ...timer, module: 'cnc_cutting' }));
            
            // Combine timers from both modules
            this.activeTimers = [...machiningTimersWithModule, ...cncCuttingTimersWithModule];
            return true;
        } catch (error) {
            console.error('Error loading active timers:', error);
            return false;
        }
    }

    renderTimers() {
        const content = document.getElementById('timer-widget-content');
        const badge = document.getElementById('timer-widget-badge');
        
        if (this.activeTimers.length === 0) {
            content.innerHTML = `
                <div class="timer-widget-empty">
                    <span>Aktif zamanlayıcı bulunmuyor</span>
                </div>
            `;
            // Hide badge when no timers
            if (badge) {
                badge.style.display = 'none';
            }
            return;
        }

        // Show badge with timer count
        if (badge) {
            badge.textContent = this.activeTimers.length;
            badge.style.display = 'flex';
        }

        content.innerHTML = this.activeTimers.map(timer => {
            // Determine module path - default to machining if not set
            const module = timer.module || 'machining';
            const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
            
            // Build URL with hold parameter if issue_is_hold_task is true
            let url = `/${modulePath}/tasks/?machine_id=${timer.machine_fk}&key=${timer.issue_key}`;
            if (timer.issue_is_hold_task) {
                url += '&hold=1';
            }
            
            // For CNC cutting tasks, show nesting_id if available, otherwise fall back to issue_key
            const displayKey = module === 'cnc_cutting' && timer.nesting_id 
                ? timer.nesting_id 
                : timer.issue_key;
            
            return `
                <div class="timer-widget-item" data-timer-id="${timer.id}" data-module="${module}" onclick="window.location.href='${url}'">
                    <div class="timer-widget-item-header">
                        <span class="timer-widget-issue">${displayKey}</span>
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
            // Find the timer to get its module
            const timer = this.activeTimers.find(t => t.id === timerId);
            if (!timer) {
                console.error('Timer not found:', timerId);
                return;
            }
            
            // Determine module path - default to machining if not set
            const module = timer.module || 'machining';
            const modulePath = module === 'cnc_cutting' ? 'cnc_cutting' : 'machining';
            
            // Ensure time sync before stopping timer
            await this.ensureTimeSync();
            
            const response = await authedFetch(`${backendBase}/${modulePath}/timers/stop/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        if (this.isVisible) {
            this.collapseWidget();
        } else {
            this.expandWidget();
        }
    }

    minimizeWidget() {
        this.collapseWidget();
    }

    destroy() {
        this.stopUpdateInterval();
        this.stopAdminPolling();
        
        // Clean up resize event listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
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
                
                // Fetch timers from both modules
                const [machiningResponse, cncCuttingResponse] = await Promise.all([
                    fetchTimers({ start_after: startAfterTs }, 'machining'),
                    fetchTimers({ start_after: startAfterTs }, 'cnc_cutting')
                ]);
                
                // Get current user information
                const currentUser = JSON.parse(localStorage.getItem('user'));
                
                // Combine timers from both modules with their module info
                const machiningTimers = extractResultsFromResponse(machiningResponse);
                const cncCuttingTimers = extractResultsFromResponse(cncCuttingResponse);
                const latestTimers = [
                    ...machiningTimers.map(t => ({ ...t, module: 'machining' })),
                    ...cncCuttingTimers.map(t => ({ ...t, module: 'cnc_cutting' }))
                ];
                
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
            // Auto-expand widget when timers are added
            if (!this.isVisible) {
                this.expandWidget();
            }
        }
        // If we no longer have active timers but did before, stop polling and update interval
        else if (this.activeTimers.length === 0 && hadActiveTimers) {
            this.stopAdminPolling();
            this.stopUpdateInterval();
            // Collapse widget when no timers
            if (this.isVisible) {
                this.collapseWidget();
            }
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

    setupIconClickHandler(widget) {
        const icon = widget.querySelector('.timer-widget-icon');
        const header = widget.querySelector('.timer-widget-header');
        const content = widget.querySelector('.timer-widget-content');
        const footer = widget.querySelector('.timer-widget-footer');
        const toggle = widget.querySelector('.timer-widget-toggle');
        
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            // Only expand if we didn't drag
            if (!widget.hasDragged()) {
                this.expandWidget();
            }
            // Reset drag state after a short delay
            setTimeout(() => {
                widget.setHasDragged(false);
            }, 100);
        });
        
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.collapseWidget();
        });
    }
    
    expandWidget() {
        const widget = document.getElementById('timer-widget');
        const icon = widget.querySelector('.timer-widget-icon');
        const header = widget.querySelector('.timer-widget-header');
        const content = widget.querySelector('.timer-widget-content');
        const footer = widget.querySelector('.timer-widget-footer');
        
        widget.classList.add('expanded');
        icon.style.display = 'none';
        header.style.display = 'flex';
        content.style.display = 'block';
        footer.style.display = 'block';
        
        this.isVisible = true;
    }
    
    collapseWidget() {
        const widget = document.getElementById('timer-widget');
        const icon = widget.querySelector('.timer-widget-icon');
        const header = widget.querySelector('.timer-widget-header');
        const content = widget.querySelector('.timer-widget-content');
        const footer = widget.querySelector('.timer-widget-footer');
        
        widget.classList.remove('expanded');
        icon.style.display = 'flex';
        header.style.display = 'none';
        content.style.display = 'none';
        footer.style.display = 'none';
        
        this.isVisible = false;
    }

    // Static method to trigger timer updates globally
    static triggerUpdate() {
        window.dispatchEvent(new CustomEvent('timerUpdated'));
    }
}
 