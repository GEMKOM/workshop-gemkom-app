# Parity checklist: legacy blue app → React

Every item must work in the React app before the cutover (Phase 4). Tick it once it has a test (Vitest + MSW, checking the endpoint and body) **and** has been tried on a real phone in the pilot.

URLs and query parameters stay the same, so bookmarks, the timer bubble's links and the office login's redirect to saha keep working: `machine_id`, `key`, `timer_id`, `hold`, `name`, `fault_id`, `tab`, `date`.

**Out of scope:** the warehouse section (`warehouse/`, inventory-allocation, material-tracking, transfer-requests, weight-reduction, accounting-export). It is discontinued; the office app covers it.

## Auth and session (`authService.js`, `login/`)

- [ ] Same localStorage keys: `access`, `refresh`, `user`, `permissions`, `permissions_refreshed_at`; `accessToken`/`refreshToken` read as a fallback and removed when tokens are set. A user signed in on the legacy app stays signed in on the React app.
- [ ] Sign in: POST `/token/` → GET `/users/me/` → GET `/users/me/permissions/`.
- [ ] No `workshop_access` → storage cleared, "no workshop access" error shown.
- [ ] `must_reset_password` → `/login/reset-password/`; reset: POST `/users/reset-password/`, then GET `/users/me/`, then home.
- [ ] Forgot password: POST `/users/forgot-password/request/` `{username}`.
- [ ] Show-password toggle.
- [ ] The separate "Admin Girişi" form called the same login; one form serves both.
- [ ] Requests: `Authorization: Bearer`, no `X-Subdomain` header.
- [ ] On a 401: reuse a newer token from another tab, else a single shared POST `/token/refresh/`; keep the rotated refresh token; log out only on a 400/401 from the refresh (not on network errors or 5xx).
- [ ] Admins (`is_superuser` or `is_admin`) pass every permission check.
- [ ] Route guard order: not logged in → `/login/`; must reset → reset page; logged in on login/reset → `/`; missing route permission → force-refresh permissions, then retry or `/unauthorized/`.
- [ ] Background permission refresh at most once a minute; re-render if permissions changed.
- [ ] New: an `/unauthorized/` screen (today a refused user lands on a 404).

Route permissions (`getRoutePermissionCodename`):

| Route                                         | Permission                          |
| --------------------------------------------- | ----------------------------------- |
| `/cnc_cutting/`                               | `access_cnc_cutting`                |
| `/cnc_cutting/tasks/`                         | `access_cnc_cutting_tasks`          |
| `/department-requests/`                       | `access_department_requests`        |
| `/department-requests/create/`                | `access_department_requests_create` |
| `/machining/`                                 | `access_machining`                  |
| `/machining/tasks/`                           | `access_machining_tasks`            |
| `/maintenance/`                               | `access_maintenance`                |
| `/maintenance/?tab=fault-requests`            | `access_maintenance_list`           |
| `/welding/timesheet/`                         | `access_welding_timesheet`          |
| `/maintenance/faults/task/`, `/`, login pages | none                                |

## Shell (`components/navbar.js`, `main.js`)

- [ ] Home cards by permission: Welding (`access_welding_timesheet`), Machining (`access_machining`), CNC (`access_cnc_cutting`), Maintenance (`access_maintenance`, with "create request" and "fault requests" shortcuts).
- [ ] Navigation: Home plus the areas the user can open. The legacy navbar always showed Maintenance and Department Requests, which led a user without the permission to a refused page; the bottom bar shows them by their route permission, like the others.
- [ ] Profile edit: first name, last name, email → PUT `/users/me/`, then GET `/users/me/`.
- [ ] Logout clears the session and goes to `/login/`.

## Timer bubble (`components/timerWidget.js`, `timerWidgetInit.js`)

