/**
 * Parts Export Module
 * Handles CSV export of parts table with preview and editing capabilities
 */

import { formatDecimalTurkish } from '../../generic/formatters.js';

// ============================================================================
// EXPORT MODAL FUNCTIONS
// ============================================================================

/**
 * Shows the export preview modal
 * @param {Array} parts - Array of part objects
 */
export function showExportModal(parts) {
    closeExportModal();
    
    // Transform parts to export format
    const exportData = transformPartsToExportFormat(parts);
    
    const modalHTML = createExportModalHTML(exportData);
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Render preview table
    renderPreviewTable(exportData);
    
    // Bind modal events
    bindExportModalEvents(exportData);
}

/**
 * Transforms parts data to export format
 * @param {Array} parts - Array of part objects
 * @returns {Array} Transformed data with editable structure
 */
function transformPartsToExportFormat(parts) {
    return parts.map((part, index) => {
        // Use weightToReduce if available (includes remnant), otherwise calculate from weight * quantity
        let totalWeight;
        if (part.weightToReduce !== undefined && part.weightToReduce !== null) {
            totalWeight = formatDecimalTurkish(part.weightToReduce, 2);
        } else {
            const weight = parseFloat(part.weight_kg) || 0;
            const quantity = parseInt(part.quantity) || 0;
            totalWeight = formatDecimalTurkish(weight * quantity, 2);
        }
        
        return {
            id: part.id || index,
            originalPart: part,
            col1: '', // Empty
            col2: 'C',
            col3: totalWeight, // Total weight (weightToReduce if available, otherwise quantity × weight) - formatted with comma
            col4: '', // Empty
            col5: part.job_no || '', // Job no
            col6: '2'
        };
    });
}

/**
 * Creates the HTML for export modal
 */
function createExportModalHTML(exportData) {
    return `
        <div class="modal fade show" id="exportModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-file-csv me-2"></i>CSV Dışa Aktarım - Önizleme
                        </h5>
                        <button type="button" class="btn-close" data-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            Tabloyu düzenleyebilir ve ardından CSV olarak dışa aktarabilirsiniz.
                        </div>
                        
                        <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                            <table class="table table-bordered table-hover table-sm" id="export-preview-table">
                                <thead class="table-light sticky-top">
                                    <tr>
                                        <th style="width: 15%;">Stok Kodu</th>
                                        <th style="width: 10%;">Sütun 2</th>
                                        <th style="width: 15%;">Toplam Ağırlık</th>
                                        <th style="width: 15%;">Boş Bırak</th>
                                        <th style="width: 25%;">İş Emri No</th>
                                        <th style="width: 10%;">Depo</th>
                                    </tr>
                                </thead>
                                <tbody id="export-preview-tbody">
                                    <!-- Table rows will be inserted here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-success" id="export-csv-btn">
                            <i class="fas fa-download me-2"></i>CSV Olarak Dışa Aktar
                        </button>
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">İptal</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the preview table with editable cells
 */
function renderPreviewTable(exportData) {
    const tbody = document.getElementById('export-preview-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = exportData.map((row, index) => `
        <tr data-row-index="${index}">
            <td>
                <input type="text" 
                       class="form-control form-control-sm export-cell" 
                       data-col="col1" 
                       data-row="${index}"
                       value="${escapeHtml(row.col1)}"
                       placeholder="Boş">
            </td>
            <td>
                <input type="text" 
                       class="form-control form-control-sm export-cell" 
                       data-col="col2" 
                       data-row="${index}"
                       value="${escapeHtml(row.col2)}"
                       placeholder="C">
            </td>
            <td>
                <input type="text" 
                       class="form-control form-control-sm export-cell" 
                       data-col="col3" 
                       data-row="${index}"
                       value="${escapeHtml(row.col3)}"
                       placeholder="Ağırlık">
            </td>
            <td>
                <input type="text" 
                       class="form-control form-control-sm export-cell" 
                       data-col="col4" 
                       data-row="${index}"
                       value="${escapeHtml(row.col4)}"
                       placeholder="Boş">
            </td>
            <td>
                <input type="text" 
                       class="form-control form-control-sm export-cell" 
                       data-col="col5" 
                       data-row="${index}"
                       value="${escapeHtml(row.col5)}"
                       placeholder="İş Emri No">
            </td>
            <td>
                <input type="text" 
                       class="form-control form-control-sm export-cell" 
                       data-col="col6" 
                       data-row="${index}"
                       value="${escapeHtml(row.col6)}"
                       placeholder="2">
            </td>
        </tr>
    `).join('');
}

/**
 * Binds events for the export modal
 */
function bindExportModalEvents(exportData) {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    
    // Store export data in modal for later use
    modal.exportData = exportData;
    
    // Close button
    const closeButtons = modal.querySelectorAll('[data-dismiss="modal"], .btn-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeExportModal);
    });
    
    // Export CSV button
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportToCSV(modal);
        });
    }
    
    // Update export data when cells are edited
    const cells = modal.querySelectorAll('.export-cell');
    cells.forEach(cell => {
        cell.addEventListener('input', (e) => {
            const rowIndex = parseInt(e.target.dataset.row);
            const col = e.target.dataset.col;
            if (modal.exportData && modal.exportData[rowIndex]) {
                modal.exportData[rowIndex][col] = e.target.value;
            }
        });
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeExportModal();
        }
    });
    
    // Escape key to close
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeExportModal();
        }
    };
    document.addEventListener('keydown', escapeHandler);
    modal.escapeHandler = escapeHandler;
}

/**
 * Exports data to CSV
 */
function exportToCSV(modal) {
    if (!modal.exportData || modal.exportData.length === 0) {
        alert('Dışa aktarılacak veri bulunamadı.');
        return;
    }
    
    // Get current data from table inputs
    const rows = modal.querySelectorAll('#export-preview-tbody tr');
    const csvData = [];
    
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('.export-cell');
        const rowData = [];
        cells.forEach(cell => {
            rowData.push(cell.value || '');
        });
        csvData.push(rowData);
    });
    
    // Convert to CSV format with semicolon delimiter (Excel-friendly)
    const csvContent = csvData.map(row => {
        // Escape values that contain semicolons, commas, or quotes
        return row.map(cell => {
            const value = String(cell || '');
            // If value contains semicolon, comma, quote, or newline, wrap in quotes
            if (value.includes(';') || value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(';'); // Use semicolon as delimiter for Excel compatibility
    }).join('\r\n'); // Use Windows line endings (CRLF) for Excel
    
    // Add UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    // Create download link with proper encoding
    const blob = new Blob([csvWithBOM], { 
        type: 'text/csv;charset=utf-8;' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.setAttribute('href', url);
    link.setAttribute('download', `parts_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success message
    alert('CSV dosyası başarıyla dışa aktarıldı!');
    
    // Close modal
    closeExportModal();
}

/**
 * Closes the export modal
 */
function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        // Clean up escape handler
        if (modal.escapeHandler) {
            document.removeEventListener('keydown', modal.escapeHandler);
        }
        modal.remove();
    }
}

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make closeExportModal available globally for onclick handlers
window.closeExportModal = closeExportModal;

