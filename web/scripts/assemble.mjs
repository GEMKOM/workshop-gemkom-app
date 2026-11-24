#!/usr/bin/env node
// Adds the React app to the site folder (deploy.yml puts the CNAME in first):
//   - web/dist (the build, hashed file names) under /app-assets/,
//   - the app's entry page at <prefix>/ and at every route under it
//     (<prefix>/machining/index.html, ...), so deep links and the timer
//     bubble's links load the app with a 200,
//   - the manifest's start_url and scope set to <prefix>/, so "add to home
//     screen" opens the React app.
// Without a prefix (live) 404.html is the app too, so a mistyped address shows
// the app's "not found" page. A prefix (used for the /beta/ pilot) never
// overwrites a page that is already in the folder.
//
// Usage: node scripts/assemble.mjs [--site <dir>] [--dist <dir>] [--prefix /beta]
//   --site    the assembled site (default <repo>/_site)
//   --dist    the React build (default web/dist)
//   --prefix  where the app's pages live (default: the root)

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const webDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ASSETS_DIR = 'app-assets';

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
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(abs, base));
    else if (entry.isFile()) files.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return files;
}

function copy(src, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

/** Adds the app to `siteDir`; returns what it wrote. */
export function assemble({ siteDir, distDir, prefix = '' }) {
  const cleanPrefix = prefix.replace(/\/+$/, '');
  const entry = path.join(distDir, 'index.html');
  if (!existsSync(entry))
    throw new Error(`${entry} not found; build the app first (npm run build)`);
  const html = readFileSync(entry, 'utf8');
  if (!html.includes(`/${ASSETS_DIR}/`)) {
    throw new Error(
      `${entry} does not reference /${ASSETS_DIR}/; was it built with base '/${ASSETS_DIR}/'?`,
    );
  }
  if (!existsSync(path.join(siteDir, 'CNAME'))) {
    throw new Error(`${siteDir} has no CNAME; copy the CNAME into it first`);
  }
  if (existsSync(path.join(siteDir, ASSETS_DIR))) {
    // Only keep-old-assets may add to it, after this step.
    throw new Error(`${siteDir}/${ASSETS_DIR} already exists`);
  }

  // 1. The build's files under /app-assets/.
  let assets = 0;
  for (const file of walk(distDir)) {
    if (file === 'index.html') continue;
    copy(path.join(distDir, file), path.join(siteDir, ASSETS_DIR, file));
    assets += 1;
  }

  // 2. The manifest opens the app where its pages are.
  const manifestPath = path.join(siteDir, ASSETS_DIR, 'manifest.webmanifest');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.start_url = `${cleanPrefix}/`;
    manifest.scope = `${cleanPrefix}/`;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  // 3. The entry page at every route. Never over a legacy page.
  const pages = [];
  for (const route of APP_ROUTES) {
    const rel = [cleanPrefix.replace(/^\//, ''), route, 'index.html'].filter(Boolean).join('/');
    const dest = path.join(siteDir, ...rel.split('/'));
    if (existsSync(dest) && cleanPrefix) throw new Error(`${rel} would overwrite an existing page`);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, html);
    pages.push(rel);
  }
  if (!cleanPrefix) {
    writeFileSync(path.join(siteDir, '404.html'), html);
    pages.push('404.html');
  }
  return { assets, pages };
}

function main() {
  const { values: args } = parseArgs({
    options: {
      site: { type: 'string' },
      dist: { type: 'string' },
      prefix: { type: 'string', default: '' },
    },
  });
  const result = assemble({
    siteDir: path.resolve(args.site ?? path.join(webDir, '..', '_site')),
    distDir: path.resolve(args.dist ?? path.join(webDir, 'dist')),
    prefix: args.prefix,
  });
  console.log(`assemble: ${result.assets} files in /${ASSETS_DIR}/, ${result.pages.length} pages:`);
  for (const page of result.pages) console.log(`  /${page.replace(/index\.html$/, '')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`assemble: ${error.message}`);
    process.exit(1);
  }
}
