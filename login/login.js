// login/login.js
import { login, navigateTo, ROUTES, shouldBeOnLoginPage, navigateByTeam } from '../authService.js';
import { fetchUsers } from '../generic/users.js';

function populateUserSelect(users) {
    const userSelect = document.getElementById('user-select');
    if (!userSelect) return;

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        option.textContent = user.first_name ? `${user.first_name} ${user.last_name}` : user.username;
        userSelect.appendChild(option);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user should be on this page
    if (!shouldBeOnLoginPage()) {
        navigateByTeam();
        return;
    }

    const loginForm = document.getElementById('login-form');
    const userSelect = document.getElementById('user-select');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');

    const users = await fetchUsers();
    populateUserSelect(users);
 

    // Handle user selection
    userSelect.addEventListener('change', () => {
        usernameInput.value = userSelect.value;
    });

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username) {
            errorMessage.textContent = 'Lütfen bir kullanıcı seçin.';
            errorMessage.style.display = 'block';
            return;
        }
        
        loginButton.disabled = true;
        loginButton.textContent = 'Giriş Yapılıyor...';
        errorMessage.style.display = 'none';

        try {
            await login(username, password);
            const user = JSON.parse(localStorage.getItem('user'));
            if (user.must_reset_password){
                navigateTo(ROUTES.RESET_PASSWORD);
            } else {
                navigateByTeam();
            }
        } catch (error) {
            errorMessage.textContent = 'Kullanıcı adı veya şifre hatalı.';
            errorMessage.style.display = 'block';
            loginButton.disabled = false;
            loginButton.textContent = 'Giriş Yap';
        }
    });
});
