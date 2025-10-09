import { initNavbar } from '../components/navbar.js';
import { guardRoute } from '../authService.js';
import { authedFetch } from '../authService.js';
import { backendBase } from '../base.js';
import { resolveMaintenanceRequest, fetchMachineFaults } from './maintenanceApi.js';
import { GenericCard, createCardGrid } from '../components/genericCard/genericCard.js';
import { extractResultsFromResponse } from '../generic/paginationHelper.js';

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
            case 'equipment-status':
                await loadEquipmentStatusContent();
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


async function loadEquipmentStatusContent() {
    const contentContainer = document.getElementById('maintenance-content');
    contentContainer.innerHTML = createEquipmentStatusSection();
    
    // Load equipment status data
    await loadEquipmentStatus();
}

// ============================================================================
// EQUIPMENT STATUS FUNCTIONS
// ============================================================================

async function loadEquipmentStatus() {
    try {
        // Fetch machines and faults in parallel
        const [machinesResponse, faultsResponse] = await Promise.all([
            fetchMachines({}),
            fetchMachineFaults()
        ]);
        
        // Extract results from paginated responses
        const machines = extractResultsFromResponse(machinesResponse);
        const faults = extractResultsFromResponse(faultsResponse);
        
        // Process and combine the data
        const equipmentStatus = processEquipmentStatus(machines, faults);
        
        // Render the equipment status
        renderEquipmentStatus(equipmentStatus);
        
    } catch (error) {
        console.error('Error loading equipment status:', error);
        const statusContainer = document.getElementById('equipment-status-container');
        if (statusContainer) {
            statusContainer.innerHTML = `
                <div class="text-center py-5">
                    <div class="mb-4">
                        <i class="fas fa-exclamation-triangle text-danger" style="font-size: 4rem;"></i>
                    </div>
                    <h4 class="text-danger mb-2">Hata Oluştu</h4>
                    <p class="text-muted">Ekipman durumu yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">
                        <i class="fas fa-redo me-2"></i>Yenile
                    </button>
                </div>
            `;
        }
    }
}

function processEquipmentStatus(machines, faults) {
    // Create a map of active faults by machine ID
    const activeFaultsByMachine = {};
    
    faults.forEach(fault => {
        if (!fault.resolved_at) { // Only consider unresolved faults
            if (!activeFaultsByMachine[fault.machine]) {
                activeFaultsByMachine[fault.machine] = [];
            }
            activeFaultsByMachine[fault.machine].push(fault);
        }
    });
    
    // Process each machine and determine its status
    return machines.map(machine => {
        const machineFaults = activeFaultsByMachine[machine.id] || [];
        
        // Determine machine status
        let status = 'operational';
        let statusLabel = 'Çalışır Durumda';
        let statusIcon = 'fas fa-check-circle';
        let statusClass = 'success';
        
        if (machineFaults.length > 0) {
            const hasBreakingFault = machineFaults.some(fault => fault.is_breaking);
            const hasMaintenanceFault = machineFaults.some(fault => fault.is_maintenance);
            
            if (hasBreakingFault) {
                status = 'critical';
                statusLabel = 'Kritik Arıza';
                statusIcon = 'fas fa-exclamation-triangle';
                statusClass = 'danger';
            } else if (hasMaintenanceFault) {
                status = 'maintenance';
                statusLabel = 'Bakım Gerekli';
                statusIcon = 'fas fa-tools';
                statusClass = 'warning';
            } else {
                status = 'minor';
                statusLabel = 'Küçük Arıza';
                statusIcon = 'fas fa-info-circle';
                statusClass = 'info';
            }
        }
        
        return {
            ...machine,
            status,
            statusLabel,
            statusIcon,
            statusClass,
            activeFaults: machineFaults
        };
    });
}

