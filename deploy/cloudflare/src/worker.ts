import { handleCfApi } from './handlers/cf-api';
import { handleGetDatasource, handlePutDatasource } from './handlers/datasource';
import { handleLogin } from './handlers/login';
import { handleLogout } from './handlers/logout';
import { handleSession } from './handlers/session';
import { handleSyncKvGet, handleSyncKvPut, handleSyncStatus } from './handlers/sync';
import { corsPreflightResponse, withCors } from './lib/cors';
import type { WorkerEnv } from './lib/env';
import { isCfApiPath } from './lib/env';
import { applyMiddleware, assetPathForRequest } from './middleware';

export interface Env extends WorkerEnv {
  ASSETS: Fetcher;
  SYNC_KV: KVNamespace;
}

function serveAsset(request: Request, pathname: string, env: Env): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = assetPathForRequest(pathname);
  return env.ASSETS.fetch(new Request(url, request));
}

function isSyncPath(pathname: string): boolean {
  return pathname === '/api/sync' || pathname.startsWith('/api/sync/');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const preflight = corsPreflightResponse(request);
    if (preflight) {
      return preflight;
    }

    const middleware = await applyMiddleware(request, env);
    if (middleware.response) {
      return isSyncPath(middleware.pathname) ? withCors(middleware.response, request) : middleware.response;
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
    if (pathname === '/api/admin/datasource') {
      if (request.method === 'GET') {
        return handleGetDatasource(request, env.SYNC_KV);
      }
      if (request.method === 'PUT') {
        return handlePutDatasource(request, env.SYNC_KV);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }
    if (pathname === '/api/sync/status') {
      const response = await handleSyncStatus(request, env, env.SYNC_KV);
      return withCors(response, request);
    }
    if (pathname === '/api/sync/kv') {
      const response =
        request.method === 'GET'
          ? await handleSyncKvGet(request, env.SYNC_KV)
          : await handleSyncKvPut(request, env.SYNC_KV);
      return withCors(response, request);
    }
    if (isCfApiPath(pathname)) {
      return handleCfApi(request);
    }

    return serveAsset(request, pathname, env);
  },
};
