// ============================================================================
// GENERIC TIMER PAGE COMPONENT
// ============================================================================
// A reusable timer page component that can be customized for different modules

import { GenericCard, createCardGrid } from '../genericCard/genericCard.js';

export class TimerPage {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        // Default configuration
        this.config = {
            // Header configuration
            title: 'Timer',
            subtitle: '',
            showBackButton: true,
            backButtonText: 'Geri',
            backButtonIcon: 'fas fa-arrow-left',
            // Custom header right content (if provided, replaces status badge)
            headerRightContent: null,
            
            // Timer configuration
            timerLabel: 'Geçen Süre',
            showTimer: true,
            
            // Button configuration
            buttons: {
                startStop: {
                    enabled: true,
                    startText: 'Başlat',
                    stopText: 'Durdur',
                    startIcon: 'fas fa-play',
                    stopIcon: 'fas fa-stop'
                },
                manual: {
                    enabled: true,
                    text: 'Manuel',
                    icon: 'fas fa-clock'
                },
                complete: {
                    enabled: true,
                    text: 'Tamamla',
                    icon: 'fas fa-check'
                },
                fault: {
                    enabled: true,
                    text: 'Arıza',
                    icon: 'fas fa-exclamation-triangle'
                }
            },
            
            // Task details configuration
            showTaskDetails: true,
            taskDetails: [],
            
            // Generic cards configuration
            showGenericCards: false,
            genericCards: [],
            cardsGridOptions: {
                columns: 'auto', // 'auto' for responsive, or number for fixed columns
                gap: '1rem',
                className: '',
                responsive: true // Enable responsive behavior
            },
            
            // Warning configuration
            showWarning: false,
            warningMessage: '',
            warningIcon: 'fas fa-exclamation-circle',
            
            // Modal configuration
            modals: {
                manualTime: true,
                faultReport: true,
                machineStatus: true,
                redirectWarning: true
            },
            
            // Event handlers
            onBack: null,
            onStart: null,
            onStop: null,
            onManual: null,
            onComplete: null,
            onFault: null,
            onTimerUpdate: null,
            
            // Styling
            theme: 'default', // 'default', 'dark', 'custom'
            customCss: null
        };

        // Merge with provided options
        this.config = { ...this.config, ...options };
        
        // State management
        this.state = {
            isRunning: false,
            startTime: null,
            elapsedTime: 0,
            timerInterval: null,
            currentTask: null,
            currentMachine: null
        };
        
