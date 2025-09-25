import { guardRoute, isAdmin, getUser, navigateByTeamIfFreshLogin } from './authService.js';
import { initNavbar } from './components/navbar.js';
import { TimerWidget } from './components/timerWidget.js';

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

        // Highlight user's team module
        if (user.team) {
            const teamCard = document.getElementById(`${user.team}-card`);
            if (teamCard) {
                teamCard.classList.add('user-team-card');
            }
        }

        // Only redirect on fresh logins, not manual navigation
        if (user.team && !isAdmin()) {
            navigateByTeamIfFreshLogin();
        }

    } catch (error) {
        console.error('Error handling landing page:', error);
    }
}