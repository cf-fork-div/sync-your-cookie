import { getHostFromStorageKey } from '../domain/entryKey';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';

export type BrowserCookieItem = {
  id: string;
  domain: string;
  name: string;
  value: string;
  path: string;
  expirationDate?: number | null;
  session?: boolean | null;
  hostOnly?: boolean | null;
  httpOnly?: boolean | null;
  sameSite?: string | null;
  secure?: boolean | null;
  storeId?: string | null;
};

export type CookieFormData = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: chrome.cookies.SameSiteStatus;
  url: string;
};

export const SAME_SITE_OPTIONS: chrome.cookies.SameSiteStatus[] = [
  'unspecified',
  'no_restriction',
  'lax',
  'strict',
];

export function normalizeCookieHost(host: string): string {
  return host.replace(/^\./, '').replace(/:\d+$/, '').toLowerCase();
}

/** Stable key for matching stored vs browser cookies during pull mirror cleanup. */
export function pullCookieKey(cookie: { domain?: string | null; name?: string | null; path?: string | null }): string {
  const domain = normalizeCookieHost(cookie.domain || '');
  const path = cookie.path && cookie.path.length > 0 ? cookie.path : '/';
  return `${domain}|${cookie.name ?? ''}|${path}`;
}

function hostMatchesUrl(normalizedHost: string, url: string): boolean {
  if (!url.startsWith('http')) {
    return false;
  }
  try {
    const tabHost = normalizeCookieHost(new URL(url).hostname);
    return tabHost === normalizedHost || tabHost.endsWith(`.${normalizedHost}`);
  } catch {
    return false;
  }
}

export async function resolveDomainUrl(host: string, tabUrl?: string): Promise<string> {
  const domainConfig = await domainConfigStorage.get();
  const config = domainConfig?.domainMap?.[host];
  const sourceUrl = config?.sourceUrl;
  if (sourceUrl) {
    return sourceUrl;
  }

  const normalizedHost = normalizeCookieHost(host);

  if (tabUrl && hostMatchesUrl(normalizedHost, tabUrl)) {
    return tabUrl;
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = tabs[0];
  if (activeTab?.url && hostMatchesUrl(normalizedHost, activeTab.url)) {
    return activeTab.url;
  }

  return `https://${normalizedHost}`;
}

function browserCookieKey(cookie: chrome.cookies.Cookie): string {
  return `${cookie.storeId ?? ''}|${cookie.domain}|${cookie.name}|${cookie.path}`;
}

export function toBrowserCookieItem(cookie: chrome.cookies.Cookie, index: number): BrowserCookieItem {
  return {
    id: browserCookieKey(cookie) || `cookie_${index}`,
    domain: cookie.domain,
    name: cookie.name ?? '',
    value: cookie.value ?? '',
    path: cookie.path,
    expirationDate: cookie.expirationDate ?? null,
    session: cookie.session ?? null,
    hostOnly: cookie.hostOnly ?? null,
    httpOnly: cookie.httpOnly ?? null,
    sameSite: cookie.sameSite ?? null,
    secure: cookie.secure ?? null,
    storeId: cookie.storeId ?? null,
  };
}

/** Merge URL-scoped and domain-scoped browser cookies (same strategy as the cookie editor). */
export async function gatherRawBrowserCookies(
  hostOrStorageKey: string,
  tabUrl?: string,
): Promise<chrome.cookies.Cookie[]> {
  const cookieHost = normalizeCookieHost(getHostFromStorageKey(hostOrStorageKey));
  const url = await resolveDomainUrl(hostOrStorageKey, tabUrl);
  const [urlCookies, domainCookies] = await Promise.all([
    chrome.cookies.getAll({ url }),
    chrome.cookies.getAll({ domain: cookieHost }),
  ]);

  const merged = new Map<string, chrome.cookies.Cookie>();
  for (const cookie of [...urlCookies, ...domainCookies]) {
    merged.set(browserCookieKey(cookie), cookie);
  }

  return Array.from(merged.values());
}

export async function fetchBrowserCookies(host: string, tabUrl?: string): Promise<BrowserCookieItem[]> {
  const cookies = await gatherRawBrowserCookies(host, tabUrl);
  return cookies.map((cookie, index) => toBrowserCookieItem(cookie, index));
}

export function buildCookieUrl(
  cookie: Pick<BrowserCookieItem, 'domain' | 'path' | 'secure' | 'name'>,
  fallbackUrl: string,
): string {
  const fallback = new URL(fallbackUrl);
  const isHostPrefixed = cookie.name.startsWith('__Host-');
  const protocol = cookie.secure || isHostPrefixed ? 'https:' : fallback.protocol;
  const host = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
  const path = isHostPrefixed ? '/' : cookie.path || '/';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${host || fallback.hostname}${normalizedPath}`;
}

export function buildSetDetails(form: CookieFormData): chrome.cookies.SetDetails {
  const isHostPrefixed = form.name.startsWith('__Host-');
  const isSecurePrefixed = form.name.startsWith('__Secure-');
  const urlObj = new URL(form.url);
  const path = isHostPrefixed ? '/' : form.path || '/';
  const secure = isHostPrefixed || isSecurePrefixed ? true : form.secure;
  const itemHost = form.domain.startsWith('.') ? form.domain.slice(1) : form.domain;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const protocol = secure ? 'https:' : urlObj.protocol;
  const href = `${protocol}//${itemHost || urlObj.hostname}${normalizedPath}`;

  const details: chrome.cookies.SetDetails = {
    url: href,
    name: form.name,
    value: form.value,
    path,
    expirationDate: form.expirationDate ?? undefined,
    secure,
    httpOnly: form.httpOnly,
    sameSite: form.sameSite,
    storeId: undefined,
  };

  if (!isHostPrefixed && form.domain.startsWith('.')) {
    details.domain = form.domain;
  }

  return details;
}

export async function setBrowserCookie(form: CookieFormData): Promise<void> {
  const details = buildSetDetails(form);
  return new Promise((resolve, reject) => {
    chrome.cookies.set(details, cookie => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!cookie) {
        reject(new Error('Failed to set cookie'));
        return;
      }
      resolve();
    });
  });
}

