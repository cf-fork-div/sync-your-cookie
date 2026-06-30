import { settingsStorage } from '@sync-your-cookie/storage/lib/settingsStorage';

export interface SyncApiError {
  ok: false;
  error: string;
  message?: string;
}

export interface SyncStatusResponse {
  ok: true;
  datasourceConfigured: boolean;
  storageKey?: string;
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function authHeaders(password: string): HeadersInit {
  return {
    Authorization: `Bearer ${password}`,
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  return data;
}

export async function verifySyncServer(serverUrl: string, password: string): Promise<SyncStatusResponse> {
  const base = normalizeServerUrl(serverUrl);
  const res = await fetch(`${base}/api/sync/status`, {
    method: 'GET',
    headers: authHeaders(password),
  });

  if (res.status === 401) {
    throw new Error('wrong_password');
  }
  if (res.status === 503) {
    const data = await parseJsonResponse<SyncApiError>(res).catch(() => ({ error: 'service_unavailable' }));
    if (data.error === 'password_not_configured') {
      throw new Error('password_not_configured');
    }
    if (data.error === 'datasource_not_configured') {
      throw new Error('datasource_not_configured');
    }
    throw new Error('service_unavailable');
  }
  if (!res.ok) {
    throw new Error('network_error');
  }

  const data = await parseJsonResponse<SyncStatusResponse>(res);
  if (!data.ok) {
    throw new Error('verify_failed');
  }
  if (!data.datasourceConfigured) {
    throw new Error('datasource_not_configured');
  }
  return data;
}

export async function readSyncKV(serverUrl: string, password: string, storageKey?: string): Promise<string> {
  const base = normalizeServerUrl(serverUrl);
  const key = storageKey || settingsStorage.getSnapshot()?.storageKey || 'sync-your-cookie';
  const url = new URL(`${base}/api/sync/kv`);
  url.searchParams.set('storageKey', key);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: authHeaders(password),
  });

  if (res.status === 401) {
    return Promise.reject({ message: 'Unauthorized', code: 'unauthorized' });
  }
  if (res.status === 404) {
    return '';
  }
  if (res.status === 503) {
    const data = await parseJsonResponse<SyncApiError>(res).catch(() => null);
    if (data?.error === 'datasource_not_configured') {
      return Promise.reject({
        message: 'Server data source is not configured. Ask admin to set up Cloudflare KV on the web console.',
        code: 'datasource_not_configured',
      });
    }
  }
  if (!res.ok) {
    const text = await res.text();
    return Promise.reject({ message: text || `Read failed (${res.status})` });
  }
  const text = await res.text();
  return text.trim();
}

export async function writeSyncKV(
  serverUrl: string,
  password: string,
  value: string,
  storageKey?: string,
): Promise<{ success: boolean; errors: { code: number; message: string }[] }> {
  const base = normalizeServerUrl(serverUrl);
  const key = storageKey || settingsStorage.getSnapshot()?.storageKey || 'sync-your-cookie';
  const url = new URL(`${base}/api/sync/kv`);
  url.searchParams.set('storageKey', key);

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      ...authHeaders(password),
      'Content-Type': 'text/plain',
    },
    body: value,
  });

  if (res.status === 401) {
    return { success: false, errors: [{ code: 401, message: 'Unauthorized' }] };
  }
  if (!res.ok) {
    const data = await parseJsonResponse<SyncApiError>(res).catch(() => null);
    return {
      success: false,
      errors: [{ code: res.status, message: data?.message || data?.error || 'Write failed' }],
    };
  }
  return { success: true, errors: [] };
}
