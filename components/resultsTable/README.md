# Results Table Component

A flexible and reusable results table component that can display data with filtering capabilities and customizable item rendering.

## Features

- **Flexible Filtering**: Configurable filters with different input types
- **Custom Item Rendering**: Support for custom item renderers or default GenericCard
- **Loading States**: Built-in loading, empty, and error states
- **Clickable Items**: Optional click handlers for items
- **Responsive Design**: Works on all screen sizes
- **Accessible**: Proper ARIA labels and keyboard navigation

## Usage

### Basic Usage

```javascript
import { ResultsTable } from './components/resultsTable/resultsTable.js';

const container = document.getElementById('results-container');
const resultsTable = new ResultsTable(container, {
    title: 'Sonuçlar',
    items: data,
    onItemClick: (item, index) => {
        console.log('Item clicked:', item);
    }
});
```

### With Filters

```javascript
const resultsTable = new ResultsTable(container, {
    title: 'Görevler',
    showFilters: true,
    filters: [
        {
            id: 'start-date',
            label: 'Başlangıç Tarihi',
            type: 'date',
            required: true
        },
        {
            id: 'end-date',
            label: 'Bitiş Tarihi',
            type: 'date'
        },
        {
            id: 'status',
            label: 'Durum',
            type: 'select',
            options: [
                { value: 'active', text: 'Aktif' },
                { value: 'completed', text: 'Tamamlandı' }
            ]
        }
    ],
    onFilterApply: (filterValues) => {
        console.log('Filters applied:', filterValues);
        // Apply filters and reload data
    },
    onFilterClear: () => {
        console.log('Filters cleared');
        // Clear filters and reload data
    }
});
```

### With Custom Item Renderer

```javascript
const resultsTable = new ResultsTable(container, {
    title: 'Özel Görevler',
    items: tasks,
    itemRenderer: (item, index) => {
        const div = document.createElement('div');
        div.className = 'custom-task-item';
        div.innerHTML = `
            <h5>${item.title}</h5>
            <p>${item.description}</p>
            <span class="badge">${item.status}</span>
        `;
        return div;
    }
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | 'Sonuçlar' | Title of the results section |
| `icon` | string | 'fas fa-list' | Icon for the results section |
| `showFilters` | boolean | true | Whether to show filters section |
| `filterToggleText` | string | 'Filtreleri Göster' | Text for filter toggle button |
| `filters` | array | [] | Array of filter configurations |
| `items` | array | [] | Array of items to display |
| `itemRenderer` | function | null | Custom function to render items |
| `onItemClick` | function | null | Callback when an item is clicked |
| `onFilterApply` | function | null | Callback when filters are applied |
| `onFilterClear` | function | null | Callback when filters are cleared |
| `emptyStateText` | string | 'Sonuç bulunamadı' | Text for empty state |
| `emptyStateDescription` | string | 'Seçilen kriterlere uygun kayıt bulunamadı.' | Description for empty state |
| `loadingText` | string | 'Veriler yükleniyor...' | Text for loading state |
| `className` | string | '' | Additional CSS classes |

## Filter Configuration

Each filter in the `filters` array can have the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the filter |
| `label` | string | Yes | Label text for the filter |
| `type` | string | Yes | Input type: 'date', 'text', 'select' |
| `placeholder` | string | No | Placeholder text |
| `required` | boolean | No | Whether the filter is required |
| `options` | array | No | Options for select type filters |

## Methods

### `setItems(items)`
Update the items displayed in the table.

```javascript
resultsTable.setItems(newItems);
```

### `showLoadingState()`
Show loading spinner.

```javascript
resultsTable.showLoadingState();
```

### `showEmptyState()`
Show empty state when no items.

```javascript
resultsTable.showEmptyState();
```

### `showErrorState(error)`
Show error state with error message.

```javascript
resultsTable.showErrorState(new Error('API Error'));
```

### `updateResultsInfo(count)`
Update the results count display.

```javascript
resultsTable.updateResultsInfo(25);
```

### `getFilterValues()`
Get current filter values.

```javascript
const filters = resultsTable.getFilterValues();
console.log(filters); // { 'start-date': '2024-01-01', 'status': 'active' }
```

### `clearFilters()`
Clear all filter values.

```javascript
resultsTable.clearFilters();
```

### `destroy()`
Remove the component from DOM.

```javascript
resultsTable.destroy();
```

## Examples

### Finished Timers

```javascript
const finishedTimersTable = new ResultsTable(container, {
    title: 'Tamamlanan Zamanlayıcılar',
    icon: 'fas fa-check-circle',
    showFilters: true,
    filters: [
        {
            id: 'start-date',
            label: 'Başlangıç Tarihi',
            type: 'date'
        },
        {
            id: 'end-date',
            label: 'Bitiş Tarihi',
            type: 'date'
        }
    ],
    onFilterApply: (filters) => {
        loadFinishedTimers(filters);
    }
});
```

### Active Tasks

```javascript
const activeTasksTable = new ResultsTable(container, {
    title: 'Aktif Görevler',
    icon: 'fas fa-play-circle',
    items: tasks,
    onItemClick: (task) => {
        window.location.href = `/task/${task.id}`;
    }
});
```

## Styling

The component uses CSS custom properties for theming:

```css
:root {
    --primary-color: #8b0000;
    --secondary-color: #a52a2a;
    --text-color: #2c3e50;
    --border-radius: 12px;
    --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    --card-hover-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
    --transition: all 0.3s ease;
}
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills for ES6 features)
- Mobile browsers (iOS Safari, Chrome Mobile)
