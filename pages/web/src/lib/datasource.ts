import { apiUrl, parseJsonResponse } from '@src/lib/api';

export type DatasourceStatus = {
  ok: boolean;
  configured: boolean;
  accountId?: string;
  namespaceId?: string;
  storageKey?: string;
  tokenMasked?: string;
};

export type DatasourceConfigInput = {
  accountId: string;
  namespaceId: string;
  token: string;
  storageKey: string;
};

export async function fetchDatasourceStatus(): Promise<DatasourceStatus> {
  const res = await fetch(apiUrl('/api/admin/datasource').toString(), { credentials: 'same-origin' });
  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  const data = await parseJsonResponse<DatasourceStatus & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'fetch_datasource_failed');
  }
  return data;
}

export async function saveDatasourceConfig(config: DatasourceConfigInput): Promise<DatasourceStatus> {
  const res = await fetch(apiUrl('/api/admin/datasource').toString(), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  const data = await parseJsonResponse<DatasourceStatus & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'save_datasource_failed');
  }
  return data;
}

export async function fetchKvViaServer(storageKey?: string): Promise<string> {
  const url = apiUrl('/api/sync/kv');
  if (storageKey?.trim()) {
    url.searchParams.set('storageKey', storageKey.trim());
  }
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (res.status === 404) {
    return '';
  }
  if (res.status === 401) {
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    if (text.trimStart().startsWith('<!')) {
      throw new Error('api_html_response');
    }
    throw new Error(text || `read_failed_${res.status}`);
  }
  return (await res.text()).trim();
}
