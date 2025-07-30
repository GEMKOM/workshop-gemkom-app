import { isAdmin, navigateTo, ROUTES, logout } from './authService.js';

// Define available modules
const MODULES = [
    {
        id: 'machining',
        title: 'İşleme',
        description: 'Makine işleme modülü',
        icon: '🔧',
        route: ROUTES.MACHINING,
        color: 'primary'
    },
    {
        id: 'maintenance',
        title: 'Bakım',
        description: 'Bakım ve onarım modülü',
        icon: '🛠️',
        route: ROUTES.MAINTENANCE,
        color: 'success'
    },
    {
        id: 'planning',
        title: 'Planlama',
        description: 'Üretim planlama modülü',
        icon: '📋',
        route: ROUTES.HOME, // No specific route yet
        color: 'info'
    },
    {
        id: 'warehouse',
        title: 'Depo',
        description: 'Depo yönetimi modülü',
        icon: '📦',
        route: ROUTES.HOME, // No specific route yet
        color: 'warning'
    },
    {
        id: 'cutting',
        title: 'Kesme',
        description: 'Kesme işlemleri modülü',
        icon: '✂️',
        route: ROUTES.HOME, // No specific route yet
        color: 'danger'
    },
    {
        id: 'manufacturing',
        title: 'Üretim',
        description: 'Üretim süreçleri modülü',
        icon: '🏭',
        route: ROUTES.HOME, // No specific route yet
        color: 'secondary'
    },
    {
        id: 'welding',
        title: 'Kaynak',
        description: 'Kaynak işlemleri modülü',
        icon: '🔥',
        route: ROUTES.HOME, // No specific route yet
        color: 'dark'
    }
];

function populateUserInfo() {
    const user = JSON.parse(localStorage.getItem('user'));
    const userNameElement = document.getElementById('user-name');
    
    if (user && userNameElement) {
        const displayName = user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`
            : user.username || 'Kullanıcı';
        userNameElement.textContent = displayName;
    }
}

function handleLogout() {
    logout();
}

// Make logout function globally available
window.logout = handleLogout;

function createModuleCard(module) {
    const isAdminUser = isAdmin();
    const cardClass = isAdminUser ? 'module-card clickable' : 'module-card disabled';
    const cursorClass = isAdminUser ? 'cursor-pointer' : 'cursor-not-allowed';
    
    return `
        <div class="col-lg-4 col-md-6 col-sm-12">
            <div class="card ${cardClass} ${cursorClass} h-100" 
                 data-module-id="${module.id}" 
                 data-module-route="${module.route}">
                <div class="card-body text-center">
                    <div class="module-icon mb-3">
                        <span class="display-4">${module.icon}</span>
                    </div>
                    <h5 class="card-title">${module.title}</h5>
                    <p class="card-text">${module.description}</p>
                    ${!isAdminUser ? '<small class="text-muted">Sadece yöneticiler erişebilir</small>' : ''}
                </div>
                <div class="card-footer bg-transparent">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-${module.color}">${module.title}</span>
                        ${isAdminUser ? '<i class="fas fa-arrow-right text-muted"></i>' : '<i class="fas fa-lock text-muted"></i>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function handleModuleClick(event) {
    const card = event.currentTarget;
    const moduleId = card.dataset.moduleId;
    const moduleRoute = card.dataset.moduleRoute;
    
    if (!isAdmin()) {
        // Show a toast or alert for non-admin users
        showAccessDeniedMessage();
        return;
    }
    
    // Navigate to the module
    if (moduleRoute && moduleRoute !== ROUTES.HOME) {
        navigateTo(moduleRoute);
    } else {
        // For modules without specific routes, show a message
        showModuleNotAvailableMessage(moduleId);
    }
}

function showAccessDeniedMessage() {
    // Create a simple alert for now - could be replaced with a toast
    alert('Bu modüle erişim için yönetici yetkisi gereklidir.');
}

function showModuleNotAvailableMessage(moduleId) {
    alert(`${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} modülü henüz mevcut değil.`);
}

function initializeModules() {
    const container = document.getElementById('modules-container');
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create and append module cards
    MODULES.forEach(module => {
        const cardHTML = createModuleCard(module);
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
    
    // Add click event listeners
    const cards = document.querySelectorAll('.module-card');
    cards.forEach(card => {
        card.addEventListener('click', handleModuleClick);
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    populateUserInfo();
    initializeModules();
});

export { initializeModules }; 