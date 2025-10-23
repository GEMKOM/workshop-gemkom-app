# Timer Page Component

A generic, reusable timer page component that provides a complete timer interface with customizable header, timer display, control buttons, and task details section.

## Features

- ⏱️ **Timer Functionality**: Start, stop, and reset timer with real-time display
- 🎨 **Customizable UI**: Fully customizable header, buttons, and styling
- 📋 **Task Details**: Configurable task information display with clickable elements
- 🃏 **Generic Cards**: Support for adding generic cards with full customization
- 🚨 **Warning System**: Built-in warning message display
- 📱 **Responsive Design**: Mobile-friendly responsive layout
- 🎭 **Theme Support**: Multiple built-in themes (default, dark, custom)
- 🔧 **Modal Support**: Built-in modals for manual time entry and fault reporting
- ⚡ **Event System**: Comprehensive event handling for all user interactions

## Installation

1. Copy the component files to your project:
   ```
   components/timer-page/
   ├── timer-page.js
   ├── timer-page.css
   └── README.md
   ```

2. Include the CSS file in your HTML:
   ```html
   <link rel="stylesheet" href="components/timer-page/timer-page.css">
   ```

3. Import and use the component:
   ```javascript
   import { TimerPage } from './components/timer-page/timer-page.js';
   ```

## Basic Usage

```javascript
// Create a basic timer
const timer = new TimerPage('timer-container', {
    title: 'My Timer',
    subtitle: 'Task Description'
});
```

## Configuration Options

### Header Configuration

```javascript
{
    title: 'Timer Title',                    // Main title
    subtitle: 'Subtitle text',               // Optional subtitle
    showBackButton: true,                    // Show/hide back button
    backButtonText: 'Geri',                  // Back button text
    backButtonIcon: 'fas fa-arrow-left'      // Back button icon
}
```

### Timer Configuration

```javascript
{
    timerLabel: 'Geçen Süre',               // Timer label text
    showTimer: true                          // Show/hide timer section
}
```

### Button Configuration

```javascript
{
    buttons: {
        startStop: {
            enabled: true,                   // Enable/disable start/stop button
            startText: 'Başlat',            // Start button text
            stopText: 'Durdur',             // Stop button text
            startIcon: 'fas fa-play',       // Start button icon
            stopIcon: 'fas fa-stop'         // Stop button icon
        },
        manual: {
            enabled: true,                   // Enable/disable manual button
            text: 'Manuel',                 // Manual button text
            icon: 'fas fa-clock'            // Manual button icon
        },
        complete: {
            enabled: true,                   // Enable/disable complete button
            text: 'Tamamla',                // Complete button text
            icon: 'fas fa-check'            // Complete button icon
        },
        fault: {
            enabled: true,                   // Enable/disable fault button
            text: 'Arıza',                  // Fault button text
            icon: 'fas fa-exclamation-triangle' // Fault button icon
        }
    }
}
```

### Task Details Configuration

```javascript
{
    showTaskDetails: true,                  // Show/hide task details section
    taskDetails: [                          // Array of detail objects
        {
            icon: 'fas fa-file-alt',        // Icon class
            label: 'İş Emri',              // Label text
            value: '12345',                // Value text
            clickable: false,              // Make clickable
            id: 'job-number',              // Unique ID for clickable items
            onClick: () => {               // Click handler (for clickable items)
                console.log('Clicked!');
            }
        }
    ]
}
```

### Generic Cards Configuration

