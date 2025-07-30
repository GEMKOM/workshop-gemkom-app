import { authedFetch } from "../authService.js";
import { extractResultsFromResponse } from "../generic/paginationHelper.js";

export class GenericReport {
    constructor(config) {
        this.config = {
            title: 'Rapor',
            containerId: 'generic-report-container',
            apiEndpoint: '',
            defaultColumns: [],
            allColumns: [],
            filters: [],
            showEditButton: false,
            showDeleteButton: false,
            editModalId: null,
            onEdit: null,
            onDelete: null,
            onDataTransform: null,
            onRowRender: null,
            pageSize: 100, // Default page size
            ...config
        };
        
        this.selectedColumns = this.loadColumnSelection();
        this.paginationData = null;
        this.filterValues = this.initializeFilterValues();
        this.lastData = null;
        this.lastIsMobile = null;
        this.currentOrdering = { field: 'finish_time', direction: 'desc' };
        this.init();
    }

    loadColumnSelection() {
        const storageKey = `${this.config.containerId}Columns`;
        try {
            return JSON.parse(localStorage.getItem(storageKey)) || this.config.defaultColumns;
        } catch {
            return this.config.defaultColumns;
        }
    }

    saveColumnSelection(columns) {
        const storageKey = `${this.config.containerId}Columns`;
        localStorage.setItem(storageKey, JSON.stringify(columns));
    }

    initializeFilterValues() {
        const values = {};
        
        if (this.config.filters) {
            this.config.filters.forEach(filter => {
                if (filter.defaultValue !== undefined) {
                    if (filter.type === 'datetime') {
                        // For datetime filters, create a timestamp from default date and time
                        const dateVal = filter.defaultValue;
                        const timeVal = filter.defaultTime || '00:00';
                        const timestamp = this.toTimestamp(dateVal, timeVal);
                        if (timestamp) {
                            values[filter.key] = timestamp;
                        }
                    } else {
                        values[filter.key] = filter.defaultValue;
                    }
                }
            });
        }
        
        return values;
    }

    init() {
        this.isMobile = window.innerWidth <= 768;
        this.optionsCollapsed = this.isMobile;
        this.render();
        this.bindEvents();
        this.fetchData();
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        if (wasMobile !== this.isMobile) {
            // Reset collapse state on mode change
            this.optionsCollapsed = this.isMobile;
            this.render();
            this.bindEvents();
            this.fetchData();
        }
    }

