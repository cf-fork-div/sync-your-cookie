export type ComparableCookie = {
  name?: string | null;
  value?: string | null;
  domain?: string | null;
};

export const buildCookieSignature = (cookies: ComparableCookie[] | undefined): string => {
  if (!cookies?.length) {
    return '';
  }
  return cookies
    .filter(cookie => cookie.name && cookie.value)
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .sort()
    .join(';');
};

export const browserCookiesDifferFromKv = (
  browserCookies: ComparableCookie[],
  kvCookies: ComparableCookie[] | undefined,
): boolean => {
  if (!kvCookies?.length) {
    return browserCookies.some(cookie => cookie.name && cookie.value);
  }
  return buildCookieSignature(browserCookies) !== buildCookieSignature(kvCookies);
};

export const findMatchingKvEntryKey = (
  browserCookies: ComparableCookie[],
  entries: { storageKey: string; kvCookies?: ComparableCookie[] }[],
): string | undefined => {
  for (const entry of entries) {
    if (!browserCookiesDifferFromKv(browserCookies, entry.kvCookies)) {
      return entry.storageKey;
    }
  }
  return undefined;
};