function renderEquipmentStatus(equipmentStatus) {
    const statusContainer = document.getElementById('equipment-status-container');
    if (!statusContainer) return;
    
    // Update summary counts
    updateSummaryCounts(equipmentStatus);
    
    // Group machines by type
    const machinesByType = {};
    equipmentStatus.forEach(machine => {
        const type = machine.machine_type_label || machine.machine_type;
        if (!machinesByType[type]) {
            machinesByType[type] = [];
        }
        machinesByType[type].push(machine);
    });
    
    let html = '';
    
    // Render each machine type group
    Object.entries(machinesByType).forEach(([type, machines]) => {
        html += `
            <div class="equipment-type-section mb-4">
                <h3 class="equipment-type-title">
                    <i class="fas fa-cogs me-2"></i>
                    ${type}
                </h3>
                <div class="equipment-grid">
        `;
        
        machines.forEach(machine => {
            html += createEquipmentCard(machine);
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    statusContainer.innerHTML = html;
}

function updateSummaryCounts(equipmentStatus) {
    const counts = {
        operational: 0,
        critical: 0,
        maintenance: 0,
        minor: 0
    };
    
    equipmentStatus.forEach(machine => {
        counts[machine.status]++;
    });
    
    // Update the summary count elements
    const operationalCount = document.getElementById('operational-count');
    const criticalCount = document.getElementById('critical-count');
    const maintenanceCount = document.getElementById('maintenance-count');
    const minorCount = document.getElementById('minor-count');
    
    if (operationalCount) operationalCount.textContent = counts.operational;
    if (criticalCount) criticalCount.textContent = counts.critical;
    if (maintenanceCount) maintenanceCount.textContent = counts.maintenance;
    if (minorCount) minorCount.textContent = counts.minor;
}

function createEquipmentCard(machine) {
    const propertiesHtml = Object.entries(machine.properties || {}).map(([key, value]) => 
        `<div class="equipment-property"><strong>${key}:</strong> ${value}</div>`
    ).join('');
    
    const faultsHtml = machine.activeFaults.length > 0 ? `
        <div class="equipment-faults">
            <h6 class="faults-title">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Aktif Arızalar (${machine.activeFaults.length})
            </h6>
            ${machine.activeFaults.map(fault => `
                <div class="fault-item">
                    <div class="fault-description">${fault.description}</div>
                    <div class="fault-meta">
                        <small class="text-muted">
                            <i class="fas fa-user me-1"></i>${fault.reported_by_username}
                            <i class="fas fa-calendar ms-3 me-1"></i>${new Date(fault.reported_at).toLocaleDateString('tr-TR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </small>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';
    
    const propertiesToggleHtml = propertiesHtml ? `
        <div class="equipment-properties-toggle">
            <button class="properties-toggle-btn" onclick="toggleProperties(this)" data-target="properties-${machine.id}">
                <i class="fas fa-chevron-down"></i>
                <span>Özellikleri Göster</span>
            </button>
            <div class="equipment-properties collapsed" id="properties-${machine.id}">
                ${propertiesHtml}
            </div>
        </div>
    ` : '';
    
    return `
        <div class="equipment-card ${machine.statusClass}">
            <div class="equipment-card-header">
                <div class="equipment-status-badge ${machine.statusClass}">
                    <i class="${machine.statusIcon}"></i>
                    ${machine.statusLabel}
                </div>
                <h5 class="equipment-name">${machine.name}</h5>
            </div>
            <div class="equipment-card-body">
                <div class="equipment-info">
                    ${propertiesToggleHtml}
                </div>
                ${faultsHtml}
            </div>
        </div>
    `;
}

// Global function for toggling properties visibility
window.toggleProperties = function(button) {
    const targetId = button.getAttribute('data-target');
    const propertiesDiv = document.getElementById(targetId);
    const icon = button.querySelector('i');
    const span = button.querySelector('span');
    
    if (propertiesDiv.classList.contains('collapsed')) {
        // Expand
        propertiesDiv.classList.remove('collapsed');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        span.textContent = 'Özellikleri Gizle';
    } else {
        // Collapse
        propertiesDiv.classList.add('collapsed');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        span.textContent = 'Özellikleri Göster';
    }
}

function createEquipmentStatusSection() {
    return `
        <div class="equipment-status-section">
            <div class="row">
                <div class="col-12">
                    <div class="equipment-status-header">
                        <h2 class="section-title">
                            <i class="fas fa-clipboard-check me-3"></i>
                            Ekipman Durumu
                        </h2>
                        <p class="section-description">
                            Tüm ekipmanların mevcut durumunu ve aktif arızalarını görüntüleyin
                        </p>
                    </div>
                    
                    <div class="equipment-summary mb-4">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="summary-card operational">
                                    <div class="summary-icon">
                                        <i class="fas fa-check-circle"></i>
                                    </div>
                                    <div class="summary-content">
                                        <h4 class="summary-count" id="operational-count">-</h4>
                                        <p class="summary-label">Çalışır Durumda</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="summary-card critical">
                                    <div class="summary-icon">
                                        <i class="fas fa-exclamation-triangle"></i>
                                    </div>
                                    <div class="summary-content">
                                        <h4 class="summary-count" id="critical-count">-</h4>
                                        <p class="summary-label">Kritik Arıza</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="summary-card maintenance">
                                    <div class="summary-icon">
                                        <i class="fas fa-tools"></i>
                                    </div>
                                    <div class="summary-content">
                                        <h4 class="summary-count" id="maintenance-count">-</h4>
                                        <p class="summary-label">Bakım Gerekli</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="summary-card minor">
                                    <div class="summary-icon">
                                        <i class="fas fa-info-circle"></i>
                                    </div>
                                    <div class="summary-content">
                                        <h4 class="summary-count" id="minor-count">-</h4>
                                        <p class="summary-label">Küçük Arıza</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="equipment-status-container">
                        <div class="loading-container">
                            <div class="loading-spinner"></div>
                            <p class="text-muted">Ekipman durumu yükleniyor...</p>
                        </div>
                    </div>
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
// REFRESH FUNCTIONALITY
// ============================================================================

function setupRefreshButton() {
    const refreshButton = new RefreshButton('refresh-btn-container', {
        onRefresh: async () => {
            // Get current active tab
            const activeTab = document.querySelector('.tab-button.active');
            const currentTab = activeTab ? activeTab.getAttribute('data-tab') : 'view-requests';
            
            // Reload current tab content
            await loadTabContent(currentTab);
        }
    });
}

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================


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

// Show request details (placeholder function)
function showRequestDetails(request) {
    // Create a modal or expandable section to show full details
    const descriptionContent = request.description || 'Açıklama yok';
    const resolutionContent = request.resolved_at && request.resolution_description ? request.resolution_description : '';
    
    let detailsContent = `<strong>Açıklama:</strong><br>${descriptionContent}`;
    if (resolutionContent) {
        detailsContent += `<br><br><strong>Çözüm Açıklaması:</strong><br>${resolutionContent}`;
    }
    
    // For now, show an alert. You can replace this with a proper modal
    alert(`Detaylar:\n\n${detailsContent.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '')}`);
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