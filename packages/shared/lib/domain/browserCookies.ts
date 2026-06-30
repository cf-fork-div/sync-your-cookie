import type { ComparableCookie } from './cookieCompare';

export const getBrowserCookiesForHost = async (
  host: string,
  sourceUrl?: string,
): Promise<ComparableCookie[]> => {
  const cleanHost = host.startsWith('.') ? host.slice(1) : host;
  const url = sourceUrl || `https://${cleanHost}`;
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
  }));
};
