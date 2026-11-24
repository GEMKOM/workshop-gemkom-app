// --- plateStock.js ---
// Sac Stoğu tab: the real plate stock, read-only. One row per stock card +
// size with its count; a row opens to its sheets, each with its own code
// (S26-00012, written on the sheet), heat no, place, whether a cut has it
// set aside, and where it came from. Remnants of a cut join it when the cut
// is finished (cnc_cutting/tasks/remnantFinishModal.js).

import { getPlateGroups } from '../generic/platePieces.js';
import { HeaderComponent } from '../components/header/header.js';
import { ResultsTable } from '../components/resultsTable/resultsTable.js';
import { Pagination } from '../components/pagination/pagination.js';
import { formatNumber, normalizeShape, sizeText, sheetCodeFromSearch } from './plateShape.js';

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 350;

// Kept across tab switches and the page's refresh button.
const state = { page: 1, search: '' };
let resultsTable = null;
let pagination = null;
let requestId = 0;
let searchTimer = null;

const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);

const qty = (value) => Number(value) || 0;

export function loadPlateStockContent() {
    clearTimeout(searchTimer);
    createHTML();
    bindEvents();
    loadGroups(state.page);
}

function createHTML() {
    const mainView = document.getElementById('main-view');
    mainView.innerHTML = `
        <div class="plate-stock-view">
            <div id="plate-stock-header"></div>
            <div class="plate-stock-search mb-3">
                <div class="input-group">
                    <span class="input-group-text"><i class="fas fa-search"></i></span>
                    <input type="search" id="plate-stock-search" class="form-control" autocomplete="off"
                           placeholder="Sac kodu, malzeme, ölçü (1500x3000), döküm no…"
                           value="${esc(state.search)}">
                    <button type="button" class="btn btn-outline-secondary" id="plate-stock-search-clear" title="Aramayı temizle">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div id="plate-stock-results"></div>
            <div class="pagination-section">
                <div id="plate-stock-pagination"></div>
            </div>
        </div>`;

    new HeaderComponent({
        title: 'Sac Stoğu',
        subtitle: 'Depodaki saclar, her biri üzerindeki koduyla. Fire saclar kesim bitirilirken stoğa girer.',
        icon: 'layer-group',
        containerId: 'plate-stock-header',
        showBackButton: 'none',
    });

    resultsTable = new ResultsTable(document.getElementById('plate-stock-results'), {
        title: 'Saclar',
        icon: 'fas fa-layer-group',
        showFilters: false,
        loadingText: 'Sac stoğu yükleniyor...',
        itemRenderer: (group) => groupElement(group),
    });
    pagination = null;
}

function bindEvents() {
    const input = document.getElementById('plate-stock-search');
    const runSearch = () => {
        clearTimeout(searchTimer);
        const value = input.value.trim();
        if (value === state.search) return;
        state.search = value;
        loadGroups(1);
    };
    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') runSearch();
    });
    document.getElementById('plate-stock-search-clear').addEventListener('click', () => {
        input.value = '';
        runSearch();
        input.focus();
    });

    // A group with several sheets opens and closes on click / Enter / Space.
    const results = document.getElementById('plate-stock-results');
    const toggle = (head) => {
        const card = head.closest('.plate-group');
        const sheets = card.querySelector('.plate-group-sheets');
        const open = sheets.classList.toggle('d-none') === false;
        head.setAttribute('aria-expanded', String(open));
        card.querySelector('.plate-group-chevron')?.classList.toggle('fa-rotate-180', open);
    };
    results.addEventListener('click', (event) => {
        const head = event.target.closest('.plate-group-head[role="button"]');
        if (head) toggle(head);
    });
    results.addEventListener('keydown', (event) => {
        const head = event.target.closest('.plate-group-head[role="button"]');
        if (head && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            toggle(head);
        }
    });
}

async function loadGroups(page = 1) {
    const id = ++requestId;
    state.page = page;
    resultsTable.showLoadingState();
    setResultsInfo('');
    try {
        let data;
        try {
            data = await getPlateGroups({ page, page_size: PAGE_SIZE, search: state.search });
        } catch (error) {
            // The list got shorter since (e.g. a refresh on a late page): start over.
            if (error.status === 404 && page > 1) {
                state.page = 1;
                data = await getPlateGroups({ page: 1, page_size: PAGE_SIZE, search: state.search });
            } else {
                throw error;
            }
        }
        if (id !== requestId) return; // a newer search or page is on its way
        const groups = Array.isArray(data?.results) ? data.results : [];
        const count = Number(data?.count) || groups.length;

        resultsTable.options.emptyStateText = state.search ? 'Aramaya uyan sac bulunamadı' : 'Stokta sac yok';
        resultsTable.options.emptyStateDescription = state.search
            ? 'Sac kodunu, malzemeyi veya ölçüyü kontrol edip tekrar deneyin.'
            : 'Depoya alınan saclar ve kesimden dönen fire saclar burada görünür.';
        resultsTable.setItems(groups);
        setResultsInfo(groups.length ? `${count} ölçü grubu` : '');
        renderPagination(count, state.page);
    } catch (error) {
        if (id !== requestId) return;
        console.error('Error loading plate stock:', error);
        showError(error);
        renderPagination(0, 1);
    }
}

