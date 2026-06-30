import { useCallback, useEffect, useState } from 'react';
import {
  BrowserCookieItem,
  CookieFormData,
  fetchBrowserCookies,
  parseImportedCookies,
  removeBrowserCookie,
  resolveDomainUrl,
  setBrowserCookie,
} from '../../../lib/browserCookies';

export const useLiveBrowserCookies = (host: string) => {
  const [cookies, setCookies] = useState<BrowserCookieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainUrl, setDomainUrl] = useState('');

  const refresh = useCallback(async () => {
    if (!host) return;
    setLoading(true);
    try {
      const url = await resolveDomainUrl(host);
      setDomainUrl(url);
      const items = await fetchBrowserCookies(host);
      setCookies(items);
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSet = async (form: CookieFormData) => {
    await setBrowserCookie(form);
    await refresh();
  };

  const handleRemove = async (cookie: BrowserCookieItem) => {
    await removeBrowserCookie(cookie, domainUrl);
    await refresh();
  };

  const handleImport = async (json: string, defaultUrl: string) => {
    const items = parseImportedCookies(json);
    for (const item of items) {
      if (!item.name || !item.domain) continue;
      await setBrowserCookie({
        name: item.name,
        value: item.value ?? '',
        domain: item.domain,
        path: item.path ?? '/',
        expirationDate: item.expirationDate ?? null,
        secure: item.secure ?? false,
        httpOnly: item.httpOnly ?? false,
        sameSite: item.sameSite ?? 'unspecified',
        url: defaultUrl,
      });
    }
    await refresh();
  };

  return {
    cookies,
    loading,
    domainUrl,
    refresh,
    handleSet,
    handleRemove,
    handleImport,
  };
};
