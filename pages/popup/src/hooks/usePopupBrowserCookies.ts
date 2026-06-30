import {
  clearAllBrowserCookies,
  cookieMatchesHost,
  fetchBrowserCookies,
  removeBrowserCookie,
  resolveDomainUrl,
  setBrowserCookie,
  type BrowserCookieItem,
  type CookieFormData,
} from '@sync-your-cookie/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export const usePopupBrowserCookies = (host: string, enabled: boolean, tabUrl?: string) => {
  const [cookies, setCookies] = useState<BrowserCookieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainUrl, setDomainUrl] = useState('');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!host || !enabled) return;
    setLoading(true);
    try {
      const url = await resolveDomainUrl(host, tabUrl);
      setDomainUrl(url);
      const items = await fetchBrowserCookies(host, tabUrl);
      setCookies(items);
    } finally {
      setLoading(false);
    }
  }, [host, enabled, tabUrl]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  useEffect(() => {
    if (!host || !enabled) return;

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
  }, [host, enabled, refresh]);

  const handleSet = async (cookie: BrowserCookieItem, form: CookieFormData) => {
    const identityChanged =
      form.name !== cookie.name || form.domain !== cookie.domain || form.path !== (cookie.path || '/');
    if (identityChanged) {
      await removeBrowserCookie(cookie, domainUrl);
    }
    await setBrowserCookie(form);
    await refresh();
  };

  const handleRemove = async (cookie: BrowserCookieItem) => {
    await removeBrowserCookie(cookie, domainUrl);
    await refresh();
  };

  const handleClearAll = async () => {
    await clearAllBrowserCookies(host, tabUrl);
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
  };
};
