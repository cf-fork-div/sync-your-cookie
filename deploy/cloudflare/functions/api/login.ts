import { getWebAccessPassword } from '../lib/env';
import { createSessionCookie, isSecureRequest } from '../lib/session';
import { jsonResponse } from '../lib/response';

interface LoginBody {
  password?: string;
}

export const onRequestPost: PagesFunction = async context => {
  if (context.request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const configuredPassword = getWebAccessPassword(context.env as { WEB_ACCESS_PASSWORD?: string });
  if (!configuredPassword) {
    return jsonResponse({ ok: false, error: 'password_not_configured' }, { status: 503 });
  }

  let body: LoginBody;
  try {
    body = (await context.request.json()) as LoginBody;
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

  const secure = isSecureRequest(context.request);
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
};