- [ ] Shown on every page except login and welding, only with `access_machining`, `access_cnc_cutting` or `access_maintenance`.
- [ ] Active timers from GET `/machining/timers/?is_active=true`, `/cnc_cutting/timers/?is_active=true` and `/machines/faults/timers/`, loaded in parallel, de-duplicated by id.
- [ ] Elapsed time ticks every second against server time (GET `/now/` offset, re-synced every 30 s).
- [ ] Per-timer stop: POST `/{machining|cnc_cutting}/timers/stop/`.
- [ ] Tap → the timer's task page; fault timers → `/maintenance/faults/task/?fault_id=`.
- [ ] "New" button → CNC or machining by permission.
- [ ] A task page whose timer was stopped elsewhere goes back to its list (legacy polls every 15 minutes).
- [ ] Reloads when a page reports a timer change (legacy `timerUpdated` event).
- [ ] New: draggable and tappable by touch.
- [ ] New: on wake (`visibilitychange`/`pageshow`), reload active timers and re-sync the clock.

## Machining (`machining/`, `machining/tasks/`)

- [ ] Aktif: machine picker from GET `/machines/dropdown/?used_in=machining&include_availability=true`; busy and under-maintenance machines disabled; `?machine_id` in the URL, back/forward work.
- [ ] Operations: GET `/tasks/operations/?machine_fk=&completion_date__isnull=true&in_plan=true[&search=]`; debounced server search; stale responses dropped.
- [ ] "Durma Nedeni Kaydet": reasons from GET `/tasks/downtime-reasons/` (only `creates_timer`); comment required except LUNCH and BREAK; POST `/tasks/log-reason/` `{reason_id, machine_id, comment?}`; with `new_timer_id` → `/machining/tasks/?machine_id=&timer_id=` (`&key=` for productive timers).
- [ ] Tap an operation → `/machining/tasks/?machine_id=&key=`.
- [ ] Biten: GET `/machining/timers/?is_active=false&ordering=-finish_time&page=&page_size=20&start_date=&end_date=`, default last 30 days, paged.
- [ ] Task screen loads GET `/machines/{id}/`, GET `/machining/timers/?is_active=true&machine_fk=[&issue_key=]`, GET `/tasks/operations/{key}/`.
- [ ] Start: sync time (GET `/now/`), then POST `/tasks/operations/{key}/start-timer/`; blocked when the machine is under maintenance or on a timer-only page.
- [ ] Stop productive → reason sheet → POST `/tasks/log-reason/` `{current_timer_id, reason_id, comment?}` → back to `/machining/`.
- [ ] Stop non-productive → POST `/machining/timers/stop/` with `finish_time` from server time; not offered when `can_be_stopped_by_user === false`.
- [ ] Back while a timer runs asks for confirmation.

## CNC (`cnc_cutting/`, `cnc_cutting/tasks/`)

- [ ] Aktif: machines from GET `/machines/?used_in=cutting&is_active=true&page_size=1000`; tasks GET `/cnc_cutting/tasks/?machine_fk=&completion_date__isnull=true&in_plan=true&ordering=plan_order&page_size=10`; client-side "TI numarası" search.
- [ ] Hold-task picker: GET `/cnc_cutting/hold-tasks/` → `tasks/?machine_id&key&name&hold=1`.
- [ ] Biten: like machining, on `/cnc_cutting/timers/`.
- [ ] Görev Genel Bakış: GET `/cnc_cutting/tasks/?completion_date__isnull=true&page_size=1000`, grouped by machine / no machine in plan / no machine not in plan; detail from GET `/cnc_cutting/tasks/{key}/` with files (viewer for images and PDFs).
- [ ] Fire Saclar: GET `/cnc_cutting/remnants/?material=&thickness_mm=&dimensions=`, collapsible filters.
- [ ] Task screen loads GET `/machines/{id}/` and GET `/cnc_cutting/tasks/{key}/` (or, with `?hold=1`, a task built from the URL), and the active timer GET `/cnc_cutting/timers/?is_active=true&machine_fk=&issue_key=`.
- [ ] Info cards: parts and files.
- [ ] Start: POST `/cnc_cutting/timers/start/`, the server's error message shown; blocked while `sheets_waiting > 0`; hold tasks other than W-14 and W-02 ask for a comment first.
- [ ] Stop: POST `/cnc_cutting/timers/stop/`.
- [ ] Manual time: POST `/cnc_cutting/manual-time/`.
- [ ] Tamamla (not for hold tasks): confirm → remnant rows (width, length mm, quantity; a side under 500 mm is fire) or "no remnant" → POST `/cnc_cutting/tasks/mark-completed/` `{key, remnants, no_remnant}` → show the booked remnant codes with Print.
- [ ] Arıza: "is the machine stopped?" Yes → description → POST `/machines/faults/`; No → the hold task `?machine_id=7&key=W-07&hold=1`.
- [ ] Maintenance check via GET `/machines/{id}/`.

