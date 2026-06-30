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
  const res = await fetch('/api/admin/datasource', { credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error('fetch_datasource_failed');
  }
  return (await res.json()) as DatasourceStatus;
}

export async function saveDatasourceConfig(config: DatasourceConfigInput): Promise<DatasourceStatus> {
  const res = await fetch('/api/admin/datasource', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = (await res.json()) as DatasourceStatus & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'save_datasource_failed');
  }
  return data;
}

export async function fetchKvViaServer(storageKey?: string): Promise<string> {
  const url = new URL('/api/sync/kv', window.location.origin);
  if (storageKey?.trim()) {
    url.searchParams.set('storageKey', storageKey.trim());
  }
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (res.status === 404) {
    return '';
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `read_failed_${res.status}`);
  }
  return (await res.text()).trim();
}
