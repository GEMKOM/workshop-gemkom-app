class Sidebar {
    constructor(container) {
        this.container = container;
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'sidebar';
        this.toggleButton = document.createElement('div');
        this.toggleButton.className = 'sidebar-toggle';
        this.toggleButton.innerHTML = '&#9776;';
        this.sidebar.appendChild(this.toggleButton);
        this.list = document.createElement('ul');
        this.sidebar.appendChild(this.list);
        this.container.appendChild(this.sidebar);
        
        // Mobile-specific elements
        this.createMobileElements();
        
        // Event listeners
        this.setupEventListeners();
        
        // Check if mobile
        this.isMobile = window.innerWidth <= 768;
        this.updateMobileState();
        
        // Calculate and set navbar height (only if navbar exists)
        this.updateNavbarHeight();
        
        // Listen for window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            
            if (wasMobile !== this.isMobile) {
                this.updateMobileState();
            }
            
            // Update navbar height on resize (only if navbar exists)
            this.updateNavbarHeight();
        });
        
        // Listen for navbar collapse/expand events (only if navbar exists)
        this.setupNavbarListener();
    }
    
    createMobileElements() {
        // Create mobile navigation indicator
        this.mobileNavIndicator = document.createElement('div');
        this.mobileNavIndicator.className = 'mobile-nav-indicator';
        this.mobileNavIndicator.innerHTML = '&#9776;';
        this.mobileNavIndicator.style.display = 'none';
        document.body.appendChild(this.mobileNavIndicator);
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay';
        document.body.appendChild(this.overlay);
    }
    
    setupEventListeners() {
        // Desktop toggle
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isMobile) {
                this.toggleMobileSidebar();
            } else {
                this.toggleDesktopSidebar();
            }
        });
        
        // Mobile navigation indicator
        this.mobileNavIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMobileSidebar();
        });
        
        // Overlay click to close
        this.overlay.addEventListener('click', () => {
            this.closeMobileSidebar();
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (this.isMobile && this.sidebar.classList.contains('mobile-open')) {
                if (!this.sidebar.contains(e.target) && !this.mobileNavIndicator.contains(e.target)) {
                    this.closeMobileSidebar();
                }
            }
        });
        
        // Close sidebar on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMobile && this.sidebar.classList.contains('mobile-open')) {
                this.closeMobileSidebar();
            }
        });
    }
    
    setupNavbarListener() {
        // Only set up navbar listeners if navbar exists
        const navbar = document.querySelector('.navbar');
        const navbarCollapse = document.querySelector('.navbar-collapse');
        
        if (!navbar || !navbarCollapse) {
            return; // Exit early if navbar doesn't exist
        }
        
        // Use MutationObserver to detect when navbar classes change
        const observer = new MutationObserver(() => {
            this.updateNavbarHeight();
        });
        
        observer.observe(navbarCollapse, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Also listen for Bootstrap collapse events
        navbarCollapse.addEventListener('shown.bs.collapse', () => {
            this.updateNavbarHeight();
        });
        
        navbarCollapse.addEventListener('hidden.bs.collapse', () => {
            this.updateNavbarHeight();
        });
        
        // Also check for navbar height changes periodically (only if navbar exists)
        this.navbarCheckInterval = setInterval(() => {
            if (document.querySelector('.navbar')) {
                this.updateNavbarHeight();
            } else {
                // Clear interval if navbar no longer exists
                clearInterval(this.navbarCheckInterval);
            }
        }, 1000);
    }
    
    updateNavbarHeight() {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            const navbarHeight = navbar.offsetHeight;
            document.documentElement.style.setProperty('--navbar-height', `${navbarHeight}px`);
            
            // Update mobile nav indicator position if mobile
            if (this.isMobile && this.mobileNavIndicator) {
                this.mobileNavIndicator.style.top = `calc(${navbarHeight}px + 10px)`;
            }
        } else {
            // If no navbar exists, set default height to 0
            document.documentElement.style.setProperty('--navbar-height', '0px');
            
            // Update mobile nav indicator position if mobile (no navbar)
            if (this.isMobile && this.mobileNavIndicator) {
                this.mobileNavIndicator.style.top = '20px';
            }
        }
    }
    
    updateMobileState() {
        if (this.isMobile) {
            // Mobile state
            this.mobileNavIndicator.style.display = 'flex';
            this.sidebar.classList.remove('collapsed');
            this.container.classList.remove('closed');
            this.closeMobileSidebar();
            this.updateNavbarHeight(); // Update height for mobile
        } else {
            // Desktop state
            this.mobileNavIndicator.style.display = 'none';
            this.overlay.classList.remove('active');
            this.sidebar.classList.remove('mobile-open');
            this.sidebar.style.left = '';
            this.sidebar.style.position = '';
            this.sidebar.style.width = '';
            this.sidebar.style.height = '';
            this.sidebar.style.zIndex = '';
            this.sidebar.style.boxShadow = '';
            this.sidebar.style.transition = '';
            this.sidebar.style.marginTop = '';
        }
    }
    
    toggleMobileSidebar() {
        if (this.sidebar.classList.contains('mobile-open')) {
            this.closeMobileSidebar();
        } else {
            this.openMobileSidebar();
        }
    }
    
    openMobileSidebar() {
        this.sidebar.classList.add('mobile-open');
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    closeMobileSidebar() {
        this.sidebar.classList.remove('mobile-open');
        this.overlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    toggleDesktopSidebar() {
        this.sidebar.classList.toggle('collapsed');
        this.container.classList.toggle('closed', this.sidebar.classList.contains('collapsed'));
    }

    addItem(label, options = {}) {
        const item = document.createElement('li');
        item.className = 'sidebar-item';
        const itemLabel = document.createElement('span');
        itemLabel.textContent = label;
        itemLabel.className = 'sidebar-label';
        item.appendChild(itemLabel);

        if (options.subItems && Array.isArray(options.subItems)) {
            const subList = document.createElement('ul');
            subList.className = 'sidebar-sublist';
            subList.style.display = 'none';
            options.subItems.forEach(sub => {
                const subItem = document.createElement('li');
                subItem.className = 'sidebar-subitem';
                subItem.textContent = sub;
                subList.appendChild(subItem);
            });
            item.appendChild(subList);
            itemLabel.classList.add('collapsible');
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('sidebar-subitem')) return;
                const isCollapsed = subList.style.display === 'none';
                subList.style.display = isCollapsed ? 'block' : 'none';
                itemLabel.classList.toggle('collapsed', isCollapsed);
                
                // Close mobile sidebar after item selection
                if (this.isMobile) {
                    setTimeout(() => {
                        this.closeMobileSidebar();
                    }, 300);
                }
            });
        } else {
            // For non-collapsible items, close mobile sidebar after click
            item.addEventListener('click', () => {
                if (this.isMobile) {
                    setTimeout(() => {
                        this.closeMobileSidebar();
                    }, 300);
                }
            });
        }

        this.list.appendChild(item);
        return item;
    }
    
    // Method to programmatically close mobile sidebar
    close() {
        if (this.isMobile) {
            this.closeMobileSidebar();
        }
    }
    
    // Method to programmatically open mobile sidebar
    open() {
        if (this.isMobile) {
            this.openMobileSidebar();
        }
    }
    
    // Cleanup method to remove intervals and observers
    destroy() {
        if (this.navbarCheckInterval) {
            clearInterval(this.navbarCheckInterval);
        }
    }
}

export default Sidebar; 