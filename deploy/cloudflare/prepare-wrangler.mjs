#!/usr/bin/env node
/**
 * Resolve SYNC_KV namespace and patch wrangler.toml before `wrangler deploy`.
 * Used by Cloudflare Workers Builds (Git CI) which does not run deploy.mjs.
 *
 * Usage:
 *   node deploy/cloudflare/prepare-wrangler.mjs
 *   pnpm prepare:cloudflare-worker
 *
 * Optional env:
 *   SYNC_KV_NAMESPACE_ID — bind this namespace directly (skips lookup/create)
 *   DEPLOY_ALLOW_KV_CREATE=1 — allow auto-create when no namespace found (Git CI default: off)
 *   WEB_ACCESS_PASSWORD — if set (e.g. Builds → Build variables Secret), auto `wrangler secret put`
 *   WEB_BASE_PATH — optional runtime path segment written to wrangler.toml [vars]
 *   CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — same as deploy.mjs
 */
import {
  DEPLOY_DIR,
  fail,
  log,
  mergeEnv,
  prepareWranglerConfig,
  pushRuntimeSecrets,
  runWranglerCapture,
  seedDatasourceConfigIfNeeded,
  updateWranglerBasePath,
} from './lib/deploy-shared.mjs';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const env = mergeEnv();
  Object.assign(process.env, env);

  try {
    runWranglerCapture('--version', { cwd: DEPLOY_DIR });
  } catch {
    fail('未找到 wrangler。请先运行 pnpm install。');
  }

  const { accountId, namespaceId } = await prepareWranglerConfig(env, { dryRun });

  const basePath = env.WEB_BASE_PATH?.trim()?.replace(/^\/+|\/+$/g, '') || null;
  if (!dryRun) {
    updateWranglerBasePath(basePath);
  }

  pushRuntimeSecrets(env, { dryRun, mode: 'auto' });

  if (!dryRun && (env.DEPLOY_SEED_DATASOURCE === '1' || env.DEPLOY_SEED_DATASOURCE === 'force')) {
    await seedDatasourceConfigIfNeeded(env, accountId, namespaceId, { dryRun: false });
  }

  if (dryRun) {
    log('dry-run: 完成（未写入 wrangler.toml）');
  } else {
    log('完成。可执行: npx wrangler deploy --config deploy/cloudflare/wrangler.toml');
  }
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
});
