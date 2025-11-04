// --- remnantEntry.js ---
// Remnant plate entry tab functionality (Fire Sac Girişi)

import { createRemnantPlate } from '../generic/cncCutting.js';

// ============================================================================
// REMNANT PLATE ENTRY TAB FUNCTIONALITY
// ============================================================================

export function loadRemnantEntryContent() {
    createRemnantEntryHTML();
    bindRemnantEntryEvents();
}

/**
 * Creates and inserts the HTML structure for the remnant plate entry page
 */
function createRemnantEntryHTML() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="remnant-entry-view">
            <div class="section-header">
                <h3 class="section-title">
                    <i class="fas fa-fire me-2"></i>
                    Fire Sac Girişi
                </h3>
                <p class="section-subtitle">Fire sac plakası bilgilerini giriniz</p>
            </div>
            
            <!-- Remnant Entry Form -->
            <div class="remnant-entry-form-container">
                <form id="remnant-entry-form" class="remnant-entry-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="thickness_mm" class="form-label">
                                <i class="fas fa-ruler-vertical me-2"></i>Kalınlık (mm)
                            </label>
                            <input 
                                type="number" 
                                id="thickness_mm" 
                                name="thickness_mm" 
                                class="form-control" 
                                step="0.01" 
                                min="0" 
                                placeholder="10.00" 
                                required
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="dimensions" class="form-label">
                                <i class="fas fa-arrows-alt me-2"></i>Boyutlar
                            </label>
                            <input 
                                type="text" 
                                id="dimensions" 
                                name="dimensions" 
                                class="form-control" 
                                placeholder="1200x800" 
                                required
                            >
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="quantity" class="form-label">
                                <i class="fas fa-cubes me-2"></i>Adet
                            </label>
                            <input 
                                type="number" 
                                id="quantity" 
                                name="quantity" 
                                class="form-control" 
                                min="1" 
                                placeholder="1" 
                                required
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="material" class="form-label">
                                <i class="fas fa-cube me-2"></i>Malzeme
                            </label>
                            <input 
                                type="text" 
                                id="material" 
                                name="material" 
                                class="form-control" 
                                placeholder="S235JR" 
                                required
                            >
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary btn-submit" id="remnant-submit-btn">
                            <i class="fas fa-save me-2"></i>
                            Kaydet
                        </button>
                        <button type="reset" class="btn btn-secondary btn-reset" id="remnant-reset-btn">
                            <i class="fas fa-redo me-2"></i>
                            Sıfırla
                        </button>
                    </div>
                </form>
                
                <!-- Success/Error Messages -->
                <div id="remnant-message" class="remnant-message" style="display: none;"></div>
            </div>
        </div>
    `;
}

/**
 * Bind event listeners for the remnant entry form
 */
function bindRemnantEntryEvents() {
    const form = document.getElementById('remnant-entry-form');
    const submitBtn = document.getElementById('remnant-submit-btn');
    const resetBtn = document.getElementById('remnant-reset-btn');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', handleFormReset);
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('remnant-submit-btn');
    const messageDiv = document.getElementById('remnant-message');
    
    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Kaydediliyor...';
    
    // Hide previous messages
    hideMessage();
    
    try {
        // Get form data
        const formData = {
            thickness_mm: document.getElementById('thickness_mm').value,
            dimensions: document.getElementById('dimensions').value,
            quantity: parseInt(document.getElementById('quantity').value),
            material: document.getElementById('material').value
        };
        
        // Validate dimensions format (should be like "1200x800")
        if (!/^\d+x\d+$/.test(formData.dimensions)) {
            throw new Error('Boyutlar formatı hatalı. Lütfen genişlik x yükseklik formatında giriniz (örn: 1200x800)');
        }
        
        // Validate thickness
        const thickness = parseFloat(formData.thickness_mm);
        if (isNaN(thickness) || thickness <= 0) {
            throw new Error('Kalınlık geçerli bir sayı olmalıdır');
        }
        
        // Validate quantity
        if (formData.quantity <= 0) {
            throw new Error('Adet 1 veya daha büyük olmalıdır');
        }
        
        // Validate material
        if (!formData.material || formData.material.trim() === '') {
            throw new Error('Malzeme bilgisi girilmelidir');
        }
        
        // Create remnant plate
        const result = await createRemnantPlate(formData);
        
        // Show success message
        showMessage('Fire sac plakası başarıyla kaydedildi!', 'success');
        
        // Reset form after a short delay
        setTimeout(() => {
            handleFormReset();
        }, 2000);
        
    } catch (error) {
        console.error('Error creating remnant plate:', error);
        
        // Show error message
        const errorMessage = error.message || 'Fire sac plakası kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.';
        showMessage(errorMessage, 'error');
        
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Kaydet';
    }
}

/**
 * Handle form reset
 */
function handleFormReset() {
    const form = document.getElementById('remnant-entry-form');
    if (form) {
        form.reset();
        hideMessage();
    }
}

/**
 * Show success or error message
 */
function showMessage(message, type) {
    const messageDiv = document.getElementById('remnant-message');
    if (!messageDiv) return;
    
    messageDiv.className = `remnant-message remnant-message-${type}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
            <span>${message}</span>
        </div>
    `;
    messageDiv.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            hideMessage();
        }, 5000);
    }
}

/**
 * Hide message
 */
function hideMessage() {
    const messageDiv = document.getElementById('remnant-message');
    if (messageDiv) {
        messageDiv.style.display = 'none';
        messageDiv.innerHTML = '';
    }
}

