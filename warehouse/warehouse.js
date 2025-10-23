// --- warehouse.js ---
import { initNavbar } from '../components/navbar.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();
    
    // Setup refresh button
    setupRefreshButton();
    
    // Load initial content
    loadWarehouseContent();
});

// ============================================================================
// REFRESH BUTTON SETUP
// ============================================================================

function setupRefreshButton() {
    const refreshButton = new RefreshButton('refresh-btn-container', {
        onRefresh: async () => {
            loadWarehouseContent();
        }
    });
}

// ============================================================================
// CONTENT LOADING
// ============================================================================

function loadWarehouseContent() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="warehouse-view">
            <div class="row g-4">
                <!-- Placeholder cards for future features -->
                <div class="col-md-6 col-lg-4">
                    <div class="feature-card">
                        <div class="feature-icon">
                            <i class="fas fa-boxes"></i>
                        </div>
                        <h5>Stok Takibi</h5>
                        <p class="text-muted">Malzeme ve ürün stoklarını takip edin</p>
                        <span class="badge bg-warning">Yakında</span>
                    </div>
                </div>
                
                <div class="col-md-6 col-lg-4">
                    <div class="feature-card">
                        <div class="feature-icon">
                            <i class="fas fa-dolly"></i>
                        </div>
                        <h5>Giriş/Çıkış</h5>
                        <p class="text-muted">Malzeme giriş ve çıkış işlemlerini yönetin</p>
                        <span class="badge bg-warning">Yakında</span>
                    </div>
                </div>
                
                <div class="col-md-6 col-lg-4">
                    <div class="feature-card">
                        <div class="feature-icon">
                            <i class="fas fa-clipboard-list"></i>
                        </div>
                        <h5>Envanter</h5>
                        <p class="text-muted">Envanter sayımı ve raporlama</p>
                        <span class="badge bg-warning">Yakında</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

