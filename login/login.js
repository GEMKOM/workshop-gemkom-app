// login/login.js
import { login, navigateTo, ROUTES, shouldBeOnLoginPage, navigateByTeamIfFreshLogin, forgotPassword } from '../authService.js';
import { fetchUsers } from '../generic/users.js';
import { ModernDropdown } from '../components/dropdown/dropdown.js';

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
let currentMode = 'dropdown'; // 'dropdown' or 'manual'

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

// Toggle between dropdown and manual entry modes
function setupModeToggle() {
    const dropdownModeBtn = document.getElementById('dropdown-mode-btn');
    const manualModeBtn = document.getElementById('manual-mode-btn');
    const dropdownMode = document.getElementById('dropdown-mode');
    const manualMode = document.getElementById('manual-mode');
    
    if (dropdownModeBtn && manualModeBtn && dropdownMode && manualMode) {
        dropdownModeBtn.addEventListener('click', () => {
            currentMode = 'dropdown';
            dropdownModeBtn.classList.add('active');
            manualModeBtn.classList.remove('active');
            dropdownMode.style.display = 'block';
            manualMode.style.display = 'none';
            
            // Clear manual input
            const manualInput = document.getElementById('manual-username');
            if (manualInput) {
                manualInput.value = '';
            }
        });
        
        manualModeBtn.addEventListener('click', () => {
            currentMode = 'manual';
            manualModeBtn.classList.add('active');
            dropdownModeBtn.classList.remove('active');
            manualMode.style.display = 'block';
            dropdownMode.style.display = 'none';
            
            // Clear dropdown selection
            if (userDropdown) {
                userDropdown.setValue(null);
            }
        });
    }
}

// Enhanced form validation
function validateForm() {
    const passwordInput = document.getElementById('password');
    let username = null;
    
    if (currentMode === 'dropdown') {
        username = userDropdown ? userDropdown.getValue() : null;
        if (!username) {
            showError('Lütfen bir kullanıcı seçin.');
            if (userDropdown) {
                userDropdown.dropdown.focus();
            }
            return false;
        }
    } else if (currentMode === 'manual') {
        const manualInput = document.getElementById('manual-username');
        username = manualInput ? manualInput.value.trim() : null;
        if (!username) {
            showError('Lütfen kullanıcı adınızı girin.');
            if (manualInput) {
                manualInput.focus();
            }
            return false;
        }
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
            navigateByTeamIfFreshLogin();
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Kullanıcı adı veya şifre hatalı. Lütfen tekrar deneyin.');
        setLoadingState(false);
    }
}

