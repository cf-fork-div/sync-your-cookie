import { jsonResponse } from '../lib/response';
import { createLogoutCookie, isSecureRequest, revokeSession } from '../lib/session';

export async function handleLogout(request: Request, kv: KVNamespace): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  await revokeSession(request, kv);
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
