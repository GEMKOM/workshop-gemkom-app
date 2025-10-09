// components/genericCard/genericCard.js

export class GenericCard {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            title: '',
            subtitle: '',
            icon: 'fas fa-info-circle',
            iconColor: '#6c757d',
            iconBackground: '#f8f9fa',
            status: null,
            statusType: 'info', // info, success, warning, danger, primary
            details: [],
            buttons: [],
            clickable: false,
            onClick: null,
            className: '',
            ...options
        };
        
        this.init();
    }
    
    init() {
        this.createCard();
        this.bindEvents();
    }
    
    createCard() {
        this.container.innerHTML = '';
        this.container.className = `generic-card-container ${this.options.className}`;
        
        // Main card structure
        this.card = document.createElement('div');
        this.card.className = 'generic-card';
        
        if (this.options.clickable) {
            this.card.classList.add('clickable');
            this.card.setAttribute('tabindex', '0');
            this.card.setAttribute('role', 'button');
        }
        
        // Card header
        this.createHeader();
        
        // Card details
        if (this.options.details && this.options.details.length > 0) {
            this.createDetails();
        }
        
        // Card buttons
        if (this.options.buttons && this.options.buttons.length > 0) {
            this.createButtons();
        }
        
        this.container.appendChild(this.card);
    }
    
    createHeader() {
        const header = document.createElement('div');
        header.className = 'generic-card-header';
        
        // Icon
        const iconContainer = document.createElement('div');
        iconContainer.className = 'generic-card-icon';
        iconContainer.style.background = this.options.iconBackground;
        iconContainer.innerHTML = `<i class="${this.options.icon}" style="color: ${this.options.iconColor}"></i>`;
        
        // Title section
        const titleSection = document.createElement('div');
        titleSection.className = 'generic-card-title-section';
        
        const title = document.createElement('h5');
        title.className = 'generic-card-title';
        title.textContent = this.options.title;
        
        const subtitle = document.createElement('p');
        subtitle.className = 'generic-card-subtitle';
        subtitle.textContent = this.options.subtitle;
        
        titleSection.appendChild(title);
        titleSection.appendChild(subtitle);
        
        // Status badge
        let statusBadge = null;
        if (this.options.status) {
            statusBadge = document.createElement('div');
            statusBadge.className = 'generic-card-status';
            const badge = document.createElement('span');
            badge.className = `status-badge ${this.options.statusType}`;
            badge.textContent = this.options.status;
            statusBadge.appendChild(badge);
        }
        
        header.appendChild(iconContainer);
        header.appendChild(titleSection);
        if (statusBadge) {
            header.appendChild(statusBadge);
        }
        
        this.card.appendChild(header);
    }
    
    createDetails() {
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'generic-card-details';
        
        // Group details into rows (2 items per row by default)
        const rows = this.groupDetailsIntoRows(this.options.details);
        
        rows.forEach(row => {
            const detailRow = document.createElement('div');
            detailRow.className = 'generic-detail-row';
            
            row.forEach(detail => {
                const detailItem = document.createElement('div');
                detailItem.className = 'generic-detail-item';
                
                if (detail.icon) {
                    const icon = document.createElement('i');
                    icon.className = `${detail.icon} me-1`;
                    detailItem.appendChild(icon);
                }
                
                if (detail.label) {
                    const label = document.createElement('span');
                    label.className = 'generic-detail-label';
                    label.textContent = detail.label;
                    detailItem.appendChild(label);
                }
                
                const value = document.createElement('span');
                value.className = `generic-detail-value ${detail.valueClass || ''}`;
                value.textContent = detail.value || '-';
                detailItem.appendChild(value);
                
                detailRow.appendChild(detailItem);
            });
            
            detailsContainer.appendChild(detailRow);
        });
        
        this.card.appendChild(detailsContainer);
    }
    
    createButtons() {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'generic-card-buttons';
        
        this.options.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn ${button.class || 'btn-outline-primary'} btn-sm`;
            btn.textContent = button.text;
            
            if (button.icon) {
                btn.innerHTML = `<i class="${button.icon} me-1"></i>${button.text}`;
            }
            
            if (button.onClick) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    button.onClick(e, this);
                });
            }
            
            buttonsContainer.appendChild(btn);
        });
        
        this.card.appendChild(buttonsContainer);
    }
    
    groupDetailsIntoRows(details, itemsPerRow = 2) {
        const rows = [];
        for (let i = 0; i < details.length; i += itemsPerRow) {
            rows.push(details.slice(i, i + itemsPerRow));
        }
        return rows;
    }
    
    bindEvents() {
        if (this.options.clickable && this.options.onClick) {
            this.card.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons
                if (!e.target.closest('.generic-card-buttons')) {
                    this.options.onClick(e, this);
                }
            });
            
            // Keyboard support
            this.card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!e.target.closest('.generic-card-buttons')) {
                        this.options.onClick(e, this);
                    }
                }
            });
        }
    }
    
    // Public methods for updating the card
    updateTitle(title) {
        const titleElement = this.card.querySelector('.generic-card-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    updateSubtitle(subtitle) {
        const subtitleElement = this.card.querySelector('.generic-card-subtitle');
        if (subtitleElement) {
            subtitleElement.textContent = subtitle;
        }
    }
    
    updateStatus(status, type = 'info') {
        const statusElement = this.card.querySelector('.status-badge');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `status-badge ${type}`;
        }
    }
    
    updateDetails(details) {
        this.options.details = details;
        const detailsContainer = this.card.querySelector('.generic-card-details');
        if (detailsContainer) {
            detailsContainer.remove();
            this.createDetails();
        }
    }
    
    addButton(button) {
        this.options.buttons.push(button);
        const buttonsContainer = this.card.querySelector('.generic-card-buttons');
        if (buttonsContainer) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn ${button.class || 'btn-outline-primary'} btn-sm`;
            btn.innerHTML = button.icon ? `<i class="${button.icon} me-1"></i>${button.text}` : button.text;
            
            if (button.onClick) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    button.onClick(e, this);
                });
            }
            
            buttonsContainer.appendChild(btn);
        }
    }
    
    destroy() {
        this.container.innerHTML = '';
        this.container.className = '';
    }
}

// Utility function to create multiple cards
export function createCardGrid(container, cardsData, options = {}) {
    const gridOptions = {
        columns: 1,
        gap: '1rem',
        className: '',
        ...options
    };
    
    container.innerHTML = '';
    container.className = `generic-card-grid ${gridOptions.className}`;
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${gridOptions.columns}, 1fr)`;
    container.style.gap = gridOptions.gap;
    
    cardsData.forEach(cardData => {
        const cardContainer = document.createElement('div');
        container.appendChild(cardContainer);
        
        new GenericCard(cardContainer, cardData);
    });
}
