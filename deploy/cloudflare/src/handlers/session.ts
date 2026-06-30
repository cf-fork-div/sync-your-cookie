import { getWebAccessPassword, getWebBasePathPrefix, type WorkerEnv } from '../lib/env';
import { jsonResponse } from '../lib/response';
import { isValidSession } from '../lib/session';

export async function handleSession(request: Request, env: WorkerEnv): Promise<Response> {
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
