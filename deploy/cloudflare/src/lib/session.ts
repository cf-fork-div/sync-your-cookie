const SESSION_COOKIE = 'syc_session';
const SESSION_KV_PREFIX = '__syc_session__:';
const LEGACY_SESSION_SALT = 'syc-web-viewer-v1';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function signLegacySession(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(LEGACY_SESSION_SALT));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

export async function createSessionCookie(password: string, secure: boolean, kv: KVNamespace): Promise<string> {
  const sessionId = crypto.randomUUID();
  await kv.put(`${SESSION_KV_PREFIX}${sessionId}`, '1', { expirationTtl: SESSION_MAX_AGE });

  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function createLogoutCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export async function revokeSession(request: Request, kv: KVNamespace): Promise<void> {
  const token = extractSessionToken(request);
  if (token && UUID_PATTERN.test(token)) {
    await kv.delete(`${SESSION_KV_PREFIX}${token}`);
  }
}

export async function isValidSession(request: Request, password: string, kv: KVNamespace): Promise<boolean> {
  const token = extractSessionToken(request);
  if (!token) {
    return false;
  }

  if (UUID_PATTERN.test(token)) {
    const stored = await kv.get(`${SESSION_KV_PREFIX}${token}`);
    return stored !== null;
  }

  const expected = await signLegacySession(password);
  return token === expected;
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}
