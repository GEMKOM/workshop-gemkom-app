// --- activeTimers.js ---
import { fetchMachines } from '../generic/machines.js';
import { HeaderComponent } from '../components/header/header.js';
import { ResultsTable } from '../components/resultsTable/resultsTable.js';
import { ModernDropdown } from '../components/dropdown/dropdown.js';

// ============================================================================
// ACTIVE TIMERS TAB FUNCTIONALITY
// ============================================================================

// Global instances
let resultsTableInstance = null;
let machineDropdown = null;
let allMachines = [];
let allTasks = [];

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
                        <i class="fas fa-cut me-2"></i>
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
                               placeholder="TI numarası ile ara...">
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
        subtitle: 'Makine görevlerini görüntüleyin ve zamanlayıcıları yönetin',
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
        title: 'Makine Görevleri',
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
            filterAndDisplayTasks();
        });
    }
}

/**
 * Loads machines and sets up the dropdown
 */
async function loadMachinesAndSetupDropdown() {
    try {
        // Load machines
        const machinesData = await fetchMachines({ used_in: "cutting", is_active: true });
        allMachines = machinesData.results || machinesData;
        
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
            const newUrl = `/cnc_cutting/?machine_id=${encodeURIComponent(selectedMachine.id)}`;
            window.history.pushState({ machineId: selectedMachine.id }, '', newUrl);
            
            // Load tasks for the selected machine
            loadTasksForMachine(selectedMachine.id);
        }
    });
    
    // Check if there's a machine_id in URL and select it
    const urlParams = new URLSearchParams(window.location.search);
    const machineIdFromUrl = urlParams.get('machine_id');
    if (machineIdFromUrl) {
        const machine = allMachines.find(m => String(m.id) === String(machineIdFromUrl));
        if (machine) {
            machineDropdown.setValue(machine.id);
            loadTasksForMachine(machine.id);
        }
    }
}


/**
 * Loads tasks for a specific machine
 */
async function loadTasksForMachine(machineId) {
    if (resultsTableInstance) {
        resultsTableInstance.showLoadingState();
    }
    
    try {
        const { fetchTasks } = await import('../generic/tasks.js');
        const data = await fetchTasks({ machineId, completionDateIsNull: true, inPlan: true, ordering: 'plan_order', pageSize: 10 }, 'cnc_cutting');
        allTasks = data.results || data;
        
        // Display tasks
        filterAndDisplayTasks();
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        if (resultsTableInstance) {
            resultsTableInstance.showErrorState(error);
        }
    }
}

/**
 * Filters and displays tasks based on search
 */
function filterAndDisplayTasks() {
    if (!resultsTableInstance || allTasks.length === 0) {
        if (resultsTableInstance) {
            resultsTableInstance.setItems([]);
            resultsTableInstance.updateResultsInfo(0);
        }
        return;
    }
    
    // Get search term from the main search input
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    const filteredTasks = filterTasksBySearch(allTasks, searchTerm);
    
    // Convert tasks to ResultsTable format
    const formattedTasks = formatTasksForResultsTable(filteredTasks);
    
    if (resultsTableInstance) {
        resultsTableInstance.setItems(formattedTasks);
        resultsTableInstance.updateResultsInfo(filteredTasks.length);
    }
}

/**
 * Filters tasks based on search term
 */
function filterTasksBySearch(tasks, searchTerm) {
    if (!searchTerm) return tasks;
    
    const term = searchTerm.toLowerCase();
    return tasks.filter(task =>
        (task.key && task.key.toLowerCase().includes(term)) ||
        (task.name && task.name.toLowerCase().includes(term))
    );
}

/**
 * Formats tasks for the ResultsTable component
 */
