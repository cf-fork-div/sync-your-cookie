import {
  getWebAccessPassword,
  getWebBasePathSegment,
  isApiPath,
  isCfApiPath,
  stripBasePathPrefix,
  type WorkerEnv,
} from './lib/env';
import { isPasswordAuthorized } from './lib/request-auth';
import { isValidSession } from './lib/session';

const PUBLIC_API_SUFFIXES = ['/api/login', '/api/session', '/api/logout'];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_SUFFIXES.includes(pathname);
}

function isSyncApiPath(pathname: string): boolean {
  return pathname === '/api/sync' || pathname.startsWith('/api/sync/');
}

function isAdminApiPath(pathname: string): boolean {
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}

function shouldRequireAuth(pathname: string): boolean {
  if (isCfApiPath(pathname)) {
    return true;
  }
  if (isSyncApiPath(pathname)) {
    return true;
  }
  if (isAdminApiPath(pathname)) {
    return true;
  }
  if (isApiPath(pathname) && !isPublicApiPath(pathname)) {
    return true;
  }
  return false;
}

export interface MiddlewareResult {
  pathname: string;
  /** Early response (redirect, 404, 401, etc.) */
  response?: Response;
}

export async function applyMiddleware(request: Request, env: WorkerEnv): Promise<MiddlewareResult> {
  const url = new URL(request.url);
  const baseSegment = getWebBasePathSegment(env);

  let pathname = url.pathname;
  const hadBasePrefix =
    baseSegment !== null && (pathname === `/${baseSegment}` || pathname.startsWith(`/${baseSegment}/`));

  if (baseSegment) {
    if (pathname === `/${baseSegment}`) {
      return {
        pathname,
        response: Response.redirect(`${url.origin}/${baseSegment}/`, 302),
      };
    }
    if (hadBasePrefix) {
      pathname = stripBasePathPrefix(pathname, baseSegment);
    } else if (!isApiPath(pathname) && !isCfApiPath(pathname)) {
      return { pathname, response: new Response('Not Found', { status: 404 }) };
    }
  }

  if (shouldRequireAuth(pathname)) {
    const password = getWebAccessPassword(env);
    if (!password) {
      return { pathname, response: new Response('Service Unavailable', { status: 503 }) };
    }

    if (isSyncApiPath(pathname)) {
      const authorized = await isPasswordAuthorized(request, env);
      if (!authorized) {
        return { pathname, response: new Response('Unauthorized', { status: 401 }) };
      }
    } else if (isAdminApiPath(pathname)) {
      const authenticated = await isValidSession(request, password);
      if (!authenticated) {
        return { pathname, response: new Response('Unauthorized', { status: 401 }) };
      }
    } else {
      const authenticated = await isValidSession(request, password);
      if (!authenticated) {
        return { pathname, response: new Response('Unauthorized', { status: 401 }) };
      }
    }
  }

  return { pathname };
}

/** Map viewer paths to ASSETS fetch paths without triggering html_handling redirect loops. */
export function assetPathForRequest(pathname: string): string {
  // Cloudflare assets redirect /index.html → / (307). Never fetch /index.html from the worker.
  if (pathname === '/index.html') {
    return '/';
  }
  return pathname;
}