// Enhanced user fetching with retry mechanism
async function fetchUsersWithRetry(maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Fetching users (attempt ${attempt}/${maxRetries})`);
            const users = await fetchUsers();
            
            if (users && users.length > 0) {
                console.log(`Successfully fetched ${users.length} users`);
                return users;
            } else {
                console.warn(`No users returned (attempt ${attempt}/${maxRetries})`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        } catch (error) {
            console.error(`Error fetching users (attempt ${attempt}/${maxRetries}):`, error);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            } else {
                throw error;
            }
        }
    }
    throw new Error('Failed to fetch users after all retry attempts');
}

// Enhanced dropdown initialization with loading state
function showDropdownLoading() {
    const container = document.getElementById('user-dropdown-container');
    if (container) {
        container.innerHTML = `
            <div class="dropdown-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Kullanıcılar yükleniyor...</span>
            </div>
        `;
    }
}

function hideDropdownLoading() {
    const container = document.getElementById('user-dropdown-container');
    if (container) {
        const loadingElement = container.querySelector('.dropdown-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// Forgot password functionality
function showForgotPasswordError(message) {
    const errorElement = document.getElementById('forgot-password-error');
    const errorText = document.getElementById('forgot-password-error-text');
    const successElement = document.getElementById('forgot-password-success');
    
    if (errorElement && errorText) {
        // Hide success message if visible
        if (successElement) {
            successElement.style.display = 'none';
        }
        
        errorText.textContent = message;
        errorElement.style.display = 'flex';
        errorElement.classList.remove('fade');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideForgotPasswordError();
        }, 5000);
    }
}

function hideForgotPasswordError() {
    const errorElement = document.getElementById('forgot-password-error');
    if (errorElement) {
        errorElement.classList.add('fade');
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 300);
    }
}

function showForgotPasswordSuccess(message) {
    const successElement = document.getElementById('forgot-password-success');
    const successText = document.getElementById('forgot-password-success-text');
    const errorElement = document.getElementById('forgot-password-error');
    
    if (successElement && successText) {
        // Hide error message if visible
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        successText.textContent = message;
        successElement.style.display = 'flex';
        successElement.classList.remove('fade');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideForgotPasswordSuccess();
        }, 5000);
    }
}

function hideForgotPasswordSuccess() {
    const successElement = document.getElementById('forgot-password-success');
    if (successElement) {
        successElement.classList.add('fade');
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 300);
    }
}

function setForgotPasswordLoadingState(isLoading) {
    const submitButton = document.getElementById('forgot-password-submit');
    const btnText = submitButton?.querySelector('.btn-text');
    const btnLoading = submitButton?.querySelector('.btn-loading');
    
    if (submitButton && btnText && btnLoading) {
        if (isLoading) {
            submitButton.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            submitButton.disabled = false;
            btnText.style.display = 'flex';
            btnLoading.style.display = 'none';
        }
    }
}

async function handleForgotPassword(username) {
    try {
        const response = await forgotPassword(username);
        
        if (response.ok) {
            showForgotPasswordSuccess('Şifre sıfırlama isteğiniz yöneticinize iletildi.');
            // Clear the form
            document.getElementById('forgot-username').value = '';
            // Close modal after a delay
            setTimeout(() => {
                const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('forgotPasswordModal'));
                modal.hide();
            }, 2000);
        } else {
            showForgotPasswordSuccess('Şifre sıfırlama isteğiniz yöneticinize iletildi.');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showForgotPasswordError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
        setForgotPasswordLoadingState(false);
    }
}

function setupForgotPasswordModal() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotPasswordSubmit = document.getElementById('forgot-password-submit');
    
    // Open modal when link is clicked
    if (forgotPasswordLink && forgotPasswordModal) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = bootstrap.Modal.getOrCreateInstance(forgotPasswordModal);
            modal.show();
        });
    }
    
    // Handle form submission
    if (forgotPasswordForm && forgotPasswordSubmit) {
        forgotPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleForgotPasswordSubmit();
        });
        
        forgotPasswordSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            handleForgotPasswordSubmit();
        });
    }
    
    // Clear form when modal is hidden
    if (forgotPasswordModal) {
        forgotPasswordModal.addEventListener('hidden.bs.modal', () => {
            forgotPasswordForm.reset();
            hideForgotPasswordError();
            hideForgotPasswordSuccess();
        });
    }
}

function handleForgotPasswordSubmit() {
    const usernameInput = document.getElementById('forgot-username');
    const username = usernameInput.value.trim();
    
    // Hide any existing messages
    hideForgotPasswordError();
    hideForgotPasswordSuccess();
    
    // Validate input
    if (!username) {
        showForgotPasswordError('Lütfen kullanıcı adınızı girin.');
        usernameInput.focus();
        return;
    }
    
    // Set loading state
    setForgotPasswordLoadingState(true);
    
    // Submit request
    handleForgotPassword(username);
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user should be on this page
    if (!shouldBeOnLoginPage()) {
        navigateByTeamIfFreshLogin();
        return;
    }

    // Initialize password toggles
    setupPasswordToggle();
    setupAdminPasswordToggle();
    
    // Initialize mode toggle
    setupModeToggle();
    
    // Initialize forgot password modal
    setupForgotPasswordModal();

    // Show loading state for dropdown
    showDropdownLoading();

    // Fetch and populate users with retry mechanism
    try {
        const users = await fetchUsersWithRetry();
        hideDropdownLoading();
        initializeUserDropdown(users);
    } catch (error) {
        console.error('Error fetching users after retries:', error);
        hideDropdownLoading();
        
        // Show specific error message based on error type
        let errorMessage = 'Kullanıcı listesi yüklenirken hata oluştu.';
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edin.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Bağlantı zaman aşımı. Lütfen tekrar deneyin.';
        }
        
        showError(errorMessage);
        
        // Show retry button and auto-switch to manual mode
        const container = document.getElementById('user-dropdown-container');
        if (container) {
            container.innerHTML = `
                <div class="dropdown-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Kullanıcı listesi yüklenemedi</span>
                    <div class="mt-2">
                        <button type="button" class="btn btn-outline-primary btn-sm me-2" id="retry-users-btn">
                            <i class="fas fa-redo"></i> Tekrar Dene
                        </button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="switch-to-manual-btn">
                            <i class="fas fa-keyboard"></i> Manuel Giriş
                        </button>
                    </div>
                </div>
            `;
            
            // Add retry functionality
            const retryBtn = document.getElementById('retry-users-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', async () => {
                    showDropdownLoading();
                    try {
                        const users = await fetchUsersWithRetry();
                        hideDropdownLoading();
                        initializeUserDropdown(users);
                    } catch (retryError) {
                        hideDropdownLoading();
                        showError('Tekrar deneme başarısız. Manuel giriş kullanabilirsiniz.');
                    }
                });
            }
            
            // Add switch to manual mode functionality
            const switchToManualBtn = document.getElementById('switch-to-manual-btn');
            if (switchToManualBtn) {
                switchToManualBtn.addEventListener('click', () => {
                    // Switch to manual mode
                    const manualModeBtn = document.getElementById('manual-mode-btn');
                    if (manualModeBtn) {
                        manualModeBtn.click();
                    }
                });
            }
        }
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
            
            const passwordInput = document.getElementById('password');
            let username = null;
            
            if (currentMode === 'dropdown') {
                username = userDropdown ? userDropdown.getValue() : null;
            } else if (currentMode === 'manual') {
                const manualInput = document.getElementById('manual-username');
                username = manualInput ? manualInput.value.trim() : null;
            }
            
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