```javascript
{
    showGenericCards: true,                // Show/hide generic cards section
    genericCards: [                        // Array of card objects
        {
            title: 'Machine Status',       // Card title
            subtitle: 'CNC-001 is operational', // Card subtitle
            icon: 'fas fa-cog',            // Font Awesome icon
            iconColor: '#28a745',          // Icon color
            iconBackground: '#f8f9fa',      // Icon background
            status: 'Active',              // Status text
            statusType: 'success',         // Status type (info, success, warning, danger, primary)
            details: [                     // Card details array
                {
                    icon: 'fas fa-map-marker-alt',
                    label: 'Location:',
                    value: 'Workshop A'
                }
            ],
            buttons: [                     // Card buttons array
                {
                    text: 'Details',
                    icon: 'fas fa-info',
                    class: 'btn-outline-primary',
                    onClick: () => console.log('Button clicked!')
                }
            ],
            clickable: false,              // Make entire card clickable
            onClick: null                  // Card click handler
        }
    ],
    cardsGridOptions: {                    // Grid layout options
        columns: 'auto',                   // 'auto' for responsive, or number for fixed columns
        gap: '1.5rem',                     // Gap between cards
        className: 'custom-grid',          // Additional CSS class
        responsive: true                    // Enable responsive behavior
    }
}
```

### Warning Configuration

```javascript
{
    showWarning: false,                     // Show/hide warning section
    warningMessage: 'Warning text',         // Warning message
    warningIcon: 'fas fa-exclamation-circle' // Warning icon
}
```

### Modal Configuration

```javascript
{
    modals: {
        manualTime: true,                   // Enable manual time modal
        faultReport: true,                  // Enable fault report modal
        machineStatus: true,                // Enable machine status modal
        redirectWarning: true               // Enable redirect warning modal
    }
}
```

### Event Handlers

```javascript
{
    onBack: () => {                         // Back button click handler
        console.log('Back clicked');
    },
    onStart: () => {                        // Timer start handler
        console.log('Timer started');
    },
    onStop: () => {                         // Timer stop handler
        console.log('Timer stopped');
    },
    onManual: (data) => {                   // Manual time entry handler
        console.log('Manual time:', data);
        // data contains: { startTime, endTime, duration }
    },
    onComplete: () => {                     // Complete button handler
        console.log('Task completed');
    },
    onFault: (data) => {                    // Fault report handler
        console.log('Fault reported:', data);
        // data contains: { description }
    },
    onTimerUpdate: (elapsed) => {           // Timer update handler
        console.log('Elapsed time:', elapsed);
    }
}
```

### Styling Configuration

```javascript
{
    theme: 'default',                       // 'default', 'dark', 'custom'
    customCss: `                            // Custom CSS string
        .timer-page-wrapper {
            --timer-primary-color: #ff6b6b;
        }
    `
}
```

## Complete Example

```javascript
import { TimerPage } from './components/timer-page/timer-page.js';

const timer = new TimerPage('timer-container', {
    // Header
    title: 'Talaşlı İmalat - İş Emri #12345',
    subtitle: 'Makine: CNC Torna Tezgahı #01',
    showBackButton: true,
    
    // Timer
    timerLabel: 'Geçen Süre',
    
    // Buttons
    buttons: {
        startStop: { enabled: true },
        manual: { enabled: true },
        complete: { enabled: true },
        fault: { enabled: true }
    },
    
    // Task Details
    showTaskDetails: true,
    taskDetails: [
        {
            icon: 'fas fa-file-alt',
            label: 'İş Emri',
            value: '12345'
        },
        {
            icon: 'fas fa-image',
            label: 'Resim No',
            value: 'DRW-001'
        },
        {
            icon: 'fas fa-map-marker-alt',
            label: 'Poz No',
            value: 'A-01'
        },
        {
            icon: 'fas fa-cubes',
            label: 'Adet',
            value: '50'
        }
    ],
    
    // Event Handlers
    onStart: () => {
        console.log('Timer started');
    },
    onStop: () => {
        console.log('Timer stopped');
    },
    onComplete: () => {
        alert('Görev tamamlandı!');
    },
    onFault: (data) => {
        console.log('Arıza bildirimi:', data.description);
    },
    onManual: (data) => {
        console.log('Manuel zaman girişi:', data);
    }
});
```

## Public API Methods

### Timer Control

```javascript
// Start the timer
timer.startTimer();

// Stop the timer
timer.stopTimer();

// Reset the timer
timer.resetTimer();

// Get current elapsed time
const elapsed = timer.state.elapsedTime;
```

### UI Updates

