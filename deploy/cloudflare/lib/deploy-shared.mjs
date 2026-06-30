import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../../..');
export const DEPLOY_DIR = resolve(__dirname, '..');
export const STATE_FILE = join(DEPLOY_DIR, '.deploy-state.json');
export const WRANGLER_TOML = join(DEPLOY_DIR, 'wrangler.toml');
export const KV_NAMESPACE_NAME = 'SYNC_YOUR_COOKIE';
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
  const cmd = process.platform === 'win32' ? `"${wrangler}" ${args}` : `${wrangler} ${args}`;
  return runCapture(cmd, opts);
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

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
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

function listKvNamespacesViaWrangler() {
  const raw = runWranglerCapture('kv namespace list', { cwd: DEPLOY_DIR });
  const namespaces = JSON.parse(raw);
  return namespaces.filter(ns => ns.title === KV_NAMESPACE_NAME);
}

async function listKvNamespacesByTitle(env, accountId) {
  const matches = [];
  const headers = getCfHeaders(env);
  if (headers) {
    try {
      const list = await fetchJson(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
        headers,
      );
      matches.push(...(list.result ?? []).filter(ns => ns.title === KV_NAMESPACE_NAME));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Cloudflare API 列出 KV 失败，尝试 wrangler: ${message}`);
    }
  }

  if (matches.length === 0) {
    try {
      matches.push(...listKvNamespacesViaWrangler());
    } catch {
      // fall through
    }
  }

  return matches;
}

function pickExistingNamespaceId(matches, preferredIds = []) {
  for (const preferredId of preferredIds) {
    if (!preferredId || preferredId === PLACEHOLDER_KV_ID) {
      continue;
    }
    const match = matches.find(ns => ns.id === preferredId);
    if (match?.id) {
      return match.id;
    }
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    log(
      `警告: 发现 ${matches.length} 个同名 KV 命名空间 "${KV_NAMESPACE_NAME}"，绑定 ${matches[0].id}（请在 Dashboard 设置 SYNC_KV_NAMESPACE_ID 固定绑定）`,
    );
  }

  return matches[0].id;
}

export async function ensureKvNamespace(env, accountId, { dryRun = false } = {}) {
  const explicitId = env.SYNC_KV_NAMESPACE_ID?.trim();
  const state = loadState();
  const preferredIds = [explicitId, state.namespaceId].filter(Boolean);

  const existingMatches = await listKvNamespacesByTitle(env, accountId);
  const existingId = pickExistingNamespaceId(existingMatches, preferredIds);

  if (existingId) {
    if (explicitId && explicitId !== existingId) {
      log(`SYNC_KV_NAMESPACE_ID (${explicitId}) 与按名称找到的命名空间 (${existingId}) 不一致，使用按名称找到的命名空间`);
    } else if (explicitId) {
      log(`使用 SYNC_KV_NAMESPACE_ID: ${existingId}`);
    } else if (state.namespaceId === existingId) {
      log(`复用已有 KV 命名空间: ${existingId}`);
    } else {
      log(`找到已有 KV 命名空间: ${existingId}`);
    }
    saveState({ namespaceId: existingId, namespaceName: KV_NAMESPACE_NAME, accountId });
    return existingId;
  }

  if (explicitId && explicitId !== PLACEHOLDER_KV_ID) {
    log(`使用 SYNC_KV_NAMESPACE_ID（未在账户中验证）: ${explicitId}`);
    saveState({ namespaceId: explicitId, namespaceName: KV_NAMESPACE_NAME, accountId });
    return explicitId;
  }

  if (dryRun) {
    log('dry-run: 跳过 KV 命名空间创建');
    return state.namespaceId ?? PLACEHOLDER_KV_ID;
  }

  log(`创建 KV 命名空间: ${KV_NAMESPACE_NAME}`);
  const raw = runWranglerCapture(`kv namespace create "${KV_NAMESPACE_NAME}"`, { cwd: DEPLOY_DIR });
  const parsed = JSON.parse(raw);
  const namespaceId = parsed.id;
  if (!namespaceId) {
    fail(`KV 命名空间创建失败: ${raw}`);
  }

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

export async function prepareWranglerConfig(env, { dryRun = false } = {}) {
  const accountId = await resolveAccountId(env);
  const namespaceId = await ensureKvNamespace(env, accountId, { dryRun });
  if (dryRun && namespaceId === PLACEHOLDER_KV_ID) {
    log('dry-run: 跳过 wrangler.toml KV 绑定写入');
    return { accountId, namespaceId };
  }
  updateWranglerKvBinding(namespaceId);
  log(`wrangler.toml 已绑定 SYNC_KV → ${namespaceId} (Worker: ${WORKER_NAME})`);
  return { accountId, namespaceId };
}
