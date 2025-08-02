/**
 * Reusable Refresh Button Component
 * Maintains consistent size and behavior across the application
 */

class RefreshButton {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            onRefresh: null,
            loadingText: 'Yenileniyor...',
            successText: 'Yenilendi',
            errorText: 'Hata',
            originalText: 'Yenile',
            ...options
        };
        
        this.isRefreshing = false;
        this.init();
    }
    
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`Refresh button container not found: ${this.containerId}`);
            return;
        }
        
        this.render();
        this.setupEventListeners();
    }
    
    render() {
        this.container.innerHTML = `
            <button class="btn btn-primary refresh-btn" id="refresh-btn">
                <span class="refresh-icon">
                    <i class="fas fa-sync-alt"></i>
                </span>
                <span class="refresh-text">${this.options.originalText}</span>
            </button>
        `;
        
        this.button = this.container.querySelector('.refresh-btn');
        this.icon = this.container.querySelector('.refresh-icon i');
        this.text = this.container.querySelector('.refresh-text');
    }
    
    setupEventListeners() {
        this.button.addEventListener('click', async () => {
            if (this.isRefreshing) return;
            
            await this.startRefresh();
        });
    }
    
    async startRefresh() {
        this.isRefreshing = true;
        this.setLoadingState();
        
        try {
            if (this.options.onRefresh) {
                await this.options.onRefresh();
            }
            
            this.setSuccessState();
            setTimeout(() => {
                this.resetState();
            }, 1000);
            
        } catch (error) {
            console.error('Refresh error:', error);
            this.setErrorState();
            setTimeout(() => {
                this.resetState();
            }, 2000);
        }
    }
    
    setLoadingState() {
        this.button.classList.add('loading');
        this.icon.classList.add('fa-spin');
        this.text.textContent = this.options.loadingText;
    }
    
    setSuccessState() {
        this.icon.classList.remove('fa-spin');
        this.icon.classList.remove('fa-sync-alt');
        this.icon.classList.add('fa-check');
        this.text.textContent = this.options.successText;
    }
    
    setErrorState() {
        this.icon.classList.remove('fa-spin');
        this.icon.classList.remove('fa-sync-alt');
        this.icon.classList.add('fa-exclamation-triangle');
        this.text.textContent = this.options.errorText;
    }
    
    resetState() {
        this.isRefreshing = false;
        this.button.classList.remove('loading');
        this.icon.classList.remove('fa-spin', 'fa-check', 'fa-exclamation-triangle');
        this.icon.classList.add('fa-sync-alt');
        this.text.textContent = this.options.originalText;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RefreshButton;
} 