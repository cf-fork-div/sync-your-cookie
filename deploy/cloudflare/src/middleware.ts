import {
  getWebAccessPassword,
  getWebBasePathSegment,
  isApiPath,
  isCfApiPath,
  isStaticAssetPath,
  stripBasePathPrefix,
  type WorkerEnv,
} from './lib/env';
import { isValidSession } from './lib/session';

const PUBLIC_API_SUFFIXES = ['/api/login', '/api/session', '/api/logout'];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_SUFFIXES.includes(pathname);
}

function shouldRequireAuth(pathname: string): boolean {
  if (isCfApiPath(pathname)) {
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
    const authenticated = await isValidSession(request, password);
    if (!authenticated) {
      return { pathname, response: new Response('Unauthorized', { status: 401 }) };
    }
  }

  return { pathname };
}

export function assetPathForRequest(pathname: string): string {
  if (pathname === '/' || pathname === '/index.html') {
    return '/index.html';
  }
  if (isStaticAssetPath(pathname)) {
    return pathname;
  }
  return pathname;
}
