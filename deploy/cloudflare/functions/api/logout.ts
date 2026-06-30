import { createLogoutCookie, isSecureRequest } from '../lib/session';
import { jsonResponse } from '../lib/response';

export const onRequestPost: PagesFunction = async context => {
  if (context.request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const secure = isSecureRequest(context.request);
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
};
