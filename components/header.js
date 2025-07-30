// Header component for all pages
import { logout } from '../authService.js';

export function createHeader() {
    return `
        <header class="page-header">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <div class="brand-container">
                            <img src="../images/gemkom.png" alt="Gemkom Logo" class="brand-logo">
                            <h1 class="brand-title">GEMKOM</h1>
                        </div>
                    </div>
                    <div class="col-md-6 text-end">
                        <div class="user-info">
                            <span class="user-name" id="user-name">Kullanıcı</span>
                            <button class="btn btn-outline-light btn-sm ms-2" onclick="logout()">Çıkış</button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;
}

export function populateUserInfo() {
    const user = JSON.parse(localStorage.getItem('user'));
    const userNameElement = document.getElementById('user-name');
    
    if (user && userNameElement) {
        const displayName = user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`
            : user.username || 'Kullanıcı';
        userNameElement.textContent = displayName;
    }
}

export function handleLogout() {
    logout();
}

// Make logout function globally available
window.logout = handleLogout; 