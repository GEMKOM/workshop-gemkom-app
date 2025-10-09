// components/machineTaskView.js
// Generic machine/task view for machining etc.
import { extractResultsFromResponse } from '../generic/paginationHelper.js';
import { ModernDropdown } from './dropdown/dropdown.js';

export async function createMachineTaskView({
    containerId = 'main-view',
    fetchMachines,
    fetchTasks,
    onTaskClick,
    title = '',
    machineLabel = 'Makine Seçimi',
    searchPlaceholder = 'TI numarası ile ara...',
    taskDetailBasePath = ''
}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="machine-task-view">
            <!-- Machine Selection Section -->
            <div class="machine-selection-section">
                <div class="section-header">
                    <h3 class="section-title">
                        <i class="fas fa-cogs me-2"></i>
                        ${machineLabel}
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
                               placeholder="${searchPlaceholder}">
                    </div>
                </div>
            </div>

            <!-- Tasks Section -->
            <div class="tasks-section">
                <div class="section-header">
                    <h4 class="section-title">
                        <i class="fas fa-tasks me-2"></i>
                        Görevler
                    </h4>
                    <div class="task-count" id="task-count"></div>
                </div>
                
                <div class="task-list" id="task-list">
                    <div class="loading-container text-center py-5">
                        <div class="loading-spinner"></div>
                        <p class="mt-3 text-muted">Makine seçiniz...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Fetch and render machines
    const machines = await fetchMachines({});
    
    // Initialize machine dropdown
    const machineDropdownContainer = container.querySelector('#machine-dropdown-container');
    let machineDropdown = null;
    
    // Create dropdown items from machines
    const dropdownItems = machines.map(machine => {
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
        searchable: true,
        multiple: false,
        maxHeight: 250
    });
    
    // Set items
    machineDropdown.setItems(dropdownItems);
    
    let allTasks = [];
    
    async function loadTasks(machineId) {
        const taskList = container.querySelector('#task-list');
        taskList.innerHTML = `
            <div class="loading-container text-center py-5">
                <div class="loading-spinner"></div>
                <p class="mt-3 text-muted">Görevler yükleniyor...</p>
            </div>
        `;
        
        try {
            allTasks = await fetchTasks(machineId);
            renderTaskList(allTasks);
        } catch (error) {
            taskList.innerHTML = `
                <div class="error-container text-center py-5">
                    <i class="fas fa-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
                    <h4 class="mt-3 text-danger">Hata Oluştu</h4>
                    <p class="text-muted">Görevler yüklenirken bir hata oluştu.</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">
                        <i class="fas fa-redo me-2"></i>Tekrar Dene
                    </button>
                </div>
            `;
        }
    }
    
    // Listen for machine selection events
    machineDropdownContainer.addEventListener('dropdown:select', (e) => {
        const selectedMachineId = e.detail.value;
        const selectedMachine = machines.find(m => String(m.id) === String(selectedMachineId));
        if (selectedMachine) {
            // Update URL without page reload
            const newUrl = `/machining/?machine_id=${encodeURIComponent(selectedMachine.id)}`;
            window.history.pushState({ machineId: selectedMachine.id }, '', newUrl);
            
            // Load tasks for the selected machine
            loadTasks(selectedMachine.id);
        }
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const machineId = params.get('machine_id');
        if (machineId) {
            const machine = machines.find(m => String(m.id) === String(machineId));
            if (machine) {
                machineDropdown.setValue(machine.id);
                loadTasks(machine.id);
            }
        } else {
            machineDropdown.setValue(null);
            allTasks = [];
            renderTaskList(allTasks);
        }
    });
    
    // Search functionality
    container.querySelector('#search-input').oninput = (e) => {
        const term = e.target.value.trim().toLowerCase();
        const filtered = allTasks.filter(task =>
            (task.key && task.key.toLowerCase().includes(term)) ||
            (task.name && task.name.toLowerCase().includes(term))
        );
        renderTaskList(filtered);
    };
    
    function renderTaskList(tasks) {
        const ul = container.querySelector('#task-list');
        const taskCount = container.querySelector('#task-count');
        
        // Update task count
        taskCount.textContent = `${tasks.length} görev`;
        
        ul.innerHTML = '';
        
        if (tasks.length === 0) {
            ul.innerHTML = `
                <div class="empty-state text-center py-5">
                    <i class="fas fa-inbox text-muted" style="font-size: 3rem;"></i>
                    <h5 class="mt-3 text-muted">Görev Bulunamadı</h5>
                    <p class="text-muted">Seçilen makine için görev bulunmuyor.</p>
                </div>
            `;
            return;
        }
        
        // Add placeholder task at the top
        const placeholderCard = document.createElement('div');
        placeholderCard.className = 'task-card placeholder-task';
        placeholderCard.innerHTML = `
            <div class="task-card-content">
                <div class="task-icon">
                    <i class="fas fa-pause-circle"></i>
                </div>
                <div class="task-info">
                    <h5 class="task-title">Diğer İşler</h5>
                    <p class="task-description">Makineyi bekletme (Arıza, fabrika işleri, malzeme bekleme, yemek molası, izin, vs) için tıklayın</p>
                </div>
                <div class="task-action">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
        
        placeholderCard.onclick = async () => {
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
                const backendBase = (await import('../base.js')).backendBase;
                const { authedFetch } = await import('../authService.js');
                const resp = await authedFetch(`${backendBase}/machining/hold-tasks/`);
                const data = await resp.json();
                const codes = extractResultsFromResponse(data);
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
                window.location.href = `${taskDetailBasePath}?machine_id=${encodeURIComponent(machineId)}&key=${encodeURIComponent(reasonCode)}&name=${encodeURIComponent(reasonName)}&hold=1`;
            };
        };
        ul.appendChild(placeholderCard);
        
        // Render normal tasks
        tasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'task-card';
            card.onclick = () => {
                if (onTaskClick) onTaskClick(task);
                if (taskDetailBasePath && task.key) {
                    // Get machine_id from URL
                    const params = new URLSearchParams(window.location.search);
                    const machineId = params.get('machine_id');
                    const url = `${taskDetailBasePath}?machine_id=${encodeURIComponent(machineId)}&key=${task.key}`;
                    window.location.href = url;
                }
            };
            
            card.innerHTML = `
                <div class="task-card-content">
                    <div class="task-icon">
                        <i class="fas fa-cog"></i>
                    </div>
                    <div class="task-info">
                        <h5 class="task-title">${task.key || ''}</h5>
                        <p class="task-description">${task.name || ''}</p>
                        <div class="task-details">
                            <span class="task-detail">
                                <i class="fas fa-hashtag me-1"></i>
                                İş Emri: ${task.job_no || '-'}
                            </span>
                            <span class="task-detail">
                                <i class="fas fa-image me-1"></i>
                                Resim: ${task.image_no || '-'}
                            </span>
                            <span class="task-detail">
                                <i class="fas fa-map-marker-alt me-1"></i>
                                Poz: ${task.position_no || '-'}
                            </span>
                            <span class="task-detail">
                                <i class="fas fa-cubes me-1"></i>
                                Adet: ${task.quantity || '-'}
                            </span>
                            ${task.finish_time ? `
                                <span class="task-detail deadline">
                                    <i class="fas fa-calendar-alt me-1"></i>
                                    Bitiş: ${new Date(task.finish_time).toLocaleDateString('tr-TR')}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="task-action">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
            
            ul.appendChild(card);
        });
    }
} 