function setResultsInfo(text) {
    const info = document.querySelector('#plate-stock-results #results-info');
    if (info) info.innerHTML = text ? `<span class="results-count">${esc(text)}</span>` : '';
}

function showError(error) {
    const list = document.querySelector('#plate-stock-results #items-list');
    if (!list) return;
    list.className = '';
    list.innerHTML = `
        <div class="error-container text-center py-5">
            <i class="fas fa-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
            <h5 class="mt-3 text-danger">Sac stoğu yüklenemedi</h5>
            <p class="text-muted">${esc(error?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.')}</p>
            <button type="button" class="btn btn-primary plate-stock-retry">
                <i class="fas fa-redo me-2"></i>Tekrar Dene
            </button>
        </div>`;
    list.querySelector('.plate-stock-retry').addEventListener('click', () => loadGroups(state.page));
}

function renderPagination(count, page) {
    const container = document.getElementById('plate-stock-pagination');
    if (!container) return;
    pagination?.destroy();
    pagination = null;
    const totalPages = Math.ceil(count / PAGE_SIZE);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    pagination = new Pagination(container, {
        currentPage: page,
        totalPages,
        totalCount: count,
        pageSize: PAGE_SIZE,
        showInfo: true,
        showFirstLast: true,
        maxVisiblePages: 5,
        onPageChange: (next) => {
            loadGroups(next);
            document.getElementById('plate-stock-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
    });
}

// --- one group ----------------------------------------------------------------

/** "(1 kesime ayrılmış, 1 çıkış talebine ayrılmış)" for the group's set-aside sheets. */
function reservedSummary(pieces) {
    const reserved = pieces.reduce((sum, p) => sum + qty(p.reserved_quantity), 0);
    if (!reserved) return '';
    let forCuts = 0;
    let forPulls = 0;
    for (const p of pieces) {
        for (const r of p.reservations ?? []) {
            if (r.cnc_task) forCuts += qty(r.quantity);
            else if (r.pull_request) forPulls += qty(r.quantity);
        }
    }
    const parts = [];
    if (forCuts) parts.push(`${forCuts} kesime ayrılmış`);
    if (forPulls) parts.push(`${forPulls} çıkış talebine ayrılmış`);
    if (!parts.length || forCuts + forPulls < reserved) {
        const rest = reserved - forCuts - forPulls;
        parts.push(`${parts.length ? rest : reserved} ayrılmış`);
    }
    return `(${parts.join(', ')})`;
}

function totalKg(pieces) {
    if (!pieces.length || pieces.some((p) => p.total_kg === null || p.total_kg === undefined || p.total_kg === '')) {
        return '';
    }
    const kg = pieces.reduce((sum, p) => sum + Number(p.total_kg), 0);
    if (!Number.isFinite(kg)) return '';
    return `${kg.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`;
}

/** Whether the group's sheets all have the same area (şekilsiz sheets each have their own). */
function sameArea(pieces) {
    return new Set(pieces.map((p) => String(p.area_m2 ?? ''))).size === 1;
}

function groupElement(group) {
    const pieces = Array.isArray(group.pieces) ? group.pieces : [];
    const first = pieces[0] || {};
    // Groups are per card + size + shape; a group without a shape (before the
    // backend had shapes) is a rectangle.
    const shape = normalizeShape(group.shape);
    const areasMatch = sameArea(pieces);
    const size = sizeText({
        shape, width_mm: group.width_mm, length_mm: group.length_mm, area_m2: areasMatch ? first.area_m2 : null,
    });
    const thickness = formatNumber(first.plate_thickness_mm, 2);
    const weight = totalKg(pieces);
    const reserved = reservedSummary(pieces);
    const count = qty(group.quantity) || pieces.reduce((sum, p) => sum + qty(p.quantity), 0);
    const single = pieces.length === 1;
    const open = single || !!state.search;
    // A şekilsiz sheet shows its own size (with its area) when the group's areas differ.
    const sheetSize = (p) => normalizeShape(p.shape) !== shape || (shape === 'irregular' && !areasMatch);
    const searchedCode = sheetCodeFromSearch(state.search);
    const searched = state.search.toLowerCase();

    const card = document.createElement('div');
    card.className = 'card plate-group';
    card.innerHTML = `
        <div class="card-body p-3 plate-group-head" ${single ? '' : `role="button" tabindex="0" aria-expanded="${open}"`}>
            <div class="d-flex align-items-start gap-2">
                <div class="flex-grow-1" style="min-width: 0;">
                    <div class="fw-semibold">
                        <span class="font-monospace">${esc(group.item_code || first.item_code)}</span>
                        ${first.item_name ? `<span class="fw-normal text-muted ms-1">${esc(first.item_name)}</span>` : ''}
                    </div>
                    <div class="small text-muted mt-1 d-flex flex-wrap column-gap-3 row-gap-1">
                        ${thickness ? `<span><i class="fas fa-ruler-vertical me-1"></i>${esc(thickness)} mm</span>` : ''}
                        <span><i class="fas fa-vector-square me-1"></i>${esc(size)}</span>
                        ${weight ? `<span><i class="fas fa-weight-hanging me-1"></i>${esc(weight)}</span>` : ''}
                    </div>
                </div>
                <div class="text-end text-nowrap">
                    <div class="fw-bold">${count} sac</div>
                    ${reserved ? `<div class="small text-warning-emphasis">${esc(reserved)}</div>` : ''}
                </div>
                ${single ? '' : `<i class="fas fa-chevron-down text-muted mt-1 plate-group-chevron ${open ? 'fa-rotate-180' : ''}"></i>`}
            </div>
        </div>
        <div class="list-group list-group-flush plate-group-sheets ${open ? '' : 'd-none'}">
            ${pieces.map((p) => sheetHtml(p, {
                showSize: sheetSize(p),
                match: !!p.code && (p.code === searchedCode || p.code.toLowerCase() === searched),
            })).join('')}
        </div>`;
    return card;
}

function placeText(p) {
    const place = p.supplier_name
        ? `Fason: ${p.supplier_name}`
        : (p.warehouse_name || p.warehouse_code || '–');
    return p.job_no ? `${place} · İş Emri ${p.job_no}` : place;
}

/** Badges: free, or which cut / pull request has it set aside. */
function stateBadges(p) {
    const quantity = qty(p.quantity);
    const reserved = qty(p.reserved_quantity);
    const reservedClass = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    const freeClass = 'badge bg-success-subtle text-success-emphasis border border-success-subtle';
    if (!reserved) return `<span class="${freeClass}">Boşta</span>`;
    const many = quantity > 1;
    const badges = (p.reservations ?? []).map((r) => {
        const amount = many ? `${qty(r.quantity)} adet ` : '';
        if (r.cnc_task) return `<span class="${reservedClass}">${esc(amount)}${esc(r.cnc_task)} kesimine ayrılmış</span>`;
        if (r.pull_request) {
            return `<span class="${reservedClass}">${esc(amount)}${esc(r.pull_request)} nolu çıkış talebine ayrılmış</span>`;
        }
        return '';
    }).filter(Boolean);
    if (!badges.length) badges.push(`<span class="${reservedClass}">${many ? `${reserved} adet ` : ''}Ayrılmış</span>`);
    const free = qty(p.available_quantity);
    if (free > 0) badges.push(`<span class="${freeClass}">${free} adet boşta</span>`);
    return badges.join(' ');
}

function sheetHtml(p, { showSize, match }) {
    const quantity = qty(p.quantity);
    const origin = [p.origin_label, p.parent_code ? `${p.parent_code} sacından` : '']
        .filter(Boolean).join(' · ');
    return `
        <div class="list-group-item plate-sheet ${match ? 'plate-sheet-match' : ''}">
            <div class="d-flex flex-wrap align-items-center column-gap-3 row-gap-1">
                ${p.code
                    ? `<span class="plate-sheet-code font-monospace fw-bold fs-5">${esc(p.code)}</span>`
                    : '<span class="plate-sheet-code text-muted fst-italic">Kodsuz</span>'}
                ${quantity > 1 ? `<span class="badge text-bg-secondary">${quantity} adet</span>` : ''}
                ${showSize ? `<span class="small"><i class="fas fa-vector-square text-muted me-1"></i>${esc(sizeText(p))}</span>` : ''}
                <span class="small"><span class="text-muted">Döküm no:</span> ${esc(p.heat_number || '–')}</span>
                <span class="small"><i class="fas fa-map-marker-alt text-muted me-1"></i>${esc(placeText(p))}</span>
                <span class="d-inline-flex flex-wrap gap-1">${stateBadges(p)}</span>
                ${origin ? `<span class="small text-muted">${esc(origin)}</span>` : ''}
            </div>
        </div>`;
}
