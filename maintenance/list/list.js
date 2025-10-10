import { initNavbar } from '../../components/navbar.js';
import { guardRoute } from '../../authService.js';
import { authedFetch } from '../../authService.js';
import { backendBase } from '../../base.js';
import { resolveMaintenanceRequest } from '../maintenanceApi.js';
import { GenericCard } from '../../components/genericCard/genericCard.js';
import { extractResultsFromResponse } from '../../generic/paginationHelper.js';
import { HeaderComponent } from '../../components/header/header.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    maintenanceRequests: [],
    currentFilter: 'all',
    isLoading: false
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!guardRoute()) {
        return;
    }
    
    initNavbar();
    setupHeader();
    setupRefreshButton();
    loadMaintenanceRequestsContent();
});

// ============================================================================
// HEADER SETUP
// ============================================================================

function setupHeader() {
    const headerConfig = {
        title: 'Bakım Talepleri',
        subtitle: 'Mevcut bakım ve arıza taleplerini görüntüleyin, filtreleyin ve yönetin. Sistemdeki tüm talepleri tek yerden takip edebilirsiniz.',
        icon: 'list',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showCreateButton: 'none',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'none',
        backUrl: '../index.html'
    };
    
    new HeaderComponent(headerConfig);
}

// ============================================================================
// CONTENT LOADING
// ============================================================================

async function loadMaintenanceRequestsContent() {
    const contentContainer = document.getElementById('maintenance-requests-content');
    
    // Add loading state
    contentContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="text-muted">Yükleniyor...</p>
        </div>
    `;
    
    try {
        // Load the maintenance requests list
        contentContainer.innerHTML = createViewRequestsSection();
        
        // Load maintenance requests and setup functionality
        await loadMaintenanceRequests();
        setupResolveModal();
    } catch (error) {
        console.error('Error loading maintenance requests content:', error);
        contentContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-4">
                    <i class="fas fa-exclamation-triangle text-danger" style="font-size: 4rem;"></i>
                </div>
                <h4 class="text-danger mb-2">Hata Oluştu</h4>
                <p class="text-muted">İçerik yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</p>
                <button class="btn btn-primary mt-3" onclick="location.reload()">
                    <i class="fas fa-redo me-2"></i>Yenile
                </button>
            </div>
        `;
    }
}

// ============================================================================
// SECTION CREATION
// ============================================================================

function createViewRequestsSection() {
    return `
        <div class="maintenance-requests-section">
            <!-- Filter Container -->
            <div class="filter-container">
                <div class="filter-buttons" id="filter-buttons">
                    <button class="filter-btn active" data-filter="all">
                        <i class="fas fa-list"></i>
                        Tümü
                    </button>
                    <button class="filter-btn" data-filter="maintenance">
                        <i class="fas fa-tools"></i>
                        Bakım
                    </button>
                    <button class="filter-btn" data-filter="fault">
                        <i class="fas fa-exclamation-triangle"></i>
                        Arıza
                    </button>
                    <button class="filter-btn" data-filter="breaking">
                        <i class="fas fa-stop-circle"></i>
                        Duruşta
                    </button>
                    <button class="filter-btn" data-filter="completed">
                        <i class="fas fa-check-circle"></i>
                        Tamamlanan
                    </button>
                </div>
            </div>
            
            <!-- Requests List -->
            <div id="requests-list">
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p class="text-muted">Talepler yükleniyor...</p>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchMaintenanceRequests() {
    try {
        const response = await authedFetch(`${backendBase}/machines/faults/?page_size=1000`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch maintenance requests');
        }
        
        const requestsResponse = await response.json();
        const requests = extractResultsFromResponse(requestsResponse);
        state.maintenanceRequests = requests;
        return requests;
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        throw error;
    }
}

// ============================================================================
// REQUEST LOADING AND RENDERING
// ============================================================================

async function loadMaintenanceRequests() {
    try {
        await fetchMaintenanceRequests();
        renderMaintenanceRequests();
        setupFilterHandlers();
    } catch (error) {
        const requestsList = document.getElementById('requests-list');
        if (requestsList) {
            requestsList.innerHTML = `
                <div class="text-center py-4">
                    <div class="alert alert-danger">
                        <p>Talep yüklenirken hata oluştu.</p>
                        <button class="btn btn-outline-danger btn-sm" onclick="location.reload()">Tekrar Dene</button>
                    </div>
                </div>
            `;
        }
    }
}

function renderMaintenanceRequests() {
    const requestsList = document.getElementById('requests-list');
    
    if (!requestsList) return;
    
    const filteredRequests = filterRequests(state.maintenanceRequests, state.currentFilter);
    
    if (filteredRequests.length === 0) {
        requestsList.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-4">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: #6c757d; opacity: 0.5;"></i>
                </div>
                <h4 class="text-muted mb-2">Talep Bulunamadı</h4>
                <p class="text-muted">Seçili filtrelere uygun bakım talebi bulunmuyor.</p>
            </div>
        `;
        return;
    }
    
    // Convert requests to card data
    const cardsData = filteredRequests.map(convertMaintenanceRequestToCardData);
    
    // Clear the container
    requestsList.innerHTML = '';
    
    // Create individual card containers and render cards
    cardsData.forEach((cardData, index) => {
        const cardContainer = document.createElement('div');
        cardContainer.className = 'maintenance-request-card';
        requestsList.appendChild(cardContainer);
        
        new GenericCard(cardContainer, cardData);
    });
}