    render() {
        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="row mb-3">
                <div class="col-12">
                    <h3>${this.config.title}</h3>
                    <div class="collapsible-section">
                        <button type="button" class="btn btn-link p-0 collapsible-toggle" data-section="options">
                            ${this.optionsCollapsed ? 'Filtre ve Sütun Seçeneklerini Göster' : 'Filtre ve Sütun Seçeneklerini Gizle'}
                        </button>
                        <div class="collapsible-content" style="display: ${this.optionsCollapsed ? 'none' : 'block'};">
                            ${this.renderFilters()}
                            ${this.renderColumnSelector()}
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div id="${this.config.containerId}-table-container"></div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div id="${this.config.containerId}-pagination-container"></div>
                </div>
            </div>
        `;
        // Re-render table and pagination with cached data if available
        if (this.lastData) {
            const tableContainer = document.getElementById(`${this.config.containerId}-table-container`);
            const paginationContainer = document.getElementById(`${this.config.containerId}-pagination-container`);
            if (this.isMobile) {
                this.renderCards(this.lastData, tableContainer);
            } else {
                this.renderTable(this.lastData, tableContainer);
            }
            this.renderPagination(paginationContainer);
        }
    }

    renderFilters() {
        if (!this.config.filters || this.config.filters.length === 0) {
            return '';
        }

        const filterHtml = this.config.filters.map(filter => {
            const inputType = filter.type || 'text';
            const placeholder = filter.placeholder || '';
            const label = filter.label || filter.key;
            let value = this.filterValues[filter.key] || '';
            if (inputType === 'datetime') {
                let dateVal = '', timeVal = '';
                if (value) {
                    const d = new Date(Number(value));
                    dateVal = d.toISOString().slice(0, 10);
                    timeVal = d.toTimeString().slice(0, 5);
                } else {
                    dateVal = filter.defaultValue || '';
                    timeVal = filter.defaultTime || '00:00';
                }
                return `
                    <div class="col-md-3">
                        <label for="${filter.key}" class="form-label">${label}</label>
                        <div class="input-group">
                            <input type="date" class="form-control" id="${filter.key}_date" value="${dateVal}">
                            <input type="time" class="form-control" id="${filter.key}_time" value="${timeVal}">
                        </div>
                    </div>
                `;
            } else if (inputType === 'select') {
                const options = filter.options ? filter.options.map(opt => 
                    `<option value="${opt.value}"${value === opt.value ? ' selected' : ''}>${opt.label}</option>`
                ).join('') : '';
                return `
                    <div class="col-md-2">
                        <label for="${filter.key}" class="form-label">${label}</label>
                        <select class="form-select" id="${filter.key}">
                            <option value="">Tümü</option>
                            ${options}
                        </select>
                    </div>
                `;
            } else {
                return `
                    <div class="col-md-2">
                        <label for="${filter.key}" class="form-label">${label}</label>
                        <input type="${inputType}" class="form-control" id="${filter.key}" placeholder="${placeholder}" value="${value}">
                    </div>
                `;
            }
        }).join('');

        return `
            <form id="${this.config.containerId}-filters" class="row g-3 align-items-end">
                ${filterHtml}
                <div class="col-md-2 mt-2">
                    <button type="button" id="${this.config.containerId}-fetch-btn" class="btn btn-primary w-100">Listele</button>
                </div>
            </form>
        `;
    }

    renderColumnSelector() {
        if (!this.config.allColumns || this.config.allColumns.length === 0) {
            return '';
        }

        const columnHtml = this.config.allColumns.map(col =>
            `<label class="me-2"><input type="checkbox" class="column-toggle" value="${col.key}"${this.selectedColumns.includes(col.key) ? ' checked' : ''}> ${col.label}</label>`
        ).join('');

        return `<div class="mb-2"><strong>Gösterilecek Sütunlar:</strong> ${columnHtml}</div>`;
    }

    bindEvents() {
        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        // Collapsible toggle
        const btn = container.querySelector('.collapsible-toggle');
        if (btn) {
            btn.addEventListener('click', (e) => {
                this.optionsCollapsed = !this.optionsCollapsed;
                this.render();
                this.bindEvents();
            });
        }

        // Column selector events
        container.querySelectorAll('.column-toggle').forEach(cb => {
            cb.addEventListener('change', e => {
                const col = e.target.value;
                if (e.target.checked && !this.selectedColumns.includes(col)) {
                    this.selectedColumns.push(col);
                } else if (!e.target.checked && this.selectedColumns.includes(col)) {
                    this.selectedColumns = this.selectedColumns.filter(c => c !== col);
                }
                this.saveColumnSelection(this.selectedColumns);
                this.fetchData();
            });
        });

        // Filter input events
        const filterForm = document.getElementById(`${this.config.containerId}-filters`);
        if (filterForm) {
            filterForm.querySelectorAll('input, select').forEach(input => {
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById(`${this.config.containerId}-fetch-btn`).click();
                    }
                }.bind(this));
                input.addEventListener('change', (e) => {
                    const id = input.id;
                    if (id.endsWith('_date') || id.endsWith('_time')) {
                        // Handled on submit
                        return;
                    }
                    this.filterValues[input.name || input.id] = input.value;
                });
            });
        }

        // Fetch button event
        const fetchBtn = document.getElementById(`${this.config.containerId}-fetch-btn`);
        if (fetchBtn) {
            fetchBtn.addEventListener('click', () => {
                // Save filter values
                if (filterForm) {
                    this.config.filters.forEach(filter => {
                        if (filter.type === 'datetime') {
                            const dateInput = document.getElementById(`${filter.key}_date`);
                            const timeInput = document.getElementById(`${filter.key}_time`);
                            if (dateInput && dateInput.value) {
                                const dt = new Date(`${dateInput.value}T${(timeInput && timeInput.value) ? timeInput.value : '00:00'}:00`);
                                this.filterValues[filter.key] = dt.getTime();
                            } else {
                                this.filterValues[filter.key] = '';
                            }
                        } else {
                            const input = document.getElementById(filter.key);
                            if (input) {
                                this.filterValues[filter.key] = input.value;
                            }
                        }
                    });
                }
                this.fetchData();
            });
        }
    }

    async fetchData(url = null) {
        const params = this.buildQueryParams();
        const requestUrl = url || `${this.config.apiEndpoint}?${params.toString()}`;
        const container = document.getElementById(`${this.config.containerId}-table-container`);
        const paginationContainer = document.getElementById(`${this.config.containerId}-pagination-container`);
        
        container.innerHTML = '<div>Yükleniyor...</div>';
        paginationContainer.innerHTML = '';
        
        try {
            const resp = await authedFetch(requestUrl);
            if (!resp.ok) throw new Error('Veri alınamadı');
            const responseData = await resp.json();
            
            // Handle paginated response
            let data = extractResultsFromResponse(responseData);
            if (data) {
                this.paginationData = {
                    count: responseData.count,
                    next: responseData.next,
                    previous: responseData.previous,
                    currentUrl: requestUrl
                };
            } else if (Array.isArray(responseData)) {
                data = responseData;
                this.paginationData = null;
            } else {
                console.log('Unexpected response format:', responseData);
                container.innerHTML = '<div>Beklenmeyen veri formatı.</div>';
                return;
            }
            
            if (data.length === 0) {
                container.innerHTML = '<div>Sonuç bulunamadı.</div>';
                this.lastData = [];
                return;
            }

            this.lastData = data;
            this.lastIsMobile = this.isMobile;
            if (this.isMobile) {
                this.renderCards(data, container);
            } else {
                this.renderTable(data, container);
            }
            this.renderPagination(paginationContainer);
        } catch (err) {
            container.innerHTML = `<div class="text-danger">Hata: ${err.message}</div>`;
            this.lastData = null;
        }
    }

    buildQueryParams() {
        const params = new URLSearchParams();
        
        // Add default parameters if specified
        if (this.config.defaultParams) {
            Object.entries(this.config.defaultParams).forEach(([key, value]) => {
                params.append(key, value);
            });
        }
        
        // Add ordering if set
        if (this.currentOrdering.field) {
            const prefix = this.currentOrdering.direction === 'desc' ? '-' : '';
            const orderingField = this.getOrderingField(this.currentOrdering.field);
            params.append('ordering', `${prefix}${orderingField}`);
        }
        
        // Add page size parameter
        params.append('page_size', this.config.pageSize.toString());
        
        this.config.filters.forEach(filter => {
            if (filter.type === 'datetime') {
                const val = this.filterValues[filter.key];
                if (val) {
                    params.append(filter.key, Math.floor(val));
                }
            } else {
                const val = this.filterValues[filter.key];
                if (val) {
                    params.append(filter.key, val);
                }
            }
        });

        return params;
    }

    toTimestamp(date, time) {
        if (!date) return null;
        const t = time || '00:00';
        const dt = new Date(`${date}T${t}:00`);
        return dt.getTime();
    }

    renderTable(data, container) {
        let html = `<div class="table-responsive"><table class="table table-bordered table-sm resizable-table"><thead><tr>`;
        
        // Render headers
        for (const col of this.selectedColumns) {
            const colMeta = this.config.allColumns.find(c => c.key === col);
            let arrow = '';
            if (this.currentOrdering.field === col) {
                arrow = this.currentOrdering.direction === 'asc' ? ' ▲' : ' ▼';
            }
            html += `<th class="sortable-col" data-key="${col}" style="position:relative;cursor:pointer;"><span>${colMeta ? colMeta.label : col}${arrow}</span><span class="resize-handle" style="position:absolute;right:0;top:0;width:5px;height:100%;cursor:col-resize;"></span></th>`;
        }
        
        // Add action column if needed
        if (this.config.showEditButton || this.config.showDeleteButton) {
            html += '<th>İşlemler</th>';
        }
        
        html += '</tr></thead><tbody>';

        // Render rows
        for (const row of data) {
            html += '<tr>';
            for (const col of this.selectedColumns) {
                let val = this.formatCellValue(row, col);
                html += `<td>${val}</td>`;
            }
            
            // Add action buttons
            if (this.config.showEditButton || this.config.showDeleteButton) {
                html += '<td>';
                if (this.config.showEditButton) {
                    html += `<button class="btn btn-sm btn-outline-primary edit-row-btn" data-id="${row.id}">Düzenle</button> `;
                }
                if (this.config.showDeleteButton) {
                    html += `<button class="btn btn-sm btn-outline-danger delete-row-btn" data-id="${row.id}">Sil</button>`;
                }
                html += '</td>';
            }
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Make columns resizable
        this.makeTableResizable(container.querySelector('table'));

        // Bind action events
        this.bindActionEvents(data);
        
        // Bind sorting events
        this.bindSortingEvents();
    }

    renderCards(data, container) {
        let html = '';
        for (const row of data) {
            html += '<div class="report-card mb-3 p-2 border rounded">';
            for (const col of this.selectedColumns) {
                const colMeta = this.config.allColumns.find(c => c.key === col);
                let val = this.formatCellValue(row, col);
                html += `<div class="d-flex mb-1"><span class="fw-bold me-2">${colMeta ? colMeta.label : col}:</span> <span class="flex-fill">${val}</span></div>`;
            }
            if (this.config.showEditButton || this.config.showDeleteButton) {
                html += '<div class="mt-2">';
                if (this.config.showEditButton) {
                    html += `<button class="btn btn-sm btn-outline-primary edit-row-btn me-2" data-id="${row.id}">Düzenle</button>`;
                }
                if (this.config.showDeleteButton) {
                    html += `<button class="btn btn-sm btn-outline-danger delete-row-btn" data-id="${row.id}">Sil</button>`;
                }
                html += '</div>';
            }
            html += '</div>';
        }
        container.innerHTML = html;
        this.bindActionEvents(data);
    }

    formatCellValue(row, col) {
        let val = row[col];
        
        // Apply custom transformation if provided
        if (this.config.onDataTransform) {
            val = this.config.onDataTransform(row, col, val);
        }

        // Check if onDataTransform returned a special HTML object
        if (val && typeof val === 'object' && val.__html) {
            return val.__html;
        }

        // Default formatting
        if (val == null) {
            val = '';
        } else if (typeof val === 'boolean') {
            val = val ? 'Evet' : 'Hayır';
        } else if (col.includes('time') && val) {
            val = new Date(val).toLocaleString('tr-TR');
        } else if (col === 'issue_key' && val) {
            val = `<a href="https://gemkom-1.atlassian.net/browse/${val}" target="_blank">${val}</a>`;
        }

        return val;
    }

    bindActionEvents(data) {
        const container = document.getElementById(`${this.config.containerId}-table-container`);
        
        // Delete button events
        if (this.config.showDeleteButton) {
            container.querySelectorAll('.delete-row-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.getAttribute('data-id');
                    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
                    
                    if (this.config.onDelete) {
                        await this.config.onDelete(id, data);
                    }
                });
            });
        }

        // Edit button events
        if (this.config.showEditButton) {
            container.querySelectorAll('.edit-row-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.getAttribute('data-id');
                    const row = data.find(r => r.id == id);
                    if (!row) return;
                    
                    if (this.config.onEdit) {
                        await this.config.onEdit(row, data);
                    }
                });
            });
        }
    }

    makeTableResizable(table) {
        if (!table) return;
        
        let ths = table.querySelectorAll('th');
        let startX, startWidth, col;
        
        ths.forEach((th, idx) => {
            const handle = th.querySelector('.resize-handle');
            if (!handle) return;
            
            handle.addEventListener('mousedown', function (e) {
                startX = e.pageX;
                col = th;
                startWidth = th.offsetWidth;
                document.body.style.cursor = 'col-resize';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
        
        function onMouseMove(e) {
            if (!col) return;
            let newWidth = startWidth + (e.pageX - startX);
            if (newWidth > 30) col.style.width = newWidth + 'px';
        }
        
        function onMouseUp() {
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            col = null;
        }
    }

    getOrderingField(field) {
        // Map frontend field names to backend field names for ordering
        const fieldMapping = {
            'job_no': 'issue_key__job_no',
            'image_no': 'issue_key__image_no',
            'position_no': 'issue_key__position_no',
            'quantity': 'issue_key__quantity',
            'machine_name': 'machine_fk__name',
            'username': 'user__username',
            'stopped_by_first_name': 'stopped_by__first_name',
            'stopped_by_last_name': 'stopped_by__last_name',
            'issue_name': 'issue_key__name',
            'issue_is_hold_task': 'issue_key__is_hold_task'
        };
        
        return fieldMapping[field] || field;
    }

    bindSortingEvents() {
        const container = document.getElementById(`${this.config.containerId}-table-container`);
        if (!container) return;
        
        container.querySelectorAll('.sortable-col').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-key');
                if (!key) return;
                
                if (this.currentOrdering.field === key) {
                    // Toggle direction
                    this.currentOrdering.direction = this.currentOrdering.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.currentOrdering.field = key;
                    this.currentOrdering.direction = 'asc';
                }
                
                // Refresh data with new ordering
                this.fetchData();
            });
        });
    }

    renderPagination(container) {
        if (!this.paginationData) {
            container.innerHTML = '';
            return;
        }

        const { count, next, previous, currentUrl } = this.paginationData;
        
        // Calculate current page and total pages
        const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
        const pageSize = this.config.pageSize;
        const currentPage = parseInt(urlParams.get('page')) || 1;
        const totalPages = Math.ceil(count / pageSize);

        let paginationHtml = `
            <div class="d-flex justify-content-between align-items-center mt-3">
                <div class="text-muted">
                    Toplam ${count} kayıt, Sayfa ${currentPage} / ${totalPages}
                </div>
                <nav aria-label="Sayfalama">
                    <ul class="pagination pagination-sm mb-0">
        `;

        // Previous button
        if (previous) {
            paginationHtml += `
                <li class="page-item">
                    <button class="page-link" data-url="${previous}">Önceki</button>
                </li>
            `;
        } else {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link">Önceki</span>
                </li>
            `;
        }

        // Page numbers (show current page and a few around it)
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                paginationHtml += `
                    <li class="page-item active">
                        <span class="page-link">${i}</span>
                    </li>
                `;
            } else {
                // Build URL for this page
                const pageUrl = new URL(currentUrl);
                pageUrl.searchParams.set('page', i.toString());
                paginationHtml += `
                    <li class="page-item">
                        <button class="page-link" data-url="${pageUrl.toString()}">${i}</button>
                    </li>
                `;
            }
        }

        // Next button
        if (next) {
            paginationHtml += `
                <li class="page-item">
                    <button class="page-link" data-url="${next}">Sonraki</button>
                </li>
            `;
        } else {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link">Sonraki</span>
                </li>
            `;
        }

        paginationHtml += `
                    </ul>
                </nav>
            </div>
        `;

        container.innerHTML = paginationHtml;

        // Bind pagination events
        container.querySelectorAll('.page-link[data-url]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const url = btn.getAttribute('data-url');
                this.fetchData(url);
            });
        });
    }

    refresh() {
        this.fetchData();
    }
} 