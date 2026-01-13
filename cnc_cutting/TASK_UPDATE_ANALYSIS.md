# CNC Cutting Task/Part Update Analysis

## Summary
This document identifies all locations where CNC cutting tasks or parts are updated or modified in the codebase.

## Critical Finding: TWO API Calls Update Tasks

### 1. Task Completion (Mark as Done)
**Location:** `cnc_cutting/tasks/taskActions.js`
- **Function:** `handleMarkDoneClick()`
- **API Call:** `markTaskAsDoneShared(state.currentIssue.key, 'cnc_cutting')`
- **Endpoint:** `POST /cnc_cutting/tasks/mark-completed/`
- **Implementation:** `generic/tasks.js` line 10-20
- **What it does:** Marks a task as completed
- **⚠️ POTENTIAL ISSUE:** This endpoint might be deleting parts on the backend

### 2. Warehouse Processing (Mark as Warehouse Processed) ⚠️ **HIGH SUSPICION**
**Location:** `warehouse/weight-reduction/weight-reduction.js`
- **Function:** `handleWarehouseSubmit()`
- **API Call:** `markAsWareHouseProcessed(taskKey, 'cnc_cutting')`
- **Endpoint:** `POST /cnc_cutting/tasks/warehouse-process/`
- **Implementation:** `generic/tasks.js` line 28-38
- **What it does:** Marks a task as processed by warehouse
- **⚠️ CRITICAL:** This endpoint is called from the warehouse weight-reduction page when users click "Depo İşlemini Tamamla" (Complete Warehouse Process)
- **⚠️ MOST LIKELY CULPRIT:** Since parts are being deleted from the database, and this endpoint is specifically for warehouse processing (which might involve moving/archiving parts), this is the most likely place where parts are being deleted

## Read-Only Operations (No Modifications)

### 2. Task State Management
**Location:** `cnc_cutting/tasks/taskState.js`
- **Function:** `setCurrentIssueState(issue)`
- **What it does:** Sets local state from fetched issue data
- **Parts handling:** `parts: issue.parts || []`
- **Note:** This is read-only - it just copies the parts array from the API response

### 3. Task Details Fetching
**Location:** `cnc_cutting/tasks/task.js`
- **Function:** `initializeTaskView()`
- **What it does:** Fetches task details and sets state
- **API Calls:**
  - `fetchTaskDetails(taskKey, 'cnc_cutting')` - Gets task from API
  - `fetchTimers(...)` - Gets active timers
- **Note:** All read-only operations

### 4. Task Overview Display
**Location:** `cnc_cutting/taskOverview.js`
- **Functions:** `loadTaskOverviewContent()`, `openTaskDetailsModal()`
- **What it does:** Fetches and displays tasks in a modal
- **API Calls:**
  - `fetchTasks(...)` - Gets list of tasks
  - `fetchTaskById(taskKey, 'cnc_cutting')` - Gets single task details
- **Note:** All read-only operations

### 5. Active Timers Display
**Location:** `cnc_cutting/activeTimers.js`
- **Function:** `loadTasksForMachine(machineId)`
- **What it does:** Fetches and displays tasks for a machine
- **API Call:** `fetchTasks({ machineId, ... }, 'cnc_cutting')`
- **Note:** Read-only operation

## Parts Data Flow

### Where Parts Are Read:
1. **Task Fetching:**
   - `generic/tasks.js` → `fetchTaskById()` → `GET /cnc_cutting/tasks/{key}/`
   - `generic/tasks.js` → `fetchTasks()` → `GET /cnc_cutting/tasks/`
   - `generic/tasks.js` → `fetchTaskDetails()` → Uses `fetchTaskById()` or sessionStorage

2. **State Setting:**
   - `cnc_cutting/tasks/taskState.js` → `setCurrentIssueState()` → Copies `issue.parts || []`

3. **Display:**
   - `cnc_cutting/tasks/task.js` → `showPartsModal()` → Displays parts from `issue.parts`
   - `cnc_cutting/taskOverview.js` → `renderPartsTable()` → Displays parts from `task.parts`

### Where Parts Are NOT Modified:
- ❌ No frontend code modifies the parts array
- ❌ No API calls update parts directly
- ❌ No delete operations on parts in frontend

## Potential Root Causes