function filterRequests(requests, filter) {
    return requests.filter(request => {
        switch (filter) {
            case 'maintenance':
                return request.is_maintenance === true && request.resolved_at === null;
            case 'fault':
                return request.is_maintenance === false && request.is_breaking === false && request.resolved_at === null;
            case 'breaking':
                return request.is_breaking === true && request.resolved_at === null;
            case 'completed':
                return request.resolved_at !== null;
            case 'all':
                return request.resolved_at === null
            default:
                return true;
        }
    });
}

// Convert maintenance request to generic card data
function convertMaintenanceRequestToCardData(request) {
    const statusText = request.resolved_at ? 'Çözüldü' : 'Açık';
    
    // Format dates properly
    const reportedAt = new Date(request.reported_at).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    const resolvedAt = request.resolved_at ? new Date(request.resolved_at).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }) : '-';
    
    // Determine request type icon and color
    const typeIcon = request.is_maintenance ? 'fas fa-tools' : 'fas fa-exclamation-triangle';
    const typeText = request.is_maintenance ? 'Bakım Talebi' : 'Arıza Talebi';
    
    // Set card icon and colors based on status
    let cardIcon = typeIcon;
    let cardIconBackground = request.is_breaking ? 'linear-gradient(135deg,rgb(214, 9, 9),rgb(120, 3, 3))' : (request.is_maintenance ? 'linear-gradient(135deg, #007bff, #0056b3)' : 'linear-gradient(135deg, #ffc107, #e0a800)')
    const cardIconColor = '#ffffff';

    if (request.resolved_at) {
        cardIcon = 'fas fa-check-circle';
        cardIconBackground = 'linear-gradient(135deg, #28a745, #20c997)';
    }
    
    // Create details array
    const details = [
        { icon: 'fas fa-calendar', label: 'Bildirilme:', value: reportedAt },
        { icon: 'fas fa-user', label: 'Bildiren:', value: request.reported_by_username || 'Bilinmiyor' }
    ];
    
    // Add resolution date if resolved
    if (request.resolved_at) {
        details.push({ icon: 'fas fa-check-circle', label: 'Çözülme:', value: resolvedAt });
    }
    
    // Add breaking status if applicable
    if (request.is_breaking) {
        details.push({ icon: 'fas fa-stop-circle', label: 'Durum:', value: 'Makine Duruşta', valueClass: 'highlight' });
    }
    
    // Create buttons array
    const buttons = [];
    
    // Add resolve button for unresolved requests
    if (!request.resolved_at) {
        buttons.push({
            text: 'Çözüldü Olarak İşaretle',
            icon: 'fas fa-check',
            class: 'btn-success',
            onClick: () => resolveRequest(request.id)
        });
    }
    
    // Add details button
    buttons.push({
        text: 'Detaylar',
        icon: 'fas fa-info-circle',
        class: 'btn-outline-primary',
        onClick: () => showRequestDetails(request)
    });
    
    return {
        title: request.machine_name || request.asset_name || 'Makine Adı Yok',
        subtitle: `${typeText} - ${request.reported_by_username || 'Bilinmiyor'} tarafından bildirildi`,
        icon: cardIcon,
        iconColor: cardIconColor,
        iconBackground: cardIconBackground,
        status: statusText,
        statusType: request.resolved_at ? 'success' : (request.is_breaking ? 'danger' : 'warning'),
        details: details,
        buttons: buttons,
        clickable: true,
        onClick: () => showRequestDetails(request)
    };
}

