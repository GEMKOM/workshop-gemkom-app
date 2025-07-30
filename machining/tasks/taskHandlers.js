// --- taskHandlers.js ---
// Event handler setup for task functionality

import { handleStartStopClick, handleMarkDoneClick, handleManualLogClick, handleBackClick, handleFaultReportClick, handleStopOnlyClick } from './taskActions.js';
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

export function setupMarkDoneHandler() {
    const doneBtn = document.getElementById('mark-done-button');
    
    // Remove any existing listeners to prevent duplicates
    doneBtn.removeEventListener('click', handleMarkDoneClick);
    
    // Add new event listener
    doneBtn.addEventListener('click', handleMarkDoneClick);
}

export function setupStopOnlyHandler() {
    const stopOnlyBtn = document.getElementById('stop-only-button');
    
    // Remove any existing listeners to prevent duplicates
    stopOnlyBtn.removeEventListener('click', handleStopOnlyClick);
    
    // Add new event listener
    stopOnlyBtn.addEventListener('click', handleStopOnlyClick);
}

export function setupManualLogHandler() {
    const manualBtn = document.getElementById('manual-log-button');
    
    // Remove any existing listeners to prevent duplicates
    manualBtn.removeEventListener('click', handleManualLogClick);
    
    // Add new event listener
    manualBtn.addEventListener('click', handleManualLogClick);
}

export function setupBackHandler() {
    const backBtn = document.getElementById('back-button');
    
    // Remove any existing listeners to prevent duplicates
    backBtn.removeEventListener('click', handleBackClick);
    
    // Add new event listener
    backBtn.addEventListener('click', handleBackClick);
}

export function setupFaultReportHandler() {
    const faultBtn = document.getElementById('fault-report-button');
    
    // Remove any existing listeners to prevent duplicates
    faultBtn.removeEventListener('click', handleFaultReportClick);
    
    // Add new event listener
    faultBtn.addEventListener('click', handleFaultReportClick);
}

export function setupAllHandlers(restoring = false) {
    // Setup timer logic
    setupTimerHandlers(restoring);
    // Setup all event handlers
    setupStartStopHandler();
    setupStopOnlyHandler();
    setupBackHandler();
    setupManualLogHandler();
    setupMarkDoneHandler();
    setupFaultReportHandler();
} 