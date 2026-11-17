// --- remnantFinishModal.js ---
// Finishing a CNC cut: the operator enters the remnants (fire sac) the cut
// left, as rectangles. No rows means the cut left no usable remnant. The
// backend books the cut with them: the sheets leave stock, the remnants go
// back to stock as pieces, the rest is fire. A remnant shorter than 500 mm on
// its short side is not kept; it counts as fire.

const MIN_REMNANT_SIDE_MM = 500;
const MODAL_ID = 'remnantFinishModal';

function rowHtml(index) {
    return `
        <div class="row g-2 align-items-end remnant-row mb-2" data-row="${index}">
            <div class="col-4">
                <label class="form-label small mb-1">En (mm)</label>
                <input type="number" min="0.1" step="0.1" class="form-control remnant-width" inputmode="decimal">
            </div>
            <div class="col-4">
                <label class="form-label small mb-1">Boy (mm)</label>
                <input type="number" min="0.1" step="0.1" class="form-control remnant-length" inputmode="decimal">
            </div>
            <div class="col-2">
                <label class="form-label small mb-1">Adet</label>
                <input type="number" min="1" step="1" value="1" class="form-control remnant-quantity" inputmode="numeric">
            </div>
            <div class="col-2 text-end">
                <button type="button" class="btn btn-outline-danger remnant-remove" title="Satırı sil">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="col-12 small text-warning remnant-scrap" style="display:none;">
                <i class="fas fa-exclamation-triangle me-1"></i>Kısa kenarı ${MIN_REMNANT_SIDE_MM} mm'den kısa: stoğa alınmaz, fireye sayılır.
            </div>
        </div>`;
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
                            Kesimden artan kullanılabilir sacları girin (dikdörtgen olarak).
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
    return document.getElementById(MODAL_ID);
}

function readRows(modal) {
    const rows = [];
    let incomplete = false;
    modal.querySelectorAll('.remnant-row').forEach((row) => {
        const width = mm(row.querySelector('.remnant-width').value);
        const length = mm(row.querySelector('.remnant-length').value);
        const quantity = parseInt(row.querySelector('.remnant-quantity').value, 10);
        const empty = !row.querySelector('.remnant-width').value && !row.querySelector('.remnant-length').value;
        if (empty) return;
        if (!(width > 0) || !(length > 0) || !(quantity > 0)) {
            incomplete = true;
            return;
        }
        rows.push({ width_mm: width.toFixed(1), length_mm: length.toFixed(1), quantity });
    });
    return { rows, incomplete };
}

/** mm from the input, rounded to 0.1 (a comma is read as the decimal point). */
function mm(value) {
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN;
}

function refreshScrapHints(modal) {
    modal.querySelectorAll('.remnant-row').forEach((row) => {
        const width = mm(row.querySelector('.remnant-width').value);
        const length = mm(row.querySelector('.remnant-length').value);
        const scrap = width > 0 && length > 0 && Math.min(width, length) < MIN_REMNANT_SIDE_MM;
        row.querySelector('.remnant-scrap').style.display = scrap ? 'block' : 'none';
    });
}

/**
 * Asks for the cut's remnants.
 * @returns {Promise<{remnants: Array, no_remnant: boolean} | null>} null when cancelled
 */
export function askRemnants() {
    return new Promise((resolve) => {
        const modal = ensureModal();
        const rowsBox = modal.querySelector('.remnant-rows');
        const error = modal.querySelector('.remnant-error');
        let counter = 0;
        let settled = false;

        const addRow = () => {
            rowsBox.insertAdjacentHTML('beforeend', rowHtml(counter++));
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
                const { rows, incomplete } = readRows(modal);
                if (incomplete) return showError('Her fire sac için en, boy ve adet girin.');
                settled = true;
                bootstrap.Modal.getOrCreateInstance(modal).hide();
                // No rows: the cut left no usable remnant.
                resolve({ remnants: rows, no_remnant: rows.length === 0 });
            }
        };
        const onInput = () => {
            error.style.display = 'none';
            refreshScrapHints(modal);
        };
        const onHidden = () => {
            modal.removeEventListener('click', onClick);
            modal.removeEventListener('input', onInput);
            modal.removeEventListener('hidden.bs.modal', onHidden);
            if (!settled) resolve(null);
        };
        modal.addEventListener('click', onClick);
        modal.addEventListener('input', onInput);
        modal.addEventListener('hidden.bs.modal', onHidden);
        bootstrap.Modal.getOrCreateInstance(modal).show();
    });
}
