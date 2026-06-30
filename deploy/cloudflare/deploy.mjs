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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DEPLOY_DIR = __dirname;
const DIST_WEB = join(ROOT, 'dist/web');
const STATE_FILE = join(DEPLOY_DIR, '.deploy-state.json');
const WRANGLER_TOML = join(DEPLOY_DIR, 'wrangler.toml');
const KV_NAMESPACE_NAME = 'SYNC_YOUR_COOKIE';
const WORKER_NAME = 'sync-your-cookie-web';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function log(msg) {
  console.log(`[deploy] ${msg}`);
}

function fail(msg) {
  console.error(`[deploy] ERROR: ${msg}`);
  process.exit(1);
}

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

function runCapture(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
  }).trim();
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const env = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      env[key] = value;
    }
  }
  return env;
}

function mergeEnv() {
  const fromFile = loadDotEnv(join(DEPLOY_DIR, '.env'));
  return { ...fromFile, ...process.env };
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

function wranglerCmd() {
  const bin = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
  return existsSync(bin) ? bin : 'wrangler';
}

function runWrangler(args, opts = {}) {
  const wrangler = wranglerCmd();
  const cmd = process.platform === 'win32' ? `"${wrangler}" ${args}` : `${wrangler} ${args}`;
  return run(cmd, opts);
}

function runWranglerCapture(args, opts = {}) {
  const wrangler = wranglerCmd();
  const cmd = process.platform === 'win32' ? `"${wrangler}" ${args}` : `${wrangler} ${args}`;
  return runCapture(cmd, opts);
}

function getCfHeaders(env) {
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    return null;
  }
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const msg = data.errors?.[0]?.message ?? res.statusText;
    throw new Error(`${url}: ${msg}`);
  }
  return data;
}

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function updateWranglerKvId(namespaceId) {
  let toml = readFileSync(WRANGLER_TOML, 'utf8');
  toml = toml.replace(/^id = ".*"$/m, `id = "${namespaceId}"`);
  toml = toml.replace(/^preview_id = ".*"$/m, `preview_id = "${namespaceId}"`);
  writeFileSync(WRANGLER_TOML, toml, 'utf8');
}

function updateWranglerBasePath(basePath) {
  let toml = readFileSync(WRANGLER_TOML, 'utf8');
  const line = `WEB_BASE_PATH = "${basePath.replace(/"/g, '\\"')}"`;
  if (/^WEB_BASE_PATH = .*$/m.test(toml)) {
    toml = toml.replace(/^WEB_BASE_PATH = .*$/m, line);
  } else {
    toml = toml.replace(/^(\[vars\]\r?\n)/m, `$1${line}\n`);
  }
  writeFileSync(WRANGLER_TOML, toml, 'utf8');
}

