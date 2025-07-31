import { initNavbar } from '../components/navbar.js';
import { guardRoute } from '../authService.js';
import { authedFetch } from '../authService.js';
import { backendBase } from '../base.js';
import { fetchMachines } from '../generic/machines.js';
import { createMaintenanceRequest, resolveMaintenanceRequest } from './maintenanceApi.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    currentSection: 'view-requests', // Default to "Bakım Taleplerini Görüntüle"
    maintenanceRequests: [],
    currentFilter: 'all'
};

// ============================================================================
// TAB NAVIGATION SETUP
// ============================================================================

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active state
            updateTabActiveState(button);
            
            // Load appropriate content
            loadTabContent(targetTab);
        });
    });
}

function updateTabActiveState(activeButton) {
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    activeButton.classList.add('active');
}

async function loadTabContent(tabName) {
    const contentContainer = document.getElementById('maintenance-content');
    
    // Add loading state
    contentContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="text-muted">Yükleniyor...</p>
        </div>
    `;
    
    try {
        // Update state
        state.currentSection = tabName;
        
        // Load appropriate content
        switch (tabName) {
            case 'view-requests':
                await loadViewRequestsContent();
                break;
            case 'create-request':
                await loadCreateRequestContent();
                break;
            default:
                await loadViewRequestsContent();
        }
    } catch (error) {
        console.error('Error loading tab content:', error);
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

async function loadViewRequestsContent() {
    const contentContainer = document.getElementById('maintenance-content');
    contentContainer.innerHTML = createViewRequestsSection();
    
    // Load maintenance requests
    await loadMaintenanceRequests();
    setupResolveModal();
}

async function loadCreateRequestContent() {
    const contentContainer = document.getElementById('maintenance-content');
    contentContainer.innerHTML = createMaintenanceRequestForm();
    
    // Load machines and setup form
    await loadMachines();
    setupMaintenanceRequestForm();
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchMaintenanceRequests() {
    try {
        const response = await authedFetch(`${backendBase}/machines/faults/`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch maintenance requests');
        }
        
        const requests = await response.json();
        state.maintenanceRequests = requests;
        return requests;
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        throw error;
    }
}

// ============================================================================
// REFRESH FUNCTIONALITY
// ============================================================================

function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        // Remove existing event listeners by cloning the button
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        let isRefreshing = false;
        
        newRefreshBtn.addEventListener('click', async () => {
            // Prevent multiple simultaneous refreshes
            if (isRefreshing) {
                return;
            }
            
            // Add loading state to button
            const originalContent = newRefreshBtn.innerHTML;
            isRefreshing = true;
            newRefreshBtn.classList.add('loading');
            newRefreshBtn.innerHTML = '<span class="loading-spinner"></span> Yenileniyor...';
            
            try {
                // Get current active tab
                const activeTab = document.querySelector('.tab-button.active');
                const currentTab = activeTab ? activeTab.getAttribute('data-tab') : 'view-requests';
                
                // Reload current tab content
                await loadTabContent(currentTab);
                
                // Show success feedback
                newRefreshBtn.innerHTML = '<i class="fas fa-check me-2"></i>Yenilendi';
                setTimeout(() => {
                    newRefreshBtn.classList.remove('loading');
                    newRefreshBtn.innerHTML = originalContent;
                    isRefreshing = false;
                }, 1000);
                
            } catch (error) {
                console.error('Refresh error:', error);
                newRefreshBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Hata';
                setTimeout(() => {
                    newRefreshBtn.classList.remove('loading');
                    newRefreshBtn.innerHTML = originalContent;
                    isRefreshing = false;
                }, 2000);
            }
        });
    }
}

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================

function createMaintenanceRequestForm() {
    return `
        <div class="maintenance-section active" id="create-request">
            <h2><i class="fas fa-plus-circle"></i>Yeni Bakım/Arıza Talebi</h2>
            <p class="description">Yeni bir bakım veya arıza talebi oluşturun. Detaylı bilgi vererek daha hızlı çözüm sağlayabilirsiniz.</p>
            
            <div class="row g-4">
                <div class="col-lg-8">
                    <div class="maintenance-card">
                        <div class="maintenance-card-header">
                            <div class="maintenance-card-title">
                                <i class="fas fa-edit"></i>
                                Talep Bilgileri
                            </div>
                            <div class="maintenance-card-subtitle">
                                <i class="fas fa-info-circle"></i>
                                Tüm alanları eksiksiz doldurun
                            </div>
                        </div>
                        <div class="maintenance-card-body">
                            <form id="maintenance-request-form">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label for="machine-select" class="form-label">
                                            <i class="fas fa-cogs"></i>
                                            Makine Seçin
                                        </label>
                                        <select class="form-select" id="machine-select" required>
                                            <option value="">Makine seçin...</option>
                                            <!-- Machines will be loaded dynamically -->
                                        </select>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <label for="request-type" class="form-label">
                                            <i class="fas fa-tag"></i>
                                            Talep Türü
                                        </label>
                                        <select class="form-select" id="request-type" required>
                                            <option value="">Tür seçin...</option>
                                            <option value="maintenance">Bakım</option>
                                            <option value="fault">Arıza</option>
                                        </select>
                                    </div>
                                    
                                    <div class="col-12" id="fault-operable-container" style="display: none;">
                                        <div class="maintenance-card" style="margin-bottom: 0;">
                                            <div class="maintenance-card-body">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" id="is-operable" checked>
                                                    <label class="form-check-label" for="is-operable">
                                                        <i class="fas fa-check-circle text-success me-2"></i>
                                                        Makine çalışır durumda
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="col-12">
                                        <label for="description" class="form-label">
                                            <i class="fas fa-align-left"></i>
                                            Detaylı Açıklama
                                        </label>
                                        <textarea class="form-control" id="description" rows="5" 
                                                  placeholder="Bakım/arıza detaylarını açıklayın. Mümkün olduğunca detaylı bilgi verin..." required></textarea>
                                    </div>
                                </div>
                                
                                <div class="maintenance-card-footer">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-paper-plane me-2"></i>
                                        Talep Oluştur
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-4">
                    <div class="maintenance-card">
                        <div class="maintenance-card-header">
                            <div class="maintenance-card-title">
                                <i class="fas fa-info-circle"></i>
                                Bilgilendirme
                            </div>
                        </div>
                        <div class="maintenance-card-body">
                            <div class="row g-3">
                                <div class="col-12">
                                    <div class="d-flex align-items-start gap-3">
                                        <div class="bg-primary bg-opacity-10 p-2 rounded">
                                            <i class="fas fa-tools text-primary"></i>
                                        </div>
                                        <div>
                                            <h6 class="mb-1">Bakım Talepleri</h6>
                                            <p class="text-muted small mb-0">Planlı bakım işlemleri için kullanılır. Önceden belirlenmiş bakım programlarına göre oluşturulur.</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="col-12">
                                    <div class="d-flex align-items-start gap-3">
                                        <div class="bg-warning bg-opacity-10 p-2 rounded">
                                            <i class="fas fa-exclamation-triangle text-warning"></i>
                                        </div>
                                        <div>
                                            <h6 class="mb-1">Arıza Talepleri</h6>
                                            <p class="text-muted small mb-0">Acil durumlar ve beklenmeyen sorunlar için kullanılır. Hızlı müdahale gerektirir.</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="col-12">
                                    <div class="alert alert-info">
                                        <i class="fas fa-lightbulb me-2"></i>
                                        <strong>İpucu:</strong> Detaylı açıklama yazarsanız, bakım ekibi daha hızlı ve etkili çözüm sağlayabilir.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createViewRequestsSection() {
    return `
        <div class="maintenance-section active" id="view-requests">
            <h2><i class="fas fa-list"></i>Bakım Talepleri</h2>
            <p class="description">Mevcut bakım ve arıza taleplerini görüntüleyin, filtreleyin ve yönetin. Sistemdeki tüm talepleri tek yerden takip edebilirsiniz.</p>
            
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
    
    const requestsHTML = filteredRequests.map(request => createRequestCard(request)).join('');
    requestsList.innerHTML = requestsHTML;
}

function filterRequests(requests, filter) {
    return requests.filter(request => {
        switch (filter) {
            case 'maintenance':
                return request.is_maintenance === true && request.resolved_at === null;
            case 'fault':
                return request.is_maintenance === false && request.resolved_at === null;
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

function createRequestCard(request) {
    const statusClass = request.resolved_at ? 'resolved' : 'open';
    const statusText = request.resolved_at ? 'Çözüldü' : 'Açık';
    const statusIcon = request.resolved_at ? 'fas fa-check-circle' : 'fas fa-clock';
    
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
    
    // Create breaking status indicator
    const breakingStatus = request.is_breaking ? `
        <div class="status-badge breaking">
            <i class="fas fa-stop-circle"></i>
            Makine Duruşta
        </div>
    ` : '';
    
    // Create collapsible details section
    const detailsId = `details-${request.id}`;
    const descriptionContent = request.description || 'Açıklama yok';
    const resolutionContent = request.resolved_at && request.resolution_description ? request.resolution_description : '';
    
    // Combine description and resolution content
    let detailsContent = `<strong>Açıklama:</strong><br>${descriptionContent}`;
    if (resolutionContent) {
        detailsContent += `<br><br><strong>Çözüm Açıklaması:</strong><br>${resolutionContent}`;
    }
    
    const collapsibleDetails = `
        <div class="description-toggle-container">
            <button class="description-toggle" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#${detailsId}" 
                    aria-expanded="false" 
                    aria-controls="${detailsId}">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Detaylar</strong>
                <i class="fas fa-chevron-down ms-2"></i>
            </button>
            <div class="collapse" id="${detailsId}">
                <div class="description-content">
                    ${detailsContent}
                </div>
            </div>
        </div>
    `;
    
    // Add resolve button for unresolved requests
    const resolveButton = !request.resolved_at ? `
        <button class="btn btn-success" onclick="resolveRequest(${request.id})">
            <i class="fas fa-check me-2"></i>
            Çözüldü Olarak İşaretle
        </button>
    ` : '';
    
    // Determine request type icon and color
    const requestType = request.is_maintenance ? 'maintenance' : 'fault';
    const typeIcon = request.is_maintenance ? 'fas fa-tools' : 'fas fa-exclamation-triangle';
    const typeText = request.is_maintenance ? 'Bakım Talebi' : 'Arıza Talebi';
    const typeColor = request.is_maintenance ? 'primary' : 'warning';
    
    return `
        <div class="maintenance-card">
            <div class="maintenance-card-header">
                <div class="maintenance-card-title">
                    <i class="${typeIcon}"></i>
                    ${request.machine_name || 'Makine Adı Yok'}
                </div>
                <div class="maintenance-card-subtitle">
                    <i class="fas fa-user me-1"></i>
                    ${request.reported_by_username || 'Bilinmiyor'} tarafından bildirildi
                </div>
            </div>
            
            <div class="maintenance-card-body">
                <div class="maintenance-card-content">
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <div class="d-flex align-items-center gap-2">
                                <div class="bg-light p-2 rounded">
                                    <i class="fas fa-calendar text-muted"></i>
                                </div>
                                <div>
                                    <small class="text-muted d-block">Bildirilme</small>
                                    <strong>${reportedAt}</strong>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="d-flex align-items-center gap-2">
                                <div class="bg-light p-2 rounded">
                                    <i class="fas fa-check-circle text-muted"></i>
                                </div>
                                <div>
                                    <small class="text-muted d-block">Çözülme</small>
                                    <strong>${resolvedAt}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <span class="badge bg-${typeColor} bg-opacity-10 text-${typeColor} border border-${typeColor} border-opacity-25">
                            <i class="${typeIcon} me-1"></i>
                            ${typeText}
                        </span>
                    </div>
                    
                    ${collapsibleDetails}
                </div>
            </div>
            
            <div class="maintenance-card-footer">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <div class="status-badge ${statusClass}">
                        <i class="${statusIcon}"></i>
                        ${statusText}
                    </div>
                    ${breakingStatus}
                </div>
                
                <div class="d-flex align-items-center gap-2">
                    ${resolveButton}
                </div>
            </div>
        </div>
    `;
}

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

async function loadMachines() {
    const machineSelect = document.getElementById('machine-select');
    if (!machineSelect) return;
    
    // Show loading state
    machineSelect.innerHTML = '<option value="">Makineler yükleniyor...</option>';
    machineSelect.disabled = true;
    
    try {
        const machines = await fetchMachines();
        populateMachinesDropdown(machines);
    } catch (error) {
        machineSelect.innerHTML = `
            <option value="">Makine yüklenirken hata oluştu</option>
        `;
        machineSelect.disabled = true;
        console.error('Error loading machines:', error);
    }
}

function populateMachinesDropdown(machines) {
    const machineSelect = document.getElementById('machine-select');
    if (!machineSelect) return;
    
    // Clear existing options except the first placeholder
    machineSelect.innerHTML = '<option value="">Makine seçin...</option>';
    
    // Add machine options
    machines.forEach(machine => {
        const option = document.createElement('option');
        option.value = machine.id;
        option.textContent = machine.name || `Makine ${machine.id}`;
        machineSelect.appendChild(option);
    });
    
    // Enable the select if it was disabled during loading
    machineSelect.disabled = false;
}

function setupMaintenanceRequestForm() {
    const form = document.getElementById('maintenance-request-form');
    if (!form) return;

    // Remove previous event listeners by replacing the form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Get new references from the new form
    const requestTypeSelect = newForm.querySelector('#request-type');
    const faultOperableContainer = newForm.querySelector('#fault-operable-container');
    const machineSelect = newForm.querySelector('#machine-select');
    const descriptionInput = newForm.querySelector('#description');
    const isOperableCheckbox = newForm.querySelector('#is-operable');

    if (requestTypeSelect && faultOperableContainer) {
        requestTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'fault') {
                faultOperableContainer.style.display = 'block';
            } else {
                faultOperableContainer.style.display = 'none';
            }
        });
    }

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const machineId = machineSelect ? machineSelect.value : '';
        const requestType = requestTypeSelect ? requestTypeSelect.value : '';
        const description = descriptionInput ? descriptionInput.value : '';
        const isOperable = isOperableCheckbox ? isOperableCheckbox.checked : true;

        if (!machineId || !requestType || !description) {
            alert('Lütfen tüm alanları doldurun.');
            return;
        }

        try {
            await createMaintenanceRequest({
                machine: machineId,
                is_maintenance: requestType === 'maintenance',
                description: description,
                is_breaking: !isOperable
            });

            // Reset form
            newForm.reset();
            // Hide the operable checkbox after form reset
            if (faultOperableContainer) {
                faultOperableContainer.style.display = 'none';
            }
            alert('Bakım talebi başarıyla oluşturuldu.');

            // Switch to view requests to see the new request
            const viewRequestsTab = document.querySelector('[data-tab="view-requests"]');
            if (viewRequestsTab) {
                viewRequestsTab.click();
            }

        } catch (error) {
            console.error('Error creating maintenance request:', error);
            alert('Bakım talebi oluşturulurken hata oluştu.');
        }
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
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!guardRoute()) {
        return;
    }
    
    initNavbar();
    setupTabNavigation();
    setupRefreshButton();
    
    // Initialize the default view (View Requests)
    loadTabContent('view-requests');
});