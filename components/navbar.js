import { logout, isAdmin, isLoggedIn, getUser, navigateTo, ROUTES } from '../authService.js';
import { backendBase } from '../base.js';
import { authedFetch } from '../authService.js';

// Navbar component
export function createNavbar() {
    const navbar = document.createElement('nav');
    navbar.className = 'navbar navbar-expand-lg navbar-dark bg-dark';
    navbar.innerHTML = `
        <div class="container">
            <a class="navbar-brand" href="/">GEMKOM</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav">
                    <li class="nav-item">
                        <a class="nav-link" href="/">Ana Sayfa</a>
                    </li>
                    <li class="nav-item admin-only" style="display: none;">
                        <a class="nav-link" href="/admin">Admin</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/maintenance">Bakım</a>
                    </li>
                    <li class="nav-item machining-only" style="display: none;">
                        <a class="nav-link" href="/machining">Talaşlı İmalat</a>
                    </li>
                </ul>
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <button id="logout-button" class="nav-link">Çıkış</button>
                    </li>
                </ul>
            </div>
        </div>
    `;

    // Add active class to current page link
    const currentPath = window.location.pathname;
    const navLinks = navbar.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Add click handlers for navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Allow home page and login page without authentication
            if (link.getAttribute('href') === '/' || link.getAttribute('href') === '/login') {
                return;
            }

            // Check if user is logged in
            if (!isLoggedIn()) {
                e.preventDefault();
                navigateTo(ROUTES.LOGIN);
            }
        });
    });

    // Show admin tab if user is admin (sync)
    const adminTab = navbar.querySelector('.admin-only');
    if (isAdmin()) {
        adminTab.style.display = 'block';
    } else {
        adminTab.style.display = 'none';
    }
    
    // Show machining tab if user is machining team or admin
    const machiningTab = navbar.querySelector('.machining-only');
    const user = JSON.parse(localStorage.getItem('user'));
    if (isAdmin() || (user && user.team === 'machining')) {
        machiningTab.style.display = 'block';
    } else {
        machiningTab.style.display = 'none';
    }

    return navbar;
}

// Helper to create user modal
function createUserEditModal(user) {
    let modal = document.getElementById('user-edit-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'user-edit-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.4)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
      <div style="background:#fff;padding:2rem;border-radius:8px;min-width:320px;max-width:90vw;box-shadow:0 2px 16px #0002;position:relative;">
        <button id="user-edit-close" style="position:absolute;top:8px;right:8px;font-size:1.2rem;background:none;border:none;">&times;</button>
        <h5>Kullanıcı Bilgileri</h5>
        <form id="user-edit-form">
          <div class="mb-2">
            <label>Ad</label>
            <input type="text" class="form-control" id="user-edit-firstname" value="${user.first_name||''}" required />
          </div>
          <div class="mb-2">
            <label>Soyad</label>
            <input type="text" class="form-control" id="user-edit-lastname" value="${user.last_name||''}" required />
          </div>
          <div class="mb-2">
            <label>Email</label>
            <input type="email" class="form-control" id="user-edit-email" value="${user.email||''}" required />
          </div>
          <button type="submit" class="btn btn-primary w-100">Kaydet</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('user-edit-close').onclick = () => modal.remove();
    document.getElementById('user-edit-form').onsubmit = async (e) => {
      e.preventDefault();
      const first_name = document.getElementById('user-edit-firstname').value;
      const last_name = document.getElementById('user-edit-lastname').value;
      const email = document.getElementById('user-edit-email').value;
      try {
        const res = await authedFetch(`${backendBase}/users/me/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ first_name, last_name, email })
        });
        if (res.ok) {
          alert('Bilgiler güncellendi!');
          const user_data = await getUser();
          localStorage.setItem('user', JSON.stringify(user_data));
          modal.remove();
          window.location.reload();
        } else {
          alert('Güncelleme başarısız.');
        }
      } catch (err) {
        alert(err)
        alert('Sunucu hatası.');
      }
    };
}

// Function to initialize navbar
export function initNavbar() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) {
      return;
    }

    async function renderNavbar() {
      let user = null;
      try {
        const cached = localStorage.getItem('user');
        if (cached) {
          user = JSON.parse(cached);
        } else {
          user = await getUser();
          localStorage.setItem('user', JSON.stringify(user));
        }
      } catch (e) {
        user = await getUser();
        localStorage.setItem('user', JSON.stringify(user));
      }
      const username = user.username || user.email || 'Kullanıcı';
      const userIconHTML = `
        <div id="navbar-user-icon" style="cursor:pointer;display:flex;align-items:center;gap:0.5rem;margin-right:2rem;">
          <span style="font-size:1.5rem;color:#ffc107;">👤</span>
          <span id="navbar-username" style="font-weight:500;color:#fff;">${username}</span>
        </div>
      `;
      const navHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
            <div class="container-fluid">
                <a class="navbar-brand" href="/">
                    <img src="/images/gemkom.png" alt="Gemkom Logo" style="height: 30px;">
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                        <li class="nav-item machining-only" style="display: none;">
                            <a class="nav-link" href="/machining">Talaşlı İmalat</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/maintenance">Bakım</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/procurement">Satın Alma</a>
                        </li>
                        <li class="nav-item admin-only" style="display: none;">
                            <a class="nav-link" href="/admin">Admin</a>
                        </li>
                    </ul>
                    <ul class="navbar-nav ms-auto align-items-center">
                        <li class="nav-item">
                          <div id="navbar-user-icon" style="cursor:pointer;display:flex;align-items:center;gap:0.5rem;margin-right:2rem;">
                            <span style="font-size:1.5rem;color:#ffc107;">👤</span>
                            <span id="navbar-username" style="font-weight:500;color:#fff;">${username}</span>
                          </div>
                        </li>
                        <li class="nav-item ms-2">
                            <button id="logout-button" class="btn btn-danger">Çıkış Yap</button>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
      `;
      navbarContainer.innerHTML = navHTML;
      document.getElementById('navbar-user-icon').onclick = () => createUserEditModal(user);

      const logoutButton = document.getElementById('logout-button');
      if (logoutButton) {
          logoutButton.addEventListener('click', () => {
              logout();
          });
      }
      // Highlight active page
      const links = navbarContainer.querySelectorAll('.nav-link');
      const currentPath = window.location.pathname;
      links.forEach(link => {
          if (link.getAttribute('href') === currentPath) {
              link.classList.add('active');
          }
      });
      // Show admin tab if user is admin (sync)
      const adminTab = navbarContainer.querySelector('.admin-only');
      if (isAdmin()) {
          adminTab.style.display = 'block';
      } else {
          adminTab.style.display = 'none';
      }
      
      // Show machining tab if user is machining team or admin
      const machiningTab = navbarContainer.querySelector('.machining-only');
      if (isAdmin() || user.team === 'machining') {
          machiningTab.style.display = 'block';
      } else {
          machiningTab.style.display = 'none';
      }
    }
    renderNavbar();
}

export function setupLogoutButton() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.onclick = () => {
            localStorage.clear();
            navigateTo(ROUTES.LOGIN);
        };
    }
}