import { guardRoute, isAdmin, getUser, navigateByTeamIfFreshLogin } from './authService.js';
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

    // Handle landing page specific logic
    if (window.location.pathname === '/') {
        await handleLandingPage();
    }
});

async function handleLandingPage() {
    try {
        const user = await getUser();
        
        // Setup the menu component
        setupHomeMenu(user);

        // Only redirect on fresh logins, not manual navigation
        if (user.team && !isAdmin()) {
            navigateByTeamIfFreshLogin();
        }

    } catch (error) {
        console.error('Error handling landing page:', error);
    }
}

function setupHomeMenu(user) {
    const menuConfig = {
        title: 'Çalışma Alanları',
        subtitle: 'Takımınıza göre ilgili alanı seçin',
        cards: [
            {
                title: 'Talaşlı İmalat',
                description: 'Makine görevlerini yönetin, zamanlayıcıları kullanın ve üretim süreçlerini takip edin.',
                icon: 'fas fa-cogs',
                iconColor: 'primary',
                link: 'machining/',
                features: []
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
                ]
            }
        ]
    };
    
    const menu = new MenuComponent('menu-placeholder', menuConfig);
    menu.render();
    
    // Highlight user's team module if they have one
    if (user.team) {
        highlightUserTeamCard(user.team);
    }
}

function highlightUserTeamCard(team) {
    // Add a small delay to ensure the menu is rendered
    setTimeout(() => {
        const teamCard = document.querySelector(`[onclick*="${team}"]`);
        if (teamCard) {
            teamCard.classList.add('user-team-card');
        }
    }, 100);
}