// --- fireSaclar.js ---
// Fire Saclar tab functionality - Display remnant plates using genericCard component

import { getRemnantPlates, createRemnantPlate } from '../generic/cncCutting.js';
import { createCardGrid } from '../components/genericCard/genericCard.js';

// ============================================================================
// FIRE SACLAR TAB FUNCTIONALITY
// ============================================================================

export function loadFireSaclarContent() {
    createFireSaclarHTML();
    bindFireSaclarEvents();
    loadRemnantPlates();
}

/**
 * Creates and inserts the HTML structure for the fire saclar page
 */
function createFireSaclarHTML() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="fire-saclar-view">
            <div class="section-header">
                <div class="section-header-content">
                    <div>
                        <h3 class="section-title">
                            <i class="fas fa-fire me-2"></i>
                            Fire Saclar
                        </h3>
                        <p class="section-subtitle">Mevcut fire sac plakalarını görüntüleyin</p>
                    </div>
                    <button id="toggle-form-btn" class="btn btn-primary btn-toggle-form" type="button">
                        <i class="fas fa-plus me-2"></i>
                        <span class="toggle-form-text">Yeni Ekle</span>
                    </button>
                </div>
            </div>
            
            <!-- Remnant Entry Form (Initially Hidden) -->
            <div id="fire-saclar-form-container" class="fire-saclar-form-container" style="display: none;">
                <div class="remnant-entry-form-container">
                    <form id="fire-saclar-entry-form" class="remnant-entry-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="fire-saclar-thickness_mm" class="form-label">
                                    <i class="fas fa-ruler-vertical me-2"></i>Kalınlık (mm)
                                </label>
                                <input 
                                    type="number" 
                                    id="fire-saclar-thickness_mm" 
                                    name="thickness_mm" 
                                    class="form-control" 
                                    step="0.01" 
                                    min="0" 
                                    placeholder="10.00" 
                                    required
                                >
                            </div>
                            
                            <div class="form-group">
                                <label for="fire-saclar-dimensions" class="form-label">
                                    <i class="fas fa-arrows-alt me-2"></i>Boyutlar
                                </label>
                                <input 
                                    type="text" 
                                    id="fire-saclar-dimensions" 
                                    name="dimensions" 
                                    class="form-control" 
                                    placeholder="1200x800" 
                                    required
                                >
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="fire-saclar-quantity" class="form-label">
                                    <i class="fas fa-cubes me-2"></i>Adet
                                </label>
                                <input 
                                    type="number" 
                                    id="fire-saclar-quantity" 
                                    name="quantity" 
                                    class="form-control" 
                                    min="1" 
                                    placeholder="1" 
                                    required
                                >
                            </div>
                            
                            <div class="form-group">
                                <label for="fire-saclar-material" class="form-label">
                                    <i class="fas fa-cube me-2"></i>Malzeme
                                </label>
                                <input 
                                    type="text" 
                                    id="fire-saclar-material" 
                                    name="material" 
                                    class="form-control" 
                                    placeholder="S235JR" 
                                    required
                                >
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary btn-submit" id="fire-saclar-submit-btn">
                                <i class="fas fa-save me-2"></i>
                                Kaydet
                            </button>
                            <button type="reset" class="btn btn-secondary btn-reset" id="fire-saclar-reset-btn">
                                <i class="fas fa-redo me-2"></i>
                                Sıfırla
                            </button>
                            <button type="button" class="btn btn-outline-secondary btn-cancel" id="fire-saclar-cancel-btn">
                                <i class="fas fa-times me-2"></i>
                                İptal
                            </button>
                        </div>
                    </form>
                    
                    <!-- Success/Error Messages -->
                    <div id="fire-saclar-message" class="remnant-message" style="display: none;"></div>
                </div>
            </div>
            
            <!-- Loading State -->
            <div id="fire-saclar-loading" class="loading-state" style="display: none;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Yükleniyor...</span>
                </div>
                <p class="mt-2">Fire saclar yükleniyor...</p>
            </div>
            
            <!-- Error State -->
            <div id="fire-saclar-error" class="error-state" style="display: none;">
                <div class="alert alert-danger" role="alert">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    <span id="fire-saclar-error-message">Fire saclar yüklenirken bir hata oluştu.</span>
                </div>
            </div>
            
            <!-- Empty State -->
            <div id="fire-saclar-empty" class="empty-state" style="display: none;">
                <div class="alert alert-info" role="alert">
                    <i class="fas fa-info-circle me-2"></i>
                    Henüz fire sac plakası bulunmamaktadır.
                </div>
            </div>
            
            <!-- Cards Grid Container -->
            <div id="fire-saclar-grid" class="fire-saclar-grid"></div>
        </div>
    `;
}

/**
 * Load remnant plates and display them as cards
 */
async function loadRemnantPlates() {
    const loadingDiv = document.getElementById('fire-saclar-loading');
    const errorDiv = document.getElementById('fire-saclar-error');
    const emptyDiv = document.getElementById('fire-saclar-empty');
    const gridContainer = document.getElementById('fire-saclar-grid');
    const errorMessage = document.getElementById('fire-saclar-error-message');
    
    // Show loading state
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    emptyDiv.style.display = 'none';
    gridContainer.innerHTML = '';
    
    try {
        // Fetch remnant plates
        const data = await getRemnantPlates();
        
        // Handle paginated response or direct array
        const remnants = data.results || data;
        
        // Hide loading state
        loadingDiv.style.display = 'none';
        
        if (!remnants || remnants.length === 0) {
            // Show empty state
            emptyDiv.style.display = 'block';
            return;
        }
        
        // Map remnants to card data format
        const cardsData = remnants.map(remnant => ({
            title: remnant.id ? `Fire Sac #${remnant.id}` : 'Fire Sac',
            subtitle: `${remnant.material || 'N/A'} - ${remnant.dimensions || 'N/A'}`,
            icon: 'fas fa-fire',
            iconColor: '#dc3545',
            iconBackground: 'linear-gradient(135deg, #dc3545, #c82333)',
            status: remnant.quantity ? `${remnant.quantity} adet` : null,
            statusType: remnant.quantity && remnant.quantity > 0 ? 'success' : 'warning',
            details: [
                { 
                    icon: 'fas fa-ruler-vertical', 
                    label: 'Kalınlık:', 
                    value: remnant.thickness_mm ? `${remnant.thickness_mm} mm` : 'N/A' 
                },
                { 
                    icon: 'fas fa-arrows-alt', 
                    label: 'Boyutlar:', 
                    value: remnant.dimensions || 'N/A' 
                },
                { 
                    icon: 'fas fa-cube', 
                    label: 'Malzeme:', 
                    value: remnant.material || 'N/A' 
                },
                { 
                    icon: 'fas fa-cubes', 
                    label: 'Adet:', 
                    value: remnant.quantity ? remnant.quantity.toString() : '0' 
                }
            ],
            itemsPerRow: 2,
            className: 'remnant-card'
        }));
        
        // Create card grid
        createCardGrid(gridContainer, cardsData, {
            columns: 3,
            gap: '1.5rem',
            className: 'fire-saclar-card-grid'
        });
        
    } catch (error) {
        console.error('Error loading remnant plates:', error);
        
        // Hide loading state
        loadingDiv.style.display = 'none';
        
        // Show error state
        errorMessage.textContent = error.message || 'Fire saclar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.';
        errorDiv.style.display = 'block';
    }
}

