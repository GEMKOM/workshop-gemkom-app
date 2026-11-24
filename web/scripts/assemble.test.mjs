// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { APP_ROUTES, assemble } from './assemble.mjs';

const dirs = [];
const read = (...parts) => readFileSync(path.join(...parts), 'utf8');
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'saha-assemble-'));
  dirs.push(root);
  const siteDir = path.join(root, '_site');
  const distDir = path.join(root, 'dist');
  mkdirSync(path.join(siteDir, 'machining'), { recursive: true });
  writeFileSync(path.join(siteDir, 'CNAME'), 'saha.gemcore.com.tr');
  writeFileSync(path.join(siteDir, 'machining', 'index.html'), 'legacy machining');
  mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  writeFileSync(
    path.join(distDir, 'index.html'),
    '<script src="/app-assets/assets/index-AAAAAAAA.js"></script>',
  );
  writeFileSync(path.join(distDir, 'assets', 'index-AAAAAAAA.js'), 'app');
  writeFileSync(
    path.join(distDir, 'manifest.webmanifest'),
    JSON.stringify({ name: 'GEMKOM Saha', start_url: '/', scope: '/' }),
  );
  return { siteDir, distDir };
}

it('adds the app under /beta/ next to the untouched legacy pages', () => {
  const { siteDir, distDir } = setup();
  const result = assemble({ siteDir, distDir, prefix: '/beta' });
  expect(readFileSync(path.join(siteDir, 'machining', 'index.html'), 'utf8')).toBe(
    'legacy machining',
  );
  expect(
    readFileSync(path.join(siteDir, 'beta', 'machining', 'tasks', 'index.html'), 'utf8'),
  ).toContain('/app-assets/assets/index-AAAAAAAA.js');
  expect(existsSync(path.join(siteDir, 'beta', 'index.html'))).toBe(true);
  expect(existsSync(path.join(siteDir, 'app-assets', 'assets', 'index-AAAAAAAA.js'))).toBe(true);
  expect(existsSync(path.join(siteDir, 'app-assets', 'index.html'))).toBe(false);
  const manifest = JSON.parse(
    readFileSync(path.join(siteDir, 'app-assets', 'manifest.webmanifest'), 'utf8'),
  );
  expect(manifest).toMatchObject({ start_url: '/beta/', scope: '/beta/' });
  expect(result.pages).toHaveLength(APP_ROUTES.length);
});

it('serves the app at the legacy routes when live, keeping the other legacy files', () => {
  const { siteDir, distDir } = setup();
  writeFileSync(path.join(siteDir, 'machining', 'machining.js'), 'legacy script');
  writeFileSync(path.join(siteDir, 'authService.js'), 'legacy auth');
  const result = assemble({ siteDir, distDir });
  expect(read(siteDir, 'machining', 'index.html')).toContain(
    '/app-assets/assets/index-AAAAAAAA.js',
  );
  expect(read(siteDir, 'index.html')).toContain('/app-assets/');
  expect(read(siteDir, '404.html')).toContain('/app-assets/');
  expect(read(siteDir, 'machining', 'machining.js')).toBe('legacy script');
  expect(read(siteDir, 'authService.js')).toBe('legacy auth');
  expect(existsSync(path.join(siteDir, 'beta'))).toBe(false);
  expect(JSON.parse(read(siteDir, 'app-assets', 'manifest.webmanifest'))).toMatchObject({
    start_url: '/',
    scope: '/',
  });
  expect(result.pages).toHaveLength(APP_ROUTES.length + 1);
});

it('refuses a build that was not made for /app-assets/', () => {
  const { siteDir, distDir } = setup();
  writeFileSync(path.join(distDir, 'index.html'), '<script src="/assets/index.js"></script>');
  expect(() => assemble({ siteDir, distDir })).toThrow(/app-assets/);
});

it('lists every route of the router', () => {
  const router = readFileSync(
    fileURLToPath(new URL('../src/routes/router.tsx', import.meta.url)),
    'utf8',
  );
  const paths = [...router.matchAll(/path: '([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*');
  expect([...APP_ROUTES].filter(Boolean).sort()).toEqual(paths.sort());
});
