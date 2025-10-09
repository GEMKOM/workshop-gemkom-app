# Generic Card Component

A flexible and reusable card component for displaying various types of data with customizable icons, status badges, details, and action buttons.

## Features

- ✅ **Flexible Content**: Support for title, subtitle, icon, status, details, and buttons
- ✅ **Customizable Styling**: Configurable colors, icons, and status types
- ✅ **Interactive Elements**: Clickable cards and action buttons
- ✅ **Responsive Design**: Works on all screen sizes
- ✅ **Accessibility**: Keyboard navigation and screen reader support
- ✅ **Grid Layout**: Built-in support for card grids
- ✅ **Modern Design**: Clean, professional appearance with hover effects

## Installation

1. Copy the `genericCard.js` and `genericCard.css` files to your project
2. Include the CSS file in your HTML:
   ```html
   <link rel="stylesheet" href="components/genericCard/genericCard.css">
   ```
3. Import the component in your JavaScript:
   ```javascript
   import { GenericCard, createCardGrid } from './components/genericCard/genericCard.js';
   ```

## Basic Usage

### Simple Card

```javascript
import { GenericCard } from './components/genericCard/genericCard.js';

const card = new GenericCard(document.getElementById('card-container'), {
    title: 'Card Title',
    subtitle: 'Card subtitle or description',
    icon: 'fas fa-info-circle',
    iconColor: '#6c757d',
    iconBackground: '#f8f9fa'
});
```

### Card with Status and Details

```javascript
const card = new GenericCard(document.getElementById('card-container'), {
    title: 'TI-2024-001',
    subtitle: 'CNC İşleme - Parça A',
    icon: 'fas fa-check-circle',
    iconColor: '#28a745',
    iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
    status: 'Tamamlandı',
    statusType: 'success',
    details: [
        { icon: 'fas fa-cog', label: 'Makine:', value: 'CNC-001' },
        { icon: 'fas fa-user', label: 'Kullanıcı:', value: 'Ahmet Yılmaz' },
        { icon: 'fas fa-clock', label: 'Süre:', value: '2s 15dk', valueClass: 'duration' }
    ]
});
```

### Card with Buttons

```javascript
const card = new GenericCard(document.getElementById('card-container'), {
    title: 'Machine Status',
    subtitle: 'CNC-001 is operational',
    icon: 'fas fa-cog',
    iconColor: '#28a745',
    iconBackground: '#f8f9fa',
    status: 'Active',
    statusType: 'success',
    buttons: [
        { 
            text: 'View Details', 
            icon: 'fas fa-eye', 
            class: 'btn-outline-primary', 
            onClick: () => console.log('View clicked') 
        },
        { 
            text: 'Edit', 
            icon: 'fas fa-edit', 
            class: 'btn-outline-warning', 
            onClick: () => console.log('Edit clicked') 
        }
    ]
});
```

### Clickable Card

```javascript
const card = new GenericCard(document.getElementById('card-container'), {
    title: 'Clickable Card',
    subtitle: 'Click anywhere on this card',
    icon: 'fas fa-hand-pointer',
    iconColor: '#007bff',
    iconBackground: '#f8f9fa',
    clickable: true,
    onClick: (event, cardInstance) => {
        console.log('Card clicked!', cardInstance);
        // Handle card click
    }
});
```

## Card Grid

Create multiple cards in a grid layout:

```javascript
import { createCardGrid } from './components/genericCard/genericCard.js';

const cardsData = [
    {
        title: 'Card 1',
        subtitle: 'First card',
        icon: 'fas fa-info-circle',
        status: 'Active',
        statusType: 'success'
    },
    {
        title: 'Card 2',
        subtitle: 'Second card',
        icon: 'fas fa-check-circle',
        status: 'Completed',
        statusType: 'success'
    }
];

createCardGrid(document.getElementById('grid-container'), cardsData, {
    columns: 2,
    gap: '1rem',
    className: 'my-custom-grid'
});
```

## Configuration Options

### Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `''` | Main card title |
| `subtitle` | string | `''` | Card subtitle or description |
| `icon` | string | `'fas fa-info-circle'` | Font Awesome icon class |
| `iconColor` | string | `'#6c757d'` | Icon color (hex, rgb, etc.) |
| `iconBackground` | string | `'#f8f9fa'` | Icon background (color or gradient) |
| `status` | string | `null` | Status text (null to hide) |
| `statusType` | string | `'info'` | Status badge type (info, success, warning, danger, primary) |
| `details` | array | `[]` | Array of detail objects |
| `buttons` | array | `[]` | Array of button objects |
| `clickable` | boolean | `false` | Make the entire card clickable |
| `onClick` | function | `null` | Click handler for clickable cards |
| `className` | string | `''` | Additional CSS class for the container |

