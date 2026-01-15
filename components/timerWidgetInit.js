// --- timerWidgetInit.js ---
// Global timer widget initialization for all pages

import { TimerWidget } from './timerWidget.js';
import { guardRoute, isAdmin } from '../authService.js';

// Track if event listener has been added to prevent duplicates
let timerUpdateListenerAdded = false;

// Initialize timer widget globally
function initializeTimerWidget() {
    // Only initialize if user is authenticated, not admin, and is in machining or cutting team
    const user = JSON.parse(localStorage.getItem('user'));
    if (guardRoute() && !isAdmin() && user && (user.team === 'machining' || user.team === 'cutting')) {
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