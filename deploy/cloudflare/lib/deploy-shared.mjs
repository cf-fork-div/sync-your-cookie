import { execSync } from 'node:child_process';
import { platform } from 'node:process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../../..');
export const DEPLOY_DIR = resolve(__dirname, '..');
export const STATE_FILE = join(DEPLOY_DIR, '.deploy-state.json');
export const WRANGLER_TOML = join(DEPLOY_DIR, 'wrangler.toml');
/** Primary name for new namespaces; lookup also tries legacy SYNC_YOUR_COOKIE. */
export const KV_NAMESPACE_NAME = 'sync-your-cookie';
export const KV_NAMESPACE_NAMES = [KV_NAMESPACE_NAME, 'SYNC_YOUR_COOKIE'];
export const WORKER_NAME = 'sync-your-cookie';
export const DATASOURCE_CONFIG_KEY = '__syc_datasource_config__';
export const DEFAULT_STORAGE_KEY = 'sync-your-cookie';
const PLACEHOLDER_KV_ID = '00000000000000000000000000000000';

export function log(msg) {
  console.log(`[deploy] ${msg}`);
}

export function fail(msg) {
  console.error(`[deploy] ERROR: ${msg}`);
  process.exit(1);
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
  }).trim();
}

export function wranglerCmd() {
  const bin = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
  return existsSync(bin) ? bin : 'wrangler';
}

export function runWranglerCapture(args, opts = {}) {
  const wrangler = wranglerCmd();
  const cmd = platform === 'win32' ? `"${wrangler}" ${args}` : `${wrangler} ${args}`;
  return runCapture(cmd, opts);
}

function runWranglerStdin(args, input, opts = {}) {
  const wrangler = wranglerCmd();
  const cmd = platform === 'win32' ? `"${wrangler}" ${args}` : `${wrangler} ${args}`;
  execSync(cmd, {
    cwd: opts.cwd ?? DEPLOY_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
    input,
    env: { ...process.env, ...opts.env },
  });
}

/**
 * Push WEB_ACCESS_PASSWORD to the Worker as an encrypted secret.
 *
 * @param {'opt-in'|'auto'} mode
 *   - opt-in: only when DEPLOY_RUNTIME_SECRETS=1 (local deploy.mjs)
 *   - auto: when WEB_ACCESS_PASSWORD is set (Git CI prepare-wrangler / Build secret)
 */
export function pushRuntimeSecrets(env, { dryRun = false, mode = 'opt-in' } = {}) {
  if (mode === 'opt-in' && env.DEPLOY_RUNTIME_SECRETS !== '1') {
    log('跳过 wrangler secret 推送（可在 Dashboard 修改 WEB_ACCESS_PASSWORD，或设置 DEPLOY_RUNTIME_SECRETS=1）');
    return false;
  }

  const password = env.WEB_ACCESS_PASSWORD?.trim();
  if (!password) {
    if (mode === 'auto' && env.WORKERS_CI === '1') {
      log('Git CI 未注入 WEB_ACCESS_PASSWORD；请在 Builds → Build variables 添加 Secret，或在 Worker → Variables and Secrets 设置');
    } else {
      log('未设置 WEB_ACCESS_PASSWORD，跳过 secret 推送');
    }
    return false;
  }

  if (dryRun) {
    log('dry-run: 跳过 WEB_ACCESS_PASSWORD secret 推送');
    return false;
  }

  log('推送 WEB_ACCESS_PASSWORD 到 Cloudflare Worker（加密 Secret）...');
  runWranglerStdin('secret put WEB_ACCESS_PASSWORD', `${password}\n`, { cwd: DEPLOY_DIR });
  return true;
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

export function mergeEnv() {
  const fromFile = loadDotEnv(join(DEPLOY_DIR, '.env'));
  return { ...fromFile, ...process.env };
}

export function getCfHeaders(env) {
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    return null;
  }
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson(url, headers, init) {
  const res = await fetch(url, init ? { ...init, headers: { ...headers, ...init.headers } } : { headers });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const msg = data.errors?.[0]?.message ?? res.statusText;
    throw new Error(`${url}: ${msg}`);
  }
  return data;
}

