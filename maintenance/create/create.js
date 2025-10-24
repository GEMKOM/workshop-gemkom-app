import { initNavbar } from '../../components/navbar.js';
import { guardRoute } from '../../authService.js';
import { authedFetch } from '../../authService.js';
import { backendBase } from '../../base.js';
import { fetchMachines } from '../../generic/machines.js';
import { createMaintenanceRequest } from '../maintenanceApi.js';
import { ModernDropdown } from '../../components/dropdown/dropdown.js';
import { extractResultsFromResponse } from '../../generic/paginationHelper.js';
import { HeaderComponent } from '../../components/header/header.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    machines: [],
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
    loadCreateRequestContent();
});

// ============================================================================
// HEADER SETUP
// ============================================================================

function setupHeader() {
    const headerConfig = {
        title: 'Yeni Bakım Talebi',
        subtitle: 'Yeni bir bakım veya arıza talebi oluşturun. Detaylı bilgi vererek daha hızlı çözüm sağlayabilirsiniz.',
        icon: 'plus-circle',
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

async function loadCreateRequestContent() {
    const contentContainer = document.getElementById('create-request-content');
    
    // Add loading state
    contentContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="text-muted">Yükleniyor...</p>
        </div>
    `;
    
    try {
        // Load the create request form
        contentContainer.innerHTML = createMaintenanceRequestForm();
        
        // Setup form first, then load machines
        setupMaintenanceRequestForm();
        await loadMachines();
    } catch (error) {
        console.error('Error loading create request content:', error);
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
// FORM CREATION
// ============================================================================

function createMaintenanceRequestForm() {
    return `
        <div class="create-request-section">
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
                                    <div class="col-12">
                                        <div class="modern-checkbox-container">
                                            <label class="modern-checkbox">
                                                <input type="checkbox" id="custom-equipment-checkbox">
                                                <span class="modern-checkmark"></span>
                                                <span class="modern-checkbox-text">
                                                    <i class="fas fa-tools text-primary me-2"></i>
                                                    Özel Ekipman Bilgisi Gir
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6" id="machine-selection-container">
                                        <label class="form-label">
                                            <i class="fas fa-cogs"></i>
                                            Makine Seçin
                                        </label>
                                        <div id="machine-selection-button-container"></div>
                                        <div id="selected-machine-display" class="selected-machine-display" style="display: none;">
                                            <div class="selected-machine-card">
                                                <div class="selected-machine-info">
                                                    <div class="selected-machine-name"></div>
                                                    <div class="selected-machine-details"></div>
                                                </div>
                                                <button type="button" class="btn btn-outline-secondary btn-sm" id="change-machine-btn">
                                                    <i class="fas fa-edit"></i> Değiştir
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6" id="custom-equipment-container" style="display: none;">
                                        <label for="asset-name" class="form-label">
                                            <i class="fas fa-tag"></i>
                                            Ekipman Adı
                                        </label>
                                        <input type="text" class="form-control" id="asset-name" placeholder="Ekipman adını girin">
                                    </div>
                                    
                                    <div class="col-md-6" id="location-container" style="display: none;">
                                        <label for="location" class="form-label">
                                            <i class="fas fa-map-marker-alt"></i>
                                            Konum
                                        </label>
                                        <input type="text" class="form-control" id="location" placeholder="Konum bilgisini girin">
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <label for="request-type-dropdown" class="form-label">
                                            <i class="fas fa-tag"></i>
                                            Talep Türü
                                        </label>
                                        <div id="request-type-dropdown"></div>
                                    </div>
                                    
                                    <div class="col-12" id="fault-operable-container" style="display: none;">
                                        <div class="maintenance-card" style="margin-bottom: 0;">
                                            <div class="maintenance-card-body">
                                                <div class="modern-checkbox-container">
                                                    <label class="modern-checkbox">
                                                        <input type="checkbox" id="is-operable" checked>
                                                        <span class="modern-checkmark"></span>
                                                        <span class="modern-checkbox-text">
                                                            <i class="fas fa-check-circle text-success me-2"></i>
                                                            Makine çalışır durumda
                                                        </span>
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

// ============================================================================
// FORM SETUP
// ============================================================================

function setupMaintenanceRequestForm() {
    const form = document.getElementById('maintenance-request-form');
    if (!form) return;

    // Get form elements
    const faultOperableContainer = form.querySelector('#fault-operable-container');
    const descriptionInput = form.querySelector('#description');
    const isOperableCheckbox = form.querySelector('#is-operable');
    const customEquipmentCheckbox = form.querySelector('#custom-equipment-checkbox');
    const machineSelectionContainer = form.querySelector('#machine-selection-container');
    const customEquipmentContainer = form.querySelector('#custom-equipment-container');
    const locationContainer = form.querySelector('#location-container');
    const assetNameInput = form.querySelector('#asset-name');
    const locationInput = form.querySelector('#location');

    // Setup request type dropdown
    const requestTypeContainer = form.querySelector('#request-type-dropdown');
    if (requestTypeContainer) {
        console.log('Creating request type dropdown');
        const requestTypeDropdown = new ModernDropdown(requestTypeContainer, {
            placeholder: 'Tür seçin...'
        });
        
        const requestTypeItems = [
            { value: 'maintenance', text: 'Bakım' },
            { value: 'fault', text: 'Arıza' }
        ];
        
        requestTypeDropdown.setItems(requestTypeItems);
        
        // Handle request type change
        requestTypeContainer.addEventListener('dropdown:select', (e) => {
            console.log('Request type changed to:', e.detail.value);
            if (e.detail.value === 'fault') {
                faultOperableContainer.style.display = 'block';
            } else {
                faultOperableContainer.style.display = 'none';
            }
        });
        
        // Store dropdown reference for form submission
        requestTypeContainer.dropdownInstance = requestTypeDropdown;
        console.log('Request type dropdown created successfully');
    } else {
        console.error('Request type dropdown container not found');
    }

    // Setup custom equipment checkbox toggle
    if (customEquipmentCheckbox) {
        customEquipmentCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            
            if (isChecked) {
                // Show warning dialog before enabling custom equipment
                showCustomEquipmentWarning(() => {
                    // Show custom equipment fields, hide machine selection
                machineSelectionContainer.style.display = 'none';
                customEquipmentContainer.style.display = 'block';
                locationContainer.style.display = 'block';
                
                    // Clear machine selection
                    const buttonContainer = form.querySelector('#machine-selection-button-container');
                    const selectedDisplay = form.querySelector('#selected-machine-display');
                    if (buttonContainer) buttonContainer.style.display = 'block';
                    if (selectedDisplay) {
                        selectedDisplay.style.display = 'none';
                        selectedDisplay.removeAttribute('data-selected-machine-id');
                    }
                });
            } else {
                // Show machine selection, hide custom equipment fields
                machineSelectionContainer.style.display = 'block';
                customEquipmentContainer.style.display = 'none';
                locationContainer.style.display = 'none';
                
                // Clear custom equipment fields
                if (assetNameInput) assetNameInput.value = '';
                if (locationInput) locationInput.value = '';
            }
        });
    }

    // Setup form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get values from form elements
        const selectedMachineDisplay = form.querySelector('#selected-machine-display');
        const requestTypeDropdown = form.querySelector('#request-type-dropdown').dropdownInstance;
        
        const machineId = selectedMachineDisplay ? selectedMachineDisplay.getAttribute('data-selected-machine-id') : '';
        const requestType = requestTypeDropdown ? requestTypeDropdown.getValue() : '';
        const description = descriptionInput ? descriptionInput.value : '';
        const isOperable = isOperableCheckbox ? isOperableCheckbox.checked : true;
        const isCustomEquipment = customEquipmentCheckbox ? customEquipmentCheckbox.checked : false;
        const assetName = assetNameInput ? assetNameInput.value.trim() : '';
        const location = locationInput ? locationInput.value.trim() : '';

        // Validation based on equipment type
        if (!requestType || !description) {
            alert('Lütfen talep türü ve açıklama alanlarını doldurun.');
            return;
        }

        if (isCustomEquipment) {
            if (!assetName || !location) {
                alert('Lütfen ekipman adı ve konum bilgilerini doldurun.');
                return;
            }
        } else {
            if (!machineId) {
                alert('Lütfen bir makine seçin.');
                return;
            }
        }

        try {
            state.isLoading = true;
            
            // Disable submit button
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Oluşturuluyor...';

            const requestData = {
                is_maintenance: requestType === 'maintenance',
                description: description,
                is_breaking: !isOperable
            };

            if (isCustomEquipment) {
                // For custom equipment, send asset_name and location instead of machine
                requestData.asset_name = assetName;
                requestData.location = location;
            } else {
                // For regular machines, send machine ID
                requestData.machine = machineId;
            }

            await createMaintenanceRequest(requestData);

            // Reset form
            form.reset();
            
            // Reset dropdowns
            if (requestTypeDropdown) requestTypeDropdown.setValue('');
            
            // Reset machine selection
            const buttonContainer = form.querySelector('#machine-selection-button-container');
            const selectedDisplay = form.querySelector('#selected-machine-display');
            if (buttonContainer) buttonContainer.style.display = 'block';
            if (selectedDisplay) {
                selectedDisplay.style.display = 'none';
                selectedDisplay.removeAttribute('data-selected-machine-id');
            }
            
            // Reset custom equipment fields and checkbox
            if (customEquipmentCheckbox) {
                customEquipmentCheckbox.checked = false;
            }
            if (assetNameInput) assetNameInput.value = '';
            if (locationInput) locationInput.value = '';
            
            // Reset visibility to default state
            if (machineSelectionContainer) machineSelectionContainer.style.display = 'block';
            if (customEquipmentContainer) customEquipmentContainer.style.display = 'none';
            if (locationContainer) locationContainer.style.display = 'none';
            
            // Hide the operable checkbox after form reset
            if (faultOperableContainer) {
                faultOperableContainer.style.display = 'none';
            }
            
            alert('Bakım talebi başarıyla oluşturuldu.');

            // Redirect to maintenance page to see the new request
            window.location.href = '../index.html';

        } catch (error) {
            console.error('Error creating maintenance request:', error);
            alert('Bakım talebi oluşturulurken hata oluştu.');
        } finally {
            state.isLoading = false;
            
            // Re-enable submit button
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Talep Oluştur';
        }
    });
}

