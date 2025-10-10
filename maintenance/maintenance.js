import { initNavbar } from '../components/navbar.js';
import { guardRoute } from '../authService.js';
import { HeaderComponent } from '../components/header/header.js';
import { MenuComponent } from '../components/menu/menu.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!guardRoute()) {
        return;
    }
    
    initNavbar();
    setupMenu();
});

// ============================================================================
// LANDING PAGE SETUP
// ============================================================================


function setupMenu() {
    const menuConfig = {
        title: 'Bakım Yönetimi',
        subtitle: 'Bakım süreçlerinizi yönetmek için aşağıdaki seçeneklerden birini seçin',
        cards: [
            {
                title: 'Yeni Talep Oluştur',
                description: 'Yeni bir bakım veya arıza talebi oluşturun. Detaylı bilgi vererek daha hızlı çözüm sağlayabilirsiniz.',
                icon: 'fas fa-plus-circle',
                iconColor: 'success',
                link: 'create/',
                features: []
            },
            {
                title: 'Bakım Talepleri',
                description: 'Mevcut bakım ve arıza taleplerini görüntüleyin, filtreleyin ve yönetin. Sistemdeki tüm talepleri tek yerden takip edebilirsiniz.',
                icon: 'fas fa-list',
                iconColor: 'primary',
                link: 'list/',
                features: []
            }
        ]
    };
    
    const menu = new MenuComponent('menu-placeholder', menuConfig);
    menu.render();
}