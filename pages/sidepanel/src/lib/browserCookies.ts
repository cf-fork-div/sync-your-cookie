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

export async function resolveDomainUrl(host: string): Promise<string> {
  const domainConfig = await domainConfigStorage.get();
  const config = domainConfig?.domainMap?.[host];
  const sourceUrl = config?.sourceUrl;
  if (sourceUrl) {
    return sourceUrl;
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (activeTab?.url && activeTab.url.includes(host)) {
    return activeTab.url;
  }
  const cleanHost = host.startsWith('.') ? host.slice(1) : host;
  return `https://${cleanHost}`;
}

export function toBrowserCookieItem(cookie: chrome.cookies.Cookie, index: number): BrowserCookieItem {
  return {
    id: `${cookie.domain}_${cookie.name}_${index}`,
    domain: cookie.domain,
    name: cookie.name,
    value: cookie.value,
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

export async function fetchBrowserCookies(host: string): Promise<BrowserCookieItem[]> {
  const url = await resolveDomainUrl(host);
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map((cookie, index) => toBrowserCookieItem(cookie, index));
}

export function buildSetDetails(form: CookieFormData): chrome.cookies.SetDetails {
  const itemHost = form.domain.startsWith('.') ? form.domain.slice(1) : form.domain;
  const urlObj = new URL(form.url);
  const href = `${urlObj.protocol}//${itemHost || urlObj.hostname}`;
  return {
    url: href,
    name: form.name,
    value: form.value,
    domain: form.domain.startsWith('.') || !form.url ? form.domain : undefined,
    path: form.path || '/',
    expirationDate: form.expirationDate ?? undefined,
    secure: form.secure,
    httpOnly: form.httpOnly,
    sameSite: form.sameSite,
    storeId: undefined,
  };
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
  cookie: Pick<BrowserCookieItem, 'name' | 'domain' | 'path' | 'storeId'>,
  url: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.cookies.remove(
      {
        url,
        name: cookie.name,
        storeId: cookie.storeId ?? undefined,
      },
      details => {
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
