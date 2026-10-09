import { backendBase } from '../../base.js';
import { guardRoute, authedFetch } from '../../authService.js';
import { initNavbar } from '../../components/navbar.js';

// Kaynak Puantaj: the welder picks the jobs of the day and taps the hours.
// The office reviews and approves on ofis.gemcore.com.tr. Cell layout mirrors
// welding/timesheet_layout.py in the backend (the server sends it as well).

const API = `${backendBase}/welding/timesheets`;
const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const REGULAR_CELLS = 10;

const state = {
    date: null,
    day: null,           // payload from /mobile/day/
    rows: [],            // [{job_no, title, cells: bool[]}]
    blankDay: false,
    note: '',
    dirty: false,
    saving: false,
    searchTimer: null,
    searchResults: [],
};

const $ = (id) => document.getElementById(id);

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(message, isError = false) {
    const el = $('wt-toast');
    el.textContent = message;
    el.className = 'wt-toast' + (isError ? ' error' : '');
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, isError ? 4500 : 2500);
}

async function api(path, options = {}) {
    const resp = await authedFetch(`${API}${path}`, options);
    let data = null;
    try { data = await resp.json(); } catch { data = null; }
    if (!resp.ok) {
        throw new Error((data && (data.error || data.detail)) || `İstek başarısız (${resp.status})`);
    }
    return data;
}

