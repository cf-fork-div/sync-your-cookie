import { useCookieAction, useI18n } from '@sync-your-cookie/shared';
import type { Cookie } from '@sync-your-cookie/storage/lib/cookieStorage';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CookieItem } from './../index';
import { useSelected } from './useSelected';

export const useAction = (cookie: Cookie) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [currentSearchStr, setCurrentSearchStr] = useState('');
  const {
    loading: loadingWithSelected,
    selectedDomain,
    showCookiesColumns,
    setSelectedDomain,
    cookieList,
    renderKeyValue,
    localStorageItems,
    ...rest
  } = useSelected(cookie, currentSearchStr);

  useEffect(() => {
    setCurrentSearchStr('');
  }, [selectedDomain]);

  const cookieAction = useCookieAction(selectedDomain, toast);
  const handleDelete = async (cookie: CookieItem): Promise<boolean> => {
    try {
      setLoading(true);
      return await cookieAction.handleRemove(cookie.storageKey);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async (activeTabUrl: string, cookie: CookieItem) => {
    try {
      setLoading(true);
      await cookieAction.handlePull(activeTabUrl, cookie.storageKey, true);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async (cookie: CookieItem, sourceUrl?: string) => {
    try {
      setLoading(true);
      await cookieAction.handlePush(cookie.storageKey, sourceUrl);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCookies = async (domain: string) => {
    setSelectedDomain(domain);
  };

  const handleBack = () => {
    setCurrentSearchStr('');
    setSelectedDomain('');
  };

  const handleCopy = (domain: string, isJSON: boolean = false) => {
    const cookies = cookie.domainCookieMap?.[domain]?.cookies || [];
    if (cookies.length === 0) {
      toast.warning(t('noCookieToCopy'));
      return;
    }
    if (!navigator.clipboard) {
      toast.warning(t('checkClipboardPermission'));
      return;
    }
    let copyText = '';
    if (isJSON) {
      copyText = JSON.stringify(cookies, undefined, 2);
    } else {
      const pairs = [];
      for (const ck of cookies) {
        if (ck.value) {
          const pair = `${ck.name}=${ck.value}`;
          pairs.push(pair);
        }
      }
      copyText = pairs.join('; ');
    }
    navigator?.clipboard?.writeText(copyText).then(
      () => {
        toast.success(t('copySuccess'));
      },
      err => {
        console.log('err', err);
        toast.error(t('copyFailed'));
      },
    );
  };

  const handleSearch = (val: string) => {
    setCurrentSearchStr(val);
  };

  return {
    handleDelete,
    handlePull,
    handlePush,
    handleViewCookies,
    loading: loading || loadingWithSelected,
    selectedDomain,
    setSelectedDomain,
    handleBack,
    showCookiesColumns,
    cookieAction,
    handleCopy,
    currentSearchStr,
    // handlePush,
    handleSearch,
    renderKeyValue,
    cookieList: cookieList.filter(item => {
      if (currentSearchStr.trim()) {
        return (
          item.domain.includes(currentSearchStr) ||
          item.name.includes(currentSearchStr) ||
          item.value.includes(currentSearchStr)
        );
      }
      return true;
    }),
    localStorageItems: localStorageItems.filter(item => {
      if (currentSearchStr.trim()) {
        return item.key?.includes(currentSearchStr) || item.value?.includes(currentSearchStr);
      }
      return true;
    }),
    ...rest,
  };
};
