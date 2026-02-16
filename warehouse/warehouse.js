// --- warehouse.js ---
import { initNavbar } from '../components/navbar.js';
import { MenuComponent } from '../components/menu/menu.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();
    
    // Load initial content
    loadWarehouseContent();
});


// ============================================================================
// CONTENT LOADING
// ============================================================================

function loadWarehouseContent() {
    const mainView = document.getElementById('main-view');
    
    // Define warehouse menu cards
    const warehouseCards = [
        {
            title: 'Stok Kontrol',
            description: 'Planlama taleplerine envanter tahsis edin ve stok kontrolü yapın',
            icon: 'fas fa-clipboard-check',
            iconColor: 'primary',
            link: 'inventory-allocation/',
            features: []
        },
        {
            title: 'Ağırlık Düşüşü',
            description: 'CNC kesim işlemlerinden kaynaklanan ağırlık düşüşlerini takip edin',
            icon: 'fas fa-weight-hanging',
            iconColor: 'info',
            link: 'weight-reduction/',
            features: []
        },
        {
            title: 'Malzeme Takibi',
            description: 'Planlama talebi öğelerini görüntüleyin ve teslim durumunu yönetin',
            icon: 'fas fa-boxes',
            iconColor: 'success',
            link: 'material-tracking/',
            features: []
        }
    ];
    
    // Create menu config
    const menuConfig = {
        title: 'Depo Yönetimi',
        subtitle: 'Stok takibi, malzeme yönetimi ve envanter işlemleri',
        cards: warehouseCards
    };
    
    // Create and render menu component
    const menu = new MenuComponent('main-view', menuConfig);
    menu.render();
}

