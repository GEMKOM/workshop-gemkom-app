import { guardRoute, authedFetch } from '../authService.js';
import { backendBase } from '../base.js';
import { fetchMachines } from '../generic/machines.js';
import { createMaintenanceRequest, resolveMaintenanceRequest } from './maintenanceApi.js';
import { createHeader, createFooter, populateUserInfo } from '../components/header.js';

// ============================================================================
// MOBILE NAVIGATION
// ============================================================================

function setupMobileNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const section = tab.dataset.section;
            
            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show appropriate section
            showSection(section);
        });
    });
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    currentSection: 'view-requests', // Default to "Bakım Taleplerini Görüntüle"
    maintenanceRequests: [],
    currentFilter: 'all'
};

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
// CONTENT MANAGEMENT
// ============================================================================

function createMaintenanceRequestForm() {
    return `
        <div class="maintenance-section active" id="create-request">
            <h2>Bakım/Arıza Talebi Oluştur</h2>
            <p class="description">Yeni bir bakım veya arıza talebi oluşturun.</p>
            
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-body">
                            <form id="maintenance-request-form">
                                <div class="mb-3">
                                    <label for="machine-select" class="form-label">Makine Seçin</label>
                                    <select class="form-select" id="machine-select" required>
                                        <option value="">Makine seçin...</option>
                                        <!-- Machines will be loaded dynamically -->
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="request-type" class="form-label">Talep Türü</label>
                                    <select class="form-select" id="request-type" required>
                                        <option value="">Tür seçin...</option>
                                        <option value="maintenance">Bakım</option>
                                        <option value="fault">Arıza</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3" id="fault-operable-container" style="display: none;">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="is-operable" checked>
                                        <label class="form-check-label" for="is-operable">
                                            Makine çalışır durumda
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="description" class="form-label">Açıklama</label>
                                    <textarea class="form-control" id="description" rows="4" 
                                              placeholder="Bakım/arıza detaylarını açıklayın..." required></textarea>
                                </div>
                                
                                <div class="text-end">
                                    <button type="submit" class="btn btn-primary">Talep Oluştur</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Bilgi</h5>
                            <p class="card-text">
                                Bakım talepleri planlı bakım işlemleri için kullanılır.<br><br>
                                Arıza talepleri acil durumlar ve beklenmeyen sorunlar için kullanılır.
                            </p>
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
            <h2>Bakım Taleplerini Görüntüle</h2>
            <p class="description">Mevcut bakım ve arıza taleplerini görüntüleyin ve yönetin.</p>
            
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title mb-0">Bakım Talepleri</h5>
                                <div class="btn-group" role="group">
                                    <button type="button" class="btn btn-outline-primary active" data-filter="all">Tümü</button>
                                    <button type="button" class="btn btn-outline-primary" data-filter="maintenance">Bakım</button>
                                    <button type="button" class="btn btn-outline-primary" data-filter="fault">Arıza</button>
                                    <button type="button" class="btn btn-outline-danger" data-filter="breaking">Duruşta</button>
                                    <button type="button" class="btn btn-outline-success" data-filter="completed">Tamamlanan</button>
                                </div>
                            </div>
                            
                            <div id="requests-list">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Yükleniyor...</span>
                                    </div>
                                    <p class="mt-2">Talepler yükleniyor...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Resolve Modal -->
        <div class="modal fade" id="resolveModal" tabindex="-1" aria-labelledby="resolveModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="resolveModalLabel">Talep Çözümü</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="resolve-form">
                            <div class="mb-3">
                                <label for="resolution-description" class="form-label">Çözüm Açıklaması</label>
                                <textarea class="form-control" id="resolution-description" rows="4" 
                                          placeholder="Talep nasıl çözüldü? Detayları açıklayın..." required></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                        <button type="button" class="btn btn-success" id="confirm-resolve">Çözüldü Olarak İşaretle</button>
                    </div>
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
            <div class="text-center py-4">
                <p class="text-muted">Gösterilecek talep bulunamadı.</p>
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
    const statusClass = request.resolved_at ? 'success' : 'warning';
    const statusText = request.resolved_at ? 'Çözüldü' : 'Açık';
    const statusIcon = request.resolved_at ? '✅' : '⚠️';
    
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
        <div class="mb-2">
            <span class="badge bg-danger">
                🛑 Makine Duruşta
            </span>
        </div>
    ` : '';
    
    // Create collapsible description
    const descriptionId = `description-${request.id}`;
    const descriptionContent = request.description || 'Açıklama yok';
    
    const collapsibleDescription = `
        <div class="description-toggle-container">
            <button class="btn btn-link btn-sm p-0 description-toggle" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#${descriptionId}" 
                    aria-expanded="false" 
                    aria-controls="${descriptionId}">
                <strong>Açıklamayı Görüntüle</strong> ▼
            </button>
            <div class="collapse" id="${descriptionId}">
                <div class="description-content mt-2">
                    ${descriptionContent}
                </div>
            </div>
        </div>
    `;
    
    // Create collapsible resolution description for resolved requests
    let collapsibleResolutionDescription = '';
    if (request.resolved_at && request.resolution_description) {
        const resolutionId = `resolution-${request.id}`;
        const resolutionContent = request.resolution_description;
        
        collapsibleResolutionDescription = `
            <div class="description-toggle-container mt-2">
                <button class="btn btn-link btn-sm p-0 description-toggle" 
                        data-bs-toggle="collapse" 
                        data-bs-target="#${resolutionId}" 
                        aria-expanded="false" 
                        aria-controls="${resolutionId}">
                    <strong>Çözüm Açıklamasını Görüntüle</strong> ▼
                </button>
                <div class="collapse" id="${resolutionId}">
                    <div class="description-content mt-2">
                        ${resolutionContent}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add resolve button for unresolved requests
    const resolveButton = !request.resolved_at ? `
        <div class="mt-2">
            <button class="btn btn-success btn-sm" onclick="resolveRequest(${request.id})">
                <i class="fas fa-check"></i> Çözüldü Olarak İşaretle
            </button>
        </div>
    ` : '';
    
    return `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <h6 class="card-title">${request.machine_name || 'Makine Adı Yok'}</h6>
                        <div class="row">
                            <div class="col-md-6">
                                <small class="text-muted">
                                    <strong>Bildirilme:</strong> ${reportedAt}
                                </small>
                            </div>
                            <div class="col-md-6">
                                <small class="text-muted">
                                    <strong>Çözülme:</strong> ${resolvedAt}
                                </small>
                            </div>
                        </div>
                        <div class="card-text mt-2">
                            ${collapsibleDescription}
                            ${collapsibleResolutionDescription}
                        </div>
                        ${resolveButton}
                    </div>
                    <div class="col-md-4 text-end">
                        <span class="badge bg-${statusClass}">
                            ${statusIcon} ${statusText}
                        </span>
                        ${breakingStatus}
                        <small class="text-muted">
                            <strong>Bildiren:</strong> ${request.reported_by_username || 'Bilinmiyor'}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadContent() {
    const contentContainer = document.getElementById('maintenance-content');
    
    // Clear existing content
    contentContainer.innerHTML = '';
    
    // Add both sections (one will be active)
    contentContainer.innerHTML = createMaintenanceRequestForm() + createViewRequestsSection();
    
    // Show the current section
    showSection(state.currentSection);
    
    // Load maintenance requests if viewing that section
    if (state.currentSection === 'view-requests') {
        loadMaintenanceRequests();
        setupResolveModal();
    }
    
    else if (state.currentSection === 'create-request') {
        loadMachines();
        setupMaintenanceRequestForm();
    }
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
    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
                // Reset button styles
                if (btn.dataset.filter === 'breaking') {
                    btn.classList.remove('btn-danger');
                    btn.classList.add('btn-outline-danger');
                } else if (btn.dataset.filter === 'completed') {
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-success');
                } else {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-outline-primary');
                }
            });
            
            // Add active class to clicked button and update styles
            e.target.classList.add('active');
            if (e.target.dataset.filter === 'breaking') {
                e.target.classList.remove('btn-outline-danger');
                e.target.classList.add('btn-danger');
            } else if (e.target.dataset.filter === 'completed') {
                e.target.classList.remove('btn-outline-success');
                e.target.classList.add('btn-success');
            } else {
                e.target.classList.remove('btn-outline-primary');
                e.target.classList.add('btn-primary');
            }
            
            // Update filter and re-render
            state.currentFilter = e.target.dataset.filter;
            renderMaintenanceRequests();
        });
    });
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.maintenance-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update state
    state.currentSection = sectionId;
    
    // Load maintenance requests if switching to that section
    if (sectionId === 'view-requests') {
        loadMaintenanceRequests();
        setupResolveModal();
    }
    
    // Load machines if switching to create request section
    if (sectionId === 'create-request') {
        loadMachines();
        setupMaintenanceRequestForm();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) {
        return;
    }
    
    // Insert header and footer
    const headerContainer = document.getElementById('header-container');
    const footerContainer = document.getElementById('footer-container');
    
    if (headerContainer) {
        headerContainer.innerHTML = createHeader();
    }
    
    if (footerContainer) {
        footerContainer.innerHTML = createFooter();
    }
    
    // Populate user info
    populateUserInfo();
    
    // Setup mobile navigation
    setupMobileNavigation();
    
    // Load content
    loadContent();
});

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
            showSection('view-requests');

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

