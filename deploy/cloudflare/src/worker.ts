import { handleCfApi } from './handlers/cf-api';
import { handleLogin } from './handlers/login';
import { handleLogout } from './handlers/logout';
import { handleSession } from './handlers/session';
import type { WorkerEnv } from './lib/env';
import { isCfApiPath } from './lib/env';
import { applyMiddleware, assetPathForRequest } from './middleware';

export interface Env extends WorkerEnv {
  ASSETS: Fetcher;
}

function serveAsset(request: Request, pathname: string, env: Env): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = assetPathForRequest(pathname);
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const middleware = await applyMiddleware(request, env);
    if (middleware.response) {
      return middleware.response;
    }

    const { pathname } = middleware;

    if (pathname === '/api/login') {
      return handleLogin(request, env);
    }
    if (pathname === '/api/session') {
      return handleSession(request, env);
    }
    if (pathname === '/api/logout') {
      return handleLogout(request, env);
    }
    if (isCfApiPath(pathname)) {
      return handleCfApi(request);
    }

    return serveAsset(request, pathname, env);
  },
};
