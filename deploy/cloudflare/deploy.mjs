#!/usr/bin/env node
/**
 * One-command Cloudflare Worker deploy for sync-your-cookie web viewer.
 *
 * Usage:
 *   pnpm deploy:cloudflare
 *   pnpm deploy:cloudflare -- --dry-run
 *
 * Auth: set CLOUDFLARE_API_TOKEN or run `wrangler login` once.
 * Config: deploy/cloudflare/.env or env vars (see .env.example).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEPLOY_DIR,
  ROOT,
  WORKER_NAME,
  fail,
  log,
  mergeEnv,
  prepareWranglerConfig,
  pushRuntimeSecrets,
  runWranglerCapture,
  seedDatasourceConfigIfNeeded,
  updateWranglerBasePath,
  wranglerCmd,
} from './lib/deploy-shared.mjs';

const DIST_WEB = join(ROOT, 'dist/web');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function run(cmd, opts = {}) {
  log(`$ ${cmd}`);
  return execSync(cmd, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    stdio: opts.silent ? ['pipe', 'pipe', 'pipe'] : opts.stdinSilent ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input: opts.input,
    env: { ...process.env, ...opts.env },
  });
}

function warnDeprecatedViteEnv(env) {
  if (env.VITE_WEB_ACCESS_PASSWORD?.trim()) {
    log(
      '注意: deploy/.env 中的 VITE_WEB_ACCESS_PASSWORD 已弃用（构建时不会写入 JS）。请改用 WEB_ACCESS_PASSWORD，并在 Dashboard 或 DEPLOY_RUNTIME_SECRETS=1 中配置。',
    );
  }
  if (env.VITE_WEB_BASE_PATH?.trim() && !env.WEB_BASE_PATH?.trim()) {
    log('注意: deploy/.env 中的 VITE_WEB_BASE_PATH 已弃用，请改用 WEB_BASE_PATH。');
  }
}

/** Prevent legacy VITE_* deploy vars from being baked into the production bundle. */
function envForWebBuild() {
  const env = { ...process.env };
  delete env.VITE_WEB_ACCESS_PASSWORD;
  delete env.VITE_WEB_BASE_PATH;
  return env;
}

function runWrangler(args, opts = {}) {
  const wrangler = wranglerCmd();
  const cmd = process.platform === 'win32' ? `"${wrangler}" ${args}` : `${wrangler} ${args}`;
  return run(cmd, opts);
}

function buildWeb() {
  log('构建依赖与 Web Viewer（base=/，路径与密码在 Cloudflare 运行时配置）...');
  const buildEnv = envForWebBuild();
  run('pnpm -F @sync-your-cookie/protobuf build', { env: buildEnv });
  run('pnpm -F @sync-your-cookie/shared build', { env: buildEnv });
  run('pnpm -F @sync-your-cookie/ui build', { env: buildEnv });
  run('pnpm -F @sync-your-cookie/web build', { env: buildEnv });

  if (!existsSync(DIST_WEB)) {
    fail(`构建输出不存在: ${DIST_WEB}`);
  }
}

function pushRuntimeSecretsForDeploy(env) {
  pushRuntimeSecrets(env, { dryRun, mode: 'opt-in' });
}

function deployWorker() {
  log(`部署到 Cloudflare Worker: ${WORKER_NAME}`);
  const wrangler = wranglerCmd();
  const cmd =
    process.platform === 'win32'
      ? `"${wrangler}" deploy --config wrangler.toml`
      : `${wrangler} deploy --config wrangler.toml`;
  const out = execSync(cmd, {
    cwd: DEPLOY_DIR,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    env: process.env,
  });
  if (out) {
    process.stdout.write(out);
  }
  const urlMatch = out.match(/https:\/\/[^\s]+\.workers\.dev[^\s]*/);
  return urlMatch?.[0] ?? `https://${WORKER_NAME}.workers.dev`;
}

