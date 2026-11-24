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
- [ ] Elapsed time ticks every second against server time (GET `/now/` offset, re-synced every 5 minutes while timers run; the legacy 30 s check skipped the sync until 5 minutes had passed).
- [ ] Labels: the CNC kesim kodu (`nesting_id`), the downtime reason for break and downtime timers, `ARIZA-<fault>` for fault timers, else the task key.
- [ ] No per-timer stop button: it was commented out in the legacy widget ("for future use").
- [ ] Tap → the timer's task page; fault timers → `/maintenance/faults/task/?fault_id=`.
- [ ] "New" button → CNC or machining by permission.
- [ ] (Moved to the task pages, see Machining and CNC.)
- [ ] Reloads when a page reports a timer change (legacy `timerUpdated` event → `timersChanged(queryClient)`).
- [ ] The legacy widget opened its panel by itself when a timer appeared; the bubble shows the count instead of covering the page.
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
- [ ] Stop productive → reason sheet with **every active reason** (not only `creates_timer`: "Parça İşlemesi Tamamlandı" `WORK_COMPLETE` completes the operation, "Mesai Sonu" `END_SHIFT`, "Acil İş Geçişi"; `WORK_COMPLETE` in green); comment optional for WORK_COMPLETE, END_SHIFT, LUNCH and BREAK → POST `/tasks/log-reason/` `{current_timer_id, reason_id, comment?}` → back to `/machining/`.
- [ ] Stop non-productive → POST `/machining/timers/stop/` `{timer_id, finish_time (server time), synced_to_jira: true}`; "Durdurulamaz" with the legacy explanation when `can_be_stopped_by_user === false`.
- [ ] Back while a timer runs asks for confirmation (any in-app navigation).
- [ ] A machine busy with another task shows "Makine kullanımda" instead of offering Başlat (the legacy page offered it, then alerted "Zamanlayıcı bilgisi bulunamadı").
- [ ] After stopping with a reason, the list opens with the same machine selected (legacy: the list with no machine).

## CNC (`cnc_cutting/`, `cnc_cutting/tasks/`)

