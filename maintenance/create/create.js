import { initNavbar } from '../../components/navbar.js';
import { guardRoute } from '../../authService.js';
import { authedFetch } from '../../authService.js';
import { backendBase } from '../../base.js';
import { fetchMachines } from '../../generic/machines.js';
import { createMaintenanceRequest } from '../maintenanceApi.js';
import { ModernDropdown } from '../../components/dropdown/dropdown.js';
import { extractResultsFromResponse } from '../../generic/paginationHelper.js';

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
    setupRefreshButton();
    loadCreateRequestContent();
});

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
                                        <label for="machine-dropdown" class="form-label">
                                            <i class="fas fa-cogs"></i>
                                            Makine Seçin
                                        </label>
                                        <div id="machine-dropdown"></div>
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
                // Show custom equipment fields, hide machine dropdown
                machineSelectionContainer.style.display = 'none';
                customEquipmentContainer.style.display = 'block';
                locationContainer.style.display = 'block';
                
                // Clear machine dropdown selection
                const machineDropdown = form.querySelector('#machine-dropdown').dropdownInstance;
                if (machineDropdown) {
                    machineDropdown.setValue('');
                }
            } else {
                // Show machine dropdown, hide custom equipment fields
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

        // Get values from modern dropdowns
        const machineDropdown = form.querySelector('#machine-dropdown').dropdownInstance;
        const requestTypeDropdown = form.querySelector('#request-type-dropdown').dropdownInstance;
        
        const machineId = machineDropdown ? machineDropdown.getValue() : '';
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
            if (machineDropdown) machineDropdown.setValue('');
            if (requestTypeDropdown) requestTypeDropdown.setValue('');
            
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
// MACHINE LOADING
// ============================================================================

async function loadMachines() {
    const machineDropdownContainer = document.getElementById('machine-dropdown');
    if (!machineDropdownContainer) return;
    
    // Show loading state
    machineDropdownContainer.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p class="text-muted">Makineler yükleniyor...</p></div>';
    
    try {
        const machinesResponse = await fetchMachines({});
        const machines = extractResultsFromResponse(machinesResponse);
        state.machines = machines;
        populateMachinesDropdown(machines);
    } catch (error) {
        machineDropdownContainer.innerHTML = '<div class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>Makine yüklenirken hata oluştu</div>';
        console.error('Error loading machines:', error);
    }
}

function populateMachinesDropdown(machines) {
    const machineDropdownContainer = document.getElementById('machine-dropdown');
    if (!machineDropdownContainer) {
        console.error('Machine dropdown container not found');
        return;
    }
    
    console.log('Creating machine dropdown with', machines.length, 'machines');
    
    // Create modern dropdown for machines
    const machineDropdown = new ModernDropdown(machineDropdownContainer, {
        placeholder: 'Makine seçin...',
        searchable: true
    });
    
    // Convert machines to dropdown items
    const machineItems = machines.map(machine => ({
        value: machine.id,
        text: machine.name || `Makine ${machine.id}`
    }));
    
    machineDropdown.setItems(machineItems);
    
    // Store dropdown reference for form submission
    machineDropdownContainer.dropdownInstance = machineDropdown;
    
    console.log('Machine dropdown created successfully');
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
