import { initNavbar } from '../components/navbar.js';
import { guardRoute } from '../authService.js';
import { mountMaintenanceCreate } from './create/create.js';
import { loadFaultRequestsTab } from './requests/faultRequestsTab.js';
import { loadResolvedRequestsTab } from './requests/resolvedRequestsTab.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!guardRoute()) {
        return;
    }
    
    initNavbar();
    setupTabNavigation();
    loadInitialTab();
    setupRefreshButton();
});

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            updateTabActiveState(button);
            setTabInUrl(targetTab);
            loadTabContent(targetTab);
        });
    });
}

function updateTabActiveState(activeButton) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    activeButton.classList.add('active');
}

function setTabInUrl(tabName) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url.toString());
}

function getTabFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab');
}

function loadInitialTab() {
    const tabFromUrl = getTabFromUrl();
    const initialTab = tabFromUrl || 'create-request';
    const initialBtn = document.querySelector(`.tab-button[data-tab="${initialTab}"]`);
    if (initialBtn) {
        updateTabActiveState(initialBtn);
    }
    loadTabContent(initialTab);
}

function loadTabContent(tabName) {
    if (tabName === 'create-request') {
        mountMaintenanceCreate({
            headerContainerId: null, // tabs already have a page header
            contentContainerId: 'main-view',
            showBackButton: false
        });
    } else if (tabName === 'fault-requests') {
        loadFaultRequestsTab({ containerId: 'main-view' });
    } else if (tabName === 'resolved-requests') {
        loadResolvedRequestsTab({ containerId: 'main-view' });
    }
}

// ============================================================================
// REFRESH BUTTON
// ============================================================================

function setupRefreshButton() {
    // eslint-disable-next-line no-undef
    new RefreshButton('refresh-btn-container', {
        onRefresh: async () => {
            const activeTab = document.querySelector('.tab-button.active');
            const tabName = activeTab ? activeTab.getAttribute('data-tab') : 'create-request';
            loadTabContent(tabName);
        }
    });
}