import { apiUrl, parseJsonResponse } from './api';
import { getDevViteBasePath, PRODUCTION_BASE_PATH, segmentToBasePathPrefix } from './basePath';

export type SessionInfo = {
  authenticated: boolean;
  passwordConfigured: boolean;
  basePath: string;
};

export type LoginResult =
  | { ok: true }
  | { ok: false; error: 'wrong_password' | 'password_not_configured' | 'network_error' | 'missing_password' };

const DEV_FALLBACK_PASSWORD = 'dev';
const LEGACY_AUTH_SESSION_KEY = 'syc-web-viewer-auth';

function isRuntimeAuthMode(): boolean {
  return import.meta.env.PROD;
}

function getDevPassword(): string | null {
  const configured = import.meta.env.VITE_WEB_ACCESS_PASSWORD?.trim();
  if (configured) {
    return configured;
  }
  if (import.meta.env.DEV) {
    return DEV_FALLBACK_PASSWORD;
  }
  return null;
}

function legacyDevLogin(password: string): boolean {
  const expected = getDevPassword();
  if (!expected || password !== expected) {
    return false;
  }
  sessionStorage.setItem(LEGACY_AUTH_SESSION_KEY, '1');
  return true;
}

function legacyDevIsAuthenticated(): boolean {
  return sessionStorage.getItem(LEGACY_AUTH_SESSION_KEY) === '1';
}

function legacyDevLogout(): void {
  sessionStorage.removeItem(LEGACY_AUTH_SESSION_KEY);
}

export function isPasswordConfiguredLocally(): boolean {
  if (isRuntimeAuthMode()) {
    return true;
  }
  return getDevPassword() !== null;
}

export async function fetchSession(): Promise<SessionInfo> {
  if (!isRuntimeAuthMode()) {
    return {
      authenticated: legacyDevIsAuthenticated(),
      passwordConfigured: getDevPassword() !== null,
      basePath: import.meta.env.VITE_WEB_BASE_PATH?.trim()
        ? segmentToBasePathPrefix(import.meta.env.VITE_WEB_BASE_PATH)
        : getDevViteBasePath(undefined),
    };
  }

  try {
    const res = await fetch(apiUrl('/api/session').toString(), { credentials: 'same-origin' });
    if (!res.ok) {
      throw new Error('session_fetch_failed');
    }
    return await parseJsonResponse<SessionInfo>(res);
  } catch {
    return {
      authenticated: false,
      passwordConfigured: false,
      basePath: PRODUCTION_BASE_PATH,
    };
  }
}

export async function login(password: string): Promise<LoginResult> {
  const trimmed = password.trim();
  if (!trimmed) {
    return { ok: false, error: 'missing_password' };
  }

  if (!isRuntimeAuthMode()) {
    return legacyDevLogin(trimmed) ? { ok: true } : { ok: false, error: 'wrong_password' };
  }

  try {
    const res = await fetch(apiUrl('/api/login').toString(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: trimmed }),
    });
    const data = await parseJsonResponse<{ ok?: boolean; error?: string }>(res);
    if (res.ok && data.ok) {
      return { ok: true };
    }
    if (data.error === 'password_not_configured') {
      return { ok: false, error: 'password_not_configured' };
    }
    if (res.status === 401) {
      return { ok: false, error: 'wrong_password' };
    }
    return { ok: false, error: 'network_error' };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function logout(): Promise<void> {
  if (!isRuntimeAuthMode()) {
    legacyDevLogout();
    return;
  }

  try {
    await fetch(apiUrl('/api/logout').toString(), {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // ignore network errors; client state will reset anyway
  }
}