        // Generic cards instances
        this.genericCardsInstances = [];

        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.renderGenericCards();
        this.startTimerUpdate();
    }

    render() {
        this.container.innerHTML = this.getHTML();
        this.applyCustomStyling();
    }

    getHTML() {
        return `
            <div class="timer-page-wrapper">
                ${this.getHeaderHTML()}
                ${this.getTimerSectionHTML()}
                ${this.getTaskDetailsHTML()}
                ${this.getGenericCardsHTML()}
                ${this.getWarningSectionHTML()}
                ${this.getModalsHTML()}
            </div>
        `;
    }

    getHeaderHTML() {
        return `
            <div class="timer-header-section">
                <div class="container-fluid">
                    <div class="row align-items-center">
                        <div class="col-12">
                            <div class="timer-header-content">
                                <div class="timer-header-left">
                                    ${this.config.showBackButton ? `
                                        <button class="btn btn-outline-light btn-sm back-btn" id="timer-back-button">
                                            <i class="${this.config.backButtonIcon}"></i>
                                        </button>
                                    ` : ''}
                                    <div class="timer-info">
                                        <h1 id="timer-title" class="timer-title">${this.config.title}</h1>
                                        ${this.config.subtitle ? `<p id="timer-subtitle" class="timer-subtitle">${this.config.subtitle}</p>` : ''}
                                    </div>
                                </div>
                                <div class="timer-header-right">
                                    ${this.config.headerRightContent || `
                                        <div class="timer-status-badge" id="timer-status">
                                            <i class="fas fa-clock"></i>
                                            <span>Beklemede</span>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTimerSectionHTML() {
        if (!this.config.showTimer) return '';

        return `
            <div class="timer-section">
                <div class="container-fluid">
                    <div class="row justify-content-center">
                        <div class="col-12 col-md-8 col-lg-6">
                            <div class="timer-card">
                                <div class="timer-display-container">
                                    <div class="timer-display" id="timer-display">00:00:00</div>
                                    <div class="timer-label">${this.config.timerLabel}</div>
                                </div>
                                
                                <div class="timer-controls">
                                    <div class="primary-controls">
                                        ${this.config.buttons.startStop.enabled ? `
                                            <button id="timer-start-stop" class="btn btn-primary btn-lg timer-btn-primary">
                                                <i class="${this.config.buttons.startStop.startIcon}"></i>
                                                <span>${this.config.buttons.startStop.startText}</span>
                                            </button>
                                        ` : ''}
                                    </div>
                                    
                                    <div class="secondary-controls">
                                        ${this.config.buttons.manual.enabled ? `
                                            <button id="timer-manual-button" class="btn btn-outline-primary timer-btn-secondary">
                                                <i class="${this.config.buttons.manual.icon}"></i>
                                                <span>${this.config.buttons.manual.text}</span>
                                            </button>
                                        ` : ''}
                                        ${this.config.buttons.complete.enabled ? `
                                            <button id="timer-complete-button" class="btn btn-success timer-btn-secondary">
                                                <i class="${this.config.buttons.complete.icon}"></i>
                                                <span>${this.config.buttons.complete.text}</span>
                                            </button>
                                        ` : ''}
                                        ${this.config.buttons.fault.enabled ? `
                                            <button id="timer-fault-button" class="btn btn-danger timer-btn-secondary">
                                                <i class="${this.config.buttons.fault.icon}"></i>
                                                <span>${this.config.buttons.fault.text}</span>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTaskDetailsHTML() {
        if (!this.config.showTaskDetails) return '';

        return `
            <div class="timer-details-section">
                <div class="container-fluid">
                    <div class="row">
                        <div class="col-12">
                            <div class="timer-details-grid" id="timer-details-grid">
                                <!-- Dynamically filled -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getGenericCardsHTML() {
        if (!this.config.showGenericCards) return '';

        return `
            <div class="timer-cards-section">
                <div class="container-fluid">
                    <div class="row">
                        <div class="col-12">
                            <div class="timer-cards-container" id="timer-cards-container">
                                <!-- Generic cards will be rendered here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getWarningSectionHTML() {
        if (!this.config.showWarning) return '';

        return `
            <div class="warning-section" id="timer-warning" style="display: none;">
                <div class="container-fluid">
                    <div class="row justify-content-center">
                        <div class="col-12 col-md-8 col-lg-6">
                            <div class="warning-card">
                                <div class="warning-icon">
                                    <i class="${this.config.warningIcon}"></i>
                                </div>
                                <div class="warning-content">
                                    <h5>Uyarı</h5>
                                    <p>${this.config.warningMessage}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getModalsHTML() {
        let modalsHTML = '';

        if (this.config.modals.manualTime) {
            modalsHTML += `
                <div id="timer-manual-time-modal" class="modal-overlay">
                    <div class="modal-backdrop" id="timer-manual-time-modal-backdrop"></div>
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3><i class="fas fa-clock me-2"></i>Manuel Zaman Girişi</h3>
                            <button class="modal-close" id="timer-manual-time-modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="timer-start-datetime">Başlangıç Tarihi ve Saati:</label>
                                <input type="datetime-local" id="timer-start-datetime" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="timer-end-datetime">Bitiş Tarihi ve Saati:</label>
                                <input type="datetime-local" id="timer-end-datetime" class="form-control" required>
                            </div>
                            <div class="time-preview">
                                <strong>Toplam Süre: <span id="timer-duration-preview">00:00:00</span></strong>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="timer-manual-time-modal-cancel">
                                <i class="fas fa-times me-2"></i>İptal
                            </button>
                            <button class="btn btn-primary" id="timer-manual-time-modal-submit">
                                <i class="fas fa-save me-2"></i>Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (this.config.modals.faultReport) {
            modalsHTML += `
                <div id="timer-fault-modal" class="modal-overlay">
                    <div class="modal-backdrop" id="timer-fault-modal-backdrop"></div>
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3><i class="fas fa-exclamation-triangle me-2"></i>Arıza Bildirimi</h3>
                            <button class="modal-close" id="timer-fault-modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="timer-fault-description">Arıza Açıklaması:</label>
                                <textarea id="timer-fault-description" rows="4" placeholder="Arıza detaylarını buraya yazın..." required></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="timer-fault-modal-cancel">
                                <i class="fas fa-times me-2"></i>İptal
                            </button>
                            <button class="btn btn-danger" id="timer-fault-modal-submit">
                                <i class="fas fa-paper-plane me-2"></i>Gönder
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        return modalsHTML;
    }

    attachEventListeners() {
        // Back button
        if (this.config.showBackButton) {
            const backBtn = document.getElementById('timer-back-button');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    if (this.config.onBack) {
                        this.config.onBack();
                    }
                });
            }
        }

        // Timer controls
        if (this.config.buttons.startStop.enabled) {
            const startStopBtn = document.getElementById('timer-start-stop');
            if (startStopBtn) {
                startStopBtn.addEventListener('click', async () => {
                    if (this.state.isRunning) {
                        this.stopTimer();
                    } else {
                        // If there's an onStart callback, ONLY call it (don't call startTimer)
                        // The callback should handle starting the timer server-side and updating state
                        if (this.config.onStart) {
                            await this.config.onStart();
                        } else {
                            // No callback, use default behavior (local timer only)
                            this.startTimer();
                        }
                    }
                });
            }
        }

        if (this.config.buttons.manual.enabled) {
            const manualBtn = document.getElementById('timer-manual-button');
            if (manualBtn) {
                manualBtn.addEventListener('click', () => {
                    if (this.config.onManual) {
                        this.config.onManual();
                    } else {
                        this.showModal('timer-manual-time-modal');
                    }
                });
            }
        }

        if (this.config.buttons.complete.enabled) {
            const completeBtn = document.getElementById('timer-complete-button');
            if (completeBtn) {
                completeBtn.addEventListener('click', () => {
                    if (this.config.onComplete) {
                        this.config.onComplete();
                    }
                });
            }
        }

        if (this.config.buttons.fault.enabled) {
            const faultBtn = document.getElementById('timer-fault-button');
            if (faultBtn) {
                faultBtn.addEventListener('click', () => {
                    if (this.config.onFault) {
                        this.config.onFault();
                    } else {
                        this.showModal('timer-fault-modal');
                    }
                });
            }
        }

        // Modal event listeners
        this.attachModalListeners();
    }

    attachModalListeners() {
        // Manual time modal
        if (this.config.modals.manualTime) {
            const modal = document.getElementById('timer-manual-time-modal');
            if (modal) {
                // Close buttons
                const closeBtn = document.getElementById('timer-manual-time-modal-close');
                const cancelBtn = document.getElementById('timer-manual-time-modal-cancel');
                const backdrop = document.getElementById('timer-manual-time-modal-backdrop');
                
                if (closeBtn) closeBtn.addEventListener('click', () => this.hideModal('timer-manual-time-modal'));
                if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal('timer-manual-time-modal'));
                if (backdrop) backdrop.addEventListener('click', () => this.hideModal('timer-manual-time-modal'));

                // Submit button - only attach if no custom onManual handler (custom handlers manage their own submission)
                if (!this.config.onManual) {
                    const submitBtn = document.getElementById('timer-manual-time-modal-submit');
                    if (submitBtn) {
                        submitBtn.addEventListener('click', () => {
                            this.handleManualTimeSubmit();
                        });
                    }
                }

                // Time preview
                const startInput = document.getElementById('timer-start-datetime');
                const endInput = document.getElementById('timer-end-datetime');
                if (startInput && endInput) {
                    const updatePreview = () => {
                        const start = new Date(startInput.value);
                        const end = new Date(endInput.value);
                        if (start && end && end > start) {
                            const diff = end - start;
                            const hours = Math.floor(diff / 3600000);
                            const minutes = Math.floor((diff % 3600000) / 60000);
                            const seconds = Math.floor((diff % 60000) / 1000);
                            document.getElementById('timer-duration-preview').textContent = 
                                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        }
                    };
                    startInput.addEventListener('change', updatePreview);
                    endInput.addEventListener('change', updatePreview);
                }
            }
        }

        // Fault modal
        if (this.config.modals.faultReport) {
            const modal = document.getElementById('timer-fault-modal');
            if (modal) {
                // Close buttons
                const closeBtn = document.getElementById('timer-fault-modal-close');
                const cancelBtn = document.getElementById('timer-fault-modal-cancel');
                const backdrop = document.getElementById('timer-fault-modal-backdrop');
                
                if (closeBtn) closeBtn.addEventListener('click', () => this.hideModal('timer-fault-modal'));
                if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal('timer-fault-modal'));
                if (backdrop) backdrop.addEventListener('click', () => this.hideModal('timer-fault-modal'));

                // Submit button - only attach if no custom onFault handler (custom handlers manage their own submission)
                if (!this.config.onFault) {
                    const submitBtn = document.getElementById('timer-fault-modal-submit');
                    if (submitBtn) {
                        submitBtn.addEventListener('click', () => {
                            this.handleFaultSubmit();
                        });
                    }
                }
            }
        }
    }

    // Timer functionality
    startTimer() {
        // Only use this for local-only timers (when no server-side callback is provided)
        // If onStart callback exists, it should handle everything (showing modals, starting server timer, etc.)
        if (this.config.onStart) {
            // Don't set local state - let the callback handle everything
            this.config.onStart();
            return;
        }
        
        // Default behavior: local timer only (for demo/testing)
        this.state.isRunning = true;
        this.state.startTime = Date.now();
        this.updateButtonStates();
        this.updateStatus();
    }

    /**
     * Resume a timer from a server-provided start time
     * This is used when restoring a timer after page refresh
     * @param {number} serverStartTime - The original start time from the server (timestamp in milliseconds)
     */
    resumeTimer(serverStartTime) {
        if (!serverStartTime) {
            console.warn('resumeTimer called without serverStartTime');
            return;
        }
        
        this.state.isRunning = true;
        // Set startTime to the server's start time so elapsed time is calculated correctly
        this.state.startTime = serverStartTime;
        // Reset elapsedTime since we'll calculate from startTime
        this.state.elapsedTime = 0;
        this.updateButtonStates();
        this.updateStatus();
        this.updateTimerDisplay();
        
        // Do NOT call onStart() here - this is a resume, not a new start
    }

    stopTimer() {
        this.state.isRunning = false;
        this.state.elapsedTime += Date.now() - this.state.startTime;
        this.state.startTime = null;
        this.updateButtonStates();
        this.updateStatus();
        
        if (this.config.onStop) {
            this.config.onStop();
        }
    }

    resetTimer() {
        this.state.isRunning = false;
        this.state.startTime = null;
        this.state.elapsedTime = 0;
        this.updateButtonStates();
        this.updateStatus();
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const display = document.getElementById('timer-display');
        if (!display) return;

        let totalElapsed = this.state.elapsedTime;
        if (this.state.isRunning && this.state.startTime) {
            totalElapsed += Date.now() - this.state.startTime;
        }

        const seconds = Math.floor(totalElapsed / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

        if (this.config.onTimerUpdate) {
            this.config.onTimerUpdate(totalElapsed);
        }
    }

    startTimerUpdate() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
        }
        
        this.state.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimerUpdate() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    }

    updateButtonStates() {
        const startStopBtn = document.getElementById('timer-start-stop');
        const manualBtn = document.getElementById('timer-manual-button');
        const completeBtn = document.getElementById('timer-complete-button');
        const faultBtn = document.getElementById('timer-fault-button');

        if (startStopBtn) {
            if (this.state.isRunning) {
                startStopBtn.innerHTML = `<i class="${this.config.buttons.startStop.stopIcon}"></i><span>${this.config.buttons.startStop.stopText}</span>`;
                startStopBtn.classList.remove('btn-primary');
                startStopBtn.classList.add('btn-danger', 'running');
            } else {
                startStopBtn.innerHTML = `<i class="${this.config.buttons.startStop.startIcon}"></i><span>${this.config.buttons.startStop.startText}</span>`;
                startStopBtn.classList.remove('btn-danger', 'running');
                startStopBtn.classList.add('btn-primary');
            }
        }

        // Disable other buttons while timer is running
        const secondaryButtons = [manualBtn, completeBtn, faultBtn];
        secondaryButtons.forEach(btn => {
            if (btn) {
                btn.disabled = this.state.isRunning;
                btn.classList.toggle('disabled', this.state.isRunning);
            }
        });
    }

    updateStatus() {
        // Only update status if headerRightContent is not provided (status badge is visible)
        if (this.config.headerRightContent) {
            return;
        }
        const status = document.getElementById('timer-status');
        if (status) {
            if (this.state.isRunning) {
                status.innerHTML = '<i class="fas fa-play"></i><span>Çalışıyor</span>';
                status.classList.add('active');
            } else {
                status.innerHTML = '<i class="fas fa-clock"></i><span>Beklemede</span>';
                status.classList.remove('active');
            }
        }
    }

    // Task details management
    setTaskDetails(details) {
        this.config.taskDetails = details;
        this.updateTaskDetailsGrid();
    }

    // Generic cards management
    renderGenericCards() {
        if (!this.config.showGenericCards || !this.config.genericCards.length) return;

        const container = document.getElementById('timer-cards-container');
        if (!container) return;

        // Clear existing cards
        this.destroyGenericCards();
        container.innerHTML = '';

        // Prepare grid options with responsive behavior
        const gridOptions = this.prepareGridOptions();

        // Create cards grid
        createCardGrid(container, this.config.genericCards, gridOptions);
        
        // Store card instances for later management
        this.genericCardsInstances = [];
        const cardContainers = container.querySelectorAll('.generic-card-container');
        cardContainers.forEach((cardContainer, index) => {
            const cardData = this.config.genericCards[index];
            if (cardData) {
                const cardInstance = new GenericCard(cardContainer, cardData);
                this.genericCardsInstances.push(cardInstance);
            }
        });

        // Add responsive behavior if enabled
        if (this.config.cardsGridOptions.responsive) {
            this.addResponsiveBehavior(container);
        }
    }

    prepareGridOptions() {
        const options = { ...this.config.cardsGridOptions };
        
        // If columns is 'auto', let CSS handle responsive behavior
        if (options.columns === 'auto') {
            options.columns = 1; // Default fallback
        }
        
        return options;
    }

    addResponsiveBehavior(container) {
        const grid = container.querySelector('.generic-card-grid');
        if (!grid) return;

        // Add responsive class
        grid.classList.add('responsive-grid');

        // Handle window resize
        const handleResize = () => {
            this.updateGridLayout(grid);
        };

        // Debounce resize events
        let resizeTimeout;
        const debouncedResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 150);
        };

        window.addEventListener('resize', debouncedResize);
        
        // Store cleanup function
        this.resizeCleanup = () => {
            window.removeEventListener('resize', debouncedResize);
        };

        // Initial layout
        this.updateGridLayout(grid);
    }

    updateGridLayout(grid) {
        const width = window.innerWidth;
        const cards = grid.querySelectorAll('.generic-card-container');
        
        if (!cards.length) return;

        // Remove any existing responsive classes
        grid.classList.remove('mobile-layout', 'tablet-layout', 'desktop-layout');

        if (width <= 576) {
            // Mobile: 1 column
            grid.classList.add('mobile-layout');
            grid.style.gridTemplateColumns = '1fr';
        } else if (width <= 768) {
            // Tablet: 2 columns
            grid.classList.add('tablet-layout');
            grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else if (width <= 992) {
            // Small desktop: 3 columns
            grid.classList.add('desktop-layout');
            grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        } else {
            // Large desktop: 4 columns
            grid.classList.add('desktop-layout');
            grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        }
    }

    setGenericCards(cards, gridOptions = {}) {
        this.config.genericCards = cards;
        this.config.cardsGridOptions = { ...this.config.cardsGridOptions, ...gridOptions };
        this.renderGenericCards();
    }

    addGenericCard(cardData) {
        this.config.genericCards.push(cardData);
        this.renderGenericCards();
    }

    removeGenericCard(index) {
        if (index >= 0 && index < this.config.genericCards.length) {
            this.config.genericCards.splice(index, 1);
            this.renderGenericCards();
        }
    }

    updateGenericCard(index, cardData) {
        if (index >= 0 && index < this.config.genericCards.length) {
            this.config.genericCards[index] = cardData;
            this.renderGenericCards();
        }
    }

    destroyGenericCards() {
        this.genericCardsInstances.forEach(card => {
            if (card && typeof card.destroy === 'function') {
                card.destroy();
            }
        });
        this.genericCardsInstances = [];
        
        // Clean up resize listener
        if (this.resizeCleanup) {
            this.resizeCleanup();
            this.resizeCleanup = null;
        }
    }

    updateTaskDetailsGrid() {
        const grid = document.getElementById('timer-details-grid');
        if (!grid) return;

        grid.innerHTML = this.config.taskDetails.map(detail => `
            <div class="detail-card ${detail.clickable ? 'clickable' : ''}" ${detail.clickable ? `id="${detail.id}"` : ''}>
                <div class="detail-icon">
                    <i class="${detail.icon}"></i>
                </div>
                <div class="detail-label">${detail.label}</div>
                <div class="detail-value">${detail.value}</div>
            </div>
        `).join('');

        // Add click event listeners for clickable details
        this.config.taskDetails.forEach(detail => {
            if (detail.clickable && detail.onClick) {
                const element = document.getElementById(detail.id);
                if (element) {
                    element.addEventListener('click', detail.onClick);
                }
            }
        });
    }

    // Modal management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // Focus management
            const firstFocusable = modal.querySelector('button, input, textarea, select');
            if (firstFocusable) {
                firstFocusable.focus();
            }
            
            // Close on escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.hideModal(modalId);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Clear any form inputs
            const inputs = modal.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (input.type !== 'submit') {
                    input.value = '';
                }
            });
        }
    }

    // Modal handlers
    handleManualTimeSubmit() {
        const startInput = document.getElementById('timer-start-datetime');
        const endInput = document.getElementById('timer-end-datetime');
        
        if (!startInput.value || !endInput.value) {
            this.showMessage('Lütfen başlangıç ve bitiş zamanlarını girin.', 'error');
            return;
        }

        const startTime = new Date(startInput.value);
        const endTime = new Date(endInput.value);
        
        if (endTime <= startTime) {
            this.showMessage('Bitiş zamanı başlangıç zamanından sonra olmalıdır.', 'error');
            return;
        }

        if (this.config.onManual) {
            this.config.onManual({
                startTime: startTime,
                endTime: endTime,
                duration: endTime - startTime
            });
        }

        this.hideModal('timer-manual-time-modal');
    }

    handleFaultSubmit() {
        const description = document.getElementById('timer-fault-description').value;
        
        if (!description.trim()) {
            this.showMessage('Lütfen arıza açıklamasını girin.', 'error');
            return;
        }

        if (this.config.onFault) {
            this.config.onFault({
                description: description.trim()
            });
        }

        this.hideModal('timer-fault-modal');
    }

    // Utility methods
    showMessage(message, type = 'info', duration = 3000) {
        const messageDiv = document.createElement('div');
        const alertClass = type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
        
        messageDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        messageDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 1060;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
        
        messageDiv.innerHTML = `
            <i class="fas ${icon} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(messageDiv);
        
        // Auto remove after duration
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, duration);
    }

    applyCustomStyling() {
        if (this.config.customCss) {
            const style = document.createElement('style');
            style.textContent = this.config.customCss;
            document.head.appendChild(style);
        }
    }

    // Public API methods
    setTitle(title) {
        this.config.title = title;
        const titleElement = document.getElementById('timer-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    setSubtitle(subtitle) {
        this.config.subtitle = subtitle;
        const subtitleElement = document.getElementById('timer-subtitle');
        if (subtitleElement) {
            subtitleElement.textContent = subtitle;
        }
    }

    showWarning(message, icon = 'fas fa-exclamation-circle') {
        this.config.showWarning = true;
        this.config.warningMessage = message;
        this.config.warningIcon = icon;
        
        const warningSection = document.getElementById('timer-warning');
        if (warningSection) {
            warningSection.style.display = 'block';
            const warningContent = warningSection.querySelector('.warning-content p');
            if (warningContent) {
                warningContent.textContent = message;
            }
        }
    }

    hideWarning() {
        this.config.showWarning = false;
        const warningSection = document.getElementById('timer-warning');
        if (warningSection) {
            warningSection.style.display = 'none';
        }
    }

    destroy() {
        this.stopTimerUpdate();
        this.destroyGenericCards();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
