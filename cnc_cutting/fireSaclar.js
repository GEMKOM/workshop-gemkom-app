// --- fireSaclar.js ---
// Fire Saclar tab functionality - Display remnant plates using genericCard component

import { getRemnantPlates } from '../generic/cncCutting.js';
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
                        <p class="section-subtitle">Stoktaki fire saclar. Yeni fire sac, kesim bitirilirken girilir.</p>
                    </div>
                </div>
            </div>
            
            <!-- Filters Section -->
            <div class="filters-section">
                <div class="section-header">
                    <h4 class="section-title">
                        <i class="fas fa-filter me-2"></i>
                        Filtreler
                    </h4>
                    <button type="button" class="btn btn-link p-0 filter-toggle" id="fire-saclar-filter-toggle">
                        <i class="fas fa-chevron-down me-1"></i>Filtreleri Göster
                    </button>
                </div>
                
                <div class="filter-content" id="fire-saclar-filter-content" style="display: none;">
                    <div class="filters-grid">
                        <div class="filter-group">
                            <label class="filter-label">
                                <i class="fas fa-cube me-2"></i>Malzeme
                            </label>
                            <input 
                                type="text" 
                                id="filter-material" 
                                class="form-control" 
                                placeholder="Malzeme ara (örn: S235JR)"
                            >
                        </div>
                        
                        <div class="filter-group">
                            <label class="filter-label">
                                <i class="fas fa-ruler-vertical me-2"></i>Kalınlık (mm)
                            </label>
                            <input 
                                type="number" 
                                id="filter-thickness_mm" 
                                class="form-control" 
                                step="0.01" 
                                min="0" 
                                placeholder="Kalınlık ara (örn: 10.00)"
                            >
                        </div>
                        
                        <div class="filter-group">
                            <label class="filter-label">
                                <i class="fas fa-arrows-alt me-2"></i>Boyutlar
                            </label>
                            <input 
                                type="text" 
                                id="filter-dimensions" 
                                class="form-control" 
                                placeholder="Boyut ara (örn: 1200x800)"
                            >
                        </div>
                    </div>
                    <div class="filter-actions">
                        <button type="button" class="btn btn-primary" id="fire-saclar-apply-filters">
                            <i class="fas fa-search me-2"></i>Filtrele
                        </button>
                        <button type="button" class="btn btn-outline-secondary" id="fire-saclar-clear-filters">
                            <i class="fas fa-times me-2"></i>Temizle
                        </button>
                    </div>
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
 * @param {Object} filterParams - Optional filter parameters to send to backend
 */
async function loadRemnantPlates(filterParams = null) {
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
        // Fetch remnant plates with filter parameters (backend filtering)
        const data = await getRemnantPlates(filterParams);
        
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
    // Filter toggle
    const filterToggle = document.getElementById('fire-saclar-filter-toggle');
    const filterContent = document.getElementById('fire-saclar-filter-content');
    
    if (filterToggle && filterContent) {
        filterToggle.addEventListener('click', () => {
            const isVisible = filterContent.style.display !== 'none';
            filterContent.style.display = isVisible ? 'none' : 'block';
            
            const icon = filterToggle.querySelector('i');
            if (isVisible) {
                icon.className = 'fas fa-chevron-down me-1';
                filterToggle.innerHTML = '<i class="fas fa-chevron-down me-1"></i>Filtreleri Göster';
            } else {
                icon.className = 'fas fa-chevron-up me-1';
                filterToggle.innerHTML = '<i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle';
            }
        });
    }
    
    // Apply filters button - triggers backend request with filter parameters
    const applyFiltersBtn = document.getElementById('fire-saclar-apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('fire-saclar-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    // Filter inputs - apply on Enter key
    const filterInputs = ['filter-material', 'filter-thickness_mm', 'filter-dimensions'];
    filterInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
    });
}

/**
 * Apply filters - sends filter parameters to backend
 * NOTE: All filtering is handled by the backend API
 */
function applyFilters() {
    // Collect filter values from inputs
    const materialFilter = document.getElementById('filter-material')?.value.trim() || '';
    const thicknessFilter = document.getElementById('filter-thickness_mm')?.value.trim() || '';
    const dimensionsFilter = document.getElementById('filter-dimensions')?.value.trim() || '';
    
    // Build filter parameters object for backend
    const filterParams = {};
    
    if (materialFilter) {
        filterParams.material = materialFilter;
    }
    
    if (thicknessFilter) {
        const thicknessValue = parseFloat(thicknessFilter);
        if (!isNaN(thicknessValue)) {
            filterParams.thickness_mm = thicknessValue;
        }
    }
    
    if (dimensionsFilter) {
        filterParams.dimensions = dimensionsFilter;
    }
    
    // Reload remnants with backend filtering
    loadRemnantPlates(filterParams);
}

/**
 * Clear all filters and reload all remnants
 */
function clearFilters() {
    const materialInput = document.getElementById('filter-material');
    const thicknessInput = document.getElementById('filter-thickness_mm');
    const dimensionsInput = document.getElementById('filter-dimensions');
    
    if (materialInput) materialInput.value = '';
    if (thicknessInput) thicknessInput.value = '';
    if (dimensionsInput) dimensionsInput.value = '';
    
    // Reload all remnants without filters
    loadRemnantPlates();
}