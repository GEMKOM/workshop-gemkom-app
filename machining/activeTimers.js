// --- activeTimers.js ---
import { fetchMachinesDropdown } from '../generic/machines.js';
import { HeaderComponent } from '../components/header/header.js';
import { ResultsTable } from '../components/resultsTable/resultsTable.js';
import { ModernDropdown } from '../components/dropdown/dropdown.js';
import { getOperations, fetchDowntimeReasons, logReason } from '../generic/machining/operations.js';
import { navigateTo } from '../authService.js';

// ============================================================================
// ACTIVE TIMERS TAB FUNCTIONALITY
// ============================================================================

// Global instances
let resultsTableInstance = null;
let machineDropdown = null;
let allMachines = [];
let allOperations = [];
let downtimeReasonsCache = null;
let currentMachineId = null;

export function loadActiveTimersContent() {
    createActiveTimersHTML();
    loadMachinesAndSetupDropdown();
    bindActiveTimersEvents();
}

/**
 * Creates and inserts the HTML structure for the active timers page
 */
function createActiveTimersHTML() {
    const mainView = document.getElementById('main-view');
    
    mainView.innerHTML = `
        <div class="active-timers-view">
            <!-- Header placeholder -->
            <div id="header-placeholder"></div>
            
            <!-- Machine Selection Section -->
            <div class="machine-selection-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-cogs me-2"></i>
                        Makine Seçimi
                    </h3>
                    <p class="section-subtitle">Çalışmak istediğiniz makineyi seçin</p>
                </div>
                
                <div class="machine-selector">
                    <div id="machine-dropdown-container"></div>
                </div>
            </div>

            <!-- Search Section -->
            <div class="search-section">
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="search-input" class="form-control search-input" 
                               placeholder="Operasyon numarası ile ara...">
                    </div>
                </div>
            </div>
            
            <!-- Results Table Container -->
            <div id="results-table-container"></div>
        </div>
    `;
    
    // Create header component
    createHeader();
    
    // Create results table component
    createResultsTable();
    
    // Setup search input
    setupSearchInput();
}

/**
 * Creates the header component for active timers
 */
function createHeader() {
    new HeaderComponent({
        title: 'Aktif Zamanlayıcılar',
        subtitle: 'Makine operasyonlarını görüntüleyin ve zamanlayıcıları yönetin',
        icon: 'play-circle',
        containerId: 'header-placeholder',
        showBackButton: 'none',
        showCreateButton: 'none',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'block',
        refreshButtonText: 'Yenile',
        onRefreshClick: () => {
            loadActiveTimersData();
        }
    });
}

/**
 * Creates the results table component for active timers
 */
function createResultsTable() {
    const container = document.getElementById('results-table-container');
    if (!container) return;
    
    // Destroy existing instance if it exists
    if (resultsTableInstance) {
        resultsTableInstance.destroy();
    }
    
    resultsTableInstance = new ResultsTable(container, {
        title: 'Makine Operasyonları',
        icon: 'fas fa-tasks',
        showFilters: false
    });
}

/**
 * Sets up the search input functionality
 */
function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterAndDisplayOperations();
        });
    }
}

/**
 * Loads machines and sets up the dropdown
 */
async function loadMachinesAndSetupDropdown() {
    try {
        // Load machines with availability flags for dropdown
        allMachines = await fetchMachinesDropdown("machining", true);
        
        // Setup machine dropdown
        setupMachineDropdown();
        
    } catch (error) {
        console.error('Error loading machines:', error);
    }
}

/**
 * Sets up the machine dropdown with proper rules
 */
