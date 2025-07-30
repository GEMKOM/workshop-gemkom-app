// --- finishedTimers.js ---
import { fetchTimers } from '../generic/timers.js';

// ============================================================================
// FINISHED TIMERS TAB FUNCTIONALITY
// ============================================================================

export function loadFinishedTimersContent() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="finished-timers-view">
            <!-- Header Section -->
            <div class="timers-header">
                <div class="header-content">
                    <h3 class="timers-title">
                        <i class="fas fa-check-circle me-2"></i>
                        Tamamlanan Zamanlayıcılar
                    </h3>
                    <p class="timers-subtitle">Tamamlanan işleri görüntüleyin ve analiz edin</p>
                </div>
            </div>

            <!-- Filters Section -->
            <div class="filters-section">
                <div class="section-header">
                    <h4 class="section-title">
                        <i class="fas fa-filter me-2"></i>
                        Filtreler
                    </h4>
                    <button type="button" class="btn btn-link p-0 filter-toggle" id="filter-toggle">
                        <i class="fas fa-chevron-down me-1"></i>Filtreleri Göster
                    </button>
                </div>
                
                <div class="filter-content" id="filter-content" style="display: none;">
                    <div class="filters-grid">
                        <div class="filter-group">
                            <label class="filter-label">Başlangıç Tarihi</label>
                            <input type="date" class="form-control" id="start-date">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Bitiş Tarihi</label>
                            <input type="date" class="form-control" id="end-date">
                        </div>
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

            <!-- Results Section -->
            <div class="results-section">
                <div class="section-header">
                    <h4 class="section-title">
                        <i class="fas fa-list me-2"></i>
                        Sonuçlar
                    </h4>
                    <div class="results-info" id="results-info"></div>
                </div>
                
                <div class="results-container">
                    <div id="timers-list">
                        <div class="loading-container text-center py-5">
                            <div class="loading-spinner"></div>
                            <p class="mt-3 text-muted">Veriler yükleniyor...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pagination Section -->
            <div class="pagination-section">
                <div id="pagination-container"></div>
            </div>
        </div>
    `;

    // Initialize the finished timers functionality
    initializeFinishedTimers();
}

function initializeFinishedTimers() {
    // Set default dates (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];

    
    // Load initial data
    loadFinishedTimersData();
    
    // Bind events
    bindFinishedTimersEvents();
}

async function loadFinishedTimersData(page = 1) {
    const timersList = document.getElementById('timers-list');
    const resultsInfo = document.getElementById('results-info');
    
    if (!timersList) return;
    
    timersList.innerHTML = `
        <div class="loading-container text-center py-5">
            <div class="loading-spinner"></div>
            <p class="mt-3 text-muted">Veriler yükleniyor...</p>
        </div>
    `;
    
    try {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', 20);
        params.append('ordering', '-finish_time');
        
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;
        
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        params.append('is_active', false);
        
        // Use the actual API endpoint
        const data = await fetchTimers(params);
        
        const timers = data.results || data;
        const totalCount = data.count || timers.length;
        
        // Update results info
        if (resultsInfo) {
            resultsInfo.innerHTML = `<span class="results-count">${totalCount} kayıt</span>`;
        }
        
        if (timers.length === 0) {
            timersList.innerHTML = `
                <div class="empty-state text-center py-5">
                    <i class="fas fa-inbox text-muted" style="font-size: 3rem;"></i>
                    <h5 class="mt-3 text-muted">Sonuç Bulunamadı</h5>
                    <p class="text-muted">Seçilen kriterlere uygun tamamlanan zamanlayıcı bulunamadı.</p>
                </div>
            `;
            return;
        }
        
        renderFinishedTimers(timers);
        renderPagination(data, page);
        
    } catch (error) {
        timersList.innerHTML = `
            <div class="error-container text-center py-5">
                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
                <h4 class="mt-3 text-danger">Hata Oluştu</h4>
                <p class="text-muted">Veriler yüklenirken bir hata oluştu: ${error.message}</p>
                <button class="btn btn-primary mt-3" onclick="window.loadFinishedTimersData()">
                    <i class="fas fa-redo me-2"></i>Tekrar Dene
                </button>
            </div>
        `;
    }
}

function renderFinishedTimers(timers) {
    const timersList = document.getElementById('timers-list');
    
    if (!timersList) return;
    
    let html = '<div class="timers-container">';
    
    timers.forEach(timer => {
        const startTime = new Date(timer.start_time).toLocaleString('tr-TR');
        const finishTime = new Date(timer.finish_time).toLocaleString('tr-TR');
        const duration = calculateDuration(timer.start_time, timer.finish_time);
        
        html += `
            <div class="timer-card">
                <div class="timer-header">
                    <div class="timer-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="timer-title">
                        <h5>${timer.issue_key || 'Bilinmeyen İş'}</h5>
                        <p class="timer-subtitle">${timer.issue_name || 'Açıklama yok'}</p>
                    </div>
                    <div class="timer-status">
                        <span class="status-badge completed">Tamamlandı</span>
                    </div>
                </div>
                
                <div class="timer-details">
                    <div class="detail-row">
                        <div class="detail-item">
                            <i class="fas fa-cog me-1"></i>
                            <span class="detail-label">Makine:</span>
                            <span class="detail-value">${timer.machine_name || 'Bilinmeyen'}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-user me-1"></i>
                            <span class="detail-label">Kullanıcı:</span>
                            <span class="detail-value">${timer.username || 'Bilinmeyen'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-item">
                            <i class="fas fa-play me-1"></i>
                            <span class="detail-label">Başlangıç:</span>
                            <span class="detail-value">${startTime}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-stop me-1"></i>
                            <span class="detail-label">Bitiş:</span>
                            <span class="detail-value">${finishTime}</span>
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-item">
                            <i class="fas fa-clock me-1"></i>
                            <span class="detail-label">Süre:</span>
                            <span class="detail-value duration">${duration}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-hashtag me-1"></i>
                            <span class="detail-label">İş Emri:</span>
                            <span class="detail-value">${timer.job_no || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    timersList.innerHTML = html;
}

function calculateDuration(startTime, finishTime) {
    const start = new Date(startTime);
    const finish = new Date(finishTime);
    const diff = finish - start;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}s ${minutes}dk`;
    } else {
        return `${minutes}dk`;
    }
}

function renderPagination(data, currentPage) {
    const paginationContainer = document.getElementById('pagination-container');
    
    if (!paginationContainer) return;
    
    if (!data.count || data.count <= 20) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    const totalPages = Math.ceil(data.count / 20);
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    let html = `
        <div class="pagination-container">
            <div class="pagination-info">
                <span class="pagination-text">Toplam ${data.count} kayıt, Sayfa ${currentPage} / ${totalPages}</span>
            </div>
            <nav aria-label="Sayfalama">
                <ul class="pagination">
    `;
    
    // Previous button
    if (data.previous) {
        html += `
            <li class="page-item">
                <button class="page-link" data-page="${currentPage - 1}">
                    <i class="fas fa-chevron-left"></i>
                </button>
            </li>
        `;
    } else {
        html += `
            <li class="page-item disabled">
                <span class="page-link">
                    <i class="fas fa-chevron-left"></i>
                </span>
            </li>
        `;
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `
                <li class="page-item active">
                    <span class="page-link">${i}</span>
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
    
    // Next button
    if (data.next) {
        html += `
            <li class="page-item">
                <button class="page-link" data-page="${currentPage + 1}">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </li>
        `;
    } else {
        html += `
            <li class="page-item disabled">
                <span class="page-link">
                    <i class="fas fa-chevron-right"></i>
                </span>
            </li>
        `;
    }
    
    html += `
                </ul>
            </nav>
        </div>
    `;
    
    paginationContainer.innerHTML = html;
    
    // Bind pagination events
    paginationContainer.querySelectorAll('.page-link[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(btn.getAttribute('data-page'));
            loadFinishedTimersData(page);
        });
    });
}

function bindFinishedTimersEvents() {
    // Filter toggle
    const filterToggle = document.getElementById('filter-toggle');
    const filterContent = document.getElementById('filter-content');
    
    if (filterToggle && filterContent) {
        filterToggle.addEventListener('click', () => {
            const isVisible = filterContent.style.display !== 'none';
            filterContent.style.display = isVisible ? 'none' : 'block';
            filterToggle.innerHTML = isVisible ? 
                '<i class="fas fa-chevron-down me-1"></i>Filtreleri Göster' : 
                '<i class="fas fa-chevron-up me-1"></i>Filtreleri Gizle';
        });
    }
    
    // Apply filters
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            loadFinishedTimersData(1);
        });
    }
    
    // Clear filters
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const startDateInput = document.getElementById('start-date');
            const endDateInput = document.getElementById('end-date');
            
            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            
            loadFinishedTimersData(1);
        });
    }
}

// Make the function globally accessible
window.loadFinishedTimersData = loadFinishedTimersData; 