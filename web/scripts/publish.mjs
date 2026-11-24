#!/usr/bin/env node
// Publishes the React app into the repository itself. GitHub Pages serves main
// as it is (branch deploy, no build step), so the built files are committed:
//   app-assets/  the build (web/dist without source maps), with the manifest's
//                start_url and scope set to <prefix>/ so "add to home screen"
//                during the pilot opens the React app;
//   <prefix>/    the app's entry page at <prefix>/ and at every route under it
//                (beta/machining/tasks/index.html, ...), so deep links and the
//                timer bubble's links load with a 200.
// The legacy pages are never touched.
//
// Built files have hashed names. A phone that opened the app before an update
// still asks for the old files when it opens a page it hasn't loaded yet, so a
// build's files stay for --days after the last build that included them
// (app-assets/published.json records the dates). A rebuild with the same files
// changes nothing, so there is nothing to commit.
//
// .github/workflows/publish-beta.yml runs this on main after a change to web/
// and commits the result. Nothing else writes app-assets/ or the prefix folder.
//
// Usage: node scripts/publish.mjs [--repo <dir>] [--dist <dir>] [--prefix /beta] [--days 14]

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const webDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ASSETS_DIR = 'app-assets';
const RECORD = 'published.json';
const DAY_MS = 24 * 60 * 60 * 1000;

/** The app's routes (src/routes/router.tsx); a test keeps the two lists in step. */
export const APP_ROUTES = [
  '',
  'login',
  'login/reset-password',
  'unauthorized',
  'department-requests',
  'department-requests/create',
  'maintenance',
  'maintenance/faults/task',
  'welding/timesheet',
  'machining',
  'machining/tasks',
  'cnc_cutting',
  'cnc_cutting/tasks',
];

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(abs, base));
    else if (entry.isFile()) files.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return files.sort();
}

function sameSet(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** Writes the app into `repoDir`; returns what changed. */
export function publish({ repoDir, distDir, prefix = '/beta', days = 14, now = new Date() }) {
  const folder = prefix.replace(/^\/+|\/+$/g, '');
  // Without a prefix the pages would replace the legacy ones: that is the cutover, not this.
  if (!folder || folder.includes('/')) throw new Error(`prefix must be one folder, e.g. /beta`);
  const entry = path.join(distDir, 'index.html');
  if (!existsSync(entry))
    throw new Error(`${entry} not found; build the app first (npm run build)`);
  const html = readFileSync(entry, 'utf8');
  if (!html.includes(`/${ASSETS_DIR}/`)) {
    throw new Error(
      `${entry} does not reference /${ASSETS_DIR}/; was it built with base '/${ASSETS_DIR}/'?`,
    );
  }
  if (!existsSync(path.join(repoDir, 'CNAME'))) {
    throw new Error(`${repoDir} has no CNAME; is it the blue-app repository?`);
  }

  const built = walk(distDir).filter((f) => f !== 'index.html' && !f.endsWith('.map'));
  // The branch deploy runs Jekyll, which leaves out names starting with _ or .
  const hidden = built.filter((f) => f.split('/').some((p) => /^[_.]/.test(p)));
  if (hidden.length) throw new Error(`Pages would not publish ${hidden.join(', ')}`);

  const assetsDir = path.join(repoDir, ASSETS_DIR);
  const recordPath = path.join(assetsDir, RECORD);
  const record = existsSync(recordPath)
    ? JSON.parse(readFileSync(recordPath, 'utf8'))
    : { current: [], files: {} };
  const hashed = built.filter((f) => f.startsWith('assets/'));

  // The day each hashed file was last part of a build. Only a different build moves it.
  const today = now.toISOString().slice(0, 10);
  const files = { ...record.files };
  if (!sameSet(hashed, record.current)) {
    for (const file of [...record.current, ...hashed]) files[file] = today;
  }
  let removed = 0;
  for (const [file, day] of Object.entries(files)) {
    if (hashed.includes(file)) continue;
    if (Date.parse(today) - Date.parse(day) > days * DAY_MS) delete files[file];
  }
  // Anything else in app-assets/ is from an earlier build and no longer needed.
  for (const file of walk(assetsDir)) {
    if (file === RECORD || built.includes(file) || file in files) continue;
    rmSync(path.join(assetsDir, file));
    removed += 1;
  }
  for (const file of built) {
    mkdirSync(path.dirname(path.join(assetsDir, file)), { recursive: true });
    copyFileSync(path.join(distDir, file), path.join(assetsDir, file));
  }
  const manifestPath = path.join(assetsDir, 'manifest.webmanifest');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.start_url = `/${folder}/`;
    manifest.scope = `/${folder}/`;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(recordPath, `${JSON.stringify({ current: hashed, files: sorted }, null, 2)}\n`);

  // The entry page at every route; the folder holds only these pages.
  const pagesDir = path.join(repoDir, folder);
  const foreign = walk(pagesDir).filter((f) => !f.endsWith('index.html'));
  if (foreign.length) throw new Error(`${folder}/ has files this script did not write: ${foreign}`);
  rmSync(pagesDir, { recursive: true, force: true });
  const pages = [];
  for (const route of APP_ROUTES) {
    const rel = [folder, route, 'index.html'].filter(Boolean).join('/');
    const dest = path.join(repoDir, ...rel.split('/'));
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, html);
    pages.push(rel);
  }
  return { files: built.length, kept: Object.keys(files).length - hashed.length, removed, pages };
}

function main() {
  const { values: args } = parseArgs({
    options: {
      repo: { type: 'string' },
      dist: { type: 'string' },
      prefix: { type: 'string', default: '/beta' },
      days: { type: 'string', default: '14' },
    },
  });
  const result = publish({
    repoDir: path.resolve(args.repo ?? path.join(webDir, '..')),
    distDir: path.resolve(args.dist ?? path.join(webDir, 'dist')),
    prefix: args.prefix,
    days: Number(args.days),
  });
  console.log(
    `publish: ${result.files} files in /${ASSETS_DIR}/, ${result.kept} kept from earlier builds, ` +
      `${result.removed} removed, ${result.pages.length} pages under /${result.pages[0].split('/')[0]}/`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`publish: ${error.message}`);
    process.exit(1);
  }
}