- [ ] Aktif: machines from GET `/machines/?used_in=cutting&is_active=true&page_size=1000` (busy / maintenance disabled), `?machine_id` pushed; tasks GET `/cnc_cutting/tasks/?machine_fk=&completion_date__isnull=true&in_plan=true&ordering=plan_order&page_size=10` as cards titled by the kesim kodu; client-side search on key or name.
- [ ] "Diğer İşler" → hold-task picker: GET `/cnc_cutting/hold-tasks/` → `tasks/?machine_id&key&name&hold=1`. Now always shown once a machine is picked (the legacy list hid it on a machine with no planned cut).
- [ ] Biten: like machining, on `/cnc_cutting/timers/`.
- [ ] Görev Genel Bakış: GET `/cnc_cutting/tasks/?completion_date__isnull=true&page_size=1000`, grouped Rezerv (not in plan) / Yapılacaklar (Planlı, no machine) / each machine in order, by plan order (collapsible sections on the phone); details from GET `/cnc_cutting/tasks/{key}/`: info, files (open in the phone's viewer), parts with the total weight.
- [ ] Sac Stoğu (replaced Fire Saclar in the legacy app): GET `/warehouse/pieces/groups/?kind=plate&page&page_size=50&search` (350 ms debounce; a page past the end falls back to page 1); groups by card and size with thickness, weight, sheet count and what is set aside; sheets with code (or Kodsuz), quantity, size when it differs, heat number, place (warehouse / Fason / İş Emri), free or reserved-for-cut / pull-request badges, origin; a searched sheet code is highlighted.
- [ ] Task screen loads GET `/machines/{id}/` and GET `/cnc_cutting/tasks/{key}/` (or, with `?hold=1`, a task built from the URL: key, name), and the active timer GET `/cnc_cutting/timers/?is_active=true&machine_fk=&issue_key=`; a cut that can't be loaded goes back to the list.
- [ ] Details: Nesting ID, material, dimensions, thickness, parts (count · total kg · job orders, tap → parts and files sheet), files, estimated time; the waiting-sheets warning ("N sac bekleniyor") and, on the W-07 hold task while running, the "stopped when maintenance resolves it" note.
- [ ] Start: POST `/cnc_cutting/timers/start/` `{issue_key, start_time (server time), machine_fk, comment?}`, the server's error message shown; "Sac bekleniyor" while `sheets_waiting > 0`; hold tasks other than W-14 and W-02 ask for a comment first ("Bekletme Görevi Başlatma").
- [ ] Stop: POST `/cnc_cutting/timers/stop/` `{timer_id, finish_time, synced_to_jira: true}`. The legacy page sent the phone's clock as finish_time; it is now server time, like the start.
- [ ] "Makine bakımda" / "Makine kullanımda" (another cut runs; the legacy button did nothing then).
- [ ] Manual time: datetime-local start and end (defaults now and +1 h), duration preview, end after start, a comment for hold tasks (except W-14/W-02) → POST `/cnc_cutting/manual-time/`.
- [ ] Tamamla (not for hold tasks; refused while sheets wait): "{nesting} tamamen kesildi, markalandı ve makineden kaldırıldı mı?" → remnant rows (shape rectangle / triangle / circle / irregular with their fields, quantity; the short side under 500 mm is fire, with the hint) or none → POST `/cnc_cutting/tasks/mark-completed/` `{key, remnants, no_remnant}` → the booked remnant codes (Yazdır opens the A4 print page; "Kodları yazdım") → the list.
- [ ] Arıza: "Makine çalışır durumda mı?" Evet → "Arıza Bildirimi" → POST `/machines/faults/` `{machine, description, is_breaking: false}`; Hayır → "Bekletme sayfasına yönlendirileceksiniz" → the hold task `?machine_id=7&key=W-07&name=Makine Arızası Nedeniyle Bekleme&hold=1`.
- [ ] Back while a timer runs asks for confirmation.

## Welding timesheet (`welding/timesheet/`)

- [ ] No timer bubble on this page.
- [ ] Day data: GET `/welding/timesheets/mobile/day/[?date=]` (allowed dates, cells, suggested jobs, submission, rejection and lock state).
- [ ] Date chips; switching with unsaved changes asks first.
- [ ] "Bugün çalışmadım" (blank day).
- [ ] Add jobs from suggestions or search: GET `/welding/timesheets/mobile/jobs/?q=` (at least 2 characters, 300 ms debounce).
- [ ] Hour grid per job: taking an hour another job has moves it; Gündüz, Akşam and Clear quick buttons; remove a job.
- [ ] Note, at most 200 characters.
- [ ] Submit / resubmit: POST `/welding/timesheets/mobile/submit/` `{date, blank_day, rows: [{job_no, cells}], note}`.
- [ ] Approved (read-only), rejected and pending banners; a day-kind banner for non-weekdays; toasts. The button reads GÖNDER / TEKRAR GÖNDER (sent, unchanged) / ONAYLANDI (locked) and is disabled until hours are marked or the day is blank.

## Maintenance (`maintenance/`, `maintenance/faults/task/`)

- [ ] Tabs by `?tab=`: `create-request` (default), `fault-requests`, `resolved-requests`; the URL is replaced, not pushed. The open-requests tab needs `access_maintenance_list` (as its URL always did) and is hidden from users without it; the legacy page showed it and refused them on reload.
- [ ] Create: machine picker with search (name, code, type, assigned users) from GET `/machines/?compact=true&exclude_used_in=it&page_size=1000`, or custom equipment (asset name and location, after its warning); maintenance or fault; "is operable" for faults; description → POST `/machines/faults/` `{is_maintenance, description, is_breaking, machine | asset_name + location}`. Afterwards the legacy page went to the home page (`../index.html`); it now opens the open requests (or home without the list permission).
- [ ] Open faults: GET `/machines/faults/?unresolved=true&page_size=1000`, search by machine or description on the phone; "Makine duruşta" for breaking faults; tap → `/maintenance/faults/task/?fault_id=`.
- [ ] Resolved: GET `/machines/faults/?unresolved=false&page_size=1000`, search also in the resolution; read-only.
- [ ] Fault task loads GET `/machines/faults/{id}/` and GET `/machines/faults/timers/?issue_key={id}`.
- [ ] Start: POST `/machines/faults/timers/start/` `{task_key, task_type: 'machine_fault', start_time, machine_fk}`; stop: POST `/machines/faults/timers/stop/`.
- [ ] Complete with a required resolution: POST `/machines/faults/{id}/complete/`.
- [ ] Back while a timer runs asks for confirmation (now any in-app navigation: the back arrow, the bottom bar, the phone's back gesture).
- [ ] A fault that can't be loaded shows an error and goes back to the open requests.

## Department requests (`department-requests/`, `department-requests/create/`)

- [ ] My requests: GET `/planning/department-requests/my_requests/`; read-only cards; a create link.
  - The legacy status filter never worked: the backend's `my_requests` ignores filters, so every request showed whatever was picked. The status filter now works on the phone and defaults to "Tümü", which shows what operators saw before.
  - New: "Daha fazla" loads the next page (the legacy page showed only the first).
- [ ] Create: title, needed date (default today), description, priority (default normal), request type (730.06.004, 730.06.005, 730.10.004), item cards (name, quantity, unit: adet, kg, metre, litre, paket, kutu; spec), add and remove items → POST `/planning/department-requests/` with each item's `name` = the type's account name, `item_code`, `item_description` = the item name, `item_specifications` = its description. Problems show inline instead of `alert()`.

## Everywhere

- [ ] A request that never reached the server (shop-floor Wi-Fi) shows "Sunucuya ulaşılamadı…" in Turkish; the legacy pages showed the browser's English "Failed to fetch".

## Not ported (dead in the legacy app)

- `components/machineTaskView.js`, `cnc_cutting/remnantEntry.js`, `machining/operationsService.js`, `cnc_cuttingService.js`, the test and example files under `components/`.
- The mark-done and fault-report code on the machining task page that no button reaches.
- `jiraBase` and `proxyBase` in `base.js`; the never-set `sessionStorage.selectedTask`.
- The `/maintenance/create/` and `/maintenance/list/` route stubs (they are tabs of `/maintenance/`).
