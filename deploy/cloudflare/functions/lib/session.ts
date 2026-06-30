const SESSION_COOKIE = 'syc_session';
const SESSION_SALT = 'syc-web-viewer-v1';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function signSession(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(SESSION_SALT));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function createSessionCookie(password: string, secure: boolean): Promise<string> {
  const token = await signSession(password);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
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

export async function isValidSession(request: Request, password: string): Promise<boolean> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return false;
  }
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match?.[1]) {
    return false;
  }
  const token = decodeURIComponent(match[1]);
  const expected = await signSession(password);
  return token === expected;
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}
