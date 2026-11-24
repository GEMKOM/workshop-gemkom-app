// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { APP_ROUTES, publish } from './publish.mjs';

const dirs = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'saha-publish-'));
  dirs.push(root);
  const repoDir = path.join(root, 'repo');
  mkdirSync(path.join(repoDir, 'machining'), { recursive: true });
  writeFileSync(path.join(repoDir, 'CNAME'), 'saha.gemcore.com.tr');
  writeFileSync(path.join(repoDir, 'machining', 'index.html'), 'legacy machining');
  return { root, repoDir };
}

function build(root, name, hash) {
  const distDir = path.join(root, name);
  mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  writeFileSync(
    path.join(distDir, 'index.html'),
    `<script src="/app-assets/assets/index-${hash}.js"></script>`,
  );
  writeFileSync(path.join(distDir, 'assets', `index-${hash}.js`), hash);
  writeFileSync(path.join(distDir, 'assets', `index-${hash}.js.map`), '{}');
  writeFileSync(
    path.join(distDir, 'manifest.webmanifest'),
    JSON.stringify({ name: 'GEMKOM Saha', start_url: '/', scope: '/' }),
  );
  return distDir;
}

const read = (...parts) => readFileSync(path.join(...parts), 'utf8');
const day = (iso) => new Date(`${iso}T12:00:00Z`);

it('adds the app under /beta/ next to the untouched legacy pages', () => {
  const { root, repoDir } = setup();
  const result = publish({ repoDir, distDir: build(root, 'dist', 'AAAA'), now: day('2026-11-24') });
  expect(read(repoDir, 'machining', 'index.html')).toBe('legacy machining');
  expect(read(repoDir, 'beta', 'machining', 'tasks', 'index.html')).toContain('index-AAAA.js');
  expect(existsSync(path.join(repoDir, 'beta', 'index.html'))).toBe(true);
  expect(existsSync(path.join(repoDir, 'app-assets', 'assets', 'index-AAAA.js'))).toBe(true);
  expect(existsSync(path.join(repoDir, 'app-assets', 'assets', 'index-AAAA.js.map'))).toBe(false);
  expect(existsSync(path.join(repoDir, 'app-assets', 'index.html'))).toBe(false);
  expect(JSON.parse(read(repoDir, 'app-assets', 'manifest.webmanifest'))).toMatchObject({
    start_url: '/beta/',
    scope: '/beta/',
  });
  expect(result.pages).toHaveLength(APP_ROUTES.length);
});

it('changes nothing when the build is the same', () => {
  const { root, repoDir } = setup();
  const distDir = build(root, 'dist', 'AAAA');
  publish({ repoDir, distDir, now: day('2026-11-24') });
  const before = read(repoDir, 'app-assets', 'published.json');
  publish({ repoDir, distDir, now: day('2026-11-30') });
  expect(read(repoDir, 'app-assets', 'published.json')).toBe(before);
});

it('keeps an earlier build for the given days, then removes it', () => {
  const { root, repoDir } = setup();
  const asset = (hash) => path.join(repoDir, 'app-assets', 'assets', `index-${hash}.js`);
  publish({ repoDir, distDir: build(root, 'one', 'AAAA'), now: day('2026-11-01') });
  publish({ repoDir, distDir: build(root, 'two', 'BBBB'), now: day('2026-11-10') });
  expect(existsSync(asset('AAAA'))).toBe(true);
  expect(read(repoDir, 'beta', 'index.html')).toContain('index-BBBB.js');

  // Same build, 14 days after AAAA was last current: still kept.
  publish({ repoDir, distDir: build(root, 'two', 'BBBB'), now: day('2026-11-24') });
  expect(existsSync(asset('AAAA'))).toBe(true);
  publish({ repoDir, distDir: build(root, 'two', 'BBBB'), now: day('2026-11-25') });
  expect(existsSync(asset('AAAA'))).toBe(false);
  expect(existsSync(asset('BBBB'))).toBe(true);
});

it('refuses a build that was not made for /app-assets/', () => {
  const { root, repoDir } = setup();
  const distDir = build(root, 'dist', 'AAAA');
  writeFileSync(path.join(distDir, 'index.html'), '<script src="/assets/index.js"></script>');
  expect(() => publish({ repoDir, distDir })).toThrow(/app-assets/);
});

it('refuses files the branch deploy would leave out', () => {
  const { root, repoDir } = setup();
  const distDir = build(root, 'dist', 'AAAA');
  writeFileSync(path.join(distDir, 'assets', '_hidden-AAAA.js'), 'x');
  expect(() => publish({ repoDir, distDir })).toThrow(/_hidden/);
});

it('lists every route of the router', () => {
  const router = readFileSync(
    fileURLToPath(new URL('../src/routes/router.tsx', import.meta.url)),
    'utf8',
  );
  const paths = [...router.matchAll(/path: '([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*');
  expect([...APP_ROUTES].filter(Boolean).sort()).toEqual(paths.sort());
});
