// components/pagination/pagination.js

export class Pagination {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            currentPage: 1,
            totalPages: 1,
            totalCount: 0,
            pageSize: 20,
            showInfo: true,
            showFirstLast: true,
            maxVisiblePages: 5,
            onPageChange: null,
            className: '',
            ...options
        };
        
        this.init();
    }
    
    init() {
        this.createPagination();
        this.bindEvents();
    }
    
    createPagination() {
        this.container.innerHTML = '';
        this.container.className = `pagination-container ${this.options.className}`;
        
        // Don't show pagination if only one page
        if (this.options.totalPages <= 1) {
            return;
        }
        
        const paginationHTML = this.generatePaginationHTML();
        this.container.innerHTML = paginationHTML;
    }
    
    generatePaginationHTML() {
        const { currentPage, totalPages, totalCount, pageSize, showInfo, showFirstLast, maxVisiblePages } = this.options;
        
        let html = '';
        
        // Pagination info
        if (showInfo) {
            html += `
                <div class="pagination-info">
                    <span class="pagination-text">Toplam ${totalCount} kayıt, Sayfa ${currentPage} / ${totalPages}</span>
                </div>
            `;
        }
        
        // Pagination navigation
        html += `
            <nav aria-label="Sayfalama">
                <ul class="pagination">
        `;
        
        // First page button
        if (showFirstLast && currentPage > 1) {
            html += this.generatePageButton(1, 'İlk', 'first');
        }
        
        // Previous button
        html += this.generatePreviousButton();
        
        // Page numbers
        html += this.generatePageNumbers();
        
        // Next button
        html += this.generateNextButton();
        
        // Last page button
        if (showFirstLast && currentPage < totalPages) {
            html += this.generatePageButton(totalPages, 'Son', 'last');
        }
        
        html += `
                </ul>
            </nav>
        `;
        
        return html;
    }
    
    generatePreviousButton() {
        const { currentPage } = this.options;
        
        if (currentPage > 1) {
            return `
                <li class="page-item">
                    <button class="page-link" data-page="${currentPage - 1}" aria-label="Önceki sayfa">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </li>
            `;
        } else {
            return `
                <li class="page-item disabled">
                    <span class="page-link" aria-label="Önceki sayfa">
                        <i class="fas fa-chevron-left"></i>
                    </span>
                </li>
            `;
        }
    }
    
    generateNextButton() {
        const { currentPage, totalPages } = this.options;
        
        if (currentPage < totalPages) {
            return `
                <li class="page-item">
                    <button class="page-link" data-page="${currentPage + 1}" aria-label="Sonraki sayfa">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </li>
            `;
        } else {
            return `
                <li class="page-item disabled">
                    <span class="page-link" aria-label="Sonraki sayfa">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                </li>
            `;
        }
    }
    
    generatePageNumbers() {
        const { currentPage, totalPages, maxVisiblePages } = this.options;
        
        let html = '';
        const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if we're near the end
        const adjustedStartPage = Math.max(1, endPage - maxVisiblePages + 1);
        
        for (let i = adjustedStartPage; i <= endPage; i++) {
            if (i === currentPage) {
                html += `
                    <li class="page-item active">
                        <span class="page-link" aria-current="page">${i}</span>
                    </li>
                `;
            } else {
                html += `
                    <li class="page-item">
                        <button class="page-link" data-page="${i}">${i}</button>
                    </li>
                `;
            }
        }
        
        return html;
    }
    
    generatePageButton(page, text, type) {
        return `
            <li class="page-item">
                <button class="page-link" data-page="${page}" aria-label="${text} sayfa">
                    ${text}
                </button>
            </li>
        `;
    }
    
    bindEvents() {
        this.container.querySelectorAll('.page-link[data-page]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(btn.getAttribute('data-page'));
                this.goToPage(page);
            });
        });
    }
    
    goToPage(page) {
        if (page >= 1 && page <= this.options.totalPages && page !== this.options.currentPage) {
            this.options.currentPage = page;
            
            if (this.options.onPageChange) {
                this.options.onPageChange(page, this);
            }
            
            this.updatePagination();
        }
    }
    
    updatePagination() {
        this.createPagination();
        this.bindEvents();
    }
    
    // Public methods for updating the pagination
    updateData(data) {
        this.options.currentPage = data.currentPage || 1;
        this.options.totalPages = data.totalPages || 1;
        this.options.totalCount = data.totalCount || 0;
        this.options.pageSize = data.pageSize || 20;
        
        this.updatePagination();
    }
    
    setCurrentPage(page) {
        if (page >= 1 && page <= this.options.totalPages) {
            this.options.currentPage = page;
            this.updatePagination();
        }
    }
    
    setTotalPages(totalPages) {
        this.options.totalPages = totalPages;
        this.updatePagination();
    }
    
    setTotalCount(totalCount) {
        this.options.totalCount = totalCount;
        this.updatePagination();
    }
    
    setPageSize(pageSize) {
        this.options.pageSize = pageSize;
        this.updatePagination();
    }
    
    setOnPageChange(callback) {
        this.options.onPageChange = callback;
    }
    
    getCurrentPage() {
        return this.options.currentPage;
    }
    
    getTotalPages() {
        return this.options.totalPages;
    }
    
    destroy() {
        this.container.innerHTML = '';
        this.container.className = '';
    }
}

// Utility function to create pagination from API response
export function createPaginationFromApiResponse(container, apiData, currentPage = 1, options = {}) {
    const pageSize = 20; // Default page size
    const totalPages = Math.ceil(apiData.count / pageSize);
    
    const paginationOptions = {
        currentPage,
        totalPages,
        totalCount: apiData.count,
        pageSize,
        ...options
    };
    
    return new Pagination(container, paginationOptions);
}
