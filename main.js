import { guardRoute, isAdmin } from './authService.js';
import { initNavbar } from './components/navbar.js';
import { TimerWidget } from './components/timerWidget.js';
import { MenuComponent } from './components/menu/menu.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) {
        return;
    }

    initNavbar();

    // Initialize timer widget for machining team users only
    const user = JSON.parse(localStorage.getItem('user'));
    if (!isAdmin() && user && user.team === 'machining') {
        // Check if timer widget already exists
        if (!window.timerWidget) {
            console.log('Initializing timer widget on home page...');
            window.timerWidget = new TimerWidget();
            
            // Add global event listener for timer updates
            window.addEventListener('timerUpdated', async () => {
                if (window.timerWidget) {
                    await window.timerWidget.refreshTimerWidget();
                }
            });
        }
    }
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
            // Only visible to cnc_cutting team or admins
            visibleTo: ['cnc_cutting', 'admin']
        },
        {
            title: 'Depo',
            description: 'Stok takibi, malzeme yönetimi ve envanter işlemlerini gerçekleştirin.',
            icon: 'fas fa-warehouse',
            iconColor: 'warning',
            link: 'warehouse/',
            features: [],
            // Only visible to warehouse team or admins
            visibleTo: ['warehouse', 'admin']
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