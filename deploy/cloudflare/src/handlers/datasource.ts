import {
  loadDatasourceConfig,
  saveDatasourceConfig,
  toDatasourceStatus,
  type DatasourceConfig,
} from '../lib/datasource';
import { jsonResponse } from '../lib/response';

interface DatasourceBody {
  accountId?: string;
  namespaceId?: string;
  token?: string;
  storageKey?: string;
}

export async function handleGetDatasource(request: Request, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }
  const config = await loadDatasourceConfig(kv);
  return jsonResponse({ ok: true, ...toDatasourceStatus(config) });
}

export async function handlePutDatasource(request: Request, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'PUT') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  let body: DatasourceBody;
  try {
    body = (await request.json()) as DatasourceBody;
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const accountId = body.accountId?.trim();
  const namespaceId = body.namespaceId?.trim();
  const token = body.token?.trim();
  const storageKey = body.storageKey?.trim() || 'sync-your-cookie';

  if (!accountId || !namespaceId || !token) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const existing = await loadDatasourceConfig(kv);
  const config: DatasourceConfig = {
    accountId,
    namespaceId,
    token: token || existing?.token || '',
    storageKey,
  };

  if (!config.token) {
    return jsonResponse({ ok: false, error: 'missing_token' }, { status: 400 });
  }

  await saveDatasourceConfig(kv, config);
  return jsonResponse({ ok: true, ...toDatasourceStatus(config) });
}
