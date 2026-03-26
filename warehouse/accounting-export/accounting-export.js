import { initNavbar } from '../../components/navbar.js';
import { HeaderComponent } from '../../components/header/header.js';
import { TableComponent } from '../../components/table/table.js';
import { authedFetch } from '../../authService.js';
import { backendBase } from '../../base.js';
import { formatDecimalTurkish } from '../../generic/formatters.js';

const EXPORT_ENDPOINT = `${backendBase}/subcontracting/statements/accounting-export/`;

const TURKISH_MONTHS = [
    { label: 'Ocak', value: 1 },
    { label: 'Şubat', value: 2 },
    { label: 'Mart', value: 3 },
    { label: 'Nisan', value: 4 },
    { label: 'Mayıs', value: 5 },
    { label: 'Haziran', value: 6 },
    { label: 'Temmuz', value: 7 },
    { label: 'Ağustos', value: 8 },
    { label: 'Eylül', value: 9 },
    { label: 'Ekim', value: 10 },
    { label: 'Kasım', value: 11 },
    { label: 'Aralık', value: 12 }
];

let currentRows = [];
let resultsTable = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initializeHeader();
    initializeForm();
    initializeTable();
});

function initializeHeader() {
    new HeaderComponent({
        title: 'Hakediş ve Boya Düşüşleri',
        subtitle: 'Hakediş ve boya düşüşlerini görüntüleyin ve Excel olarak dışa aktarın',
        icon: 'file-excel',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showRefreshButton: 'none',
        backUrl: '../'
    });
}

function initializeForm() {
    const form = document.getElementById('accounting-export-form');
    const yearInput = document.getElementById('year-input');
    const monthSelect = document.getElementById('month-select');

    const now = new Date();
    yearInput.value = String(now.getFullYear());

    monthSelect.innerHTML = TURKISH_MONTHS
        .map(m => `<option value="${m.value}">${m.label}</option>`)
        .join('');
    monthSelect.value = String(now.getMonth() + 1);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await loadAccountingExport();
    });

}

// Expose globally so the inline onclick always works.
window.doExcelExport = function () {
    exportExcel(currentRows);
};

function initializeTable() {
    resultsTable = new TableComponent('results-container', {
        title: 'Sonuçlar',
        icon: 'fas fa-table',
        iconColor: 'text-success',
        columns: [
            { field: 'stock_code', label: 'Stok Kodu' },
            { field: 'sabit', label: 'Sabit' },
            { field: 'amount', label: 'Miktar', type: 'number', formatter: (v) => formatDecimalTurkish(Number(v), 2) },
            { field: 'bosluk', label: 'Boşluk-1', formatter: () => '' },
            { field: 'job_no', label: 'İş Kodu' },
            { field: 'depo', label: 'Depo' }
        ],
        data: [],
        sortable: true,
        pagination: false,
        emptyMessage: 'Yıl ve ay seçip "Getir" ile verileri yükleyin.'
    });
}

async function loadAccountingExport() {
    const year = document.getElementById('year-input').value;
    const month = document.getElementById('month-select').value;
    const fetchBtn = document.getElementById('fetch-btn');

    setStatus('');
    currentRows = [];
    resultsTable.setLoading(true);
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Yükleniyor...';

    try {
        const url = `${EXPORT_ENDPOINT}?year=${year}&month=${month}&distribute=true`;
        const resp = await authedFetch(url);

        if (!resp.ok) {
            let msg = `${resp.status} ${resp.statusText}`;
            try {
                const err = await resp.json();
                msg = err?.detail || err?.error || msg;
            } catch (_) { /* ignore */ }
            throw new Error(msg);
        }

        const data = await resp.json();
        const raw = Array.isArray(data) ? data : (data?.rows || data?.results || data?.data || data?.items || []);

        currentRows = raw.map(r => ({
            stock_code: r.stock_code ?? '',
            sabit: 'C',
            amount: r.amount ?? 0,
            bosluk: '',
            job_no: r.job_no ?? '',
            depo: 5
        }));

        resultsTable.updateData(currentRows, currentRows.length);
        setStatus(`${currentRows.length} kayıt yüklendi.`, 'muted');
    } catch (e) {
        console.error(e);
        resultsTable.updateData([], 0);
        setStatus(e?.message || 'Beklenmeyen bir hata oluştu', 'error');
    } finally {
        resultsTable.setLoading(false);
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = '<i class="fas fa-search me-1"></i>Getir';
    }
}

function exportExcel(rows) {
    if (!rows || rows.length === 0) {
        alert('Önce verileri yükleyin.');
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert('Excel kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
        return;
    }

    const headers = ['Stok Kodu', 'Sabit', 'Miktar', 'Boşluk-1', 'İş Kodu', 'Depo'];

    const aoa = [
        headers,
        ...rows.map(r => [
            String(r.stock_code ?? ''),
            'C',
            Math.round(Number(r.amount ?? 0) * 100) / 100,
            '',
            String(r.job_no ?? ''),
            5
        ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
        { wch: 24 },
        { wch: 8 },
        { wch: 14 },
        { wch: 10 },
        { wch: 16 },
        { wch: 8 }
    ];

    const font = { name: 'Segoe UI', sz: 8 };
    const numFmt = '0.00';
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[addr]) continue;
            if (!ws[addr].s) ws[addr].s = {};
            ws[addr].s.font = font;
            if (C === 2 && R > 0) {
                ws[addr].z = numFmt;
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });

    const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const year = document.getElementById('year-input').value;
    const month = document.getElementById('month-select').value;
    const fileName = `hakedis-boya-dususleri_${year}-${String(month).padStart(2, '0')}.xlsx`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 200);
}

function setStatus(text, kind = 'muted') {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = text || '';
    el.className = kind === 'error' ? 'small accounting-export-error' : 'small accounting-export-muted';
}
