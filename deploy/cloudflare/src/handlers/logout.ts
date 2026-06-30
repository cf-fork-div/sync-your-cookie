import { jsonResponse } from '../lib/response';
import { createLogoutCookie, isSecureRequest } from '../lib/session';

export async function handleLogout(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const secure = isSecureRequest(request);
  const setCookie = createLogoutCookie(secure);
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
