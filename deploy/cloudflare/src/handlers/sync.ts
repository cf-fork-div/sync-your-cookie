import { loadDatasourceConfig, readKvValue, writeKvValue, type DatasourceConfig } from '../lib/datasource';
import { getWebAccessPassword, type WorkerEnv } from '../lib/env';
import { jsonResponse } from '../lib/response';

const STORAGE_KEY_PATTERN = /^[a-zA-Z0-9._-]{1,128}$/;

function getStorageKeyParam(request: Request): string | undefined {
  const url = new URL(request.url);
  const key = url.searchParams.get('storageKey')?.trim();
  return key || undefined;
}

function resolveAllowedStorageKey(request: Request, config: DatasourceConfig): string | null {
  const requested = getStorageKeyParam(request);
  const key = requested || config.storageKey;
  if (!STORAGE_KEY_PATTERN.test(key)) {
    return null;
  }
  const allowed = new Set([config.storageKey, ...(config.allowedStorageKeys ?? [])]);
  if (!allowed.has(key)) {
    return null;
  }
  return key;
}

export async function handleSyncStatus(request: Request, env: WorkerEnv, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const password = getWebAccessPassword(env);
  if (!password) {
    return jsonResponse({ ok: false, error: 'password_not_configured' }, { status: 503 });
  }

  const config = await loadDatasourceConfig(kv);
  return jsonResponse({
    ok: true,
    datasourceConfigured: Boolean(config),
    storageKey: config?.storageKey,
  });
}

export async function handleSyncKvGet(request: Request, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const config = await loadDatasourceConfig(kv);
  if (!config) {
    return jsonResponse({ ok: false, error: 'datasource_not_configured' }, { status: 503 });
  }

  const storageKey = resolveAllowedStorageKey(request, config);
  if (!storageKey) {
    return jsonResponse({ ok: false, error: 'storage_key_not_allowed' }, { status: 403 });
  }

  try {
    const content = await readKvValue(config, storageKey);
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'read_failed';
    return jsonResponse({ ok: false, error: 'read_failed', message }, { status: 502 });
  }
}

export async function handleSyncKvPut(request: Request, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'PUT') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const config = await loadDatasourceConfig(kv);
  if (!config) {
    return jsonResponse({ ok: false, error: 'datasource_not_configured' }, { status: 503 });
  }

  const storageKey = resolveAllowedStorageKey(request, config);
  if (!storageKey) {
    return jsonResponse({ ok: false, error: 'storage_key_not_allowed' }, { status: 403 });
  }

  const content = await request.text();
  try {
    await writeKvValue(config, content, storageKey);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'write_failed';
    return jsonResponse({ ok: false, error: 'write_failed', message }, { status: 502 });
  }
}
