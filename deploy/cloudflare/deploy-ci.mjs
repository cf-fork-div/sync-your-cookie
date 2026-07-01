#!/usr/bin/env node
/**
 * Cloudflare Workers Git CI: prepare wrangler.toml, then deploy from deploy/cloudflare.
 *
 * Usage (Builds → Deploy command):
 *   node deploy/cloudflare/deploy-ci.mjs
 *
 * Runs wrangler with cwd = deploy/cloudflare so paths in wrangler.toml resolve
 * reliably (main, assets, kv_namespaces). Avoids fragile long CLI --config paths
 * that may be truncated in the Dashboard deploy command field.
 */
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPLOY_DIR, ROOT, fail, wranglerCmd } from './lib/deploy-shared.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREPARE_SCRIPT = join(__dirname, 'prepare-wrangler.mjs');

function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: opts.cwd ?? ROOT,
    stdio: 'inherit',
    env: process.env,
    ...opts,
  });
}

function main() {
  run(`node "${PREPARE_SCRIPT}"`, { cwd: ROOT });

  const wrangler = wranglerCmd();
  const deployCmd =
    process.platform === 'win32'
      ? `"${wrangler}" deploy --config wrangler.toml`
      : `${wrangler} deploy --config wrangler.toml`;

  try {
    run(deployCmd, { cwd: DEPLOY_DIR });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fail(
      `wrangler deploy 失败: ${message}\n` +
        '请确认 Builds → Deploy command 为: node deploy/cloudflare/deploy-ci.mjs',
    );
  }
}

main();
