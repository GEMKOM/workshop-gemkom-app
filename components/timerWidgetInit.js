// --- timerWidgetInit.js ---
// Global timer widget initialization for all pages

import { TimerWidget } from './timerWidget.js';
import { guardRoute, hasPermission } from '../authService.js';

// Track if event listener has been added to prevent duplicates
let timerUpdateListenerAdded = false;

// Initialize timer widget globally
function initializeTimerWidget() {
    const canUseTimerWidget =
        hasPermission('access_machining') ||
        hasPermission('access_cnc_cutting') ||
        hasPermission('access_maintenance');

    if (guardRoute() && canUseTimerWidget) {
        // Check if timer widget already exists
        if (!window.timerWidget) {
            console.log('Initializing timer widget...');
            window.timerWidget = new TimerWidget();
            
            // Add global event listener for timer updates (only once)
            if (!timerUpdateListenerAdded) {
                window.addEventListener('timerUpdated', async () => {
                    if (window.timerWidget) {
                        await window.timerWidget.refreshTimerWidget();
                    }
                });
                timerUpdateListenerAdded = true;
            }
        }
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimerWidget);
} else {
    // DOM is already loaded, initialize immediately
    initializeTimerWidget();
} 