export async function removeBrowserCookie(
  cookie: Pick<BrowserCookieItem, 'name' | 'domain' | 'path' | 'secure' | 'storeId'>,
  url: string,
): Promise<void> {
  const removeUrl = buildCookieUrl(cookie, url);
  return new Promise((resolve, reject) => {
    chrome.cookies.remove(
      {
        url: removeUrl,
        name: cookie.name,
        storeId: cookie.storeId ?? undefined,
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      },
    );
  });
}

export function browserCookieToForm(cookie: BrowserCookieItem, url: string): CookieFormData {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    expirationDate: cookie.expirationDate ?? null,
    secure: cookie.secure ?? false,
    httpOnly: cookie.httpOnly ?? false,
    sameSite: (cookie.sameSite as chrome.cookies.SameSiteStatus) ?? 'unspecified',
    url,
  };
}

export function formatExpiration(expirationDate?: number | null, session?: boolean | null): string {
  if (session || !expirationDate) {
    return 'Session';
  }
  return new Date(expirationDate * 1000).toLocaleString();
}

export async function clearAllBrowserCookies(host: string, tabUrl?: string): Promise<void> {
  const url = await resolveDomainUrl(host, tabUrl);
  const cookies = await fetchBrowserCookies(host, tabUrl);
  for (const cookie of cookies) {
    await removeBrowserCookie(cookie, url);
  }
}

/** Serialize cookies as HTTP `Cookie` header value (`name=value; name2=value2`). */
export function serializeCookieHeader(cookies: BrowserCookieItem[]): string {
  return cookies
    .filter(cookie => cookie.name)
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export function parseImportedCookies(json: string): Partial<CookieFormData>[] {
  const parsed = JSON.parse(json);
  const list = Array.isArray(parsed) ? parsed : parsed.cookies ?? [];
  return list.map((item: Record<string, unknown>) => ({
    name: String(item.name ?? ''),
    value: String(item.value ?? ''),
    domain: String(item.domain ?? ''),
    path: String(item.path ?? '/'),
    expirationDate: typeof item.expirationDate === 'number' ? item.expirationDate : null,
    secure: Boolean(item.secure),
    httpOnly: Boolean(item.httpOnly),
    sameSite: (item.sameSite as chrome.cookies.SameSiteStatus) ?? 'unspecified',
  }));
}
