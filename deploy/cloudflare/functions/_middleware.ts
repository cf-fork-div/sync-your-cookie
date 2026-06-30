import {
  getWebAccessPassword,
  getWebBasePathPrefix,
  getWebBasePathSegment,
  isApiPath,
  isCfApiPath,
  isStaticAssetPath,
  stripBasePathPrefix,
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

export const onRequest: PagesFunction = async context => {
  const env = context.env as { WEB_ACCESS_PASSWORD?: string; WEB_BASE_PATH?: string };
  const url = new URL(context.request.url);
  const baseSegment = getWebBasePathSegment(env);
  const basePrefix = getWebBasePathPrefix(env);

  let pathname = url.pathname;
  const hadBasePrefix =
    baseSegment !== null &&
    (pathname === `/${baseSegment}` || pathname.startsWith(`/${baseSegment}/`));

  if (baseSegment) {
    if (pathname === '/') {
      return new Response('Not Found', { status: 404 });
    }
    if (pathname === `/${baseSegment}`) {
      return Response.redirect(`${url.origin}/${baseSegment}/`, 302);
    }
    if (hadBasePrefix) {
      pathname = stripBasePathPrefix(pathname, baseSegment);
    } else if (!isApiPath(pathname) && !isCfApiPath(pathname)) {
      return new Response('Not Found', { status: 404 });
    }
  }

  if (shouldRequireAuth(pathname)) {
    const password = getWebAccessPassword(env);
    if (!password) {
      return new Response('Service Unavailable', { status: 503 });
    }
    const authenticated = await isValidSession(context.request, password);
    if (!authenticated) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  if (hadBasePrefix) {
    if (pathname === '/' || pathname === '/index.html') {
      return context.rewrite(new URL('/index.html', url.origin));
    }
    if (isStaticAssetPath(pathname)) {
      return context.rewrite(new URL(pathname, url.origin));
    }
  }

  return context.next();
};
