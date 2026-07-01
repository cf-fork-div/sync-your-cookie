const LOGIN_RATE_PREFIX = '__syc_login_rate__:';
const MAX_ATTEMPTS = 5;
const WINDOW_SEC = 900;

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP')?.trim() ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function checkLoginRateLimit(
  ip: string,
  kv: KVNamespace,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `${LOGIN_RATE_PREFIX}${ip}`;
  const raw = await kv.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  if (count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: WINDOW_SEC };
  }
  return { allowed: true };
}

export async function recordLoginFailure(ip: string, kv: KVNamespace): Promise<void> {
  const key = `${LOGIN_RATE_PREFIX}${ip}`;
  const raw = await kv.get(key);
  const count = (raw ? Number.parseInt(raw, 10) : 0) + 1;
  await kv.put(key, String(count), { expirationTtl: WINDOW_SEC });
}

export async function clearLoginRateLimit(ip: string, kv: KVNamespace): Promise<void> {
  await kv.delete(`${LOGIN_RATE_PREFIX}${ip}`);
}
