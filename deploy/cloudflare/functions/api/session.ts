import { getWebAccessPassword, getWebBasePathPrefix } from '../lib/env';
import { isValidSession } from '../lib/session';
import { jsonResponse } from '../lib/response';

export const onRequestGet: PagesFunction = async context => {
  const env = context.env as { WEB_ACCESS_PASSWORD?: string; WEB_BASE_PATH?: string };
  const configuredPassword = getWebAccessPassword(env);
  const basePath = getWebBasePathPrefix(env);

  if (!configuredPassword) {
    return jsonResponse({
      authenticated: false,
      passwordConfigured: false,
      basePath,
    });
  }

  const authenticated = await isValidSession(context.request, configuredPassword);
  return jsonResponse({
    authenticated,
    passwordConfigured: true,
    basePath,
  });
};
