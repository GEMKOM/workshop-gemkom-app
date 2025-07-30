// --- timerWidgetInit.js ---
// Global timer widget initialization for all pages

import { TimerWidget } from './timerWidget.js';
import { guardRoute, isAdmin } from '../authService.js';

// Initialize timer widget globally
function initializeTimerWidget() {
    // Only initialize if user is authenticated and not admin
    if (guardRoute() && !isAdmin()) {
        // Check if timer widget already exists
        if (!window.timerWidget) {
            console.log('Initializing timer widget...');
            window.timerWidget = new TimerWidget();
            
            // Add global event listener for timer updates
            window.addEventListener('timerUpdated', async () => {
                if (window.timerWidget) {
                    await window.timerWidget.refreshTimerWidget();
                }
            });
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