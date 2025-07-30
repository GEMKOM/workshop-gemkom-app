import { guardRoute, navigateByTeam } from './authService.js';
import { initializeModules } from './homeModules.js';
import { createHeader, populateUserInfo } from './components/header.js';
import { createFooter } from './components/footer.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) {
        return;
    }
    
    // Insert header and footer
    const headerContainer = document.getElementById('header-container');
    const footerContainer = document.getElementById('footer-container');
    
    if (headerContainer) {
        headerContainer.innerHTML = createHeader();
    }
    
    if (footerContainer) {
        footerContainer.innerHTML = createFooter();
    }
    
    // Populate user info
    populateUserInfo();
    
    // Instead of showing navbar, redirect based on team
    navigateByTeam();
    
    // Initialize home page modules (only if we're on the home page)
    if (window.location.pathname === '/') {
        initializeModules();
    }
});