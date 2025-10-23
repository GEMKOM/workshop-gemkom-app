// --- taskUI.js ---
// UI management functions for task functionality (simplified for timer component)

import { state} from '../cnc_cuttingService.js';
import { getSyncedNow } from '../../generic/timeService.js';
import { formatTime } from '../../generic/formatters.js';

// ============================================================================
// UI MANAGEMENT (LEGACY SUPPORT)
// ============================================================================

// These functions are kept for backward compatibility but are no longer used
// since the timer component handles all UI management

export function getUIElements() {
    // Legacy function - not used with timer component
    return {};
}

export function updateTimerDisplay() {
    // Legacy function - timer component handles this
    if (state.currentTimer && state.currentTimer.start_time) {
        const elapsed = Math.round((getSyncedNow() - state.currentTimer.start_time) / 1000);
        return formatTime(elapsed);
    }
    return '00:00:00';
}

export function resetTimerDisplay() {
    // Legacy function - timer component handles this
    return '00:00:00';
}

export function setupTaskDisplay(hasActiveTimer, isHoldTask) {
    // Legacy function - timer component handles this
    // This function is kept for backward compatibility but does nothing
    console.log('setupTaskDisplay called - handled by timer component');
}

export function startTimerUpdate() {
    // Legacy function - timer component handles this
    console.log('startTimerUpdate called - handled by timer component');
}

export function stopTimerUpdate() {
    // Legacy function - timer component handles this
    console.log('stopTimerUpdate called - handled by timer component');
}

// ============================================================================
// MODAL MANAGEMENT (LEGACY SUPPORT)
// ============================================================================

export function showModal(modalId) {
    // Legacy function - timer component handles modals
    console.log('showModal called - handled by timer component');
}

export function hideModal(modalId) {
    // Legacy function - timer component handles modals
    console.log('hideModal called - handled by timer component');
}

// ============================================================================
// LOADING STATES (LEGACY SUPPORT)
// ============================================================================

export function showLoadingState(button) {
    // Legacy function - timer component handles loading states
    console.log('showLoadingState called - handled by timer component');
    return '';
}

export function restoreButtonState(button, originalContent) {
    // Legacy function - timer component handles button states
    console.log('restoreButtonState called - handled by timer component');
}

// ============================================================================
// MESSAGE DISPLAY (LEGACY SUPPORT)
// ============================================================================

export function showSuccessMessage(message, duration = 3000) {
    // Legacy function - timer component handles messages
    console.log('showSuccessMessage called - handled by timer component');
}

export function showErrorMessage(message, duration = 5000) {
    // Legacy function - timer component handles messages
    console.log('showErrorMessage called - handled by timer component');
}

// ============================================================================
// PARTS MODAL (LEGACY SUPPORT)
// ============================================================================

export function showPartsModal() {
    // Legacy function - timer component handles modals
    console.log('showPartsModal called - handled by timer component');
}

export function showFilesModal() {
    // Legacy function - timer component handles modals
    console.log('showFilesModal called - handled by timer component');
}