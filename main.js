import { guardRoute, hasPermission } from './authService.js';
import { initNavbar } from './components/navbar.js';
import { MenuComponent } from './components/menu/menu.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) {
        return;
    }

    initNavbar();

    // Timer widget initialization is handled by timerWidgetInit.js script
    const user = JSON.parse(localStorage.getItem('user'));
    setupHomeMenu(user);

});


function setupHomeMenu(user) {
    // Define all available cards
    const allCards = [
        {
            title: 'Talaşlı İmalat',
            description: 'Makine görevlerini yönetin, zamanlayıcıları kullanın ve üretim süreçlerini takip edin.',
            icon: 'fas fa-cogs',
            iconColor: 'primary',
            link: 'machining/',
            features: [],
            requiredPermission: 'access_machining'
        },
        {
            title: 'CNC Kesim',
            description: 'CNC kesim görevlerini yönetin, zamanlayıcıları kullanın ve kesim süreçlerini takip edin.',
            icon: 'fas fa-cut',
            iconColor: 'danger',
            link: 'cnc_cutting/',
            features: [],
            requiredPermission: 'access_cnc_cutting'
        },
        {
            title: 'Depo',
            description: 'Stok takibi, malzeme yönetimi ve envanter işlemlerini gerçekleştirin.',
            icon: 'fas fa-warehouse',
            iconColor: 'warning',
            link: 'warehouse/',
            features: [],
            requiredPermission: 'access_warehouse'
        },
        {
            title: 'Bakım',
            description: 'Bakım taleplerini yönetin, planlı bakımları takip edin ve ekipman durumlarını izleyin.',
            icon: 'fas fa-tools',
            iconColor: 'success',
            link: 'maintenance/',
            features: [
                {
                    label: 'Yeni Talep Oluştur',
                    icon: 'fas fa-calendar',
                    iconColor: 'rgba(139, 0, 0, 1)',
                    link: 'maintenance/?tab=create-request'
                },
                {
                    label: 'Bakım Talepleri',
                    icon: 'fas fa-wrench',
                    iconColor: 'rgba(139, 0, 0, 1)',
                    link: 'maintenance/?tab=fault-requests'
                }
            ],
            requiredPermission: 'access_maintenance'
        }
    ];
    
    // Filter cards by permission map from /users/me/permissions/
    const visibleCards = allCards.filter(card => {
        return hasPermission(card.requiredPermission);
    });
    
    // Create menu config with filtered cards
    const menuConfig = {
        title: 'Çalışma Alanları',
        subtitle: 'Yetkinize gore ilgili alani secin',
        cards: visibleCards.map(card => {
            const { requiredPermission, ...cardWithoutVisibility } = card;
            return cardWithoutVisibility;
        })
    };
    
    const menu = new MenuComponent('menu-placeholder', menuConfig);
    menu.render();
}