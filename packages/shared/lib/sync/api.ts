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

export class SyncVerifyError extends Error {
  readonly status?: number;
  readonly detail?: string;
  readonly serverError?: string;

  constructor(
    code: string,
    options?: {
      status?: number;
      detail?: string;
      serverError?: string;
    },
  ) {
    super(code);
    this.name = 'SyncVerifyError';
    this.status = options?.status;
    this.detail = options?.detail;
    this.serverError = options?.serverError;
  }
}

export function getSyncVerifyErrorCode(err: unknown): string {
  if (err instanceof SyncVerifyError) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'verify_failed';
}

export function formatSyncVerifyErrorMessage(err: unknown): string {
  if (err instanceof SyncVerifyError) {
    const parts: string[] = [];
    const label = err.serverError && err.serverError !== err.message ? err.serverError : err.message;
    parts.push(label);
    if (err.status !== undefined) {
      parts.push(`HTTP ${err.status}`);
    }
    if (err.detail) {
      parts.push(err.detail);
    }
    return parts.join(' · ');
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'verify_failed';
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function assertAllowedStorageKey(storageKey: string): void {
  const settings = settingsStorage.getSnapshot();
  const allowed = settings?.storageKeyList?.map(item => item.value) ?? [];
  if (!allowed.includes(storageKey)) {
    throw new Error('storage_key_not_allowed');
  }
}

function authHeaders(password: string): HeadersInit {
  return {
    Authorization: `Bearer ${password}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readServerError(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  if (typeof body.error === 'string' && body.error) {
    return body.error;
  }
  if (typeof body.message === 'string' && body.message) {
    return body.message;
  }
  return undefined;
}

async function readResponseBody(res: Response): Promise<{ body: unknown; raw: string }> {
  const raw = await res.text();
  if (!raw.trim()) {
    return { body: null, raw };
  }
  try {
    return { body: JSON.parse(raw) as unknown, raw };
  } catch {
    throw new SyncVerifyError('invalid_response', {
      status: res.status,
      detail: raw.slice(0, 200),
    });
  }
}

function mapUnauthorizedError(body: unknown): SyncVerifyError {
  const serverError = readServerError(body);
  return new SyncVerifyError('wrong_password', {
    status: 401,
    serverError,
    detail: serverError && serverError !== 'wrong_password' ? serverError : undefined,
  });
}

function mapHttpError(status: number, body: unknown, raw: string): SyncVerifyError {
  const serverError = readServerError(body);

  if (status === 503) {
    if (serverError === 'password_not_configured') {
      return new SyncVerifyError('password_not_configured', { status, serverError });
    }
    if (serverError === 'datasource_not_configured') {
      return new SyncVerifyError('datasource_not_configured', { status, serverError });
    }
    return new SyncVerifyError('service_unavailable', { status, serverError, detail: raw.slice(0, 200) });
  }

  if (status === 429) {
    return new SyncVerifyError('rate_limited', { status, serverError, detail: raw.slice(0, 200) });
  }

  if (status === 401) {
    return mapUnauthorizedError(body);
  }

  const code = serverError || `http_${status}`;
  return new SyncVerifyError(code, {
    status,
    serverError,
    detail: raw.slice(0, 200),
  });
}

function mapUnexpectedSuccessBody(body: unknown, status: number, raw: string): SyncVerifyError {
  if (isRecord(body) && 'authenticated' in body && !('ok' in body)) {
    return new SyncVerifyError('wrong_endpoint', {
      status,
      serverError: 'session_response',
      detail: 'Server returned /api/session payload; use Worker root URL (no /api suffix).',
    });
  }

  const serverError = readServerError(body);
  return new SyncVerifyError(serverError || 'verify_failed', {
    status,
    serverError,
    detail: raw.slice(0, 200),
  });
}

export async function verifySyncServer(serverUrl: string, password: string): Promise<SyncStatusResponse> {
  const base = normalizeServerUrl(serverUrl);
  let res: Response;
  try {
    res = await fetch(`${base}/api/sync/status`, {
      method: 'GET',
      headers: authHeaders(password),
    });
  } catch (err) {
    throw new SyncVerifyError('network_error', {
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const { body, raw } = await readResponseBody(res);

  if (res.status === 401) {
    throw mapUnauthorizedError(body);
  }

  if (res.status === 503) {
    throw mapHttpError(res.status, body, raw);
  }

  if (!res.ok) {
    throw mapHttpError(res.status, body, raw);
  }

  if (!isRecord(body) || body.ok !== true) {
    throw mapUnexpectedSuccessBody(body, res.status, raw);
  }

  const data: SyncStatusResponse = {
    ok: true,
    datasourceConfigured: body.datasourceConfigured === true,
    storageKey: typeof body.storageKey === 'string' ? body.storageKey : undefined,
  };
  if (!data.datasourceConfigured) {
    throw new SyncVerifyError('datasource_not_configured', { status: res.status });
  }

  return data;
}

export async function readSyncKV(serverUrl: string, password: string, storageKey?: string): Promise<string> {
  const base = normalizeServerUrl(serverUrl);
  const key = storageKey || settingsStorage.getSnapshot()?.storageKey || 'sync-your-cookie';
  assertAllowedStorageKey(key);
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
    const data = (await res.json().catch(() => null)) as SyncApiError | null;
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
  assertAllowedStorageKey(key);
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
    const data = (await res.json().catch(() => null)) as SyncApiError | null;
    return {
      success: false,
      errors: [{ code: res.status, message: data?.message || data?.error || 'Write failed' }],
    };
  }
  return { success: true, errors: [] };
}
