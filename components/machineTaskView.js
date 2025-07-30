// components/machineTaskView.js
// Generic machine/task view for machining etc.
import { extractResultsFromResponse } from '../generic/paginationHelper.js';

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
        <div class="row mb-4">
            <div class="col">
                <div class="filter-bar" id="filter-bar">
                    <label for="filter-select" class="form-label">${machineLabel}</label>
                    <select id="filter-select" class="form-select">
                        <option value="" disabled selected>Makine Seçiniz...</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col">
                <div class="search-container">
                    <input type="text" id="search-input" class="form-control" placeholder="${searchPlaceholder}">
                </div>
                <div class="task-list" id="task-list"></div>
            </div>
        </div>
    `;
    if (title) {
        const h = document.createElement('h2');
        h.textContent = title;
        container.prepend(h);
    }
    // Fetch and render machines
    const select = container.querySelector('#filter-select');
    const machines = await fetchMachines();
    machines.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.dataset.machineId = f.id;
        let label = f.name;
        if (f.has_active_timer) {
            label += ' (Kullanımda)';
            option.disabled = true;
            option.style.color = '#6b7280';
            option.style.fontStyle = 'italic';
        } 
        if (f.is_under_maintenance) {
            label += ' (Bakımda)';
            option.disabled = true;
            option.style.color = '#dc2626';
            option.style.fontStyle = 'italic';
        }
        option.textContent = label;
        select.appendChild(option);
    });
    let allTasks = [];
    
    async function loadTasks(machineId) {
        allTasks = await fetchTasks(machineId);
        renderTaskList(allTasks);
    }
    
    select.onchange = () => {
        const selectedOption = select.options[select.selectedIndex];
        const selectedMachine = machines.find(m => String(m.id) === String(selectedOption.dataset.machineId));
        if (selectedMachine) {
            // Update URL without page reload
            const newUrl = `/machining/?machine_id=${encodeURIComponent(selectedMachine.id)}`;
            window.history.pushState({ machineId: selectedMachine.id }, '', newUrl);
            
            // Load tasks for the selected machine
            loadTasks(selectedMachine.id);
        }
    };
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const machineId = params.get('machine_id');
        if (machineId) {
            const machine = machines.find(m => String(m.id) === String(machineId));
            if (machine) {
                select.value = machine.id;
                loadTasks(machine.id);
            }
        } else {
            select.value = '';
            allTasks = [];
            renderTaskList(allTasks);
        }
    });
    // Search
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
        ul.innerHTML = '';
        // Add placeholder task at the top
        const placeholderCard = document.createElement('div');
        placeholderCard.className = 'task-card placeholder-task';
        placeholderCard.style.background = '#ffeeba'; // Distinct color
        placeholderCard.style.cursor = 'pointer';
        placeholderCard.innerHTML = '<h3>Diğer İşler</h3><p>Makineyi bekletme (Arıza, fabrika işleri, malzeme bekleme, yemek molası, izin, vs) için tıklayın</p>';
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
                        <h5 class="modal-title">Bekletme Nedeni Seç</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
                      </div>
                      <div class="modal-body">
                        <select id="reason-code-select" class="form-select"><option>Yükleniyor...</option></select>
                      </div>
                      <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                        <button type="button" class="btn btn-primary" id="select-reason-code-btn">Devam</button>
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
            // Render using backend fields
            const left = document.createElement('div');
            left.className = 'task-left';
            const title = document.createElement('h3');
            title.textContent = task.key || '';
            const summary = document.createElement('p');
            summary.textContent = task.name || '';
            left.appendChild(title);
            left.appendChild(summary);
            const right = document.createElement('div');
            right.className = 'task-right';
            right.innerHTML = `
                <div>İş Emri: ${task.job_no || '-'}</div>
                <div>Resim No: ${task.image_no || '-'}</div>
                <div>Poz No: ${task.position_no || '-'}</div>
                <div>Adet: ${task.quantity || '-'}</div>
                <div>Bitmesi Gereken Tarih: ${task.finish_time ? new Date(task.finish_time).toLocaleDateString('tr-TR') : '-'}</div>
            `;
            card.appendChild(left);
            card.appendChild(right);
            ul.appendChild(card);
        });
    }
} 