async function resolveAccountId(env) {
  if (env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    return env.CLOUDFLARE_ACCOUNT_ID.trim();
  }

  const headers = getCfHeaders(env);
  if (headers) {
    const data = await fetchJson('https://api.cloudflare.com/client/v4/accounts?per_page=1', headers);
    const id = data.result?.[0]?.id;
    if (id) {
      return id;
    }
  }

  try {
    const out = runWranglerCapture('whoami', { cwd: DEPLOY_DIR });
    const match = out.match(/Account ID[:\s]+([0-9a-f]{32})/i) ?? out.match(/([0-9a-f]{32})/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // fall through
  }

  fail(
    '无法获取 Account ID。请设置 CLOUDFLARE_ACCOUNT_ID，或配置 CLOUDFLARE_API_TOKEN / 运行 wrangler login。',
  );
}

function findKvNamespaceViaWrangler() {
  const raw = runWranglerCapture('kv namespace list', { cwd: DEPLOY_DIR });
  const namespaces = JSON.parse(raw);
  return namespaces.find(ns => ns.title === KV_NAMESPACE_NAME);
}

async function ensureKvNamespace(env, accountId) {
  const state = loadState();
  if (state.namespaceId && state.namespaceName === KV_NAMESPACE_NAME) {
    log(`复用已有 KV 命名空间: ${state.namespaceId}`);
    updateWranglerKvId(state.namespaceId);
    return state.namespaceId;
  }

  if (dryRun) {
    log('dry-run: 跳过 KV 命名空间创建');
    return state.namespaceId ?? '00000000000000000000000000000000';
  }

  const headers = getCfHeaders(env);
  if (headers) {
    const list = await fetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
      headers,
    );
    const existing = list.result?.find(ns => ns.title === KV_NAMESPACE_NAME);
    if (existing?.id) {
      log(`找到已有 KV 命名空间: ${existing.id}`);
      saveState({ namespaceId: existing.id, namespaceName: KV_NAMESPACE_NAME, accountId });
      updateWranglerKvId(existing.id);
      return existing.id;
    }
  } else {
    const existing = findKvNamespaceViaWrangler();
    if (existing?.id) {
      log(`找到已有 KV 命名空间: ${existing.id}`);
      saveState({ namespaceId: existing.id, namespaceName: KV_NAMESPACE_NAME, accountId });
      updateWranglerKvId(existing.id);
      return existing.id;
    }
  }

  log(`创建 KV 命名空间: ${KV_NAMESPACE_NAME}`);
  const raw = runWranglerCapture(`kv namespace create "${KV_NAMESPACE_NAME}"`, { cwd: DEPLOY_DIR });
  const parsed = JSON.parse(raw);
  const namespaceId = parsed.id;
  if (!namespaceId) {
    fail(`KV 命名空间创建失败: ${raw}`);
  }

  saveState({ namespaceId, namespaceName: KV_NAMESPACE_NAME, accountId });
  updateWranglerKvId(namespaceId);
  return namespaceId;
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

function pushRuntimeSecrets(env) {
  if (env.DEPLOY_RUNTIME_SECRETS !== '1') {
    log('跳过 wrangler secret 推送（可在 Dashboard 修改 WEB_ACCESS_PASSWORD，或设置 DEPLOY_RUNTIME_SECRETS=1）');
    return;
  }

  const password = env.WEB_ACCESS_PASSWORD?.trim();
  if (!password) {
    log('未设置 WEB_ACCESS_PASSWORD，跳过 secret 推送');
    return;
  }

  if (dryRun) {
    log('dry-run: 跳过 WEB_ACCESS_PASSWORD secret 推送');
    return;
  }

  log('推送 WEB_ACCESS_PASSWORD 到 Cloudflare Worker（加密 Secret）...');
  runWrangler('secret put WEB_ACCESS_PASSWORD', {
    cwd: DEPLOY_DIR,
    stdinSilent: true,
    input: `${password}\n`,
  });
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
  const urlMatch =
    out.match(/https:\/\/[^\s]+\.workers\.dev[^\s]*/) ??
    out.match(/Published sync-your-cookie-web[^\n]*\n[^\n]*(https:\/\/[^\s]+)/);
  return urlMatch?.[0] ?? `https://${WORKER_NAME}.${process.env.CF_ACCOUNT_SUBDOMAIN ?? 'workers'}.dev`;
}

function maskToken(token) {
  if (!token || token.length < 8) {
    return '(未设置)';
  }
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function printSummary({ accountId, namespaceId, basePath, workerUrl, env }) {
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const viewerPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const normalizedPath = viewerPath.endsWith('/') ? viewerPath : `${viewerPath}/`;

  console.log('\n========================================');
  console.log('  Sync Your Cookie — Cloudflare 部署完成');
  console.log('========================================\n');
  console.log('Web Viewer 地址:');
  console.log(`  ${workerUrl.replace(/\/$/, '')}${normalizedPath}\n`);
  console.log('请填入扩展 Options 页面的凭据:\n');
  console.log(`  Account ID:    ${accountId}`);
  console.log(`  Namespace ID:  ${namespaceId}`);
  if (token) {
    console.log(`  API Token:     ${token}`);
    console.log(`  (Token 摘要: ${maskToken(token)} — 与部署时使用的 CLOUDFLARE_API_TOKEN 相同)\n`);
  } else {
    console.log('  API Token:     请使用具备 Workers KV Storage:Edit 权限的 Token');
    console.log('                 (部署时使用了 wrangler login，需在 Dashboard 手动创建 Token)\n');
  }
  console.log('Web Viewer 运行时配置（Cloudflare Dashboard 修改后立即生效，无需重新构建）:\n');
  console.log('  WEB_ACCESS_PASSWORD  — 登录密码（Encrypted Secret）');
  console.log('  WEB_BASE_PATH        — 访问路径，默认 my-cookie-vault\n');
  console.log('  路径: Workers & Pages → sync-your-cookie-web → Settings → Variables and Secrets\n');
  if (env.WEB_ACCESS_PASSWORD?.trim()) {
    console.log(`  当前 deploy/.env 中的 WEB_ACCESS_PASSWORD 已用于首次配置参考`);
    if (env.DEPLOY_RUNTIME_SECRETS !== '1') {
      console.log('  提示: 设置 DEPLOY_RUNTIME_SECRETS=1 可在部署时自动推送 Secret\n');
    }
  } else {
    console.log('  请在 Dashboard 设置 WEB_ACCESS_PASSWORD 后再访问 Web Viewer\n');
  }
  console.log('自动化项:');
  console.log('  ✓ KV 命名空间创建/复用');
  console.log('  ✓ Worker 部署 + 运行时认证 + /cf-api 反向代理');
  console.log('  ✓ Account ID / Namespace ID 输出');
  console.log('\n需手动完成:');
  console.log('  • 首次授权: wrangler login 或设置 CLOUDFLARE_API_TOKEN');
  console.log('  • 若未设置 CLOUDFLARE_API_TOKEN，需在 Dashboard 创建 API Token 填入扩展');
  console.log('  • 在 Dashboard 确认 WEB_ACCESS_PASSWORD / WEB_BASE_PATH');
  console.log('  • 在扩展 Options 保存上述凭据\n');
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

  const basePath = env.WEB_BASE_PATH?.trim() || 'my-cookie-vault';
  updateWranglerBasePath(basePath);

  buildWeb();

  const accountId = await resolveAccountId(env);
  const namespaceId = await ensureKvNamespace(env, accountId);

  let workerUrl = `https://${WORKER_NAME}.workers.dev`;
  if (!dryRun) {
    pushRuntimeSecrets(env);
    workerUrl = deployWorker();
  } else {
    log('dry-run: 跳过 Worker 部署');
  }

  printSummary({ accountId, namespaceId, basePath, workerUrl, env });
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
});
