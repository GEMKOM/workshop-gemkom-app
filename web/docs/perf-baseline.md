# Performance baseline: the legacy blue app

Measured on 2026-11-24 against the live site (saha.gemcore.com.tr, commit 9510584), before any React code. The React app is compared against these numbers in the beta (Phase 3).

## What a phone downloads per page load

Every navigation is a full page load. For each page this counts the HTML, every script and stylesheet, the ES modules they import (followed recursively) and the Font Awesome webfonts. Sizes are raw and gzip (what the network carries). The site's own files are served with `Cache-Control: max-age=600`, so after 10 minutes the browser revalidates each one again.

| Page                         | Requests | Own JS modules | Total (gzip) | Own files (gzip) | CDN (gzip) |
| ---------------------------- | -------: | -------------: | -----------: | ---------------: | ---------: |
| /login/                      |       13 |              3 |       371 KB |            15 KB |     356 KB |
| /                            |       25 |             13 |       387 KB |            31 KB |     356 KB |
| /machining/                  |       42 |             23 |       420 KB |            64 KB |     356 KB |
| /machining/tasks/            |       35 |             21 |       412 KB |            56 KB |     356 KB |
| /cnc_cutting/                |       47 |             28 |       436 KB |            80 KB |     356 KB |
| /cnc_cutting/tasks/          |       38 |             23 |       424 KB |            69 KB |     356 KB |
| /welding/timesheet/          |       17 |              6 |       375 KB |            19 KB |     356 KB |
| /maintenance/                |       41 |             21 |       424 KB |            68 KB |     356 KB |
| /maintenance/faults/task/    |       27 |             13 |       397 KB |            41 KB |     356 KB |
| /department-requests/        |       32 |             16 |       400 KB |            44 KB |     356 KB |
| /department-requests/create/ |       32 |             16 |       402 KB |            46 KB |     356 KB |

- The CDN share is Bootstrap 5.3.0 (CSS + JS bundle) and the full Font Awesome 6.4.0 (CSS + webfonts). It is the same on every page.
- `/machining/tasks/` and `/maintenance/faults/task/` also request `/pre-auth.css`, which does not exist (404).
- Own JS is unbundled ES modules: up to 28 separate requests on /cnc_cutting/, loaded as a waterfall of imports.

## Lighthouse (mobile, simulated slow 4G)

Only the login page can be measured without signing in.

| Page    | Performance | First Contentful Paint | Largest Contentful Paint | Total Blocking Time | Speed Index |
| ------- | ----------: | ---------------------: | -----------------------: | ------------------: | ----------: |
| /login/ |          71 |                  4.4 s |                    4.9 s |                0 ms |       4.4 s |

## Targets for the React app

- Initial JS ≤ 200 KB gzip, downloaded once: pages after the first load only fetch their own small chunk, and the libraries stay cached across deploys (hashed file names, separate react / mantine / vendor chunks). The first estimate of 150 KB was below what React, React Router and Mantine cost together; the foundation (2026-11-24) is 196 KB JS + 38 KB CSS gzip, against 370–436 KB on every legacy page load.
- Lighthouse mobile performance ≥ 90 on /login/ and, measured in the pilot, on the main pages.
- No CDN round trips, and no full page reload when moving between pages.
