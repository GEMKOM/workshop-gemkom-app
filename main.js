import { guardRoute, isAdmin } from './authService.js';
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
            // Only visible to machining team or admins
            visibleTo: ['machining', 'admin']
        },
        {
            title: 'CNC Kesim',
            description: 'CNC kesim görevlerini yönetin, zamanlayıcıları kullanın ve kesim süreçlerini takip edin.',
            icon: 'fas fa-cut',
            iconColor: 'danger',
            link: 'cnc_cutting/',
            features: [],
            // Only visible to cutting team or admins
            visibleTo: ['cutting', 'admin', 'planning']
        },
        {
            title: 'Depo',
            description: 'Stok takibi, malzeme yönetimi ve envanter işlemlerini gerçekleştirin.',
            icon: 'fas fa-warehouse',
            iconColor: 'warning',
            link: 'warehouse/',
            features: [],
            // Only visible to warehouse team or admins
            visibleTo: ['warehouse', 'admin', 'planning']
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
                    link: 'maintenance/create'
                },
                {
                    label: 'Bakım Talepleri',
                    icon: 'fas fa-wrench',
                    iconColor: 'rgba(139, 0, 0, 1)',
                    link: 'maintenance/list'
                }
            ],
            // Visible to all users
            visibleTo: ['all']
        }
    ];
    
    // Filter cards based on user permissions
    const visibleCards = allCards.filter(card => {
        // If user is admin, show all cards
        if (isAdmin()) {
            return true;
        }
        
        // If card is visible to all users
        if (card.visibleTo.includes('all')) {
            return true;
        }
        
        // If user has a team and card is visible to that team
        if (user.team && card.visibleTo.includes(user.team)) {
            return true;
        }
        
        // Otherwise, hide the card
        return false;
    });
    
    // Create menu config with filtered cards
    const menuConfig = {
        title: 'Çalışma Alanları',
        subtitle: 'Takımınıza göre ilgili alanı seçin',
        cards: visibleCards.map(card => {
            // Remove the visibleTo property before passing to MenuComponent
            const { visibleTo, ...cardWithoutVisibility } = card;
            return cardWithoutVisibility;
        })
    };
    
    const menu = new MenuComponent('menu-placeholder', menuConfig);
    menu.render();
}