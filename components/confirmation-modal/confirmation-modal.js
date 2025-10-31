/**
 * Reusable Confirmation Modal Component
 * Displays confirmation dialogs with customizable content and callbacks
 */
export class ConfirmationModal {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        
        this.options = {
            title: 'Onay',
            icon: 'fas fa-exclamation-triangle',
            message: 'Bu işlemi yapmak istediğinize emin misiniz?',
            confirmText: 'Evet',
            cancelText: 'İptal',
            confirmButtonClass: 'btn-primary',
            showCancelButton: true,
            ...options
        };
        
        this.modal = null;
        this.onConfirm = null;
        this.onCancel = null;
        this.dismissReason = null; // Track how modal was dismissed: 'cancel-button', 'x-button', 'backdrop', 'escape', or null
        
        this.init();
    }
    
    init() {
        this.createModal();
        this.bindEvents();
    }
    
    createModal() {
        const modalHtml = `
            <div class="modal fade confirmation-modal" id="confirmationModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header confirmation-modal-header">
                            <h5 class="modal-title">
                                <i class="${this.options.icon} me-2"></i>
                                <span class="confirmation-title-text">${this.options.title}</span>
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" data-dismiss-reason="x-button"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center" id="confirmation-main-content">
                                <i class="fas fa-question-circle confirmation-icon mb-3"></i>
                                <h5 class="confirmation-message">${this.options.message}</h5>
                                <p class="text-muted confirmation-description" id="confirmation-description"></p>
                                <div class="alert alert-info confirmation-details" id="confirmation-details" style="display: none;"></div>
                            </div>
                            <div class="custom-form-content" id="confirmation-custom-form" style="display: none;"></div>
                        </div>
                        <div class="modal-footer">
                            ${this.options.showCancelButton ? `
                                <button type="button" class="btn btn-secondary" id="confirmation-cancel-btn" data-dismiss-reason="cancel-button">
                                    <i class="fas fa-times me-2"></i>${this.options.cancelText}
                                </button>
                            ` : ''}
                            <button type="button" class="btn ${this.options.confirmButtonClass}" id="confirm-action-btn">
                                <i class="fas fa-check me-2"></i>${this.options.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = modalHtml;
        this.modal = this.container.querySelector('#confirmationModal');
    }
    
    bindEvents() {
        // Confirm button event
        const confirmBtn = this.container.querySelector('#confirm-action-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.handleConfirm();
            });
        }
        
        // Cancel button will be bound dynamically in show() method
        // X button and backdrop - track dismiss reason
        if (this.modal) {
            const closeBtn = this.modal.querySelector('.btn-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.dismissReason = 'x-button';
                });
            }
            
            // Track backdrop clicks
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.dismissReason = 'backdrop';
                }
            });
            
            // Track ESC key
            this.modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.dismissReason = 'escape';
                }
            });
            
            // Ensure z-index when modal is shown
            this.modal.addEventListener('shown.bs.modal', () => {
                // Set modal z-index
                this.modal.style.zIndex = '10050';
                
                // Set backdrop z-index
                const backdrop = document.querySelector('.modal-backdrop.show');
                if (backdrop) {
                    backdrop.style.zIndex = '10049';
                }
                
                // Reset dismiss reason when modal is shown
                this.dismissReason = null;
            });
            
            // Handle modal close event
            this.modal.addEventListener('hidden.bs.modal', () => {
                if (this.onCancel) {
                    // Pass dismiss reason to callback
                    this.onCancel(this.dismissReason);
                }
                // Reset dismiss reason
                this.dismissReason = null;
            });
        }
    }
    
    async handleConfirm() {
        // Collect form data if custom form exists
        const customForm = document.getElementById('confirmation-custom-form');
        let formData = null;
        
        if (customForm && customForm.style.display !== 'none') {
            formData = {};
            const inputs = customForm.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.id) {
                    formData[input.id] = input.value;
                } else if (input.name) {
                    formData[input.name] = input.value;
                }
            });
        }
        
        if (this.onConfirm) {
            try {
                const result = await Promise.resolve(this.onConfirm(formData));
                // Only hide modal if callback doesn't explicitly prevent it
                if (result === false) {
                    // Callback wants to keep modal open
                    return;
                } else {
                    // Normal flow - close modal
                    // Use a small delay to ensure any async operations complete
                    await new Promise(resolve => setTimeout(resolve, 50));
                    this.hide();
                }
            } catch (error) {
                console.error('Error in confirmation callback:', error);
                // On error, keep modal open so user can retry
            }
        } else {
            this.hide();
        }
    }
    
    // Method to get form data without closing modal
    getFormData() {
        const customForm = document.getElementById('confirmation-custom-form');
        if (customForm && customForm.style.display !== 'none') {
            const formData = {};
            const inputs = customForm.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.id) {
                    formData[input.id] = input.value;
                } else if (input.name) {
                    formData[input.name] = input.value;
                }
            });
            return formData;
        }
        return null;
    }
    
    async show(options = {}) {
        // Update options if provided
        if (options.title) {
            const titleElement = this.modal.querySelector('.confirmation-title-text');
            if (titleElement) {
                titleElement.textContent = options.title;
            }
        }
        
        if (options.message) {
            const messageElement = this.modal.querySelector('.confirmation-message');
            if (messageElement) {
                messageElement.textContent = options.message;
            }
        }
        
        if (options.description) {
            const descElement = document.getElementById('confirmation-description');
            if (descElement) {
                descElement.textContent = options.description;
                descElement.style.display = 'block';
            }
        } else {
            const descElement = document.getElementById('confirmation-description');
            if (descElement) {
                descElement.style.display = 'none';
            }
        }
        
        if (options.details) {
            const detailsElement = document.getElementById('confirmation-details');
            if (detailsElement) {
                detailsElement.innerHTML = options.details;
                detailsElement.style.display = 'block';
            }
        } else {
            const detailsElement = document.getElementById('confirmation-details');
            if (detailsElement) {
                detailsElement.style.display = 'none';
            }
        }
        
        // Handle custom form content
        if (options.customFormContent) {
            const mainContent = document.getElementById('confirmation-main-content');
            const customForm = document.getElementById('confirmation-custom-form');
            if (mainContent && customForm) {
                mainContent.style.display = 'none';
                customForm.innerHTML = options.customFormContent;
                customForm.style.display = 'block';
            }
        } else {
            const mainContent = document.getElementById('confirmation-main-content');
            const customForm = document.getElementById('confirmation-custom-form');
            if (mainContent && customForm) {
                mainContent.style.display = 'block';
                customForm.style.display = 'none';
                customForm.innerHTML = '';
            }
        }
        
        if (options.confirmText) {
            const confirmBtn = this.container.querySelector('#confirm-action-btn');
            if (confirmBtn) {
                confirmBtn.innerHTML = `<i class="fas fa-check me-2"></i>${options.confirmText}`;
            }
        }
        
        if (options.confirmButtonClass) {
            const confirmBtn = this.container.querySelector('#confirm-action-btn');
            if (confirmBtn) {
                // Remove existing button classes and add new one
                confirmBtn.className = `btn ${options.confirmButtonClass}`;
                const existingIcon = confirmBtn.querySelector('i');
                if (existingIcon) {
                    confirmBtn.innerHTML = existingIcon.outerHTML + (options.confirmText || 'Evet');
                } else {
                    confirmBtn.innerHTML = `<i class="fas fa-check me-2"></i>${options.confirmText || 'Evet'}`;
                }
            }
        }
        
        // Update cancel button text and visibility if provided, and rebind click handler
        let cancelBtn = this.container.querySelector('#confirmation-cancel-btn');
        if (cancelBtn) {
            // Remove old click listeners by cloning (preserves the element in DOM)
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            cancelBtn = newCancelBtn; // Update reference to the new element
            
            // Update text if provided
            if (options.cancelText !== undefined) {
                cancelBtn.innerHTML = `<i class="fas fa-times me-2"></i>${options.cancelText}`;
            }
            // Update visibility if provided
            if (options.showCancelButton !== undefined) {
                cancelBtn.style.display = options.showCancelButton ? 'inline-block' : 'none';
            }
            
            // Bind click handler
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dismissReason = 'cancel-button';
                this.hide();
            });
        }
        
        // Set callbacks
        if (options.onConfirm) {
            this.onConfirm = options.onConfirm;
        }
        
        if (options.onCancel) {
            this.onCancel = options.onCancel;
        }
        
        // Show modal - handle case where modal is already showing
        const modalInstance = bootstrap.Modal.getOrCreateInstance(this.modal);
        
        // Check if modal or backdrop is currently showing
        const isCurrentlyShowing = this.modal.classList.contains('show') || 
                                   document.querySelector('.modal-backdrop.show');
        
        if (isCurrentlyShowing) {
            // Hide the current modal first, then show with new content
            return new Promise((resolve) => {
                modalInstance.hide();
                // Wait for modal to fully hide before showing again
                const handleHidden = () => {
                    setTimeout(() => {
                        modalInstance.show();
                        // Resolve after modal is shown
                        this.modal.addEventListener('shown.bs.modal', () => {
                            resolve();
                        }, { once: true });
                    }, 200);
                };
                this.modal.addEventListener('hidden.bs.modal', handleHidden, { once: true });
            });
        } else {
            modalInstance.show();
            // Return a promise that resolves when modal is shown
            return new Promise((resolve) => {
                this.modal.addEventListener('shown.bs.modal', () => {
                    resolve();
                }, { once: true });
            });
        }
        
        // Ensure cancel button text is updated after modal is fully shown
        const updateCancelButton = () => {
            const updatedCancelBtn = this.container.querySelector('#confirmation-cancel-btn');
            if (options.cancelText !== undefined && updatedCancelBtn) {
                updatedCancelBtn.innerHTML = `<i class="fas fa-times me-2"></i>${options.cancelText}`;
            }
        };
        
        this.modal.addEventListener('shown.bs.modal', () => {
            updateCancelButton();
            // Also update after a small delay to ensure DOM is fully ready
            setTimeout(updateCancelButton, 50);
        }, { once: true });
        
        // Ensure modal and backdrop z-index are set correctly
        const ensureZIndex = () => {
            // Set modal z-index
            if (this.modal) {
                this.modal.style.zIndex = '10050';
            }
            
            // Set backdrop z-index (Bootstrap creates it dynamically)
            setTimeout(() => {
                const backdrop = document.querySelector('.modal-backdrop.show');
                if (backdrop) {
                    backdrop.style.zIndex = '10049';
                }
            }, 10);
        };
        
        // Set z-index before and after showing
        ensureZIndex();
        modalInstance.show();
        
        // Also set after a small delay to catch dynamically created backdrop
        setTimeout(ensureZIndex, 50);
    }
    
    hide() {
        if (this.modal) {
            const modalInstance = bootstrap.Modal.getInstance(this.modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
    }
    
    setOnConfirm(callback) {
        this.onConfirm = callback;
    }
    
    setOnCancel(callback) {
        this.onCancel = callback;
    }
    
    updateMessage(message) {
        const messageElement = this.modal.querySelector('.confirmation-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
    
    updateDetails(details) {
        const detailsElement = document.getElementById('confirmation-details');
        if (detailsElement) {
            detailsElement.innerHTML = details;
            detailsElement.style.display = details ? 'block' : 'none';
        }
    }
}