function maskToken(token) {
  if (!token || token.length < 8) {
    return '(未设置)';
  }
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function printSummary({ accountId, namespaceId, basePath, workerUrl, env }) {
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const viewerUrl = basePath
    ? `${workerUrl.replace(/\/$/, '')}/${basePath.replace(/^\/+|\/+$/g, '')}/`
    : `${workerUrl.replace(/\/$/, '')}/`;

  console.log('\n========================================');
  console.log('  Sync Your Cookie — Cloudflare 部署完成');
  console.log('========================================\n');
  console.log('Web Viewer 地址:');
  console.log(`  ${viewerUrl}\n`);
  console.log('请填入扩展的同步服务器信息:\n');
  console.log(`  服务器 URL:  ${viewerUrl.replace(/\/$/, '')}`);
  console.log('  访问密码:    与 WEB_ACCESS_PASSWORD 相同\n');
  console.log('Web 管理端 / 扩展 KV 凭据（登录后「连接数据源」，或 DEPLOY_SEED_DATASOURCE=1 自动写入）:\n');
  console.log(`  Account ID:    ${accountId}`);
  console.log(`  Namespace ID:  ${namespaceId}`);
  if (token) {
    console.log(`  API Token:     ${token}`);
    console.log(`  (Token 摘要: ${maskToken(token)} — 与部署时使用的 CLOUDFLARE_API_TOKEN 相同)\n`);
  } else {
    console.log('  API Token:     请使用具备 Workers KV Storage:Edit 权限的 Token');
    console.log('                 (部署时使用了 wrangler login，需在 Dashboard 手动创建 Token)\n');
  }
  console.log('  Storage Key:   sync-your-cookie（可在 Web 管理端修改）\n');
  console.log('Web Viewer 运行时配置（Cloudflare Dashboard 修改后立即生效，无需重新构建）:\n');
  console.log('  WEB_ACCESS_PASSWORD  — 登录密码（Encrypted Secret，必填）');
  if (basePath) {
    console.log(`  WEB_BASE_PATH        — 当前自定义路径: ${basePath}`);
  } else {
    console.log('  WEB_BASE_PATH        — 可选，设置后隐藏于自定义路径（默认根路径 /）');
  }
  console.log('\n  路径: Workers & Pages → sync-your-cookie → Settings → Variables and Secrets\n');
  if (env.WEB_ACCESS_PASSWORD?.trim()) {
    console.log(`  当前 deploy/.env 中的 WEB_ACCESS_PASSWORD 已用于首次配置参考`);
    if (env.DEPLOY_RUNTIME_SECRETS !== '1') {
      console.log('  提示: 设置 DEPLOY_RUNTIME_SECRETS=1 可在部署时自动推送 Secret\n');
    }
  } else {
    console.log('  请在 Dashboard 设置 WEB_ACCESS_PASSWORD 后再访问 Web Viewer\n');
  }
  console.log('自动化项:');
  console.log('  ✓ KV 命名空间按名称复用（sync-your-cookie / SYNC_YOUR_COOKIE），避免 redeploy 换绑');
  console.log('  ✓ Worker 部署 + 运行时认证 + /api/sync 扩展同步 API');
  if (env.DEPLOY_SEED_DATASOURCE === '1' || env.DEPLOY_SEED_DATASOURCE === 'force') {
    console.log('  ✓ datasource 配置写入 SYNC_KV（DEPLOY_SEED_DATASOURCE）');
  } else {
    console.log('  ○ datasource 配置：设置 DEPLOY_SEED_DATASOURCE=1 可部署时自动写入');
  }
  if (env.DEPLOY_RUNTIME_SECRETS === '1' && env.WEB_ACCESS_PASSWORD?.trim()) {
    console.log('  ✓ WEB_ACCESS_PASSWORD 已通过 wrangler secret 推送');
  }
  console.log('\n需手动完成（一次性）:');
  console.log('  • 首次授权: wrangler login 或设置 CLOUDFLARE_API_TOKEN');
  if (env.DEPLOY_RUNTIME_SECRETS !== '1' || !env.WEB_ACCESS_PASSWORD?.trim()) {
    console.log('  • 在 Dashboard 设置 WEB_ACCESS_PASSWORD（或 DEPLOY_RUNTIME_SECRETS=1 + .env）');
  }
  if (env.DEPLOY_SEED_DATASOURCE !== '1' && env.DEPLOY_SEED_DATASOURCE !== 'force') {
    console.log('  • 登录 Web 管理端保存 KV 凭据，或设置 DEPLOY_SEED_DATASOURCE=1');
  }
  if (basePath) {
    console.log('  • 确认 WEB_BASE_PATH 自定义路径');
  }
  console.log('  • 在扩展中填写服务器 URL + 访问密码\n');
  console.log('详细说明: deploy/CLOUDFLARE.md');
  console.log('========================================\n');
}

async function main() {
  const env = mergeEnv();
  Object.assign(process.env, env);
  warnDeprecatedViteEnv(env);

  try {
    runWranglerCapture('--version', { cwd: DEPLOY_DIR });
  } catch {
    fail('未找到 wrangler。请先运行 pnpm install。');
  }

  const basePath = env.WEB_BASE_PATH?.trim()?.replace(/^\/+|\/+$/g, '') || null;
  updateWranglerBasePath(basePath);

  buildWeb();

  const { accountId, namespaceId } = await prepareWranglerConfig(env, { dryRun, allowCreate: true });

  let workerUrl = `https://${WORKER_NAME}.workers.dev`;
  if (!dryRun) {
    pushRuntimeSecretsForDeploy(env);
    workerUrl = deployWorker();
    await seedDatasourceConfigIfNeeded(env, accountId, namespaceId, { dryRun: false });
  } else {
    log('dry-run: 跳过 Worker 部署');
    await seedDatasourceConfigIfNeeded(env, accountId, namespaceId, { dryRun: true });
  }

  printSummary({ accountId, namespaceId, basePath, workerUrl, env });
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
});