function setupMachineDropdown() {
    const machineDropdownContainer = document.getElementById('machine-dropdown-container');
    if (!machineDropdownContainer) return;
    
    // Create dropdown items from machines with proper rules
    const dropdownItems = allMachines.map(machine => {
        let label = machine.name;
        
        if (machine.has_active_timer) {
            label += ' (Kullanımda)';
        }
        if (machine.is_under_maintenance) {
            label += ' (Bakımda)';
        }
        
        return {
            value: machine.id,
            text: label,
            disabled: machine.has_active_timer || machine.is_under_maintenance
        };
    });
    
    // Initialize the dropdown
    machineDropdown = new ModernDropdown(machineDropdownContainer, {
        placeholder: 'Makine Seçiniz...',
        searchable: false,
        multiple: false,
        maxHeight: 250
    });
    
    // Set items
    machineDropdown.setItems(dropdownItems);
    
    // Listen for machine selection events
    machineDropdownContainer.addEventListener('dropdown:select', (e) => {
        const selectedMachineId = e.detail.value;
        const selectedMachine = allMachines.find(m => String(m.id) === String(selectedMachineId));
        if (selectedMachine) {
            // Update URL without page reload
            const newUrl = `/machining/?machine_id=${encodeURIComponent(selectedMachine.id)}`;
            window.history.pushState({ machineId: selectedMachine.id }, '', newUrl);
            
            // Load operations for the selected machine
            loadOperationsForMachine(selectedMachine.id);
        }
    });
    
    // Check if there's a machine_id in URL and select it
    const urlParams = new URLSearchParams(window.location.search);
    const machineIdFromUrl = urlParams.get('machine_id');
    if (machineIdFromUrl) {
        const machine = allMachines.find(m => String(m.id) === String(machineIdFromUrl));
        if (machine) {
            machineDropdown.setValue(machine.id);
            loadOperationsForMachine(machine.id);
        }
    }
}


/**
 * Loads operations for a specific machine
 */
async function loadOperationsForMachine(machineId) {
    currentMachineId = machineId;
    
    if (resultsTableInstance) {
        resultsTableInstance.showLoadingState();
    }
    
    try {
        // Fetch downtime reasons for this machine
        try {
            downtimeReasonsCache = await fetchDowntimeReasons();
        } catch (error) {
            console.error('Error fetching downtime reasons:', error);
            downtimeReasonsCache = null;
        }
        
        // Fetch operations for the machine, filtering for incomplete operations in plan
        const data = await getOperations({ 
            machine_fk: machineId,
            completion_date__isnull: true,
            in_plan: true,
            ordering: 'order'
        });
        allOperations = data.results || data;
        
        // Display operations
        filterAndDisplayOperations();
        
    } catch (error) {
        console.error('Error loading operations:', error);
        if (resultsTableInstance) {
            resultsTableInstance.showErrorState(error);
        }
    }
}

/**
 * Filters and displays operations based on search
 */
function filterAndDisplayOperations() {
    if (!resultsTableInstance) {
        return;
    }
    
    // Get search term from the main search input
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    
    // Filter operations (downtime reason item is always shown, so we don't filter it)
    const filteredOperations = searchTerm ? filterOperationsBySearch(allOperations, searchTerm) : allOperations;
    
    // Convert operations to ResultsTable format (downtime reason item is added here)
    const formattedOperations = formatOperationsForResultsTable(filteredOperations);
    
    if (resultsTableInstance) {
        resultsTableInstance.setItems(formattedOperations);
        // Count includes downtime reason item if present
        resultsTableInstance.updateResultsInfo(formattedOperations.length);
    }
}

/**
 * Filters operations based on search term
 */
function filterOperationsBySearch(operations, searchTerm) {
    if (!searchTerm) return operations;
    
    const term = searchTerm.toLowerCase();
    return operations.filter(operation =>
        (operation.key && operation.key.toLowerCase().includes(term)) ||
        (operation.part_key && operation.part_key.toLowerCase().includes(term)) ||
        (operation.part_name && operation.part_name.toLowerCase().includes(term)) ||
        (operation.name && operation.name.toLowerCase().includes(term))
    );
}

/**
 * Creates downtime reason item for the top of the list
 */
