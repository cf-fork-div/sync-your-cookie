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
 *   SYNC_KV_NAMESPACE_ID — skip lookup/create, bind this namespace directly
 *   CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — same as deploy.mjs
 */
import {
  DEPLOY_DIR,
  fail,
  log,
  mergeEnv,
  prepareWranglerConfig,
  runWranglerCapture,
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

  await prepareWranglerConfig(env, { dryRun });

  if (dryRun) {
    log('dry-run: 完成（未写入 wrangler.toml）');
  } else {
    log('完成。可执行: npx wrangler deploy --config deploy/cloudflare/wrangler.toml');
  }
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
});