/**
 * Bind event listeners for the fire saclar view
 */
function bindFireSaclarEvents() {
    const toggleBtn = document.getElementById('toggle-form-btn');
    const formContainer = document.getElementById('fire-saclar-form-container');
    const form = document.getElementById('fire-saclar-entry-form');
    const cancelBtn = document.getElementById('fire-saclar-cancel-btn');
    const resetBtn = document.getElementById('fire-saclar-reset-btn');
    
    // Toggle form visibility
    if (toggleBtn && formContainer) {
        toggleBtn.addEventListener('click', () => {
            const computedStyle = window.getComputedStyle(formContainer);
            const isVisible = computedStyle.display !== 'none';
            
            formContainer.style.display = isVisible ? 'none' : 'block';
            
            const icon = toggleBtn.querySelector('i');
            const text = toggleBtn.querySelector('.toggle-form-text');
            
            if (isVisible) {
                icon.className = 'fas fa-plus me-2';
                text.textContent = 'Yeni Ekle';
            } else {
                icon.className = 'fas fa-times me-2';
                text.textContent = 'Kapat';
            }
        });
    }
    
    // Cancel button - hide form
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            formContainer.style.display = 'none';
            const icon = toggleBtn.querySelector('i');
            const text = toggleBtn.querySelector('.toggle-form-text');
            icon.className = 'fas fa-plus me-2';
            text.textContent = 'Yeni Ekle';
            hideFireSaclarMessage();
            if (form) form.reset();
        });
    }
    
    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            hideFireSaclarMessage();
        });
    }
    
    // Form submission
    if (form) {
        form.addEventListener('submit', handleFireSaclarFormSubmit);
    }
}

/**
 * Handle form submission
 */
async function handleFireSaclarFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('fire-saclar-submit-btn');
    const messageDiv = document.getElementById('fire-saclar-message');
    
    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Kaydediliyor...';
    
    // Hide previous messages
    hideFireSaclarMessage();
    
    try {
        // Get form data
        const formData = {
            thickness_mm: document.getElementById('fire-saclar-thickness_mm').value,
            dimensions: document.getElementById('fire-saclar-dimensions').value,
            quantity: parseInt(document.getElementById('fire-saclar-quantity').value),
            material: document.getElementById('fire-saclar-material').value
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
        showFireSaclarMessage('Fire sac plakası başarıyla kaydedildi!', 'success');
        
        // Reset form after a short delay
        setTimeout(() => {
            const form = document.getElementById('fire-saclar-entry-form');
            if (form) form.reset();
            hideFireSaclarMessage();
            
            // Hide form
            const formContainer = document.getElementById('fire-saclar-form-container');
            const toggleBtn = document.getElementById('toggle-form-btn');
            if (formContainer) formContainer.style.display = 'none';
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                const text = toggleBtn.querySelector('.toggle-form-text');
                icon.className = 'fas fa-plus me-2';
                text.textContent = 'Yeni Ekle';
            }
        }, 2000);
        
        // Reload remnants list
        setTimeout(() => {
            loadRemnantPlates();
        }, 1000);
        
    } catch (error) {
        console.error('Error creating remnant plate:', error);
        
        // Show error message
        const errorMessage = error.message || 'Fire sac plakası kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.';
        showFireSaclarMessage(errorMessage, 'error');
        
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Kaydet';
    }
}

/**
 * Show success or error message
 */
function showFireSaclarMessage(message, type) {
    const messageDiv = document.getElementById('fire-saclar-message');
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
            hideFireSaclarMessage();
        }, 5000);
    }
}

/**
 * Hide message
 */
function hideFireSaclarMessage() {
    const messageDiv = document.getElementById('fire-saclar-message');
    if (messageDiv) {
        messageDiv.style.display = 'none';
        messageDiv.innerHTML = '';
    }
}

