import { getWebAccessPassword, type WorkerEnv } from '../lib/env';
import { clearLoginRateLimit, checkLoginRateLimit, getClientIp, recordLoginFailure } from '../lib/rate-limit';
import { jsonResponse } from '../lib/response';
import { createSessionCookie, isSecureRequest } from '../lib/session';

interface LoginBody {
  password?: string;
}

export async function handleLogin(request: Request, env: WorkerEnv, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const configuredPassword = getWebAccessPassword(env);
  if (!configuredPassword) {
    return jsonResponse({ ok: false, error: 'password_not_configured' }, { status: 503 });
  }

  const clientIp = getClientIp(request);
  const rateLimit = await checkLoginRateLimit(clientIp, kv);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { ok: false, error: 'rate_limited', retryAfter: rateLimit.retryAfter },
      { status: 429 },
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password) {
    return jsonResponse({ ok: false, error: 'missing_password' }, { status: 400 });
  }

  if (password !== configuredPassword) {
    await recordLoginFailure(clientIp, kv);
    return jsonResponse({ ok: false, error: 'wrong_password' }, { status: 401 });
  }

  await clearLoginRateLimit(clientIp, kv);
  const secure = isSecureRequest(request);
  const setCookie = await createSessionCookie(configuredPassword, secure, kv);
  return jsonResponse(
    { ok: true },
    {
      status: 200,
      headers: {
        'Set-Cookie': setCookie,
      },
    },
  );
}
