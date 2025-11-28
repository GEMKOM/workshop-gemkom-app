import { initNavbar } from '../../components/navbar.js';
import { guardRoute } from '../../authService.js';
import { createDepartmentRequest, submitDepartmentRequest } from '../../generic/purchaseRequest.js';
import { ModernDropdown } from '../../components/dropdown/dropdown.js';
import { HeaderComponent } from '../../components/header/header.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const UNIT_CHOICES = [
    { value: 'adet', label: 'Adet' },
    { value: 'kg', label: 'KG' },
    { value: 'metre', label: 'Metre' },
    { value: 'litre', label: 'Litre' },
    { value: 'paket', label: 'Paket' },
    { value: 'kutu', label: 'Kutu' }
];

export const REQUEST_TYPE_CHOICES = [
    { 
        value: '730.06.004', 
        label: 'Fabrika Bakım Onarım',
        description: 'Atölye bakımı için gerekli giderler, ekipmanlar, malzemeler, parçalar'
    },
    { 
        value: '730.06.005', 
        label: 'Makine Bakım Onarım',
        description: 'Belirli bir makinenin/ekipmanın bakımı için gerekli giderler, ekipmanlar, parçalar'
    },
    { 
        value: '730.10.004', 
        label: 'Makine Kiralama',
        description: 'Kiralanması gereken makineler (vinç, kaynak ekipmanı vb.)'
    }
];

export const ITEM_CODE_NAMES = {
    '730.06.004': 'FABRİKA BAKIM ONARIM GİDERLERİ',
    '730.06.005': 'FABRİKA MAKİNE BAKIM ONARIM GİDERİ',
    '730.10.004': 'MAKİNA KİRALAMA GİDERİ'
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    items: [],
    isLoading: false
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!guardRoute()) {
        return;
    }

    initNavbar();
    setupHeader();
    loadCreateRequestContent();
});

// ============================================================================
// HEADER SETUP
// ============================================================================

function setupHeader() {
    const headerConfig = {
        title: 'Yeni Departman Talebi',
        subtitle: 'Yeni bir departman talebi oluşturun. Detaylı bilgi vererek daha hızlı işlem sağlayabilirsiniz.',
        icon: 'plus-circle',
        containerId: 'header-placeholder',
        showBackButton: 'block',
        showCreateButton: 'none',
        showBulkCreateButton: 'none',
        showExportButton: 'none',
        showRefreshButton: 'none',
        backUrl: '../'
    };

    new HeaderComponent(headerConfig);
}

// ============================================================================
// CONTENT LOADING
// ============================================================================

async function loadCreateRequestContent() {
    const contentContainer = document.getElementById('create-request-content');

    // Add loading state
    contentContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="text-muted">Yükleniyor...</p>
        </div>
    `;

    try {
        // Load the create request form
        contentContainer.innerHTML = createDepartmentRequestForm();

        // Setup form
        setupDepartmentRequestForm();
    } catch (error) {
        console.error('Error loading create request content:', error);
        contentContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-4">
                    <i class="fas fa-exclamation-triangle text-danger" style="font-size: 4rem;"></i>
                </div>
                <h4 class="text-danger mb-2">Hata Oluştu</h4>
                <p class="text-muted">İçerik yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</p>
                <button class="btn btn-primary mt-3" onclick="location.reload()">
                    <i class="fas fa-redo me-2"></i>Yenile
                </button>
            </div>
        `;
    }
}

// ============================================================================
// FORM CREATION
// ============================================================================