```javascript
// Update title
timer.setTitle('New Title');

// Update subtitle
timer.setSubtitle('New Subtitle');

// Show warning
timer.showWarning('Warning message', 'fas fa-exclamation-triangle');

// Hide warning
timer.hideWarning();

// Show message
timer.showMessage('Success message', 'success', 3000);
```

### Task Details

```javascript
// Update task details
timer.setTaskDetails([
    {
        icon: 'fas fa-star',
        label: 'New Field',
        value: 'New Value'
    }
]);
```

### Generic Cards

```javascript
// Set generic cards
timer.setGenericCards([
    {
        title: 'Machine Status',
        subtitle: 'CNC-001 is operational',
        icon: 'fas fa-cog',
        status: 'Active',
        statusType: 'success'
    }
], {
    columns: 2,
    gap: '1rem'
});

// Add a new card
timer.addGenericCard({
    title: 'New Card',
    subtitle: 'Card description',
    icon: 'fas fa-plus'
});

// Remove a card by index
timer.removeGenericCard(0);

// Update a card by index
timer.updateGenericCard(0, {
    title: 'Updated Card',
    subtitle: 'Updated description'
});
```

### Modal Control

```javascript
// Show modal
timer.showModal('timer-manual-time-modal');

// Hide modal
timer.hideModal('timer-manual-time-modal');
```

### Cleanup

```javascript
// Destroy the component
timer.destroy();
```

## Themes

### Default Theme
```javascript
const timer = new TimerPage('container', {
    theme: 'default'  // Red color scheme
});
```

### Dark Theme
```javascript
const timer = new TimerPage('container', {
    theme: 'dark'     // Dark color scheme
});
```

### Custom Theme
```javascript
const timer = new TimerPage('container', {
    theme: 'custom',
    customCss: `
        .timer-page-wrapper {
            --timer-primary-color: #9C27B0;
            --timer-secondary-color: #7B1FA2;
        }
    `
});
```

## Responsive Design

The timer page component is fully responsive and works seamlessly across all device sizes:

### Mobile (≤576px)
- **Cards**: 1 column layout
- **Touch-friendly**: 44px minimum touch targets
- **Optimized spacing**: Reduced padding and margins
- **Stacked layout**: Card headers stack vertically

### Tablet (577px-768px)
- **Cards**: 2 column layout
- **Landscape mode**: Optimized for horizontal orientation
- **Medium spacing**: Balanced padding and gaps

### Desktop (769px-992px)
- **Cards**: 3 column layout
- **Full features**: All components visible
- **Optimal spacing**: Standard padding and gaps

### Large Desktop (≥993px)
- **Cards**: 4+ column layout
- **Ultra-wide support**: Up to 5 columns on very wide screens
- **Enhanced spacing**: Larger gaps for better visual hierarchy

### Responsive Configuration

```javascript
const timer = new TimerPage('container', {
    showGenericCards: true,
    cardsGridOptions: {
        columns: 'auto',        // Use responsive behavior
        responsive: true,       // Enable responsive layout
        gap: '1.5rem'          // Responsive gap
    }
});
```

### Mobile-Specific Features
- **Touch optimization**: Proper touch targets and gestures
- **Viewport handling**: Optimized for mobile viewports
- **Performance**: Debounced resize events
- **Accessibility**: Screen reader friendly

## CSS Customization

The component uses CSS custom properties for easy theming:

```css
:root {
    --timer-primary-color: #8B0000;
    --timer-secondary-color: #b40024;
    --timer-accent-color: #FF4D4D;
    --timer-text-color: #2c3e50;
    --timer-light-bg: #f8f9fa;
    --timer-border-radius: 16px;
    --timer-card-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    --timer-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- Bootstrap 5.3.0+ (for basic styling and components)
- Font Awesome 6.4.0+ (for icons)

## Testing

Open `test-timer-page.html` in your browser to see various examples of the timer component in action. The test page includes:

- Basic timer functionality
- Machining timer example
- CNC cutting timer example
- Custom timer with different configurations
- Timer with generic cards integration
- Minimal timer with only essential features
- Theme switching

## License

This component is part of the Gemkom project and follows the same licensing terms.
