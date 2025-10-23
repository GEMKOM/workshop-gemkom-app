// components/dropdown/dropdown.js

// Global z-index management for dropdowns
let globalDropdownZIndex = 1000000;
let allDropdowns = []; // Track all dropdown instances

export class ModernDropdown {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            placeholder: 'Seçiniz...',
            searchable: false,
            multiple: false,
            maxHeight: 300,
            width: '100%',
            ...options
        };
        
        this.isOpen = false;
        this.selectedValue = null;
        this.selectedValues = [];
        this.items = [];
        this.currentZIndex = 1; // Start with low z-index
        
        this.init();
        
        // Register this dropdown instance
        allDropdowns.push(this);
    }
    
    init() {
        this.createDropdown();
        this.bindEvents();
    }
    
    createDropdown() {
        if (!this.container) {
            console.error('Dropdown container is null. Cannot create dropdown.');
            return;
        }
        
        this.container.innerHTML = '';
        this.container.className = 'modern-dropdown-container';
        
        // Main dropdown structure
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'modern-dropdown';
        this.dropdown.style.width = this.options.width;
        
        // Selected display
        this.selectedDisplay = document.createElement('div');
        this.selectedDisplay.className = 'dropdown-selected';
        this.selectedDisplay.innerHTML = `
            <span class="selected-text">${this.options.placeholder}</span>
            <i class="fas fa-chevron-down dropdown-arrow"></i>
        `;
        
        // Dropdown menu
        this.menu = document.createElement('div');
        this.menu.className = 'dropdown-menu';
        this.menu.style.display = 'none';
        
        // Search input (if searchable)
        if (this.options.searchable) {
            this.searchInput = document.createElement('input');
            this.searchInput.className = 'dropdown-search';
            this.searchInput.placeholder = 'Ara...';
            this.searchInput.type = 'text';
            this.menu.appendChild(this.searchInput);
        }
        
        // Items container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'dropdown-items';
        this.itemsContainer.style.maxHeight = `${this.options.maxHeight}px`;
        this.menu.appendChild(this.itemsContainer);
        
        this.dropdown.appendChild(this.selectedDisplay);
        this.dropdown.appendChild(this.menu);
        this.container.appendChild(this.dropdown);
        
        // Initialize with low z-index
        this.container.style.zIndex = '1';
        this.dropdown.style.zIndex = '1';
        this.menu.style.zIndex = '1';
    }
    
    bindEvents() {
        if (!this.container || !this.dropdown || !this.selectedDisplay) {
            console.error('Dropdown elements not properly initialized. Cannot bind events.');
            return;
        }
        
        // Toggle dropdown
        this.selectedDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.close();
            }
        });
        
        // Search functionality
        if (this.options.searchable && this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterItems(e.target.value);
            });
            
            this.searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Keyboard navigation
        this.dropdown.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    }
    
    handleKeyboard(e) {
        const items = this.menu.querySelectorAll('.dropdown-item');
        const currentIndex = Array.from(items).findIndex(item => item.classList.contains('focused'));
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.focusItem(currentIndex + 1, items);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.focusItem(currentIndex - 1, items);
                break;
            case 'Enter':
                e.preventDefault();
                if (currentIndex >= 0) {
                    items[currentIndex].click();
                }
                break;
            case 'Escape':
                this.close();
                break;
        }
    }
    
    focusItem(index, items) {
        items.forEach(item => item.classList.remove('focused'));
        if (index >= 0 && index < items.length) {
            items[index].classList.add('focused');
            items[index].scrollIntoView({ block: 'nearest' });
        }
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        // Close all other dropdowns first
        this.closeAllOtherDropdowns();
        
        // Get the next highest z-index for this dropdown
        globalDropdownZIndex += 1;
        this.currentZIndex = globalDropdownZIndex;
        
        this.isOpen = true;
        this.dropdown.classList.add('open');
        this.selectedDisplay.querySelector('.dropdown-arrow').className = 'fas fa-chevron-up dropdown-arrow';
        
        // Ensure dropdown menu is visible
        this.menu.style.display = 'block';
        this.menu.style.opacity = '1';
        this.menu.style.visibility = 'visible';
        this.menu.style.transform = 'translateY(0)';
        this.menu.style.maxHeight = '400px';
        
        // Apply dynamic z-index to ensure this dropdown appears above all others
        this.menu.style.zIndex = this.currentZIndex;
        this.menu.style.position = 'absolute';
        this.menu.style.top = '100%';
        this.menu.style.left = '0';
        this.menu.style.right = '0';
        this.menu.style.overflow = 'visible';
        this.menu.style.pointerEvents = 'auto';
        
        // Ensure the dropdown container has proper stacking context with dynamic z-index
        this.container.style.zIndex = this.currentZIndex - 1;
        this.container.style.position = 'relative';
        this.dropdown.style.zIndex = this.currentZIndex;
        this.dropdown.style.position = 'relative';
        
        // Focus search input if available
        if (this.options.searchable && this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 100);
        }
        
        // Trigger custom event
        this.container.dispatchEvent(new CustomEvent('dropdown:open'));
    }
    
    closeAllOtherDropdowns() {
        // Close all other dropdown instances
        allDropdowns.forEach(dropdown => {
            if (dropdown !== this && dropdown.isOpen) {
                dropdown.close();
            }
        });
    }
    
    close() {
        this.isOpen = false;
        this.dropdown.classList.remove('open');
        this.selectedDisplay.querySelector('.dropdown-arrow').className = 'fas fa-chevron-down dropdown-arrow';
        
        // Hide dropdown menu
        this.menu.style.display = 'none';
        this.menu.style.opacity = '0';
        this.menu.style.visibility = 'hidden';
        this.menu.style.transform = 'translateY(-10px)';
        this.menu.style.maxHeight = '0';
        
        // Reset z-index to very low values when closed to ensure open dropdowns appear above
        this.container.style.zIndex = '1';
        this.dropdown.style.zIndex = '1';
        this.menu.style.zIndex = '1';
        
        // Clear search if available
        if (this.options.searchable && this.searchInput) {
            this.searchInput.value = '';
            // Only filter if items container exists and has items
            if (this.itemsContainer && this.itemsContainer.querySelectorAll('.dropdown-item').length > 0) {
                this.filterItems('');
            }
        }
        
        // Trigger custom event
        this.container.dispatchEvent(new CustomEvent('dropdown:close'));
    }
    
    setItems(items) {
        this.items = items;
        this.renderItems();
        if (this.options.multiple) {
            this.updateCheckboxes();
        }
    }
    
    renderItems() {
        this.itemsContainer.innerHTML = '';
        
        if (this.items.length === 0) {
            const noItems = document.createElement('div');
            noItems.className = 'dropdown-item no-items';
            noItems.textContent = 'Seçenek bulunamadı';
            this.itemsContainer.appendChild(noItems);
            return;
        }
        
        this.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'dropdown-item';
            itemElement.dataset.value = item.value;
            itemElement.dataset.index = index;
            
            // Handle disabled items
            if (item.disabled) {
                itemElement.classList.add('disabled');
                itemElement.style.opacity = '0.6';
                itemElement.style.cursor = 'not-allowed';
            }
            
            if (this.options.multiple) {
                itemElement.innerHTML = `
                    <label class="checkbox-container">
                        <input type="checkbox" ${this.selectedValues.includes(item.value) ? 'checked' : ''} ${item.disabled ? 'disabled' : ''}>
                        <span class="checkmark"></span>
                        <span class="item-text">${item.text}</span>
                    </label>
                `;
                
                // Handle checkbox change event for multi-select
                const checkbox = itemElement.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (!item.disabled) {
                        this.selectItem(item, itemElement);
                    }
                });
                
                // Handle clicks on the entire item area (outside the label)
                itemElement.addEventListener('click', (e) => {
                    // Only handle clicks outside the label/checkbox area
                    if (!e.target.closest('.checkbox-container')) {
                        e.stopPropagation();
                        if (!item.disabled) {
                            const checkbox = itemElement.querySelector('input[type="checkbox"]');
                            checkbox.checked = !checkbox.checked;
                            this.selectItem(item, itemElement);
                        }
                    }
                });
            } else {
                itemElement.innerHTML = `
                    <span class="item-text">${item.text}</span>
                    ${this.selectedValue === item.value ? '<i class="fas fa-check selected-icon"></i>' : ''}
                `;
                
                itemElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!item.disabled) {
                        this.selectItem(item, itemElement);
                    }
                });
            }
            
            this.itemsContainer.appendChild(itemElement);
        });
    }
    
    selectItem(item, element) {
        if (this.options.multiple) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            
            // Use the checkbox state as the source of truth
            if (checkbox.checked) {
                // Add to selection if not already selected
                if (!this.selectedValues.includes(item.value)) {
                    this.selectedValues.push(item.value);
                }
            } else {
                // Remove from selection
                this.selectedValues = this.selectedValues.filter(v => v !== item.value);
            }
            
            this.updateMultipleDisplay();
        } else {
            this.selectedValue = item.value;
            this.updateDisplay(item.text);
            this.close();
        }
        
        // Trigger selection event
        this.container.dispatchEvent(new CustomEvent('dropdown:select', {
            detail: {
                value: this.options.multiple ? this.selectedValues : this.selectedValue,
                item: item
            }
        }));
    }
    
    updateDisplay(text) {
        const selectedText = this.selectedDisplay.querySelector('.selected-text');
        if (selectedText) {
            selectedText.textContent = text || this.options.placeholder;
        }
        
        // Update selected state in items
        this.itemsContainer.querySelectorAll('.dropdown-item').forEach(item => {
            const selectedIcon = item.querySelector('.selected-icon');
            if (selectedIcon) {
                selectedIcon.remove();
            }
            
            if (item.dataset.value === this.selectedValue) {
                const icon = document.createElement('i');
                icon.className = 'fas fa-check selected-icon';
                item.appendChild(icon);
            }
        });
    }
    
    updateMultipleDisplay() {
        const selectedTextElement = this.selectedDisplay.querySelector('.selected-text');
        if (!selectedTextElement) return;
        
        if (this.selectedValues.length === 0) {
            selectedTextElement.textContent = this.options.placeholder;
        } else if (this.selectedValues.length === 1) {
            const item = this.items.find(i => i.value === this.selectedValues[0]);
            selectedTextElement.textContent = item ? item.text : this.options.placeholder;
        } else {
            selectedTextElement.textContent = `${this.selectedValues.length} seçenek`;
        }
    }
    
    updateCheckboxes() {
        if (!this.options.multiple) return;
        
        const checkboxes = this.itemsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            // Find the parent dropdown item to get the value
            const dropdownItem = checkbox.closest('.dropdown-item');
            if (dropdownItem) {
                const itemValue = dropdownItem.dataset.value;
                checkbox.checked = this.selectedValues.includes(itemValue);
            }
        });
    }
    
    filterItems(searchTerm) {
        if (!this.itemsContainer) return;
        
        const items = this.itemsContainer.querySelectorAll('.dropdown-item');
        const term = searchTerm.toLowerCase();
        
        items.forEach(item => {
            const textElement = item.querySelector('.item-text');
            if (textElement && textElement.textContent) {
                const text = textElement.textContent.toLowerCase();
                if (text.includes(term)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            } else {
                // If no text element found, hide the item
                item.style.display = 'none';
            }
        });
    }
    
    getValue() {
        return this.options.multiple ? this.selectedValues : this.selectedValue;
    }
    
    setValue(value) {
        if (this.options.multiple) {
            this.selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
            this.updateMultipleDisplay();
            this.updateCheckboxes();
        } else {
            this.selectedValue = value;
            const item = this.items.find(i => i.value === value);
            this.updateDisplay(item ? item.text : '');
        }
    }
    
    destroy() {
        this.container.innerHTML = '';
        this.container.className = '';
    }
}
