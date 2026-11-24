// --- remnantFinishModal.js ---
// Finishing a CNC cut: the operator enters the remnants (fire sac) the cut
// left, each with its shape (Dikdörtgen, Üçgen, Daire, Şekilsiz) and size.
// No rows means the cut left no usable remnant. The backend books the cut
// with them: the sheets leave stock, the remnants go back to stock as pieces,
// the rest is fire. A remnant shorter than 500 mm on its short side (a
// circle's diameter) is not kept; it counts as fire.

import { SHAPES, SHAPE_LABELS, shapeFields, buildRemnant, parseDecimal, shortSideMm } from '../plateShape.js';

const MIN_REMNANT_SIDE_MM = 500;
const MODAL_ID = 'remnantFinishModal';
// The confirmation modal's stylesheet lifts every Bootstrap backdrop to 10049
// (components/confirmation-modal/confirmation-modal.css), so this modal must
// sit above it or it opens under its own backdrop and nothing is clickable.
const MODAL_Z_INDEX = '10050';

/** Waits until the "Görevi Tamamla" confirmation has finished closing, so the
 * two Bootstrap modals never overlap (at most ~1 s). */
async function waitForOtherModals() {
    for (let i = 0; i < 40; i++) {
        const others = [...document.querySelectorAll('.modal.show, .modal[style*="display: block"]')]
            .filter((m) => m.id !== MODAL_ID);
        if (!others.length) return;
        await new Promise((r) => setTimeout(r, 25));
    }
}

function rowHtml(index) {
    const options = SHAPES.map((shape) => `<option value="${shape}">${SHAPE_LABELS[shape]}</option>`).join('');
    return `
        <div class="remnant-row border rounded px-2 pb-2 mb-2" data-row="${index}">
            <div class="row g-2 align-items-start">
                <div class="col-6">
                    <label class="form-label small mb-1">Şekil</label>
                    <select class="form-select remnant-shape">${options}</select>
                </div>
                <div class="col-4">
                    <label class="form-label small mb-1">Adet</label>
                    <input type="number" min="1" step="1" value="1" class="form-control remnant-quantity" inputmode="numeric">
                </div>
                <div class="col-2 text-end">
                    <label class="form-label small mb-1 d-block" aria-hidden="true">&nbsp;</label>
                    <button type="button" class="btn btn-outline-danger remnant-remove" title="Satırı sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="col-6">
                    <label class="form-label small mb-1 remnant-width-label">En (mm)</label>
                    <input type="number" min="0.1" step="0.1" class="form-control remnant-width" inputmode="decimal">
                </div>
                <div class="col-6 remnant-length-col">
                    <label class="form-label small mb-1 remnant-length-label">Boy (mm)</label>
                    <input type="number" min="0.1" step="0.1" class="form-control remnant-length" inputmode="decimal">
                </div>
                <div class="col-6 remnant-area-col d-none">
                    <label class="form-label small mb-1">Tahmini alan (m²)</label>
                    <input type="number" min="0.0001" step="0.01" class="form-control remnant-area" inputmode="decimal">
                </div>
                <div class="col-6 remnant-area-col d-none small text-muted pt-4">
                    <i class="fas fa-info-circle me-1"></i>Ağırlık bu alandan hesaplanır; <span class="text-nowrap">en × boy</span> alanından büyük olamaz.
                </div>
                <div class="col-12 small text-warning remnant-scrap" style="display:none;">
                    <i class="fas fa-exclamation-triangle me-1"></i><span class="remnant-scrap-text"></span>
                </div>
            </div>
        </div>`;
}

/** Shows the inputs the row's shape asks for, with their labels. */
function applyShape(row) {
    const shape = row.querySelector('.remnant-shape').value;
    const fields = shapeFields(shape);
    const label = (field) => fields.find((f) => f.field === field)?.label;
    row.querySelector('.remnant-width-label').textContent = label('width');
    const lengthLabel = label('length');
    row.querySelector('.remnant-length-col').classList.toggle('d-none', !lengthLabel);
    if (lengthLabel) row.querySelector('.remnant-length-label').textContent = lengthLabel;
    row.querySelectorAll('.remnant-area-col').forEach((col) => col.classList.toggle('d-none', shape !== 'irregular'));
    row.querySelector('.remnant-scrap-text').textContent = shape === 'circle'
        ? `Çapı ${MIN_REMNANT_SIDE_MM} mm'den küçük: stoğa alınmaz, fireye sayılır.`
        : `Kısa kenarı ${MIN_REMNANT_SIDE_MM} mm'den kısa: stoğa alınmaz, fireye sayılır.`;
}