export function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(state) {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function updateWranglerKvBinding(namespaceId) {
  if (!namespaceId || namespaceId === PLACEHOLDER_KV_ID) {
    fail('Refusing to write placeholder KV namespace id to wrangler.toml');
  }

  let toml = readFileSync(WRANGLER_TOML, 'utf8');
  const idLine = `id = "${namespaceId}"`;
  const previewLine = `preview_id = "${namespaceId}"`;
  if (/^\[\[kv_namespaces\]\]/m.test(toml)) {
    toml = toml.replace(/^id = .*$/m, idLine);
    toml = toml.replace(/^preview_id = .*$/m, previewLine);
  } else {
    toml = `${toml.trimEnd()}\n\n# KV binding for datasource config + sync (filled by prepare-wrangler.mjs / deploy.mjs)\n[[kv_namespaces]]\nbinding = "SYNC_KV"\n${idLine}\n${previewLine}\n`;
  }
  writeFileSync(WRANGLER_TOML, toml, 'utf8');
}

export function updateWranglerBasePath(basePath) {
  let toml = readFileSync(WRANGLER_TOML, 'utf8');
  if (basePath) {
    const line = `WEB_BASE_PATH = "${basePath.replace(/"/g, '\\"')}"`;
    if (/^WEB_BASE_PATH = .*$/m.test(toml)) {
      toml = toml.replace(/^WEB_BASE_PATH = .*$/m, line);
    } else if (/^\[vars\]/m.test(toml)) {
      toml = toml.replace(/^(\[vars\]\r?\n)/m, `$1${line}\n`);
    } else {
      toml = `${toml.trimEnd()}\n\n[vars]\n${line}\n`;
    }
  } else if (/^WEB_BASE_PATH = .*$/m.test(toml)) {
    toml = toml.replace(/^WEB_BASE_PATH = .*\r?\n/m, '');
  }
  writeFileSync(WRANGLER_TOML, toml, 'utf8');
}

export async function resolveAccountId(env) {
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

function namespaceNameMatches(title) {
  return KV_NAMESPACE_NAMES.includes(title);
}

async function listAllKvNamespacesViaApi(env, accountId) {
  const headers = getCfHeaders(env);
  if (!headers) {
    return null;
  }

  const all = [];
  let page = 1;
  for (;;) {
    const data = await fetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces?per_page=100&page=${page}`,
      headers,
    );
    all.push(...(data.result ?? []));
    const totalPages = data.result_info?.total_pages ?? 1;
    if (page >= totalPages) {
      break;
    }
    page += 1;
  }
  return all;
}

async function findKvNamespacesByName(env, accountId) {
  const all = await listAllKvNamespacesViaApi(env, accountId);
  if (all === null) {
    return { matches: [], apiAvailable: false };
  }
  return {
    matches: all.filter(ns => namespaceNameMatches(ns.title)),
    apiAvailable: true,
  };
}

async function createKvNamespaceViaApi(env, accountId, title) {
  const headers = getCfHeaders(env);
  if (!headers) {
    fail(
      '无法创建 KV 命名空间：需要 CLOUDFLARE_API_TOKEN（Workers KV Storage:Edit）。或设置 SYNC_KV_NAMESPACE_ID 绑定已有命名空间。',
    );
  }

  const data = await fetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`,
    headers,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
  );
  const namespaceId = data.result?.id;
  if (!namespaceId) {
    fail(`KV 命名空间创建失败: ${JSON.stringify(data)}`);
  }
  return namespaceId;
}

function pickExistingNamespaceId(matches, preferredIds = []) {
  for (const preferredId of preferredIds) {
    if (!preferredId || preferredId === PLACEHOLDER_KV_ID) {
      continue;
    }
    const match = matches.find(ns => ns.id === preferredId);
    if (match?.id) {
      return { id: match.id, title: match.title };
    }
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    const names = [...new Set(matches.map(ns => ns.title))].join(' / ');
    log(
      `警告: 发现 ${matches.length} 个匹配 KV 命名空间 (${names})，绑定 ${matches[0].id}（请在 Dashboard 设置 SYNC_KV_NAMESPACE_ID 固定绑定）`,
    );
  }

  return { id: matches[0].id, title: matches[0].title };
}

export async function ensureKvNamespace(env, accountId, { dryRun = false, allowCreate = false } = {}) {
  const explicitId = env.SYNC_KV_NAMESPACE_ID?.trim();
  const state = loadState();

  // Priority 1: explicit env var — skip lookup/create entirely
  if (explicitId && explicitId !== PLACEHOLDER_KV_ID) {
    log(`使用 SYNC_KV_NAMESPACE_ID: ${explicitId}`);
    saveState({ namespaceId: explicitId, namespaceName: KV_NAMESPACE_NAME, accountId });
    return explicitId;
  }

  // Priority 2: lookup by name via Cloudflare REST API
  let existing = null;
  try {
    const { matches, apiAvailable } = await findKvNamespacesByName(env, accountId);
    if (apiAvailable) {
      existing = pickExistingNamespaceId(matches, [state.namespaceId].filter(Boolean));
    } else {
      log('未配置 CLOUDFLARE_API_TOKEN，跳过 KV 按名称查找');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Cloudflare API 列出 KV 失败: ${message}`);
  }

  if (existing?.id) {
    log(`找到已有 KV 命名空间 "${existing.title}": ${existing.id}`);
    saveState({ namespaceId: existing.id, namespaceName: existing.title, accountId });
    return existing.id;
  }

  // Priority 3: .deploy-state.json cache
  if (state.namespaceId && state.namespaceId !== PLACEHOLDER_KV_ID) {
    log(`复用 .deploy-state.json 中的 KV 命名空间: ${state.namespaceId}`);
    return state.namespaceId;
  }

  if (dryRun) {
    log('dry-run: 跳过 KV 命名空间创建');
    return PLACEHOLDER_KV_ID;
  }

  if (!allowCreate) {
    fail(
      `未找到 KV 命名空间（已查找: ${KV_NAMESPACE_NAMES.join(', ')}）。请在 Dashboard 设置 SYNC_KV_NAMESPACE_ID，或设置 DEPLOY_ALLOW_KV_CREATE=1 允许自动创建。`,
    );
  }

  log(`创建 KV 命名空间: ${KV_NAMESPACE_NAME}`);
  const namespaceId = await createKvNamespaceViaApi(env, accountId, KV_NAMESPACE_NAME);
  saveState({ namespaceId, namespaceName: KV_NAMESPACE_NAME, accountId });
  return namespaceId;
}

async function readDatasourceConfigFromKv(env, accountId, syncKvNamespaceId) {
  const headers = getCfHeaders(env);
  if (!headers) {
    return null;
  }

  const key = encodeURIComponent(DATASOURCE_CONFIG_KEY);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${syncKvNamespaceId}/values/${key}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`读取 datasource 配置失败 (${res.status}): ${text}`);
  }

  const raw = (await res.text()).trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeDatasourceConfigToKv(env, accountId, syncKvNamespaceId, config) {
  const headers = getCfHeaders(env);
  if (!headers) {
    fail('无法写入 datasource 配置：需要 CLOUDFLARE_API_TOKEN 或 wrangler 授权');
  }

  const key = encodeURIComponent(DATASOURCE_CONFIG_KEY);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${syncKvNamespaceId}/values/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`写入 datasource 配置失败 (${res.status}): ${text}`);
  }
}

/**
 * Seed /api/admin/datasource config into SYNC_KV so redeploy does not require manual ConnectForm setup.
 * Enabled when DEPLOY_SEED_DATASOURCE=1 (or "force") and CLOUDFLARE_API_TOKEN is available.
 */
export async function seedDatasourceConfigIfNeeded(env, accountId, syncKvNamespaceId, { dryRun = false } = {}) {
  const mode = env.DEPLOY_SEED_DATASOURCE?.trim();
  if (!mode) {
    log('跳过 datasource 种子写入（设置 DEPLOY_SEED_DATASOURCE=1 可在部署时自动写入 ConnectForm 配置）');
    return { seeded: false, reason: 'disabled' };
  }

  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    log('跳过 datasource 种子写入（需要 CLOUDFLARE_API_TOKEN；Git CI 会自动注入）');
    return { seeded: false, reason: 'no_token' };
  }

  const cookieNamespaceId =
    env.COOKIE_KV_NAMESPACE_ID?.trim() || env.DATASOURCE_NAMESPACE_ID?.trim() || syncKvNamespaceId;
  const storageKey = env.DATASOURCE_STORAGE_KEY?.trim() || DEFAULT_STORAGE_KEY;
  const config = {
    accountId: accountId.trim(),
    namespaceId: cookieNamespaceId.trim(),
    token,
    storageKey,
  };

  if (!config.accountId || !config.namespaceId) {
    log('跳过 datasource 种子写入（缺少 Account ID 或 Namespace ID）');
    return { seeded: false, reason: 'missing_ids' };
  }

  if (dryRun) {
    log('dry-run: 跳过 datasource 配置写入 SYNC_KV');
    return { seeded: false, reason: 'dry_run' };
  }

  if (mode !== 'force') {
    const existing = await readDatasourceConfigFromKv(env, accountId, syncKvNamespaceId);
    if (existing?.accountId && existing?.namespaceId && existing?.token) {
      log('SYNC_KV 中已有 datasource 配置，跳过种子写入（使用 DEPLOY_SEED_DATASOURCE=force 可覆盖）');
      return { seeded: false, reason: 'exists' };
    }
  }

  await writeDatasourceConfigToKv(env, accountId, syncKvNamespaceId, config);
  log(`已写入 datasource 配置到 SYNC_KV（Namespace ID: ${config.namespaceId}，Storage Key: ${storageKey}）`);
  return { seeded: true, config: { ...config, token: undefined } };
}

export async function prepareWranglerConfig(env, { dryRun = false, allowCreate = false } = {}) {
  const accountId = await resolveAccountId(env);
  const allowKvCreate = allowCreate || env.DEPLOY_ALLOW_KV_CREATE === '1';
  const namespaceId = await ensureKvNamespace(env, accountId, { dryRun, allowCreate: allowKvCreate });
  if (dryRun && namespaceId === PLACEHOLDER_KV_ID) {
    log('dry-run: 跳过 wrangler.toml KV 绑定写入');
    return { accountId, namespaceId };
  }
  updateWranglerKvBinding(namespaceId);
  log(`wrangler.toml 已绑定 SYNC_KV → ${namespaceId} (Worker: ${WORKER_NAME})`);
  return { accountId, namespaceId };
}
