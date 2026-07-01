import { ICookie } from '@sync-your-cookie/protobuf';

import { getHostFromStorageKey } from '../domain/entryKey';
import { normalizeCookieHost } from './browserCookies';

const VALID_SAME_SITE: chrome.cookies.SameSiteStatus[] = ['unspecified', 'no_restriction', 'lax', 'strict'];

function normalizeSameSite(sameSite?: string | null): chrome.cookies.SameSiteStatus | undefined {
  if (!sameSite || sameSite === 'unspecified') {
    return undefined;
  }
  if (VALID_SAME_SITE.includes(sameSite as chrome.cookies.SameSiteStatus)) {
    return sameSite as chrome.cookies.SameSiteStatus;
  }
  return undefined;
}

/** Whether a browser cookie change is relevant when viewing a domain entry in the UI. */
export function cookieMatchesHost(
  cookie: Pick<ICookie, 'domain' | 'hostOnly'>,
  hostOrStorageKey: string,
): boolean {
  const normalizedHost = normalizeCookieHost(getHostFromStorageKey(hostOrStorageKey));
  const cookieDomain = normalizeCookieHost(cookie.domain || '');
  if (!cookieDomain) return false;
  if (cookieDomain === normalizedHost) return true;
  if (cookie.hostOnly) {
    return cookieDomain.endsWith(`.${normalizedHost}`);
  }
  return normalizedHost.endsWith(`.${cookieDomain}`) || cookieDomain.endsWith(`.${normalizedHost}`);
}

export function buildPullCookieUrl(
  cookie: Pick<ICookie, 'domain' | 'path' | 'secure' | 'name'>,
  activeTabUrl: string,
): string {
  const fallback = new URL(activeTabUrl);
  const isHostPrefixed = (cookie.name || '').startsWith('__Host-');
  const isSecurePrefixed = (cookie.name || '').startsWith('__Secure-');
  const protocol = cookie.secure || isHostPrefixed || isSecurePrefixed ? 'https:' : fallback.protocol;
  const host = (cookie.domain || '').startsWith('.') ? cookie.domain!.slice(1) : cookie.domain || fallback.hostname;
  const path = isHostPrefixed ? '/' : cookie.path || '/';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${host}${normalizedPath}`;
}

export function buildPullCookieSetDetails(
  cookie: ICookie,
  activeTabUrl: string,
): chrome.cookies.SetDetails {
  const isHostPrefixed = (cookie.name || '').startsWith('__Host-');
  const isSecurePrefixed = (cookie.name || '').startsWith('__Secure-');
  const sameSite = normalizeSameSite(cookie.sameSite);
  let secure = isHostPrefixed || isSecurePrefixed ? true : (cookie.secure ?? undefined);
  if (sameSite === 'no_restriction' && !secure) {
    secure = true;
  }
  const path = isHostPrefixed ? '/' : cookie.path ?? undefined;
  const url = buildPullCookieUrl({ ...cookie, secure: secure ?? false }, activeTabUrl);

  const details: chrome.cookies.SetDetails = {
    url,
    name: cookie.name ?? undefined,
    value: cookie.value ?? undefined,
    expirationDate: cookie.session ? undefined : cookie.expirationDate ?? undefined,
    path,
    httpOnly: cookie.httpOnly ?? undefined,
    secure,
    sameSite,
  };

  if (!isHostPrefixed && !cookie.hostOnly && cookie.domain?.startsWith('.')) {
    details.domain = cookie.domain;
  }

  return details;
}

export function setCookieInBrowser(details: chrome.cookies.SetDetails): Promise<chrome.cookies.Cookie> {
  return new Promise((resolve, reject) => {
    try {
      chrome.cookies.set(details, cookie => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!cookie) {
          reject(new Error(`Failed to set cookie "${details.name ?? ''}"`));
          return;
        }
        resolve(cookie);
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