## Welding timesheet (`welding/timesheet/`)

- [ ] No timer bubble on this page.
- [ ] Day data: GET `/welding/timesheets/mobile/day/[?date=]` (allowed dates, cells, suggested jobs, submission, rejection and lock state).
- [ ] Date chips; switching with unsaved changes asks first.
- [ ] "Bugün çalışmadım" (blank day).
- [ ] Add jobs from suggestions or search: GET `/welding/timesheets/mobile/jobs/?q=` (at least 2 characters, 300 ms debounce).
- [ ] Hour grid per job: taking an hour another job has moves it; Gündüz, Akşam and Clear quick buttons; remove a job.
- [ ] Note, at most 200 characters.
- [ ] Submit / resubmit: POST `/welding/timesheets/mobile/submit/` `{date, blank_day, rows: [{job_no, cells}], note}`.
- [ ] Approved (read-only), rejected and pending banners; toasts.

## Maintenance (`maintenance/`, `maintenance/faults/task/`)

- [ ] Tabs by `?tab=`: `create-request` (default), `fault-requests`, `resolved-requests`; the URL is replaced, not pushed.
- [ ] Create: machine picker with search from GET `/machines/?compact=true&exclude_used_in=it&page_size=1000`, or custom equipment (asset name and location, with its warning); maintenance or fault; "is operable" for faults; description → POST `/machines/faults/` `{is_maintenance, description, is_breaking, machine | asset_name + location}`.
- [ ] Open faults: GET `/machines/faults/?unresolved=true`; tap → `/maintenance/faults/task/?fault_id=`.
- [ ] Resolved: GET `/machines/faults/?unresolved=false`.
- [ ] Fault task loads GET `/machines/faults/{id}/` and GET `/machines/faults/timers/?issue_key={id}`.
- [ ] Start: POST `/machines/faults/timers/start/` `{task_key, task_type: 'machine_fault', start_time, machine_fk}`; stop: POST `/machines/faults/timers/stop/`.
- [ ] Complete with a required resolution: POST `/machines/faults/{id}/complete/`.
- [ ] Back while a timer runs asks for confirmation.

## Department requests (`department-requests/`, `department-requests/create/`)

- [ ] My requests: GET `/planning/department-requests/my_requests/?status=`, status filter defaulting to `submitted`; read-only cards; a create link.
- [ ] Create: title, needed date, description, priority (default normal), request type (730.06.004, 730.06.005, 730.10.004), item cards (name, quantity, unit: adet, kg, metre, litre, paket, kutu; spec), add and remove items → POST `/planning/department-requests/`.

## Not ported (dead in the legacy app)

- `components/machineTaskView.js`, `cnc_cutting/remnantEntry.js`, `machining/operationsService.js`, `cnc_cuttingService.js`, the test and example files under `components/`.
- The mark-done and fault-report code on the machining task page that no button reaches.
- `jiraBase` and `proxyBase` in `base.js`; the never-set `sessionStorage.selectedTask`.
- The `/maintenance/create/` and `/maintenance/list/` route stubs (they are tabs of `/maintenance/`).
