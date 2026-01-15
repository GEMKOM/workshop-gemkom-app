// --- taskHandlers.js ---
// Event handler setup for operation functionality

import { handleStartStopClick, handleBackClick } from './taskActions.js';
import { setupTimerHandlers } from './taskLogic.js';

// ============================================================================
// HANDLER SETUP
// ============================================================================
export function setupStartStopHandler() {
    const startBtn = document.getElementById('start-stop');
    
    // Remove any existing listeners to prevent duplicates
    startBtn.removeEventListener('click', handleStartStopClick);
    
    // Add new event listener
    startBtn.addEventListener('click', handleStartStopClick);
}

export function setupBackHandler() {
    const backBtn = document.getElementById('back-button');
    
    // Remove any existing listeners to prevent duplicates
    backBtn.removeEventListener('click', handleBackClick);
    
    // Add new event listener
    backBtn.addEventListener('click', handleBackClick);
}

export function setupAllHandlers(restoring = false) {
    // Setup timer logic
    setupTimerHandlers(restoring);
    // Setup all event handlers
    setupStartStopHandler();
    setupBackHandler();
}


