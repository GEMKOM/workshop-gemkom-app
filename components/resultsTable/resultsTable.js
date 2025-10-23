// components/resultsTable/resultsTable.js

import { GenericCard } from '../genericCard/genericCard.js';

export class ResultsTable {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            title: 'Sonuçlar',
            icon: 'fas fa-list',
            showFilters: true,
            filterToggleText: 'Filtreleri Göster',
            filters: [],
            items: [],
            itemRenderer: null,
            onItemClick: null,
            onFilterApply: null,
            onFilterClear: null,
            emptyStateText: 'Sonuç bulunamadı',
            emptyStateDescription: 'Seçilen kriterlere uygun kayıt bulunamadı.',
            loadingText: 'Veriler yükleniyor...',
            className: '',
            ...options
        };
        
        this.isLoading = false;
        this.currentItems = [];
        
        this.init();
    }
    
    init() {
        this.createTable();
        this.bindEvents();
    }
    
    createTable() {
        this.container.innerHTML = '';
        this.container.className = `results-table-container ${this.options.className}`;
        
        const html = this.generateTableHTML();
        this.container.innerHTML = html;
    }
    
    generateTableHTML() {
        return `
            <div class="results-table">
                ${this.options.showFilters ? this.generateFiltersHTML() : ''}
                
                <div class="results-section">
                    <div class="section-header">
                        <h4 class="section-title">
                            <i class="${this.options.icon} me-2"></i>
                            ${this.options.title}
                        </h4>
                        <div class="results-info" id="results-info"></div>
                    </div>
                    
                    <div class="results-container">
                        <div id="items-list">
                            <div class="loading-container text-center py-5">
                                <div class="loading-spinner"></div>
                                <p class="mt-3 text-muted">${this.options.loadingText}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    generateFiltersHTML() {
        const filtersHTML = this.options.filters.map(filter => `
            <div class="filter-group">
                <label class="filter-label">${filter.label}</label>
                ${this.generateFilterInput(filter)}
            </div>
        `).join('');
        
        return `
            <div class="filters-section">
                <div class="section-header">
                    <h4 class="section-title">
                        <i class="fas fa-filter me-2"></i>
                        Filtreler
                    </h4>
                    <button type="button" class="btn btn-link p-0 filter-toggle" id="filter-toggle">
                        <i class="fas fa-chevron-down me-1"></i>${this.options.filterToggleText}
                    </button>
                </div>
                
                <div class="filter-content" id="filter-content" style="display: none;">
                    <div class="filters-grid">
                        ${filtersHTML}
                    </div>
                    <div class="filter-actions">
                        <button type="button" class="btn btn-primary" id="apply-filters">
                            <i class="fas fa-search me-2"></i>Filtrele
                        </button>
                        <button type="button" class="btn btn-outline-secondary" id="clear-filters">
                            <i class="fas fa-times me-2"></i>Temizle
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    generateFilterInput(filter) {
        switch (filter.type) {
            case 'date':
                return `<input type="date" class="form-control" id="${filter.id}" ${filter.required ? 'required' : ''}>`;
            case 'text':
                return `<input type="text" class="form-control" id="${filter.id}" placeholder="${filter.placeholder || ''}" ${filter.required ? 'required' : ''}>`;
            case 'select':
                const options = filter.options.map(opt => 
                    `<option value="${opt.value}">${opt.text}</option>`
                ).join('');
                return `<select class="form-control" id="${filter.id}" ${filter.required ? 'required' : ''}>
                    <option value="">${filter.placeholder || 'Seçiniz...'}</option>
                    ${options}
                </select>`;
            default:
                return `<input type="text" class="form-control" id="${filter.id}">`;
        }
    }
    
    bindEvents() {
        if (!this.options.showFilters) return;
        
        // Filter toggle
        const filterToggle = this.container.querySelector('#filter-toggle');
        const filterContent = this.container.querySelector('#filter-content');
        
        if (filterToggle && filterContent) {
            filterToggle.addEventListener('click', () => {
                const isVisible = filterContent.style.display !== 'none';
                filterContent.style.display = isVisible ? 'none' : 'block';
                filterToggle.innerHTML = isVisible ? 
                    `<i class="fas fa-chevron-down me-1"></i>${this.options.filterToggleText}` : 
                    `<i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle`;
            });
        }
        
        // Apply filters
        const applyFiltersBtn = this.container.querySelector('#apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                if (this.options.onFilterApply) {
                    this.options.onFilterApply(this.getFilterValues());
                }
            });
        }
        
        // Clear filters
        const clearFiltersBtn = this.container.querySelector('#clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearFilters();
                if (this.options.onFilterClear) {
                    this.options.onFilterClear();
                }
            });
        }
    }
    
    getFilterValues() {
        const values = {};
        this.options.filters.forEach(filter => {
            const element = this.container.querySelector(`#${filter.id}`);
            if (element) {
                values[filter.id] = element.value;
            }
        });
        return values;
    }
    
    clearFilters() {
        this.options.filters.forEach(filter => {
            const element = this.container.querySelector(`#${filter.id}`);
            if (element) {
                element.value = '';
            }
        });
    }
    
    setItems(items) {
        this.currentItems = items;
        this.renderItems();
    }
    
    renderItems() {
        const itemsList = this.container.querySelector('#items-list');
        if (!itemsList) return;
        
        if (this.currentItems.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Clear container
        itemsList.innerHTML = '';
        itemsList.className = 'items-container';
        
        // Render each item
        this.currentItems.forEach((item, index) => {
            this.renderItem(item, index, itemsList);
        });
    }
    
    renderItem(item, index, container) {
        if (this.options.itemRenderer) {
            // Use custom renderer
            const itemElement = this.options.itemRenderer(item, index);
            container.appendChild(itemElement);
        } else {
            // Use default GenericCard renderer
            this.renderDefaultItem(item, index, container);
        }
    }
    
    renderDefaultItem(item, index, container) {
        const cardContainer = document.createElement('div');
        cardContainer.className = 'item-card-wrapper';
        
        // Check if item has onClick or if component has onItemClick
        const isClickable = item.onClick || this.options.onItemClick;
        
        if (isClickable) {
            cardContainer.style.cursor = 'pointer';
            cardContainer.addEventListener('click', (e) => {
                e.preventDefault();
                if (item.onClick) {
                    item.onClick(item, index);
                } else if (this.options.onItemClick) {
                    this.options.onItemClick(item, index);
                }
            });
        }
        
        container.appendChild(cardContainer);
        
        // Create GenericCard with item data
        const card = new GenericCard(cardContainer, {
            title: item.title || item.name || 'Başlık Yok',
            subtitle: item.subtitle || item.description || '',
            icon: item.icon || 'fas fa-info-circle',
            iconColor: item.iconColor || '#6c757d',
            iconBackground: item.iconBackground || '#f8f9fa',
            details: item.details || [],
            clickable: !!isClickable
        });
    }
    
    showLoadingState() {
        const itemsList = this.container.querySelector('#items-list');
        if (!itemsList) return;
        
        this.isLoading = true;
        itemsList.innerHTML = `
            <div class="loading-container text-center py-5">
                <div class="loading-spinner"></div>
                <p class="mt-3 text-muted">${this.options.loadingText}</p>
            </div>
        `;
    }
    
    showEmptyState() {
        const itemsList = this.container.querySelector('#items-list');
        if (!itemsList) return;
        
        this.isLoading = false;
        itemsList.innerHTML = `
            <div class="empty-state text-center py-5">
                <i class="fas fa-inbox text-muted" style="font-size: 3rem;"></i>
                <h5 class="mt-3 text-muted">${this.options.emptyStateText}</h5>
                <p class="text-muted">${this.options.emptyStateDescription}</p>
            </div>
        `;
    }
    
    showErrorState(error) {
        const itemsList = this.container.querySelector('#items-list');
        if (!itemsList) return;
        
        this.isLoading = false;
        itemsList.innerHTML = `
            <div class="error-container text-center py-5">
                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
                <h4 class="mt-3 text-danger">Hata Oluştu</h4>
                <p class="text-muted">Veriler yüklenirken bir hata oluştu: ${error.message}</p>
                <button class="btn btn-primary mt-3" onclick="window.location.reload()">
                    <i class="fas fa-redo me-2"></i>Tekrar Dene
                </button>
            </div>
        `;
    }
    
    updateResultsInfo(count) {
        const resultsInfo = this.container.querySelector('#results-info');
        if (resultsInfo) {
            resultsInfo.innerHTML = `<span class="results-count">${count} kayıt</span>`;
        }
    }
    
    destroy() {
        this.container.innerHTML = '';
        this.container.className = '';
    }
}