### 1. Warehouse Process Endpoint (MOST LIKELY) ⚠️
The `markAsWareHouseProcessed()` function calls:
```
POST /cnc_cutting/tasks/warehouse-process/
```
**This endpoint is called from `warehouse/weight-reduction/weight-reduction.js` when users complete warehouse processing. This is the MOST LIKELY place where parts are being deleted, as warehouse processing might involve archiving or moving parts, which could trigger a cascade delete or explicit deletion.**

**Location:** `warehouse/weight-reduction/weight-reduction.js:682`
- User flow: Warehouse → Weight Reduction → View completed task → Click "Depo İşlemini Tamamla"
- This calls `markAsWareHouseProcessed(taskKey)` which hits the backend endpoint

### 2. Task Completion Endpoint
The `markTaskAsDoneShared()` function calls:
```
POST /cnc_cutting/tasks/mark-completed/
```
**This endpoint might also be deleting parts on the backend when marking tasks as done.**

### 2. API Response Issue
When fetching tasks, the API might not be including parts in the response:
- Check if `parts` field is included in API responses
- Check if there's a serializer issue on the backend

### 3. Data Transformation Issue
In `setCurrentIssueState()`:
```javascript
parts: issue.parts || []
```
If `issue.parts` is `undefined` or `null`, it defaults to an empty array. This could mask the issue if the API isn't returning parts.

## Recommendations

### 1. Check Warehouse Process Backend Endpoint ⚠️ **CRITICAL PRIORITY**
**Priority: CRITICAL**
- **Review the backend implementation of `POST /cnc_cutting/tasks/warehouse-process/`**
- This is the MOST LIKELY culprit since it's specifically for warehouse processing
- Check if this endpoint:
  - Deletes parts explicitly
  - Has cascade delete relationships
  - Moves parts to another table (which might appear as deletion)
  - Has any cleanup logic that removes parts
- Add logging to track parts before/after warehouse processing
- **Check the database logs when this endpoint is called**

### 2. Check Task Completion Backend Endpoint
**Priority: HIGH**
- Review the backend implementation of `POST /cnc_cutting/tasks/mark-completed/`
- Check if this endpoint modifies or deletes parts
- Add logging to track parts before/after completion

### 2. Verify API Responses
**Priority: HIGH**
- Add console logging in `fetchTaskDetails()` to check if parts are in the response:
  ```javascript
  console.log('Task fetched:', issue);
  console.log('Parts in response:', issue.parts);
  ```

### 3. Add Defensive Checks
**Priority: MEDIUM**
- In `setCurrentIssueState()`, log if parts are missing:
  ```javascript
  if (!issue.parts && issue.parts_count > 0) {
    console.warn('Parts missing from API response but parts_count > 0', issue);
  }
  ```

### 4. Check Session Storage
**Priority: MEDIUM**
- `fetchTaskDetails()` checks `sessionStorage.getItem('selectedTask')`
- If tasks are stored in sessionStorage, parts might be missing there
- Check if sessionStorage is being used and if it includes parts

## Files to Review

### Backend (CRITICAL):
1. **`/cnc_cutting/tasks/warehouse-process/` endpoint** ⚠️ **START HERE - MOST LIKELY CULPRIT**
2. **`/cnc_cutting/tasks/mark-completed/` endpoint**

### Frontend:
3. **`warehouse/weight-reduction/weight-reduction.js`** - `handleWarehouseSubmit()` (line 657-706)
4. **`generic/tasks.js`** - `markAsWareHouseProcessed()` (line 28-38)
5. **`generic/tasks.js`** - `markTaskAsDoneShared()` (line 10-20)
6. **`cnc_cutting/tasks/taskActions.js`** - `handleMarkDoneClick()` (line 158-178)
7. **`cnc_cutting/tasks/taskState.js`** - `setCurrentIssueState()` (line 10-26)

## Next Steps

1. ⚠️ **IMMEDIATE:** Check backend implementation of `POST /cnc_cutting/tasks/warehouse-process/` endpoint
2. ⚠️ **IMMEDIATE:** Check database logs when warehouse-process endpoint is called
3. ✅ Check backend logs when tasks are marked as done (`mark-completed` endpoint)
4. ✅ Add frontend logging to track parts in API responses before/after warehouse processing
5. ✅ Verify if parts are included in task list vs. task detail endpoints
6. ✅ Check if there's a difference between `parts` and `parts_count` fields
7. ✅ Check database for cascade delete relationships on the Parts model