function createDepartmentRequestForm() {
    return `
        <div class="create-request-section">
            <div class="row g-4">
                <div class="col-lg-8">
                    <div class="department-card">
                        <div class="department-card-header">
                            <div class="department-card-title">
                                <i class="fas fa-edit"></i>
                                Talep Bilgileri
                            </div>
                            <div class="department-card-subtitle">
                                <i class="fas fa-info-circle"></i>
                                Tüm alanları eksiksiz doldurun
                            </div>
                        </div>
                        <div class="department-card-body">
                            <form id="department-request-form">
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label for="title" class="form-label">
                                            <i class="fas fa-heading"></i>
                                            Talep Başlığı
                                        </label>
                                        <input type="text" class="form-control" id="title"
                                               placeholder="Talep başlığını girin" required>
                                    </div>

                                    <div class="col-md-6">
                                        <label for="needed-date" class="form-label">
                                            <i class="fas fa-calendar"></i>
                                            İhtiyaç Tarihi
                                        </label>
                                        <input type="date" class="form-control" id="needed-date" required>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">
                                            <i class="fas fa-exclamation-circle"></i>
                                            Öncelik
                                        </label>
                                        <div id="priority-dropdown"></div>
                                    </div>

                                    <div class="col-12">
                                        <label class="form-label">
                                            <i class="fas fa-clipboard-list"></i>
                                            Talep Tipi <span class="text-danger">*</span>
                                        </label>
                                        <div id="request-type-dropdown"></div>
                                        <small class="text-muted" id="request-type-helper"></small>
                                    </div>

                                    <div class="col-12">
                                        <label for="description" class="form-label">
                                            <i class="fas fa-align-left"></i>
                                            Detaylı Açıklama
                                        </label>
                                        <textarea class="form-control" id="description" rows="4"
                                                  placeholder="Talep detaylarını açıklayın..." required></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Items Section -->
                    <div class="department-card">
                        <div class="department-card-header">
                            <div class="department-card-title">
                                <i class="fas fa-boxes"></i>
                                Ürünler
                            </div>
                            <div class="department-card-subtitle">
                                <i class="fas fa-info-circle"></i>
                                Talep edilen ürünleri ekleyin
                            </div>
                        </div>
                        <div class="department-card-body">
                            <div id="items-container" class="items-container">
                                <!-- Items will be dynamically added here -->
                            </div>
                            <button type="button" class="add-item-btn" id="add-item-btn">
                                <i class="fas fa-plus"></i>
                                Ürün Ekle
                            </button>
                        </div>
                    </div>

                    <!-- Submit Section -->
                    <div class="department-card">
                        <div class="department-card-footer">
                            <button type="button" class="btn btn-secondary" onclick="window.location.href='../'">
                                <i class="fas fa-times me-2"></i>
                                İptal
                            </button>
                            <button type="submit" class="btn btn-primary" id="submit-btn">
                                <i class="fas fa-paper-plane me-2"></i>
                                Talep Oluştur
                            </button>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <div class="department-card">
                        <div class="department-card-header">
                            <div class="department-card-title">
                                <i class="fas fa-info-circle"></i>
                                Bilgilendirme
                            </div>
                        </div>
                        <div class="department-card-body">
                            <div class="info-card-item">
                                <div class="info-icon-wrapper">
                                    <i class="fas fa-clipboard-list"></i>
                                </div>
                                <div class="info-text">
                                    <h6>Talep Süreci</h6>
                                    <p>Talebiniz oluşturulduktan sonra departman yöneticinizin onayına sunulacaktır.</p>
                                </div>
                            </div>

                            <div class="info-card-item">
                                <div class="info-icon-wrapper">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="info-text">
                                    <h6>İhtiyaç Tarihi</h6>
                                    <p>Ürünlere ihtiyaç duyduğunuz tarihi belirterek, planlama sürecini hızlandırabilirsiniz.</p>
                                </div>
                            </div>

                            <div class="info-card-item">
                                <div class="info-icon-wrapper">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="info-text">
                                    <h6>Öncelik Seviyeleri</h6>
                                    <p><strong>Normal:</strong> Standart talepler<br>
                                       <strong>Acil:</strong> Öncelikli işlem<br>
                                       <strong>Kritik:</strong> Acil müdahale</p>
                                </div>
                            </div>

                            <div class="info-card-item">
                                <div class="info-icon-wrapper">
                                    <i class="fas fa-clipboard-list"></i>
                                </div>
                                <div class="info-text">
                                    <h6>Talep Tipleri</h6>
                                    <p><strong>Fabrika Bakım Onarım:</strong> Atölye bakımı için malzemeler<br>
                                       <strong>Makine Bakım Onarım:</strong> Belirli makine bakımı<br>
                                       <strong>Makine Kiralama:</strong> Kiralanacak ekipmanlar</p>
                                </div>
                            </div>

                            <div class="alert alert-info">
                                <i class="fas fa-lightbulb me-2"></i>
                                <strong>İpucu:</strong> Detaylı ürün açıklamaları yazarak, tedarik sürecini hızlandırabilirsiniz.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// FORM SETUP
// ============================================================================

function setupDepartmentRequestForm() {
    const form = document.getElementById('department-request-form');
    const submitBtn = document.getElementById('submit-btn');
    const addItemBtn = document.getElementById('add-item-btn');

    // Setup priority dropdown
    const priorityContainer = document.getElementById('priority-dropdown');
    const priorityDropdown = new ModernDropdown(priorityContainer, {
        placeholder: 'Öncelik seçin...'
    });

    const priorityItems = [
        { value: 'normal', text: 'Normal' },
        { value: 'urgent', text: 'Acil' },
        { value: 'critical', text: 'Kritik' }
    ];

    priorityDropdown.setItems(priorityItems);
    priorityDropdown.setValue('normal'); // Set default
    priorityContainer.dropdownInstance = priorityDropdown;

    // Setup request type dropdown
    const requestTypeContainer = document.getElementById('request-type-dropdown');
    const requestTypeDropdown = new ModernDropdown(requestTypeContainer, {
        placeholder: 'Talep tipini seçin...',
        searchable: true
    });

    const requestTypeItems = REQUEST_TYPE_CHOICES.map(type => ({
        value: type.value,
        text: type.label
    }));

    requestTypeDropdown.setItems(requestTypeItems);
    requestTypeContainer.dropdownInstance = requestTypeDropdown;

    // Update helper text when request type is selected
    const requestTypeHelper = document.getElementById('request-type-helper');
    requestTypeContainer.addEventListener('dropdown:select', (e) => {
        const selectedType = REQUEST_TYPE_CHOICES.find(type => type.value === e.detail.value);
        if (selectedType) {
            requestTypeHelper.innerHTML = `<i class="fas fa-info-circle me-1"></i>${selectedType.description}`;
            requestTypeHelper.style.display = 'block';
            requestTypeHelper.style.marginTop = '0.5rem';
        }
    });

    // Set default needed date to today
    const neededDateInput = document.getElementById('needed-date');
    const today = new Date().toISOString().split('T')[0];
    neededDateInput.value = today;

    // Add first item by default
    addItem();

    // Add item button
    addItemBtn.addEventListener('click', () => {
        addItem();
    });

    // Form submission
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleFormSubmit();
    });
}

// ============================================================================
// ITEMS MANAGEMENT
// ============================================================================

function addItem() {
    const itemId = Date.now();
    const itemNumber = state.items.length + 1;

    state.items.push({
        id: itemId,
        name: '',
        description: '',
        quantity: 1,
        unit: ''
    });

    const itemsContainer = document.getElementById('items-container');
    const itemCard = document.createElement('div');
    itemCard.className = 'item-card';
    itemCard.dataset.itemId = itemId;

    itemCard.innerHTML = `
        <div class="item-header">
            <div class="item-number">
                <i class="fas fa-box"></i>
                Ürün ${itemNumber}
            </div>
            ${state.items.length > 1 ? `
                <button type="button" class="remove-item-btn" data-item-id="${itemId}">
                    <i class="fas fa-trash"></i>
                    Sil
                </button>
            ` : ''}
        </div>
        <div class="row g-3">
            <div class="col-12">
                <label class="form-label">
                    <i class="fas fa-tag"></i>
                    Ürün Adı
                </label>
                <input type="text" class="form-control item-name" data-item-id="${itemId}"
                       placeholder="Ürün adını girin" required>
            </div>
            <div class="col-md-6">
                <label class="form-label">
                    <i class="fas fa-sort-numeric-up"></i>
                    Miktar
                </label>
                <input type="number" class="form-control item-quantity" data-item-id="${itemId}"
                       min="1" value="1" required>
            </div>
            <div class="col-md-6">
                <label class="form-label">
                    <i class="fas fa-ruler"></i>
                    Birim
                </label>
                <div id="unit-dropdown-${itemId}" data-item-id="${itemId}"></div>
            </div>
            <div class="col-12">
                <label class="form-label">
                    <i class="fas fa-comment"></i>
                    Açıklama
                </label>
                <textarea class="form-control item-description" data-item-id="${itemId}" rows="2"
                          placeholder="Ürün detaylarını girin, link varsa ekleyin..."></textarea>
            </div>
        </div>
    `;

    itemsContainer.appendChild(itemCard);

    // Initialize unit dropdown
    const unitDropdownContainer = document.getElementById(`unit-dropdown-${itemId}`);
    const unitDropdown = new ModernDropdown(unitDropdownContainer, {
        placeholder: 'Birim seçin...',
        searchable: true,
        maxHeight: 200
    });

    const unitItems = UNIT_CHOICES.map(unit => ({
        value: unit.value,
        text: unit.label
    }));

    unitDropdown.setItems(unitItems);
    unitDropdown.setValue('adet'); // Set default value
    unitDropdownContainer.dropdownInstance = unitDropdown;

    // Add dropdown change listener
    unitDropdownContainer.addEventListener('dropdown:select', () => {
        updateItemInState(itemId);
    });

    // Add remove button listener
    const removeBtn = itemCard.querySelector('.remove-item-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            removeItem(itemId);
        });
    }

    // Add input listeners to update state
    itemCard.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', () => {
            updateItemInState(itemId);
        });
    });
}

function removeItem(itemId) {
    state.items = state.items.filter(item => item.id !== itemId);

    const itemCard = document.querySelector(`.item-card[data-item-id="${itemId}"]`);
    if (itemCard) {
        itemCard.remove();
    }

    // Update item numbers
    const itemCards = document.querySelectorAll('.item-card');
    itemCards.forEach((card, index) => {
        const itemNumber = card.querySelector('.item-number');
        if (itemNumber) {
            itemNumber.innerHTML = `<i class="fas fa-box"></i> Ürün ${index + 1}`;
        }
    });
}

function updateItemInState(itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    const nameInput = document.querySelector(`.item-name[data-item-id="${itemId}"]`);
    const quantityInput = document.querySelector(`.item-quantity[data-item-id="${itemId}"]`);
    const unitDropdownContainer = document.getElementById(`unit-dropdown-${itemId}`);
    const descriptionInput = document.querySelector(`.item-description[data-item-id="${itemId}"]`);

    item.name = nameInput ? nameInput.value : '';
    item.quantity = quantityInput ? parseInt(quantityInput.value) : 1;
    item.unit = unitDropdownContainer?.dropdownInstance ? unitDropdownContainer.dropdownInstance.getValue() : '';
    item.description = descriptionInput ? descriptionInput.value : '';
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

async function handleFormSubmit() {
    const form = document.getElementById('department-request-form');
    const submitBtn = document.getElementById('submit-btn');

    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Update all items in state
    state.items.forEach(item => {
        updateItemInState(item.id);
    });

    // Validate items
    const invalidItems = state.items.filter(item => !item.name || !item.unit);
    if (invalidItems.length > 0) {
        alert('Lütfen tüm ürün bilgilerini eksiksiz doldurun.');
        return;
    }

    if (state.items.length === 0) {
        alert('Lütfen en az bir ürün ekleyin.');
        return;
    }

    // Get form values
    const title = document.getElementById('title').value;
    const neededDate = document.getElementById('needed-date').value;
    const description = document.getElementById('description').value;
    const priorityDropdown = document.getElementById('priority-dropdown').dropdownInstance;
    const priority = priorityDropdown ? priorityDropdown.getValue() : 'normal';
    
    // Get request type
    const requestTypeDropdown = document.getElementById('request-type-dropdown').dropdownInstance;
    const itemCode = requestTypeDropdown ? requestTypeDropdown.getValue() : null;
    
    // Validate request type
    if (!itemCode) {
        alert('Lütfen talep tipini seçin.');
        return;
    }

    // Prepare request data
    const requestData = {
        title: title,
        needed_date: neededDate,
        description: description,
        priority: priority,
        items: state.items.map(item => ({
            name: ITEM_CODE_NAMES[itemCode],
            item_code: itemCode,
            item_description: item.name,
            quantity: item.quantity,
            unit: item.unit,
            item_specifications: item.description
        }))
    };

    try {
        state.isLoading = true;

        // Disable submit button
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Oluşturuluyor...';
        // Create request
        const createdRequest = await createDepartmentRequest(requestData);

        alert('Departman talebi başarıyla oluşturuldu.');

        // Redirect to list page
        window.location.href = '../';

    } catch (error) {
        console.error('Error creating department request:', error);
        alert('Talep oluşturulurken hata oluştu: ' + error.message);

        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Talep Oluştur';
    } finally {
        state.isLoading = false;
    }
}