function formatTasksForResultsTable(tasks) {
    // First, add the placeholder task card for "out of the ordinary tasks"
    const placeholderTask = {
        title: 'Diğer İşler',
        subtitle: 'Makineyi bekletme (Arıza, fabrika işleri, malzeme bekleme, yemek molası, izin, vs) için tıklayın',
        icon: 'fas fa-pause-circle',
        iconColor: '#8b0000',
        iconBackground: '#fff5f5',
        details: [],
        clickable: true,
        onClick: async () => {
            // Show modal to select reason_code
            let modal = document.getElementById('hold-task-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'hold-task-modal';
                modal.innerHTML = `
                <div class="modal fade" tabindex="-1" id="hold-task-modal-inner">
                  <div class="modal-dialog">
                    <div class="modal-content">
                      <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-pause-circle me-2"></i>
                            Bekletme Nedeni Seç
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
                      </div>
                      <div class="modal-body">
                        <p class="text-muted mb-3">Makineyi bekletme nedenini seçin:</p>
                        <select id="reason-code-select" class="form-select">
                            <option>Yükleniyor...</option>
                        </select>
                      </div>
                      <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times me-2"></i>İptal
                        </button>
                        <button type="button" class="btn btn-primary" id="select-reason-code-btn">
                            <i class="fas fa-play me-2"></i>Devam
                        </button>
                      </div>
                    </div>
                  </div>
                </div>`;
                document.body.appendChild(modal);
            }
            
            // Fetch reason codes
            const select = document.getElementById('reason-code-select');
            select.innerHTML = '<option>Yükleniyor...</option>';
            try {
                const { fetchHoldTasks } = await import('../generic/tasks.js');
                const codes = await fetchHoldTasks('cnc_cutting');
                select.innerHTML = codes.map(code => `<option value="${code.key}">${code.name || code.job_no}</option>`).join('');
            } catch (err) {
                select.innerHTML = '<option>Bekletme nedenleri alınamadı</option>';
            }
            
            // Show modal
            const bsModal = new bootstrap.Modal(document.getElementById('hold-task-modal-inner'));
            bsModal.show();
            document.getElementById('select-reason-code-btn').onclick = () => {
                const reasonCode = select.value;
                const reasonName = select.options[select.selectedIndex]?.text || reasonCode;
                if (!reasonCode) return;
                const params = new URLSearchParams(window.location.search);
                const machineId = params.get('machine_id');
                // Go to tasks page with reason_code as issue_key and pass name
                window.location.href = `/cnc_cutting/tasks/?machine_id=${encodeURIComponent(machineId)}&key=${encodeURIComponent(reasonCode)}&name=${encodeURIComponent(reasonName)}&hold=1`;
            };
        }
    };
    
    // Then map regular tasks
    const regularTasks = tasks.map(task => ({
        title: task.nesting_id || 'Görev',
        subtitle: task.key || 'Açıklama yok',
        icon: 'fas fa-cut',
        iconColor: '#6c757d',
        iconBackground: '#f8f9fa',
        details: [
            {
                icon: 'fas fa-cube',
                label: 'Malzeme:',
                value: task.material || '-'
            },
            {
                icon: 'fas fa-ruler',
                label: 'Boyutlar:',
                value: task.dimensions || '-'
            },
            {
                icon: 'fas fa-ruler-vertical',
                label: 'Kalınlık:',
                value: task.thickness_mm ? `${task.thickness_mm} mm` : '-'
            },
            {
                icon: 'fas fa-cubes',
                label: 'Parça Sayısı:',
                value: task.parts ? task.parts.length : (task.parts_count || '-')
            },
            {
                icon: 'fas fa-hashtag',
                label: 'Adet:',
                value: task.quantity ? task.quantity.toString() : '-'
            },
            ...(task.finish_time ? [{
                icon: 'fas fa-calendar-alt',
                label: 'Bitiş:',
                value: new Date(task.finish_time).toLocaleDateString('tr-TR')
            }] : [])
        ],
        clickable: true,
        onClick: () => {
            // Navigate to task detail page
            const params = new URLSearchParams(window.location.search);
            const machineId = params.get('machine_id') || resultsTableInstance.getFilterValues()['machine-select'];
            if (task.key && machineId) {
                window.location.href = `/cnc_cutting/tasks/?machine_id=${encodeURIComponent(machineId)}&key=${task.key}`;
            }
        }
    }));
    
    // Return placeholder task first, then regular tasks
    return [placeholderTask, ...regularTasks];
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
            loadTasksForMachine(machineId);
        } else if (machineDropdown) {
            machineDropdown.setValue(null);
            allTasks = [];
            filterAndDisplayTasks();
        }
    });
}
