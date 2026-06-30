import { getWebAccessPassword, getWebBasePathPrefix, type WorkerEnv } from '../lib/env';
import { jsonResponse } from '../lib/response';
import { isValidSession } from '../lib/session';

export async function handleSession(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const configuredPassword = getWebAccessPassword(env);
  const basePath = getWebBasePathPrefix(env);

  if (!configuredPassword) {
    return jsonResponse({
      authenticated: false,
      passwordConfigured: false,
      basePath,
    });
  }

  const authenticated = await isValidSession(request, configuredPassword);
  return jsonResponse({
    authenticated,
    passwordConfigured: true,
    basePath,
  });
}
