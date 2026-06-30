#!/usr/bin/env node
/**
 * Write ConnectForm datasource config into SYNC_KV (Git CI deploy step).
 *
 * Usage (after prepare-wrangler + wrangler deploy):
 *   node deploy/cloudflare/seed-datasource.mjs
 *
 * Requires DEPLOY_SEED_DATASOURCE=1 and CLOUDFLARE_API_TOKEN.
 * Reads namespace binding from wrangler.toml or SYNC_KV_NAMESPACE_ID.
 */
import { readFileSync } from 'node:fs';
import {
  DEPLOY_DIR,
  WRANGLER_TOML,
  fail,
  log,
  mergeEnv,
  resolveAccountId,
  runWranglerCapture,
  seedDatasourceConfigIfNeeded,
} from './lib/deploy-shared.mjs';

function readSyncKvNamespaceIdFromToml() {
  const toml = readFileSync(WRANGLER_TOML, 'utf8');
  const match = toml.match(/^id = "([^"]+)"/m);
  return match?.[1]?.trim() || null;
}

async function main() {
  const env = mergeEnv();
  Object.assign(process.env, env);

  try {
    runWranglerCapture('--version', { cwd: DEPLOY_DIR });
  } catch {
    fail('未找到 wrangler。请先运行 pnpm install。');
  }

  const accountId = await resolveAccountId(env);
  const namespaceId = env.SYNC_KV_NAMESPACE_ID?.trim() || readSyncKvNamespaceIdFromToml();
  if (!namespaceId) {
    fail('无法解析 SYNC_KV namespace id。请先运行 prepare-wrangler.mjs。');
  }

  await seedDatasourceConfigIfNeeded(env, accountId, namespaceId);
  log('datasource 种子步骤完成');
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
});
