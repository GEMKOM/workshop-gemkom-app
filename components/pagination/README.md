# Pagination Component

A reusable pagination component for handling page navigation in lists and tables.

## Features

- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: ARIA labels and keyboard navigation support
- **Customizable**: Configurable options for different use cases
- **Event Handling**: Callback support for page changes
- **API Integration**: Easy integration with API responses

## Usage

### Basic Usage

```javascript
import { Pagination } from './components/pagination/pagination.js';

// Create pagination instance
const pagination = new Pagination(container, {
    currentPage: 1,
    totalPages: 10,
    totalCount: 200,
    pageSize: 20,
    onPageChange: (page) => {
        console.log('Page changed to:', page);
        // Load data for the new page
        loadData(page);
    }
});
```

### With API Response

```javascript
import { createPaginationFromApiResponse } from './components/pagination/pagination.js';

// Create pagination from API response
const pagination = createPaginationFromApiResponse(container, apiData, currentPage, {
    onPageChange: (page) => {
        loadData(page);
    }
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `currentPage` | number | 1 | Current active page |
| `totalPages` | number | 1 | Total number of pages |
| `totalCount` | number | 0 | Total number of items |
| `pageSize` | number | 20 | Items per page |
| `showInfo` | boolean | true | Show pagination info text |
| `showFirstLast` | boolean | true | Show first/last page buttons |
| `maxVisiblePages` | number | 5 | Maximum visible page numbers |
| `onPageChange` | function | null | Callback when page changes |
| `className` | string | '' | Additional CSS classes |

## Methods

### `updateData(data)`
Update pagination with new data:
```javascript
pagination.updateData({
    currentPage: 2,
    totalPages: 15,
    totalCount: 300,
    pageSize: 20
});
```

### `setCurrentPage(page)`
Set the current page:
```javascript
pagination.setCurrentPage(5);
```

### `setTotalPages(totalPages)`
Set total number of pages:
```javascript
pagination.setTotalPages(20);
```

### `setTotalCount(totalCount)`
Set total number of items:
```javascript
pagination.setTotalCount(400);
```

### `setOnPageChange(callback)`
Set the page change callback:
```javascript
pagination.setOnPageChange((page) => {
    console.log('Page changed to:', page);
});
```

### `getCurrentPage()`
Get current page number:
```javascript
const currentPage = pagination.getCurrentPage();
```

### `getTotalPages()`
Get total number of pages:
```javascript
const totalPages = pagination.getTotalPages();
```

### `destroy()`
Remove pagination from DOM:
```javascript
pagination.destroy();
```

## Events

### `onPageChange(page, pagination)`
Triggered when user clicks on a page number or navigation button.

**Parameters:**
- `page` (number): The page number that was clicked
- `pagination` (Pagination): The pagination instance

## Styling

The component includes responsive CSS that works with Bootstrap classes. You can customize the appearance by overriding the CSS classes:

- `.pagination-container`: Main container
- `.pagination-info`: Info text container
- `.pagination`: Navigation list
- `.page-item`: Individual page item
- `.page-link`: Page link/button
- `.page-item.active`: Active page
- `.page-item.disabled`: Disabled navigation

## Examples

### Simple List Pagination

```javascript
const container = document.getElementById('pagination-container');
const pagination = new Pagination(container, {
    currentPage: 1,
    totalPages: 10,
    totalCount: 200,
    onPageChange: (page) => {
        loadListData(page);
    }
});
```

### Table Pagination

```javascript
const pagination = new Pagination(tableContainer, {
    currentPage: 1,
    totalPages: 25,
    totalCount: 500,
    pageSize: 20,
    showInfo: true,
    onPageChange: (page) => {
        loadTableData(page);
    }
});
```

### API Integration

```javascript
async function loadData(page = 1) {
    try {
        const response = await fetch(`/api/data?page=${page}&page_size=20`);
        const data = await response.json();
        
        // Update pagination
        pagination.updateData({
            currentPage: page,
            totalPages: Math.ceil(data.count / 20),
            totalCount: data.count,
            pageSize: 20
        });
        
        // Update content
        displayData(data.results);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills for ES6 features)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- Font Awesome (for icons)
- Bootstrap CSS classes (optional, for styling)
