import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserCookieItem,
  CookieFormData,
  clearAllBrowserCookies,
  cookieMatchesHost,
  fetchBrowserCookies,
  removeBrowserCookie,
  resolveDomainUrl,
  setBrowserCookie,
} from '../../../lib/browserCookies';
import { parseCookieImport } from '../../../lib/cookieFormats';

export const useLiveBrowserCookies = (host: string) => {
  const [cookies, setCookies] = useState<BrowserCookieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainUrl, setDomainUrl] = useState('');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!host) return;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        refresh();
      }, 200);
    };

    const onChanged = (changeInfo: chrome.cookies.CookieChangeInfo) => {
      if (cookieMatchesHost(changeInfo.cookie, host)) {
        scheduleRefresh();
      }
    };

    chrome.cookies.onChanged.addListener(onChanged);
    return () => {
      chrome.cookies.onChanged.removeListener(onChanged);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [host, refresh]);

  const handleSet = async (form: CookieFormData) => {
    await setBrowserCookie(form);
    await refresh();
  };

  const handleRemove = async (cookie: BrowserCookieItem) => {
    await removeBrowserCookie(cookie, domainUrl);
    await refresh();
  };

  const handleClearAll = async () => {
    await clearAllBrowserCookies(host);
    await refresh();
  };

  const handleImport = async (text: string, defaultUrl: string, defaultDomain: string) => {
    const items = parseCookieImport(text, defaultDomain);
    for (const item of items) {
      if (!item.name) continue;
      await setBrowserCookie({
        name: item.name,
        value: item.value ?? '',
        domain: item.domain ?? defaultDomain,
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
    handleClearAll,
    handleImport,
  };
};