function createDowntimeReasonItem() {
    if (!downtimeReasonsCache || downtimeReasonsCache.length === 0) {
        return null;
    }
    
    // Filter to only show reasons that create a timer
    const timerReasons = downtimeReasonsCache.filter(reason => reason.creates_timer);
    
    if (timerReasons.length === 0) {
        return null;
    }
    
    return {
        title: 'Durma Nedeni Kaydet',
        subtitle: 'Makine durma nedenini seçin ve kaydedin',
        icon: 'fas fa-pause-circle',
        iconColor: '#ffffff',
        iconBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        details: [],
        clickable: true,
        isDowntimeReason: true, // Special flag to identify this item
        onClick: () => {
            showDowntimeReasonModal();
        }
    };
}

/**
 * Formats operations for the ResultsTable component
 */
function formatOperationsForResultsTable(operations) {
    // Add downtime reason item at the top if available
    const downtimeReasonItem = createDowntimeReasonItem();
    
    // Map operations to ResultsTable format
    const formattedOperations = operations.map(operation => {
        // Display part_task_key as main title with operation key in parentheses, or just operation key if part_task_key doesn't exist
        let title;
        if (operation.part_task_key) {
            title = `${operation.part_task_key} (${operation.key || 'Operasyon'})`;
        } else {
            title = operation.key || 'Operasyon';
        }
        
        return {
            title: title,
            subtitle: operation.part_name || operation.name || 'Açıklama yok',
            icon: 'fas fa-cog',
            iconColor: '#6c757d',
            iconBackground: '#f8f9fa',
            details: [
                {
                    icon: 'fas fa-hashtag',
                    label: 'Parça:',
                    value: operation.part_key || '-'
                },
                {
                    icon: 'fas fa-sort-numeric-up',
                    label: 'Sıra:',
                    value: operation.order || '-'
                },
                ...(operation.part_job_no ? [{
                    icon: 'fas fa-file-alt',
                    label: 'İş Emri:',
                    value: operation.part_job_no
                }] : []),
                ...(operation.part_image_no ? [{
                    icon: 'fas fa-image',
                    label: 'Resim:',
                    value: operation.part_image_no
                }] : []),
                ...(operation.part_position_no ? [{
                    icon: 'fas fa-map-marker-alt',
                    label: 'Pozisyon:',
                    value: operation.part_position_no
                }] : []),
                ...(operation.part_quantity ? [{
                    icon: 'fas fa-cubes',
                    label: 'Adet:',
                    value: operation.part_quantity
                }] : [])
            ],
            clickable: true,
            onClick: () => {
                // Navigate to operation detail page
                const params = new URLSearchParams(window.location.search);
                const machineId = params.get('machine_id') || resultsTableInstance.getFilterValues()['machine-select'];
                if (operation.key && machineId) {
                    window.location.href = `/machining/tasks/?machine_id=${encodeURIComponent(machineId)}&key=${operation.key}`;
                }
            }
        };
    });
    
    // Prepend downtime reason item at the top if available
    if (downtimeReasonItem) {
        return [downtimeReasonItem, ...formattedOperations];
    }
    
    return formattedOperations;
}

/**
 * Binds all event listeners for the active timers page
 */
function bindActiveTimersEvents() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const machineId = params.get('machine_id');
        if (machineId && machineDropdown) {
            machineDropdown.setValue(machineId);
            loadOperationsForMachine(machineId);
        } else if (machineDropdown) {
            machineDropdown.setValue(null);
            allOperations = [];
            filterAndDisplayOperations();
        }
    });
}

// Helper function for refresh button
function loadActiveTimersData() {
    const params = new URLSearchParams(window.location.search);
    const machineId = params.get('machine_id');
    if (machineId) {
        loadOperationsForMachine(machineId);
    }
}

// ============================================================================
// DOWNTIME REASONS MODAL
// ============================================================================