// ============================================================================
// CUSTOM EQUIPMENT WARNING
// ============================================================================

function showCustomEquipmentWarning(onConfirm) {
    // Create warning modal overlay
    const warningOverlay = document.createElement('div');
    warningOverlay.className = 'custom-equipment-warning-modal';
    warningOverlay.innerHTML = `
        <div class="warning-modal-content">
            <div class="warning-header">
                <div class="warning-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="warning-title">
                    <h4>Özel Ekipman Uyarısı</h4>
                    <p>Lütfen önce mevcut makine listesini kontrol edin</p>
                </div>
            </div>
            <div class="warning-body">
                <div class="warning-message">
                    <p><strong>Önemli:</strong> Özel ekipman seçeneğini kullanmadan önce, bakım yapılacak makinenin sistemde kayıtlı olup olmadığını kontrol etmeniz önerilir.</p>
                    <ul>
                        <li><i class="fas fa-check-circle"></i> Mevcut makine listesinde arama yapın</li>
                        <li><i class="fas fa-check-circle"></i> Makine bulunamazsa özel ekipman seçeneğini kullanın</li>
                        <li><i class="fas fa-check-circle"></i> Bu seçenek sadece sistemde kayıtlı olmayan ekipmanlar için kullanılmalıdır</li>
                    </ul>
                </div>
            </div>
            <div class="warning-footer">
                <button type="button" class="btn btn-secondary" id="cancel-custom-equipment">
                    <i class="fas fa-arrow-left me-2"></i>Geri Dön
                </button>
                <button type="button" class="btn btn-primary" id="confirm-custom-equipment">
                    <i class="fas fa-tools me-2"></i>Özel Ekipman Kullan
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(warningOverlay);
    
    // Add event listeners
    const cancelBtn = warningOverlay.querySelector('#cancel-custom-equipment');
    const confirmBtn = warningOverlay.querySelector('#confirm-custom-equipment');
    
    cancelBtn.addEventListener('click', () => {
        // Uncheck the checkbox
        const customEquipmentCheckbox = document.getElementById('custom-equipment-checkbox');
        if (customEquipmentCheckbox) {
            customEquipmentCheckbox.checked = false;
        }
        document.body.removeChild(warningOverlay);
    });
    
    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(warningOverlay);
        onConfirm();
    });
    
    // Close on overlay click
    warningOverlay.addEventListener('click', (e) => {
        if (e.target === warningOverlay) {
            // Uncheck the checkbox
            const customEquipmentCheckbox = document.getElementById('custom-equipment-checkbox');
            if (customEquipmentCheckbox) {
                customEquipmentCheckbox.checked = false;
            }
            document.body.removeChild(warningOverlay);
        }
    });
}

// ============================================================================
// MACHINE LOADING
// ============================================================================

async function loadMachines() {
    const machineButtonContainer = document.getElementById('machine-selection-button-container');
    if (!machineButtonContainer) return;
    
    // Show loading state
    machineButtonContainer.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p class="text-muted">Makineler yükleniyor...</p></div>';
    
    try {
        const machinesResponse = await fetchMachines({compact: true, exclude_used_in: "it"});
        const machines = extractResultsFromResponse(machinesResponse);
        state.machines = machines;
        createMachineSelectionButton(machines);
    } catch (error) {
        machineButtonContainer.innerHTML = '<div class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>Makine yüklenirken hata oluştu</div>';
        console.error('Error loading machines:', error);
    }
}

function createMachineSelectionButton(machines) {
    const machineButtonContainer = document.getElementById('machine-selection-button-container');
    if (!machineButtonContainer) {
        console.error('Machine button container not found');
        return;
    }
    
    console.log('Creating machine selection button with', machines.length, 'machines');
    
    // Create the selection button
    machineButtonContainer.innerHTML = `
        <button type="button" class="btn btn-primary w-100" id="select-machine-btn">
            <i class="fas fa-list me-2"></i>
            Makine Seç
        </button>
    `;
    
    // Add click event listener
    const selectMachineBtn = document.getElementById('select-machine-btn');
    selectMachineBtn.addEventListener('click', () => {
        openMachineSelectionTable(machines);
    });
    
    console.log('Machine selection button created successfully');
}

function openMachineSelectionTable(machines) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'machine-selection-modal';
    modalOverlay.innerHTML = `
        <div class="machine-selection-modal-content">
            <div class="machine-selection-header">
                <div class="header-content">
                    <div class="header-icon">
                        <i class="fas fa-cogs"></i>
                    </div>
                    <div class="header-text">
                        <h4>Makine Seçin</h4>
                        <p>Bakım yapılacak makineyi seçin</p>
                    </div>
                </div>
                <button type="button" class="btn-close" id="close-machine-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="machine-selection-body">
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" class="search-input" id="machine-search" placeholder="Makine adı, tür veya kullanıcı ara...">
                        <button type="button" class="search-clear-btn" id="clear-search" style="display: none;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="machine-cards-container" id="machine-cards-container">
                    ${machines.map(machine => `
                        <div class="machine-card" 
                             data-machine-id="${machine.id || ''}" 
                             data-machine-name="${machine.name || '-'}"
                             data-machine-type="${machine.machine_type_label || '-'}"
                             data-machine-code="${machine.code || '-'}"
                             data-machine-users="${machine.assigned_users ? machine.assigned_users.map(u => u.username).join(', ') : ''}">
                            <div class="machine-card-header">
                                <div class="machine-icon">
                                    <i class="fas fa-cog"></i>
                                </div>
                                <div class="machine-info">
                                    <h6 class="machine-name">${machine.name || '-'}</h6>
                                    <span class="machine-code">${machine.code || '-'}</span>
                                </div>
                                <div class="machine-type-badge">
                                    ${machine.machine_type_label || '-'}
                                </div>
                            </div>
                            <div class="machine-card-body">
                                <div class="assigned-users-section">
                                    <div class="users-label">
                                        <i class="fas fa-users"></i>
                                        Kullanıcılar:
                                    </div>
                                    <div class="assigned-users">
                                        ${machine.assigned_users && machine.assigned_users.length > 0 
                                            ? machine.assigned_users.map(user => 
                                                `<span class="user-badge">${user.username}</span>`
                                              ).join('')
                                            : '<span class="no-users">Atanmamış</span>'
                                        }
                                    </div>
                                </div>
                            </div>
                            <div class="machine-card-footer">
                                <div class="select-indicator">
                                    <i class="fas fa-check-circle"></i>
                                    Seçmek için dokunun
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Add event listeners
    const closeBtn = modalOverlay.querySelector('#close-machine-modal');
    const machineCards = modalOverlay.querySelectorAll('.machine-card');
    const searchInput = modalOverlay.querySelector('#machine-search');
    const clearSearchBtn = modalOverlay.querySelector('#clear-search');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    });
    
    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterMachines(searchTerm, machineCards);
        
        // Show/hide clear button
        if (searchTerm) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }
    });
    
    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        filterMachines('', machineCards);
    });
    
    // Handle machine selection
    machineCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const machineId = card.getAttribute('data-machine-id');
            const machineName = card.getAttribute('data-machine-name');
            const machineType = card.getAttribute('data-machine-type');
            const machineCode = card.getAttribute('data-machine-code');
            const machineUsers = card.getAttribute('data-machine-users');
            
            selectMachine(machineId, machineName, machineType, machineCode, machineUsers);
            document.body.removeChild(modalOverlay);
        });
    });
}

function filterMachines(searchTerm, machineCards) {
    machineCards.forEach(card => {
        const machineName = card.getAttribute('data-machine-name').toLowerCase();
        const machineType = card.getAttribute('data-machine-type').toLowerCase();
        const machineCode = card.getAttribute('data-machine-code').toLowerCase();
        const machineUsers = card.getAttribute('data-machine-users').toLowerCase();
        
        const matches = searchTerm === '' || 
            machineName.includes(searchTerm) ||
            machineType.includes(searchTerm) ||
            machineCode.includes(searchTerm) ||
            machineUsers.includes(searchTerm);
        
        if (matches) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show/hide no results message
    const container = document.getElementById('machine-cards-container');
    const visibleCards = Array.from(machineCards).filter(card => card.style.display !== 'none');
    
    // Remove existing no results message
    const existingNoResults = container.querySelector('.no-results-message');
    if (existingNoResults) {
        existingNoResults.remove();
    }
    
    // Add no results message if no cards are visible and there's a search term
    if (visibleCards.length === 0 && searchTerm) {
        const noResultsMessage = document.createElement('div');
        noResultsMessage.className = 'no-results-message';
        noResultsMessage.innerHTML = `
            <div class="no-results-content">
                <i class="fas fa-search"></i>
                <h4>Arama Sonucu Bulunamadı</h4>
                <p>"${searchTerm}" için sonuç bulunamadı.</p>
                <p>Farklı anahtar kelimeler deneyin.</p>
            </div>
        `;
        container.appendChild(noResultsMessage);
    }
}

function selectMachine(machineId, machineName, machineType, machineCode, machineUsers) {
    // Hide the button and show selected machine display
    const buttonContainer = document.getElementById('machine-selection-button-container');
    const selectedDisplay = document.getElementById('selected-machine-display');
    
    buttonContainer.style.display = 'none';
    selectedDisplay.style.display = 'block';
    
    // Update the display
    const nameElement = selectedDisplay.querySelector('.selected-machine-name');
    const detailsElement = selectedDisplay.querySelector('.selected-machine-details');
    
    nameElement.textContent = machineName || '-';
    detailsElement.innerHTML = `
        <div class="machine-type-badge">${machineType || '-'}</div>
        <div class="machine-code">${machineCode || '-'}</div>
        <div class="machine-users">${machineUsers || 'Atanmamış'}</div>
    `;
    
    // Store selected machine ID for form submission
    selectedDisplay.setAttribute('data-selected-machine-id', machineId);
    
    // Add change button event listener
    const changeBtn = document.getElementById('change-machine-btn');
    changeBtn.addEventListener('click', () => {
        // Show button again and hide selected display
        buttonContainer.style.display = 'block';
        selectedDisplay.style.display = 'none';
        
        // Clear the stored machine ID
        selectedDisplay.removeAttribute('data-selected-machine-id');
    });
}

// ============================================================================
// REFRESH FUNCTIONALITY
// ============================================================================

function setupRefreshButton() {
    const refreshButton = new RefreshButton('refresh-btn-container', {
        onRefresh: async () => {
            // Reload the create request content
            await loadCreateRequestContent();
        }
    });
}
