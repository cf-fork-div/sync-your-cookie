#!/usr/bin/env node
/**
 * Build Web Viewer + copy Pages Functions for Cloudflare Pages Git deploy.
 * Does not create KV, push secrets, or deploy — use `pnpm deploy:cloudflare` for full setup.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DEPLOY_DIR = __dirname;
const DIST_WEB = join(ROOT, 'dist/web');

function log(msg) {
  console.log(`[build-pages] ${msg}`);
}

function fail(msg) {
  console.error(`[build-pages] ERROR: ${msg}`);
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

function copyPagesFunctions() {
  const src = join(DEPLOY_DIR, 'functions');
  const dest = join(DIST_WEB, 'functions');
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  log('Copied Pages Functions into dist/web/functions');
}

buildWeb();
copyPagesFunctions();
log('Done. Output: dist/web (use as Cloudflare Pages build output directory)');
