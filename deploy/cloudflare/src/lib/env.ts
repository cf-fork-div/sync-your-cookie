export interface WorkerEnv {
  WEB_ACCESS_PASSWORD?: string;
  WEB_BASE_PATH?: string;
}

export function getWebAccessPassword(env: WorkerEnv): string | null {
  const password = env.WEB_ACCESS_PASSWORD?.trim();
  return password || null;
}

/** Normalize to URL segment without slashes, e.g. `my-cookie-vault` */
export function getWebBasePathSegment(env: WorkerEnv): string | null {
  const raw = env.WEB_BASE_PATH?.trim();
  if (!raw || raw === '/') {
    return null;
  }
  return raw.replace(/^\/+|\/+$/g, '') || null;
}

/** Prefix with leading/trailing slashes, e.g. `/my-cookie-vault/` */
export function getWebBasePathPrefix(env: WorkerEnv): string {
  const segment = getWebBasePathSegment(env);
  if (!segment) {
    return '/';
  }
  return `/${segment}/`;
}

export function stripBasePathPrefix(pathname: string, baseSegment: string | null): string {
  if (!baseSegment) {
    return pathname;
  }
  const prefix = `/${baseSegment}`;
  if (pathname === prefix || pathname === `${prefix}/`) {
    return '/';
  }
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length) || '/';
  }
  return pathname;
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

export function isCfApiPath(pathname: string): boolean {
  return pathname === '/cf-api' || pathname.startsWith('/cf-api/');
}

export function isStaticAssetPath(pathname: string): boolean {
  if (pathname.startsWith('/assets/')) {
    return true;
  }
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}