function renderDowntimeReasonsList(reasons) {
    const listContainer = document.getElementById('downtime-reasons-list');
    if (!listContainer) return;
    
    // Filter to only show reasons that create a timer
    const timerReasons = reasons.filter(reason => reason.creates_timer);
    
    if (timerReasons.length === 0) {
        listContainer.innerHTML = '<p class="text-muted text-center">Durma nedeni bulunamadı.</p>';
        return;
    }
    
    listContainer.innerHTML = timerReasons.map(reason => `
        <div class="downtime-reason-item" data-reason-id="${reason.id}">
            <div class="downtime-reason-content">
                <span class="downtime-reason-name">${reason.name}</span>
            </div>
            <div class="downtime-reason-select">
                <i class="fas fa-check-circle"></i>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    listContainer.querySelectorAll('.downtime-reason-item').forEach(item => {
        item.addEventListener('click', () => {
            // Remove previous selection
            listContainer.querySelectorAll('.downtime-reason-item').forEach(i => {
                i.classList.remove('selected');
            });
            // Add selection to clicked item
            item.classList.add('selected');
            
            // Enable submit button
            const submitBtn = document.getElementById('downtime-reason-modal-submit');
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        });
    });
}

function getSelectedDowntimeReason() {
    const selectedItem = document.querySelector('.downtime-reason-item.selected');
    if (!selectedItem) return null;
    
    return parseInt(selectedItem.getAttribute('data-reason-id'));
}

function showDowntimeReasonModal() {
    const modal = document.getElementById('downtime-reason-modal');
    const backdrop = document.getElementById('downtime-reason-modal-backdrop');
    const closeBtn = document.getElementById('downtime-reason-modal-close');
    const cancelBtn = document.getElementById('downtime-reason-modal-cancel');
    const submitBtn = document.getElementById('downtime-reason-modal-submit');
    const commentInput = document.getElementById('downtime-reason-comment');
    
    if (!modal || !downtimeReasonsCache) {
        return;
    }
    
    // Reset state
    submitBtn.disabled = true;
    if (commentInput) commentInput.value = '';
    
    // Render reasons
    renderDowntimeReasonsList(downtimeReasonsCache);
    
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    async function handleSubmit() {
        const reasonId = getSelectedDowntimeReason();
        if (!reasonId) {
            alert('Lütfen bir durma nedeni seçin.');
            return;
        }
        
        if (!currentMachineId) {
            alert('Makine bilgisi bulunamadı.');
            return;
        }
        
        const comment = commentInput ? commentInput.value.trim() : '';
        
        // Prepare log data - we need an operation key, but we're on the list page
        // We'll need to get the first available operation or handle this differently
        // For now, let's check if we can log without operation_key
        const logData = {
            reason_id: reasonId,
            machine_id: currentMachineId
        };
        
        if (comment) {
            logData.comment = comment;
        }
        
        // Disable submit button during request
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Kaydediliyor...';
        
        try {
            // We need an operation_key, but we're on the list page
            // The API might require it, so we'll need to handle this
            // For now, let's try to get the first operation or show an error
            if (allOperations.length === 0) {
                alert('Durma nedeni kaydetmek için en az bir operasyon olmalıdır.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            }
            
            // Use the first operation's key
            logData.operation_key = allOperations[0].key;
            
            const result = await logReason(logData);
            
            // Show success message
            let message = result.message || 'Durma nedeni başarıyla kaydedildi.';
            if (result.new_timer_id) {
                message += ' Yeni zamanlayıcı başlatıldı.';
            }
            alert(message);
            
            // Close modal and reload
            closeModal();
            
            // Reload operations to refresh the list
            if (currentMachineId) {
                loadOperationsForMachine(currentMachineId);
            }
            
        } catch (error) {
            console.error('Error logging reason:', error);
            const errorMessage = error.data?.error || error.message || 'Durma nedeni kaydedilirken hata oluştu.';
            alert(errorMessage);
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
    
    // Event listeners
    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', handleSubmit);
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