function fmtHours(h) {
    const n = Number(h) || 0;
    return (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')) + ' saat';
}

function cellHours(idx) {
    return Number(state.day.cells[idx].hours);
}

function rowHours(row) {
    return row.cells.reduce((sum, on, idx) => sum + (on ? cellHours(idx) : 0), 0);
}

function totalHours() {
    return state.rows.reduce((sum, row) => sum + rowHours(row), 0);
}

function dateLabel(iso) {
    const today = state.day && state.day.allowed_dates ? state.day.allowed_dates[0] : null;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const name = DAY_NAMES[dt.getDay()];
    if (iso === today) return { main: 'Bugün', sub: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')} ${name}` };
    if (state.day && state.day.allowed_dates && iso === state.day.allowed_dates[1]) {
        return { main: 'Dün', sub: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')} ${name}` };
    }
    return { main: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`, sub: name };
}

function cellOwner(idx, exceptJob) {
    const row = state.rows.find((r) => r.job_no !== exceptJob && r.cells[idx]);
    return row ? row.job_no : null;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    if (!guardRoute()) return;
    initNavbar();
    $('wt-submit').addEventListener('click', submit);
    $('wt-app').addEventListener('click', onClick);
    $('wt-app').addEventListener('input', onInput);
    await loadDay(null);
});

async function loadDay(date) {
    try {
        const query = date ? `?date=${encodeURIComponent(date)}` : '';
        state.day = await api(`/mobile/day/${query}`);
        state.date = state.day.date;
        hydrateFromSubmission();
        render();
    } catch (error) {
        $('wt-app').innerHTML = `<div class="wt-card"><div class="wt-banner pending"><i class="fas fa-triangle-exclamation"></i><div>${esc(error.message)}</div></div></div>`;
    }
}

function hydrateFromSubmission() {
    const sub = state.day.submission;
    state.rows = [];
    state.blankDay = false;
    state.note = '';
    state.dirty = false;
    state.searchResults = [];
    if (sub) {
        state.blankDay = !!sub.blank_day;
        state.note = sub.note || '';
        state.rows = (sub.rows || []).map((r) => ({ job_no: r.job_no, title: r.title || '', cells: (r.cells || []).map(Boolean) }));
    }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
    const day = state.day;
    const locked = !!day.locked;
    const sub = day.submission;
    const cells = day.cells;

    const dates = day.allowed_dates.map((iso) => {
        const l = dateLabel(iso);
        return `<button type="button" class="wt-date ${iso === state.date ? 'active' : ''}" data-date="${iso}">${esc(l.main)}<small>${esc(l.sub)}</small></button>`;
    }).join('');

    let banner;
    if (locked) {
        banner = `<div class="wt-banner approved"><i class="fas fa-circle-check"></i><div><strong>Onaylandı.</strong> Bu günün puantajı kayıtlara geçti. Değişiklik için ofise söyleyin.</div></div>`;
    } else if (sub) {
        const when = sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
        banner = `<div class="wt-banner pending"><i class="fas fa-clock"></i><div><strong>Gönderildi${when ? ' · ' + esc(when) : ''}.</strong> Ofis onayı bekleniyor. Yanlış bir şey varsa düzeltip tekrar gönderin.</div></div>`;
    } else {
        banner = `<div class="wt-banner none"><i class="fas fa-pen"></i><div>Bugün hangi işlerde, hangi saatlerde çalıştınız? İşi seçin, çalıştığınız saat aralıklarına dokunun, <strong>GÖNDER</strong>'e basın.<br><small>Her kutu bir saat aralığıdır: <strong>08–09</strong> = saat 8'den 9'a kadar.</small></div></div>`;
    }
    const kindBanner = day.kind !== 'weekday'
        ? `<div class="wt-banner kind"><i class="fas fa-calendar-day"></i><div>${esc(day.kind_label)}</div></div>` : '';

    const jobsHtml = state.rows.map((row) => renderJob(row, cells)).join('');

    const added = new Set(state.rows.map((r) => r.job_no));
    const suggestions = (day.suggested_jobs || []).filter((j) => !added.has(j.job_no));
    const tag = { team: 'ekibinizin işi', recent: 'son günlerde', general: '' };
    const addHtml = suggestions.map((j) => `
        <button type="button" class="wt-add" data-add="${esc(j.job_no)}" data-title="${esc(j.title || '')}">
            <span class="wt-add-no">${esc(j.job_no === '1000' ? 'GENEL' : j.job_no)}</span>
            <span class="wt-add-title">${esc(j.job_no === '1000' ? 'İş emri dışı genel işler' : (j.title || ''))}</span>
            ${tag[j.origin] ? `<span class="wt-add-tag">${esc(tag[j.origin])}</span>` : ''}
            <i class="fas fa-plus"></i>
        </button>`).join('');

    const results = state.searchResults.filter((j) => !added.has(j.job_no)).map((j) => `
        <button type="button" class="wt-add" data-add="${esc(j.job_no)}" data-title="${esc(j.title || '')}">
            <span class="wt-add-no">${esc(j.job_no)}</span>
            <span class="wt-add-title">${esc(j.title || '')}</span>
            ${j.closed ? '<span class="wt-add-tag">kapalı</span>' : ''}
            <i class="fas fa-plus"></i>
        </button>`).join('');

    const flags = sub && sub.flags && sub.flags.length && !locked
        ? `<div class="wt-flags"><i class="fas fa-circle-info"></i> ${sub.flags.map((f) => esc(f.text)).join(' · ')}</div>` : '';

    $('wt-app').innerHTML = `
        <div class="wt-card">
            <h1 class="wt-title">Kaynak Puantaj</h1>
            <p class="wt-subtitle">${esc(day.employee.full_name)}</p>
            <div class="wt-dates">${dates}</div>
        </div>
        ${banner}
        ${kindBanner}
        <div class="${locked ? 'wt-locked' : ''}">
            <button type="button" class="wt-toggle ${state.blankDay ? 'on' : ''}" data-toggle-blank>
                <span class="wt-check">${state.blankDay ? '<i class="fas fa-check"></i>' : ''}</span>
                <span>Bugün çalışmadım <small class="text-muted">(izin / rapor / görevli değilim)</small></span>
            </button>
            ${state.blankDay ? '' : `
                ${state.rows.length ? '<div class="wt-section-title">Bugünkü işler</div>' : ''}
                ${jobsHtml}
                <div class="wt-section-title">${state.rows.length ? 'Başka iş ekle' : 'Hangi işte çalıştınız?'}</div>
                <div class="wt-add-list">${addHtml}</div>
                <div class="wt-search">
                    <input type="search" id="wt-search" placeholder="Listede yoksa iş emri no yazın (örn. 293-11)" value="${esc(state.searchQuery || '')}" ${locked ? 'disabled' : ''} inputmode="search" autocomplete="off">
                    <div class="wt-search-results">${results}</div>
                </div>
                <div class="wt-section-title">Not <small class="text-muted">(isteğe bağlı)</small></div>
                <div class="wt-note"><input type="text" id="wt-note" maxlength="200" value="${esc(state.note)}" ${locked ? 'disabled' : ''}></div>
            `}
            ${flags}
        </div>`;

    const bar = $('wt-bottom-bar');
    bar.hidden = false;
    $('wt-total').textContent = state.blankDay ? 'Çalışılmadı' : fmtHours(totalHours());
    const btn = $('wt-submit');
    if (locked) {
        btn.disabled = true;
        btn.className = 'wt-submit done';
        btn.innerHTML = '<i class="fas fa-check"></i> ONAYLANDI';
    } else {
        const canSend = state.blankDay || totalHours() > 0;
        btn.disabled = !canSend || state.saving;
        btn.className = 'wt-submit';
        btn.innerHTML = state.saving ? '<i class="fas fa-spinner fa-spin"></i> GÖNDERİLİYOR'
            : (sub && !state.dirty ? '<i class="fas fa-rotate"></i> TEKRAR GÖNDER' : '<i class="fas fa-paper-plane"></i> GÖNDER');
    }
}

function renderJob(row, cells) {
    // Each cell is a time range and is labelled as one ("08–09"), never as a
    // single hour, so "8" cannot be read as 7-8 or 8-9.
    const short = (t) => (t.endsWith(':00') ? t.slice(0, 2) : t);
    const grid = cells.map((cell, idx) => {
        const on = row.cells[idx];
        const owner = on ? null : cellOwner(idx, row.job_no);
        const classes = ['wt-cell', idx >= REGULAR_CELLS ? 'ot' : '', Number(cell.hours) < 1 ? 'half' : '', on ? 'on' : '', owner ? 'used' : ''].filter(Boolean).join(' ');
        const label = `${short(cell.start)}–${short(cell.end)}`;
        const sub = owner ? (owner === '1000' ? 'GENEL' : owner) : (Number(cell.hours) < 1 ? '½ saat' : (idx >= REGULAR_CELLS ? 'mesai' : ''));
        return `<button type="button" class="${classes}" data-job="${esc(row.job_no)}" data-cell="${idx}" aria-label="${cell.start}-${cell.end}">${label}<small>${esc(sub)}</small></button>`;
    }).join('');
    const isGeneral = row.job_no === '1000';
    return `
        <div class="wt-card wt-job" data-row="${esc(row.job_no)}">
            <div class="wt-job-head">
                <div>
                    <div class="wt-job-no">${esc(isGeneral ? 'GENEL' : row.job_no)}</div>
                </div>
                <div class="wt-job-title">${esc(isGeneral ? 'İş emri dışı genel işler' : row.title)}</div>
                <button type="button" class="wt-job-remove" data-remove="${esc(row.job_no)}" aria-label="Kaldır"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="wt-quick">
                <button type="button" data-quick="day" data-job="${esc(row.job_no)}">Gündüz 07:30–17:00</button>
                <button type="button" data-quick="evening" data-job="${esc(row.job_no)}">Akşam 17–21</button>
                <button type="button" class="clear" data-quick="clear" data-job="${esc(row.job_no)}"><i class="fas fa-eraser"></i></button>
            </div>
            <div class="wt-grid">${grid}</div>
            <div class="wt-job-total"><span>bu iş</span>${fmtHours(rowHours(row))}</div>
        </div>`;
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

function onClick(ev) {
    const dateBtn = ev.target.closest('[data-date]');
    if (dateBtn) {
        if (state.dirty && !window.confirm('Gönderilmemiş değişiklikler var. Yine de gün değiştirilsin mi?')) return;
        loadDay(dateBtn.dataset.date);
        return;
    }
    if (state.day.locked) return;

    if (ev.target.closest('[data-toggle-blank]')) {
        state.blankDay = !state.blankDay;
        state.dirty = true;
        render();
        return;
    }
    const add = ev.target.closest('[data-add]');
    if (add) {
        addJob(add.dataset.add, add.dataset.title || '');
        return;
    }
    const remove = ev.target.closest('[data-remove]');
    if (remove) {
        state.rows = state.rows.filter((r) => r.job_no !== remove.dataset.remove);
        state.dirty = true;
        render();
        return;
    }
    const quick = ev.target.closest('[data-quick]');
    if (quick) {
        const row = state.rows.find((r) => r.job_no === quick.dataset.job);
        if (!row) return;
        if (quick.dataset.quick === 'clear') {
            row.cells = row.cells.map(() => false);
        } else {
            const range = quick.dataset.quick === 'day' ? [0, REGULAR_CELLS] : [REGULAR_CELLS, state.day.cells.length];
            for (let i = range[0]; i < range[1]; i += 1) {
                if (!cellOwner(i, row.job_no)) row.cells[i] = true;
            }
        }
        state.dirty = true;
        render();
        return;
    }
    const cell = ev.target.closest('[data-cell]');
    if (cell) {
        const row = state.rows.find((r) => r.job_no === cell.dataset.job);
        if (!row) return;
        const idx = Number(cell.dataset.cell);
        if (row.cells[idx]) {
            row.cells[idx] = false;
        } else {
            const owner = cellOwner(idx, row.job_no);
            if (owner) {
                const other = state.rows.find((r) => r.job_no === owner);
                if (other) other.cells[idx] = false;       // the hour moves to this job
            }
            row.cells[idx] = true;
        }
        state.dirty = true;
        render();
    }
}

function addJob(jobNo, title) {
    if (state.rows.some((r) => r.job_no === jobNo)) return;
    state.rows.push({ job_no: jobNo, title, cells: state.day.cells.map(() => false) });
    state.searchResults = [];
    state.searchQuery = '';
    state.dirty = true;
    render();
    const card = document.querySelector(`.wt-job[data-row="${CSS.escape(jobNo)}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function onInput(ev) {
    if (ev.target.id === 'wt-note') {
        state.note = ev.target.value;
        state.dirty = true;
        return;
    }
    if (ev.target.id === 'wt-search') {
        state.searchQuery = ev.target.value;
        clearTimeout(state.searchTimer);
        const q = ev.target.value.trim();
        if (q.length < 2) {
            state.searchResults = [];
            renderSearchResults();
            return;
        }
        state.searchTimer = setTimeout(async () => {
            try {
                const data = await api(`/mobile/jobs/?q=${encodeURIComponent(q)}`);
                state.searchResults = data.results || [];
            } catch (error) {
                state.searchResults = [];
                toast(error.message, true);
            }
            renderSearchResults();
        }, 300);
    }
}

function renderSearchResults() {
    const box = document.querySelector('.wt-search-results');
    if (!box) return;
    const added = new Set(state.rows.map((r) => r.job_no));
    const results = state.searchResults.filter((j) => !added.has(j.job_no));
    if (!results.length && (state.searchQuery || '').trim().length >= 2) {
        box.innerHTML = '<div class="text-muted small px-1">Eşleşen iş emri yok.</div>';
        return;
    }
    box.innerHTML = results.map((j) => `
        <button type="button" class="wt-add" data-add="${esc(j.job_no)}" data-title="${esc(j.title || '')}">
            <span class="wt-add-no">${esc(j.job_no)}</span>
            <span class="wt-add-title">${esc(j.title || '')}</span>
            ${j.closed ? '<span class="wt-add-tag">kapalı</span>' : ''}
            <i class="fas fa-plus"></i>
        </button>`).join('');
}

async function submit() {
    if (state.saving || state.day.locked) return;
    const rows = state.blankDay ? [] : state.rows.filter((r) => r.cells.some(Boolean)).map((r) => ({ job_no: r.job_no, cells: r.cells }));
    if (!state.blankDay && !rows.length) {
        toast('Önce bir iş seçip saatleri işaretleyin', true);
        return;
    }
    state.saving = true;
    render();
    try {
        const data = await api('/mobile/submit/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: state.date, blank_day: state.blankDay, rows, note: state.note }),
        });
        state.day = data;
        hydrateFromSubmission();
        toast('Gönderildi ✓ Ofis onayından sonra kayıtlara geçer.');
    } catch (error) {
        toast(error.message, true);
    } finally {
        state.saving = false;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
