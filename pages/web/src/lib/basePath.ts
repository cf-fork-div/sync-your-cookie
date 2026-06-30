/** Prefix with leading/trailing slashes, e.g. `my-vault` → `/my-vault/`; empty → `/` */
export function segmentToBasePathPrefix(segment: string | null | undefined): string {
  const trimmed = segment?.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return '/';
  }
  return `/${trimmed}/`;
}

/** Dev Vite base from VITE_WEB_BASE_PATH; default `/syc/` when unset */
export function getDevViteBasePath(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return '/syc/';
  }
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!path.endsWith('/')) {
    path = `${path}/`;
  }
  return path;
}

export const PRODUCTION_BASE_PATH = '/';
