import { getWebAccessPassword, type WorkerEnv } from '../lib/env';
import { jsonResponse } from '../lib/response';
import { createSessionCookie, isSecureRequest } from '../lib/session';

interface LoginBody {
  password?: string;
}

export async function handleLogin(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const configuredPassword = getWebAccessPassword(env);
  if (!configuredPassword) {
    return jsonResponse({ ok: false, error: 'password_not_configured' }, { status: 503 });
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
    return jsonResponse({ ok: false, error: 'wrong_password' }, { status: 401 });
  }

  const secure = isSecureRequest(request);
  const setCookie = await createSessionCookie(configuredPassword, secure);
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
