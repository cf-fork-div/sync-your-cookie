import { accountProfileStorage, getActiveProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { defaultKey } from '@sync-your-cookie/storage/lib/settingsTypes';
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

export class SyncPullError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'SyncPullError';
    this.code = code;
    this.status = status;
  }
}

function isSyncErrorRecord(value: unknown): value is { message?: string; code?: string } {
  return isRecord(value);
}

export function getSyncVerifyErrorCode(err: unknown): string {
  if (err instanceof SyncVerifyError) {
    return err.message;
  }
  if (err instanceof SyncPullError) {
    return err.code;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (isSyncErrorRecord(err) && typeof err.code === 'string' && err.code) {
    return err.code;
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
  if (err instanceof SyncPullError) {
    const parts = [err.message];
    if (err.status !== undefined) {
      parts.push(`HTTP ${err.status}`);
    }
    return parts.join(' · ');
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (isSyncErrorRecord(err)) {
    if (typeof err.message === 'string' && err.message) {
      return err.message;
    }
    if (typeof err.code === 'string' && err.code) {
      return err.code;
    }
  }
  return 'verify_failed';
}

/** @deprecated Use formatSyncVerifyErrorMessage — kept for callers that already import this name. */
export const formatSyncError = formatSyncVerifyErrorMessage;

export function resolveSyncStorageKey(override?: string): string {
  if (override?.trim()) {
    return override.trim();
  }
  const profile = getActiveProfile(accountProfileStorage.getSnapshot());
  if (profile?.defaultStorageKey?.trim()) {
    return profile.defaultStorageKey.trim();
  }
  return settingsStorage.getSnapshot()?.storageKey?.trim() || defaultKey;
}

export async function applyServerStorageKey(storageKey: string): Promise<void> {
  const key = storageKey.trim() || defaultKey;
  await accountProfileStorage.updateActiveProfile({ defaultStorageKey: key });
  await settingsStorage.addStorageKey(key);
  const current = settingsStorage.getSnapshot()?.storageKey;
  if (current !== key) {
    await settingsStorage.update({ storageKey: key });
  }
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function assertAllowedStorageKey(storageKey: string): void {
  const profile = getActiveProfile(accountProfileStorage.getSnapshot());
  if (profile?.defaultStorageKey === storageKey) {
    return;
  }
  const settings = settingsStorage.getSnapshot();
  const allowed = settings?.storageKeyList?.map(item => item.value) ?? [];
  if (!allowed.includes(storageKey)) {
    throw new SyncPullError(
      'storage_key_not_allowed',
      'Storage key is not allowed in extension settings. Try signing in again to sync the server key.',
    );
  }
}

async function readJsonErrorBody(res: Response): Promise<SyncApiError | null> {
  try {
    return (await res.json()) as SyncApiError;
  } catch {
    return null;
  }
}

function pullHttpError(code: string, message: string, status: number): SyncPullError {
  return new SyncPullError(code, message, status);
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
  const key = resolveSyncStorageKey(storageKey);
  assertAllowedStorageKey(key);
  const url = new URL(`${base}/api/sync/kv`);
  url.searchParams.set('storageKey', key);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: authHeaders(password),
    });
  } catch (err) {
    throw new SyncPullError('network_error', err instanceof Error ? err.message : String(err));
  }

  if (res.status === 401) {
    throw pullHttpError('wrong_password', 'Unauthorized', 401);
  }
  if (res.status === 404) {
    return '';
  }
  if (res.status === 403) {
    const data = await readJsonErrorBody(res);
    throw pullHttpError(
      data?.error || 'storage_key_not_allowed',
      data?.message || 'Storage key is not allowed by the server.',
      403,
    );
  }
  if (res.status === 503) {
    const data = await readJsonErrorBody(res);
    if (data?.error === 'datasource_not_configured') {
      throw pullHttpError(
        'datasource_not_configured',
        'Server data source is not configured. Ask admin to set up Cloudflare KV on the web console.',
        503,
      );
    }
    throw pullHttpError(
      data?.error || 'service_unavailable',
      data?.message || 'Sync service is unavailable.',
      503,
    );
  }
  if (!res.ok) {
    const data = await readJsonErrorBody(res);
    const message = data?.message || data?.error || `Read failed (${res.status})`;
    throw pullHttpError(data?.error || `http_${res.status}`, message, res.status);
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
  const key = resolveSyncStorageKey(storageKey);
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
