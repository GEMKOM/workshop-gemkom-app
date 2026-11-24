// --- remnantCodesModal.js ---
// After a cut is finished: each remnant sheet that went back to stock got its
// own code (S26-00001). The operator writes it on the sheet itself, so a
// search in Sac Stoğu finds its card, size and heat no. Shown with a print.

import { sizeText } from '../plateShape.js';

const MODAL_ID = 'remnantCodesModal';
// Above the confirmation modal's backdrops (see remnantFinishModal.js).
const MODAL_Z_INDEX = '10050';

const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);

/** The coded remnant sheets of a finish result (`booked` of mark-completed). */
export function remnantSheets(booked) {
    const out = [];
    for (const r of booked?.remnants ?? []) {
        for (const sheet of r.sheets ?? []) {
            if (!sheet.code) continue;
            out.push({
                code: sheet.code,
                item_code: r.item_code,
                item_name: r.item_name,
                // "600 × 1200 mm", "Ø 600 mm", "Üçgen …", "Şekilsiz … · ~0,45 m²"
                size: sizeText(r),
                heat_number: sheet.heat_number || '',
            });
        }
    }
    return out;
}

function tableHtml(sheets, codeClass) {
    return `
        <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
                <tr><th>Sac Kodu</th><th>Stok Kartı</th><th>Ölçü</th><th>Döküm No</th></tr>
            </thead>
            <tbody>
                ${sheets.map((s) => `
                    <tr>
                        <td class="${codeClass}">${esc(s.code)}</td>
                        <td>${esc(s.item_code)}${s.item_name ? `<div class="small text-muted">${esc(s.item_name)}</div>` : ''}</td>
                        <td class="text-nowrap">${esc(s.size)}</td>
                        <td>${esc(s.heat_number || '–')}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function printSheets(title, sheets) {
    const win = window.open('', '_blank');
    if (!win) {
        alert('Yazdırma penceresi açılamadı; tarayıcının açılır pencere iznini kontrol edin.');
        return;
    }
    win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title>
        <style>
            body { font: 11pt/1.4 "Segoe UI", Arial, sans-serif; color: #111; margin: 12mm; }
            h1 { font-size: 14pt; margin: 0 0 4mm; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #999; padding: 2mm 2.5mm; text-align: left; vertical-align: middle; }
            th { background: #eee; font-size: 9.5pt; }
            td.code { font: 700 16pt/1.2 Consolas, "Courier New", monospace; white-space: nowrap; }
            .small { font-size: 9pt; color: #555; }
            tr { page-break-inside: avoid; }
            @page { size: A4; margin: 10mm; }
        </style></head><body><h1>${esc(title)}</h1>${tableHtml(sheets, 'code')}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
        try { win.print(); } catch (e) { /* the user can print from the window */ }
    }, 50);
}

/** Waits until other Bootstrap modals have finished closing (at most ~1 s). */
async function waitForOtherModals() {
    for (let i = 0; i < 40; i++) {
        const others = [...document.querySelectorAll('.modal.show, .modal[style*="display: block"]')]
            .filter((m) => m.id !== MODAL_ID);
        if (!others.length) return;
        await new Promise((r) => setTimeout(r, 25));
    }
}

/**
 * Shows the codes the cut's remnant sheets got, to write on them.
 * @param {string} title e.g. the nesting id
 * @param {Array} sheets from remnantSheets()
 * @returns {Promise<void>} once closed
 */
export async function showRemnantCodes(title, sheets) {
    await waitForOtherModals();
    document.getElementById(MODAL_ID)?.remove();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="modal fade" id="${MODAL_ID}" tabindex="-1" aria-labelledby="${MODAL_ID}Label" aria-hidden="true"
             data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${MODAL_ID}Label">
                            <i class="fas fa-tags me-2"></i>Görev tamamlandı · Fire sac kodları
                        </h5>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info small">
                            <i class="fas fa-pen me-1"></i>
                            Her fire sacın üzerine kodunu yazın. Kod ile Sac Stoğu'nda aratınca sacın
                            kartı, ölçüsü ve döküm no'su bulunur; kesimde de sac bu kodla seçilir.
                        </div>
                        ${tableHtml(sheets, 'fw-bold font-monospace fs-5 text-nowrap')}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary remnant-codes-print">
                            <i class="fas fa-print me-1"></i>Yazdır
                        </button>
                        <button type="button" class="btn btn-success" data-bs-dismiss="modal">
                            <i class="fas fa-check me-1"></i>Kodları yazdım
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(wrapper.firstElementChild);
    const modal = document.getElementById(MODAL_ID);
    modal.style.zIndex = MODAL_Z_INDEX;
    const heading = title ? `Fire sac kodları · ${title}` : 'Fire sac kodları';
    modal.querySelector('.remnant-codes-print').addEventListener('click', () => printSheets(heading, sheets));
    return new Promise((resolve) => {
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            resolve();
        }, { once: true });
        bootstrap.Modal.getOrCreateInstance(modal).show();
    });
}
