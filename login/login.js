// login/login.js
import { login, navigateTo, ROUTES, shouldBeOnLoginPage, navigateByTeam } from '../authService.js';
import { fetchUsers } from '../generic/users.js';
import { ModernDropdown } from '../components/dropdown.js';

// Enhanced error handling and display
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    if (errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.classList.remove('fade');
        errorMessage.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideError();
        }, 5000);
    }
}

function hideError() {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.classList.add('fade');
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 300);
    }
}

// Enhanced loading state management
function setLoadingState(isLoading, buttonId = 'login-button') {
    const loginButton = document.getElementById(buttonId);
    const btnText = loginButton?.querySelector('.btn-text');
    const btnLoading = loginButton?.querySelector('.btn-loading');
    
    if (loginButton && btnText && btnLoading) {
        if (isLoading) {
            loginButton.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            loginButton.disabled = false;
            btnText.style.display = 'flex';
            btnLoading.style.display = 'none';
        }
    }
}

// Initialize modern dropdown
let userDropdown = null;

function initializeUserDropdown(users) {
    const container = document.getElementById('user-dropdown-container');
    if (!container) {
        console.error('User dropdown container not found!');
        return;
    }

    // Create dropdown items from users
    const dropdownItems = users.map(user => ({
        value: user.username,
        text: user.first_name ? `${user.first_name} ${user.last_name}` : user.username
    }));

    // Initialize the dropdown
    userDropdown = new ModernDropdown(container, {
        placeholder: 'Kullanıcı seçiniz...',
        searchable: true,
        multiple: false,
        maxHeight: 250
    });

    // Set items
    userDropdown.setItems(dropdownItems);

    // Listen for selection events
    container.addEventListener('dropdown:select', (e) => {
        const selectedValue = e.detail.value;
        console.log('Selected user:', selectedValue);
    });
}

// Password toggle functionality
function setupPasswordToggle() {
    const toggleButton = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    
    if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            
            const icon = toggleButton.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            }
        });
    }
}

// Admin password toggle functionality
function setupAdminPasswordToggle() {
    const toggleButton = document.getElementById('admin-toggle-password');
    const passwordInput = document.getElementById('admin-password');
    
    if (toggleButton && passwordInput) {
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            
            const icon = toggleButton.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            }
        });
    }
}

// Enhanced form validation
function validateForm() {
    const selectedUser = userDropdown ? userDropdown.getValue() : null;
    const passwordInput = document.getElementById('password');
    
    if (!selectedUser) {
        showError('Lütfen bir kullanıcı seçin.');
        if (userDropdown) {
            userDropdown.dropdown.focus();
        }
        return false;
    }
    
    if (!passwordInput.value.trim()) {
        showError('Lütfen şifrenizi girin.');
        passwordInput.focus();
        return false;
    }
    
    return true;
}

// Admin form validation
function validateAdminForm() {
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    
    if (!usernameInput.value.trim()) {
        showError('Lütfen kullanıcı adınızı girin.');
        usernameInput.focus();
        return false;
    }
    
    if (!passwordInput.value.trim()) {
        showError('Lütfen şifrenizi girin.');
        passwordInput.focus();
        return false;
    }
    
    return true;
}

// Enhanced login process with better UX
async function handleLogin(username, password) {
    try {
        await login(username, password);
        const user = JSON.parse(localStorage.getItem('user'));
        
        // Add a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (user.must_reset_password) {
            navigateTo(ROUTES.RESET_PASSWORD);
        } else {
            navigateByTeam();
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Kullanıcı adı veya şifre hatalı. Lütfen tekrar deneyin.');
        setLoadingState(false);
    }
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user should be on this page
    if (!shouldBeOnLoginPage()) {
        navigateByTeam();
        return;
    }

    // Initialize password toggles
    setupPasswordToggle();
    setupAdminPasswordToggle();

    // Fetch and populate users
    try {
        const users = await fetchUsers();
        initializeUserDropdown(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        showError('Kullanıcı listesi yüklenirken hata oluştu.');
    }

    // Form submission handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Hide any existing errors
            hideError();
            
            // Validate form
            if (!validateForm()) {
                return;
            }
            
            const selectedUser = userDropdown ? userDropdown.getValue() : null;
            const passwordInput = document.getElementById('password');
            
            const username = selectedUser;
            const password = passwordInput.value;
            
            // Set loading state
            setLoadingState(true);
            
            // Attempt login
            await handleLogin(username, password);
        });
    }

    // Admin login button handler
    const adminLoginBtn = document.getElementById('admin-login-btn');
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
            modal.show();
        });
    }

    // Admin form submission handler
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Hide any existing errors
            hideError();
            
            // Validate form
            if (!validateAdminForm()) {
                return;
            }
            
            const usernameInput = document.getElementById('admin-username');
            const passwordInput = document.getElementById('admin-password');
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            
            // Set loading state
            setLoadingState(true, 'admin-login-button');
            
            try {
                await handleLogin(username, password);
            } catch (error) {
                setLoadingState(false, 'admin-login-button');
            }
        });
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.target.matches('input')) {
            const loginButton = document.getElementById('login-button');
            if (loginButton && !loginButton.disabled) {
                loginButton.click();
            }
        }
    });
});
