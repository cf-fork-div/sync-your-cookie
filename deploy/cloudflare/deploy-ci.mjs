#!/usr/bin/env node
/**
 * Cloudflare Workers Git CI: prepare wrangler.toml, then deploy.
 * Thin wrapper — prefer `node deploy/cloudflare/prepare-wrangler.mjs --deploy` in Dashboard.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/deploy-shared.mjs';

const prepareScript = join(dirname(fileURLToPath(import.meta.url)), 'prepare-wrangler.mjs');

execSync(`node "${prepareScript}" --deploy`, { cwd: ROOT, stdio: 'inherit', env: process.env });