### Detail Object

```javascript
{
    icon: 'fas fa-clock',        // Font Awesome icon class
    label: 'Duration:',          // Label text
    value: '2s 15dk',           // Value text
    valueClass: 'duration'      // Optional CSS class for the value
}
```

### Button Object

```javascript
{
    text: 'View Details',                    // Button text
    icon: 'fas fa-eye',                      // Optional Font Awesome icon
    class: 'btn-outline-primary',            // Bootstrap button class
    onClick: (event, cardInstance) => {      // Click handler
        console.log('Button clicked!');
    }
}
```

### Grid Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `columns` | number | `1` | Number of columns in the grid |
| `gap` | string | `'1rem'` | Gap between grid items |
| `className` | string | `''` | Additional CSS class for the grid |

## Status Types

- `info` - Blue badge for informational status
- `success` - Green badge for successful/completed status
- `warning` - Yellow badge for warning/pending status
- `danger` - Red badge for error/critical status
- `primary` - Custom primary color badge

## Public Methods

### updateTitle(title)
Update the card title.

```javascript
card.updateTitle('New Title');
```

### updateSubtitle(subtitle)
Update the card subtitle.

```javascript
card.updateSubtitle('New subtitle');
```

### updateStatus(status, type)
Update the status badge.

```javascript
card.updateStatus('Completed', 'success');
```

### updateDetails(details)
Update the card details.

```javascript
card.updateDetails([
    { icon: 'fas fa-clock', label: 'Time:', value: '10:30' }
]);
```

### addButton(button)
Add a new button to the card.

```javascript
card.addButton({
    text: 'New Action',
    icon: 'fas fa-plus',
    class: 'btn-success',
    onClick: () => console.log('New action!')
});
```

### destroy()
Remove the card from the DOM.

```javascript
card.destroy();
```

## Examples

### Timer Card
```javascript
new GenericCard(container, {
    title: 'TI-2024-001',
    subtitle: 'CNC İşleme - Parça A',
    icon: 'fas fa-check-circle',
    iconColor: '#28a745',
    iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
    status: 'Tamamlandı',
    statusType: 'success',
    details: [
        { icon: 'fas fa-cog', label: 'Makine:', value: 'CNC-001' },
        { icon: 'fas fa-user', label: 'Kullanıcı:', value: 'Ahmet Yılmaz' },
        { icon: 'fas fa-clock', label: 'Süre:', value: '2s 15dk', valueClass: 'duration' }
    ],
    buttons: [
        { text: 'Detaylar', icon: 'fas fa-eye', class: 'btn-outline-primary', onClick: showDetails },
        { text: 'Rapor', icon: 'fas fa-file-pdf', class: 'btn-outline-success', onClick: generateReport }
    ]
});
```

### Machine Status Card
```javascript
new GenericCard(container, {
    title: 'CNC-001',
    subtitle: 'CNC Torna Tezgahı',
    icon: 'fas fa-cog',
    iconColor: '#28a745',
    iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
    status: 'Çalışır Durumda',
    statusType: 'success',
    details: [
        { icon: 'fas fa-map-marker-alt', label: 'Konum:', value: 'Atölye A' },
        { icon: 'fas fa-calendar', label: 'Son Bakım:', value: '15.01.2024' },
        { icon: 'fas fa-user', label: 'Operatör:', value: 'Ahmet Yılmaz' }
    ],
    buttons: [
        { text: 'Detaylar', icon: 'fas fa-info', class: 'btn-outline-primary', onClick: showMachineDetails }
    ]
});
```

### User Card
```javascript
new GenericCard(container, {
    title: 'Ahmet Yılmaz',
    subtitle: 'CNC Operatörü',
    icon: 'fas fa-user',
    iconColor: '#28a745',
    iconBackground: 'linear-gradient(135deg, #28a745, #20c997)',
    status: 'Aktif',
    statusType: 'success',
    details: [
        { icon: 'fas fa-clock', label: 'Giriş:', value: '08:30' },
        { icon: 'fas fa-cog', label: 'Makine:', value: 'CNC-001' },
        { icon: 'fas fa-phone', label: 'Telefon:', value: '0555 123 4567' }
    ],
    buttons: [
        { text: 'Mesaj Gönder', icon: 'fas fa-envelope', class: 'btn-outline-primary', onClick: sendMessage }
    ]
});
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- Font Awesome 6.0+ (for icons)
- Bootstrap 5.0+ (for button styles, optional)

## Testing

Open `test-cards.html` in your browser to see various examples and test the component functionality.
