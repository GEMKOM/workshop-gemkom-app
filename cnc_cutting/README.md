# CNC Cutting Module

This module provides functionality for managing CNC cutting operations, similar to the machining module but with different API endpoints.

## Structure

- `index.html` - Main CNC cutting page
- `cnc_cutting.js` - Main JavaScript entry point
- `cnc_cuttingService.js` - Service layer for CNC cutting operations
- `cnc_cutting.css` - Styling for CNC cutting pages
- `activeTimers.js` - Active timers management
- `finishedTimers.js` - Finished timers management
- `cnc_cuttingTimers.js` - Timer API functions for CNC cutting
- `tasks/` - Task management subdirectory
  - `index.html` - Task detail page
  - `task.js` - Task page entry point
  - `taskApi.js` - Task API functions
  - `taskState.js` - Task state management
  - `taskUI.js` - Task UI management
  - `taskHandlers.js` - Event handlers
  - `taskActions.js` - Button actions
  - `taskLogic.js` - Business logic
  - `tasks.css` - Task page styling

## API Endpoints

All API calls use the `/cnc_cutting/` prefix instead of `/machining/`:

- `/cnc_cutting/tasks/` - Task management
- `/cnc_cutting/timers/` - Timer management
- `/cnc_cutting/manual-time/` - Manual time entries
- `/cnc_cutting/tasks/mark-completed/` - Mark tasks as completed

## Features

- Machine selection and task management
- Timer functionality for tracking work time
- Manual time entry
- Fault reporting
- Task completion tracking
- Pagination for finished timers
- Search and filtering capabilities

## Usage

Navigate to `/cnc_cutting/` to access the main CNC cutting interface. The page provides two main tabs:

1. **İş Başlat** (Start Work) - For starting new tasks and managing active timers
2. **Biten Zamanlayıcılar** (Finished Timers) - For viewing completed work

## Dependencies

- Bootstrap 5.3.0
- Font Awesome 6.4.0
- Custom components from `../components/`
- Generic utilities from `../generic/`
