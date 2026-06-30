import { ICookie } from '@sync-your-cookie/protobuf';

export function cookieMatchesHost(cookie: Pick<ICookie, 'domain' | 'hostOnly'>, host: string): boolean {
  const normalizedHost = host.replace(/^\./, '').replace(/:\d+$/, '').toLowerCase();
  const cookieDomain = (cookie.domain || '').replace(/^\./, '').toLowerCase();
  if (!cookieDomain) return false;
  if (cookieDomain === normalizedHost) return true;
  if (cookie.hostOnly) return false;
  return normalizedHost === cookieDomain || normalizedHost.endsWith(`.${cookieDomain}`);
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
  const secure = isHostPrefixed || isSecurePrefixed ? true : (cookie.secure ?? undefined);
  const path = isHostPrefixed ? '/' : cookie.path ?? undefined;
  const url = buildPullCookieUrl({ ...cookie, secure: secure ?? false }, activeTabUrl);

  const details: chrome.cookies.SetDetails = {
    url,
    name: cookie.name ?? undefined,
    value: cookie.value ?? undefined,
    expirationDate: cookie.expirationDate ?? undefined,
    path,
    httpOnly: cookie.httpOnly ?? undefined,
    secure,
    sameSite: (cookie.sameSite ?? undefined) as chrome.cookies.SameSiteStatus,
  };

  if (!isHostPrefixed && cookie.domain?.startsWith('.')) {
    details.domain = cookie.domain;
  }

  return details;
}

export function setCookieInBrowser(details: chrome.cookies.SetDetails): Promise<chrome.cookies.Cookie | null> {
  return new Promise(resolve => {
    try {
      chrome.cookies.set(details, cookie => {
        if (chrome.runtime.lastError) {
          console.error('cookie set error', details, chrome.runtime.lastError.message);
        }
        resolve(cookie ?? null);
      });
    } catch (error) {
      console.error('cookie set error', details, error);
      resolve(null);
    }
  });
}