// Make resolveRequest function globally available
window.resolveRequest = function(requestId) {
    currentResolveRequestId = requestId;
    const resolveModal = new bootstrap.Modal(document.getElementById('resolveModal'));
    resolveModal.show();
};

// Setup resolve modal handlers
function setupResolveModal() {
    const confirmResolveBtn = document.getElementById('confirm-resolve');
    const resolutionDescription = document.getElementById('resolution-description');
    
    if (confirmResolveBtn && resolutionDescription) {
        // Remove previous event listeners by replacing the button
        const newBtn = confirmResolveBtn.cloneNode(true);
        confirmResolveBtn.parentNode.replaceChild(newBtn, confirmResolveBtn);
        newBtn.addEventListener('click', async () => {
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
                // Show loading state
                newBtn.disabled = true;
                newBtn.textContent = 'İşleniyor...';
                
                await resolveMaintenanceRequest(currentResolveRequestId, description);
                
                // Close modal
                const resolveModal = bootstrap.Modal.getInstance(document.getElementById('resolveModal'));
                resolveModal.hide();
                
                // Reset form
                resolutionDescription.value = '';
                currentResolveRequestId = null;
                
                // Refresh the requests list
                await loadMaintenanceRequests();
                
                alert('Talep başarıyla çözüldü olarak işaretlendi.');
                
            } catch (error) {
                console.error('Error resolving request:', error);
                alert('Talep çözülürken hata oluştu.');
            } finally {
                newBtn.disabled = false;
                newBtn.textContent = 'Çözüldü Olarak İşaretle';
            }
        });
    }
}