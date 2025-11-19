import { getSyncedNow } from './timeService.js';

export function mapJiraIssueToTask(jiraIssue) {
    const fields = jiraIssue.fields || {};

    return {
        key: jiraIssue.key,                                 // Primary key
        name: fields.summary || '',                         // Task name
        job_no: fields.customfield_10117 || null,           // RM260-01-12
        image_no: fields.customfield_10184 || null,         // 8.7211.0005
        position_no: fields.customfield_10185 || null,      // 107
        quantity: fields.customfield_10187 || null,         // 6
        machine: fields.customfield_11411?.value || null,   // COLLET (optional)
    };
}

export function formatTime(secs) {
    const hrs = Math.floor(secs / 3600).toString().padStart(2, '0');
    const mins = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const sec = (secs % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${sec}`;
}

export function formatJiraDate(ms) {
    const d = new Date(ms);
    const pad = n => (n < 10 ? '0' + n : n);
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const msms = (d.getMilliseconds() + '').padStart(3, '0');
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
    const offsetMinutes = pad(Math.abs(offset) % 60);
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${msms}${sign}${offsetHours}${offsetMinutes}`;
}

export function formatDuration(startTime) {
    const elapsed = Math.floor((getSyncedNow() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /**
 * Formats a date string to Turkish locale
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('tr-TR');
}

/**
 * Formats duration from hours to a readable string
 * @param {number} durationHours - Duration in hours
 * @returns {string} Formatted duration string
 */
export function formatDurationFromHoursToMinutes(durationHours) {
    if (!durationHours || durationHours === 0) {
        return '0dk';
    }
    
    const totalMinutes = Math.round(durationHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}s ${minutes}dk`;
    } else {
        return `${minutes}dk`;
    }
}

/**
 * Formats a decimal number with Turkish locale (comma as decimal separator)
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string with comma as decimal separator
 */
export function formatDecimalTurkish(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    
    // Use toLocaleString with Turkish locale for proper formatting
    return value.toLocaleString('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}