// Show request details in a modal
function showRequestDetails(request) {
    const modalElement = document.getElementById('detailsModal');
    const modalBody = document.getElementById('details-modal-body');
    
    if (!modalElement || !modalBody) {
        console.error('Details modal elements not found');
        return;
    }
    
    // Format dates properly
    const reportedAt = new Date(request.reported_at).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const resolvedAt = request.resolved_at ? new Date(request.resolved_at).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : null;
    
    // Determine request type and status
    const typeIcon = request.is_maintenance ? 'fas fa-tools' : 'fas fa-exclamation-triangle';
    const typeText = request.is_maintenance ? 'Bakım Talebi' : 'Arıza Talebi';
    const statusText = request.resolved_at ? 'Çözüldü' : 'Açık';
    const statusClass = request.resolved_at ? 'success' : (request.is_breaking ? 'danger' : 'warning');
    const statusIcon = request.resolved_at ? 'fas fa-check-circle' : (request.is_breaking ? 'fas fa-stop-circle' : 'fas fa-clock');
    
    // Create modal content
    const modalContent = `
        <div class="request-details">
            <!-- Header Section -->
            <div class="details-header mb-4">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h4 class="mb-2">
                            <i class="${typeIcon} me-2 text-primary"></i>
                            ${request.machine_name || request.asset_name || 'Makine Adı Yok'}
                        </h4>
                        <p class="text-muted mb-0">${typeText} - ${request.reported_by_username || 'Bilinmiyor'} tarafından bildirildi</p>
                    </div>
                    <div class="col-md-4 text-md-end">
                        <span class="badge bg-${statusClass} fs-6">
                            <i class="${statusIcon} me-1"></i>
                            ${statusText}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Details Grid -->
            <div class="row g-4 mb-4">
                <div class="col-md-6">
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-calendar-alt me-2"></i>
                            Bildirilme Tarihi
                        </div>
                        <div class="detail-value">${reportedAt}</div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-user me-2"></i>
                            Bildiren Kişi
                        </div>
                        <div class="detail-value">${request.reported_by_username || 'Bilinmiyor'}</div>
                    </div>
                </div>
                ${request.is_breaking ? `
                <div class="col-12">
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-exclamation-triangle me-2 text-danger"></i>
                            Durum
                        </div>
                        <div class="detail-value text-danger">
                            <i class="fas fa-stop-circle me-1"></i>
                            Makine Duruşta
                        </div>
                    </div>
                </div>
                ` : ''}
                ${resolvedAt ? `
                <div class="col-md-6">
                    <div class="detail-item">
                        <div class="detail-label">
                            <i class="fas fa-check-circle me-2 text-success"></i>
                            Çözülme Tarihi
                        </div>
                        <div class="detail-value">${resolvedAt}</div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <!-- Description Section -->
            <div class="col-12">
                <div class="detail-item">
                    <div class="detail-label">
                        <i class="fas fa-align-left me-2"></i>
                        Açıklama
                    </div>
                    <div class="detail-value description-text">${request.description || '<em class="text-muted">Açıklama yok</em>'}</div>
                </div>
            </div>
            
            ${request.resolution_description ? `
            <!-- Resolution Section -->
            <div class="col-12">
                <div class="detail-item">
                    <div class="detail-label">
                        <i class="fas fa-check-circle me-2 text-success"></i>
                        Çözüm Açıklaması
                    </div>
                    <div class="detail-value resolution-text">${request.resolution_description}</div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    // Set modal content
    modalBody.innerHTML = modalContent;
    
    // Remove inert attribute to allow interaction
    modalElement.removeAttribute('inert');
    
    // Create new modal instance
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: true
    });
    
    // Show modal
    modal.show();
    
    // Handle modal hidden event to add inert back
    modalElement.addEventListener('hidden.bs.modal', () => {
        // Add inert attribute back to prevent interaction
        modalElement.setAttribute('inert', '');
    }, { once: true });
}

// ============================================================================
// FILTER HANDLERS
// ============================================================================

function setupFilterHandlers() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            e.target.classList.add('active');
            
            // Update filter and re-render
            state.currentFilter = e.target.dataset.filter;
            renderMaintenanceRequests();
        });
    });
}

// ============================================================================
// RESOLVE FUNCTIONALITY
// ============================================================================

let currentResolveRequestId = null;
let modalInitialized = false;

// Make resolveRequest function globally available
window.resolveRequest = function(requestId) {
    currentResolveRequestId = requestId;
    
    // Get the modal element
    const modalElement = document.getElementById('resolveModal');
    if (modalElement) {
        // Clear any previous content
        const textarea = modalElement.querySelector('#resolution-description');
        if (textarea) {
            textarea.value = '';
        }
        
        // Remove inert attribute to allow interaction
        modalElement.removeAttribute('inert');
        
        // Create new modal instance
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
        
        // Store the element that had focus before opening modal
        const previouslyFocusedElement = document.activeElement;
        
        // Show modal
        modal.show();
        
        // Focus the textarea when modal opens
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
            }
        }, 150);
        
        // Handle modal hidden event to restore focus and add inert back
        modalElement.addEventListener('hidden.bs.modal', () => {
            // Add inert attribute back to prevent interaction
            modalElement.setAttribute('inert', '');
            
            // Restore focus to the previously focused element
            if (previouslyFocusedElement && previouslyFocusedElement.focus) {
                previouslyFocusedElement.focus();
            }
        }, { once: true });
    }
};

// Setup resolve modal handlers
function setupResolveModal() {
    // Prevent multiple initializations
    if (modalInitialized) {
        return;
    }
    
    const confirmResolveBtn = document.getElementById('confirm-resolve');
    const resolutionDescription = document.getElementById('resolution-description');
    const modalElement = document.getElementById('resolveModal');
    
    if (confirmResolveBtn && resolutionDescription && modalElement) {
        // Remove all existing event listeners by cloning the button
        const newBtn = confirmResolveBtn.cloneNode(true);
        confirmResolveBtn.parentNode.replaceChild(newBtn, confirmResolveBtn);
        
        // Add event listener with a flag to prevent multiple executions
        let isProcessing = false;
        
        newBtn.addEventListener('click', async (e) => {
            // Prevent multiple simultaneous executions
            if (isProcessing) {
                return;
            }
            
            const description = resolutionDescription.value.trim();
            
            if (!description) {
                alert('Lütfen çözüm açıklaması girin.');
                return;
            }
            
            if (!currentResolveRequestId) {
                alert('Talep ID bulunamadı.');
                return;
            }
            
            try {
                isProcessing = true;
                
                // Show loading state
                newBtn.disabled = true;
                newBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>İşleniyor...';
                
                await resolveMaintenanceRequest(currentResolveRequestId, description);
                
                // Close modal using Bootstrap instance
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }
                
                // Reset form
                resolutionDescription.value = '';
                currentResolveRequestId = null;
                
                // Refresh the requests list without reloading the entire page
                await fetchMaintenanceRequests();
                renderMaintenanceRequests();
                
                alert('Talep başarıyla çözüldü olarak işaretlendi.');
                
            } catch (error) {
                console.error('Error resolving request:', error);
                alert('Talep çözülürken hata oluştu.');
            } finally {
                isProcessing = false;
                newBtn.disabled = false;
                newBtn.innerHTML = '<i class="fas fa-check me-2"></i>Çözüldü Olarak İşaretle';
            }
        });
        
        // Handle modal close button to ensure proper focus management
        const closeBtn = modalElement.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                // Clear any focus from modal elements before closing
                if (document.activeElement && modalElement.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            });
        }
        
        // Handle modal backdrop click to ensure proper focus management
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                // Clear any focus from modal elements before closing
                if (document.activeElement && modalElement.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            }
        });
        
        modalInitialized = true;
    }
}

// ============================================================================
// REFRESH FUNCTIONALITY
// ============================================================================

function setupRefreshButton() {
    const refreshButton = new RefreshButton('refresh-btn-container', {
        onRefresh: async () => {
            // Reload the maintenance requests content
            await loadMaintenanceRequestsContent();
        }
    });
}
