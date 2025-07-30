import { guardRoute, isAdmin, getUser, navigateByTeam } from './authService.js';
import { initNavbar } from './components/navbar.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) {
        return;
    }

    initNavbar();

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

        // Auto-redirect if user has a specific team (not admin)
        if (user.team && !isAdmin()) {
            // Add a small delay to show the landing page briefly
            setTimeout(() => {
                navigateByTeam();
            }, 2000);
        }

    } catch (error) {
        console.error('Error handling landing page:', error);
    }
}