function rowInput(row) {
    return {
        shape: row.querySelector('.remnant-shape').value,
        width: row.querySelector('.remnant-width').value,
        length: row.querySelector('.remnant-length').value,
        area: row.querySelector('.remnant-area').value,
        quantity: row.querySelector('.remnant-quantity').value,
    };
}

function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="modal fade" id="${MODAL_ID}" tabindex="-1" aria-labelledby="${MODAL_ID}Label" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${MODAL_ID}Label">
                            <i class="fas fa-layer-group me-2"></i>Fire Sac Ölçüleri
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
                    </div>
                    <div class="modal-body">
                        <p class="small text-muted mb-2">
                            Kesimden artan kullanılabilir sacları şekli ve ölçüsüyle girin.
                            Bunlar stoğa döner; kalanı fire sayılır. Kullanılabilir fire
                            kalmadıysa boş bırakın.
                        </p>
                        <div class="remnant-rows"></div>
                        <button type="button" class="btn btn-outline-primary btn-sm remnant-add mb-3">
                            <i class="fas fa-plus me-1"></i>Fire Sac Ekle
                        </button>
                        <div class="alert alert-danger small mt-3 mb-0 remnant-error" style="display:none;"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                        <button type="button" class="btn btn-success remnant-confirm">
                            <i class="fas fa-check me-1"></i>Kesimi Bitir
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(wrapper.firstElementChild);
    modal = document.getElementById(MODAL_ID);
    modal.style.zIndex = MODAL_Z_INDEX;
    return modal;
}

/** The rows in the mark-completed shape, or the first row's problem. */
function readRows(modal) {
    const rows = [];
    const rowEls = [...modal.querySelectorAll('.remnant-row')];
    for (let i = 0; i < rowEls.length; i++) {
        const result = buildRemnant(rowInput(rowEls[i]), i + 1);
        if (result.empty) continue;
        if (result.error) return { rows, error: result.error };
        rows.push(result.remnant);
    }
    return { rows, error: '' };
}

function refreshScrapHints(modal) {
    modal.querySelectorAll('.remnant-row').forEach((row) => {
        const shape = row.querySelector('.remnant-shape').value;
        const width = parseDecimal(row.querySelector('.remnant-width').value, 1);
        const length = shape === 'circle' ? width : parseDecimal(row.querySelector('.remnant-length').value, 1);
        const scrap = width > 0 && length > 0 && shortSideMm(shape, width, length) < MIN_REMNANT_SIDE_MM;
        row.querySelector('.remnant-scrap').style.display = scrap ? 'block' : 'none';
    });
}

/**
 * Asks for the cut's remnants.
 * @returns {Promise<{remnants: Array, no_remnant: boolean} | null>} null when cancelled
 */
export async function askRemnants() {
    await waitForOtherModals();
    return new Promise((resolve) => {
        const modal = ensureModal();
        const rowsBox = modal.querySelector('.remnant-rows');
        const error = modal.querySelector('.remnant-error');
        let counter = 0;
        let settled = false;

        const addRow = () => {
            rowsBox.insertAdjacentHTML('beforeend', rowHtml(counter++));
            applyShape(rowsBox.lastElementChild);
        };
        rowsBox.innerHTML = '';
        addRow();
        error.style.display = 'none';

        const showError = (text) => {
            error.textContent = text;
            error.style.display = 'block';
        };
        const onClick = (event) => {
            if (event.target.closest('.remnant-add')) {
                addRow();
            } else if (event.target.closest('.remnant-remove')) {
                event.target.closest('.remnant-row').remove();
            } else if (event.target.closest('.remnant-confirm')) {
                const { rows, error: problem } = readRows(modal);
                if (problem) return showError(problem);
                settled = true;
                bootstrap.Modal.getOrCreateInstance(modal).hide();
                // No rows: the cut left no usable remnant.
                resolve({ remnants: rows, no_remnant: rows.length === 0 });
            }
        };
        const onInput = (event) => {
            const shapeSelect = event.target.closest('.remnant-shape');
            if (shapeSelect) applyShape(shapeSelect.closest('.remnant-row'));
            error.style.display = 'none';
            refreshScrapHints(modal);
        };
        const onHidden = () => {
            modal.removeEventListener('click', onClick);
            modal.removeEventListener('input', onInput);
            modal.removeEventListener('change', onInput);
            modal.removeEventListener('hidden.bs.modal', onHidden);
            if (!settled) resolve(null);
        };
        modal.addEventListener('click', onClick);
        modal.addEventListener('input', onInput);
        // Some tablet browsers send only "change" for a select.
        modal.addEventListener('change', onInput);
        modal.addEventListener('hidden.bs.modal', onHidden);
        modal.style.zIndex = MODAL_Z_INDEX;
        bootstrap.Modal.getOrCreateInstance(modal).show();
    });
}
