#!/usr/bin/env node
/**
 * Build Web Viewer static assets for Cloudflare Worker deploy.
 * Does not create KV, push secrets, or deploy — use `pnpm deploy:cloudflare` for full setup.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DIST_WEB = join(ROOT, 'dist/web');

function log(msg) {
  console.log(`[build-worker] ${msg}`);
}

function fail(msg) {
  console.error(`[build-worker] ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd) {
  log(`$ ${cmd}`);
  const env = { ...process.env };
  delete env.VITE_WEB_ACCESS_PASSWORD;
  delete env.VITE_WEB_BASE_PATH;
  execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', env });
}

function buildWeb() {
  log('Building Web Viewer (base=/; path & password are runtime Cloudflare config)...');
  run('pnpm -F @sync-your-cookie/protobuf build');
  run('pnpm -F @sync-your-cookie/shared build');
  run('pnpm -F @sync-your-cookie/ui build');
  run('pnpm -F @sync-your-cookie/web build');

  if (!existsSync(DIST_WEB)) {
    fail(`Build output missing: ${DIST_WEB}`);
  }
}

buildWeb();
log('Done. Output: dist/web (served via Worker [assets] binding)');
