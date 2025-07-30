// --- machining.js ---
import { initNavbar } from '../components/navbar.js';
import { loadActiveTimersContent } from './activeTimers.js';
import { loadFinishedTimersContent } from './finishedTimers.js';

// ============================================================================
// TAB NAVIGATION SETUP
// ============================================================================

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active state
            updateTabActiveState(button);
            
            // Load appropriate content
            loadTabContent(targetTab);
        });
    });
}

function updateTabActiveState(activeButton) {
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    activeButton.classList.add('active');
}

function loadTabContent(tabName) {
    if (tabName === 'active-timers') {
        // Load active timers content
        loadActiveTimersContent();
    } else if (tabName === 'finished-timers') {
        // Load finished timers content
        loadFinishedTimersContent();
    }
}

// ============================================================================
// REFRESH BUTTON SETUP
// ============================================================================

function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab) {
                const tabName = activeTab.getAttribute('data-tab');
                loadTabContent(tabName);
            }
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize navbar
    initNavbar();
    
    // Setup tab navigation
    setupTabNavigation();
    
    // Load initial content (active timers)
    loadTabContent('active-timers');
    
    // Setup refresh button
    setupRefreshButton();
});

// Add any utility functions here if needed