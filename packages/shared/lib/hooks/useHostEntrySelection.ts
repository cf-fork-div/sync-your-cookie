import { useEffect, useMemo, useState } from 'react';
import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { getHostFromStorageKey, listEntryKeysForHost } from '../domain/entryKey';
import { listHostEntryOptions, resolveSelectedEntryKey } from '../domain/hostEntries';
import { useI18n } from '../i18n/useI18n';
import { useStorageSuspense } from './index';

export const useHostEntrySelection = (host: string) => {
  const { t } = useI18n();
  const domainConfig = useStorageSuspense(domainConfigStorage);
  const cookieMap = useStorageSuspense(cookieStorage);
  const defaultLabel = t('defaultAccount');

  const entries = useMemo(
    () => listHostEntryOptions(host, domainConfig, cookieMap, defaultLabel),
    [host, domainConfig, cookieMap, defaultLabel],
  );

  const hasAccountEntries = useMemo(() => {
    if (!host) {
      return false;
    }
    const remoteKeys = listEntryKeysForHost(cookieMap?.domainCookieMap ?? undefined, host);
    if (remoteKeys.length >= 1) {
      return true;
    }
    return Object.keys(domainConfig.domainMap).some(key => getHostFromStorageKey(key) === host);
  }, [host, cookieMap, domainConfig]);

  const [selectedStorageKey, setSelectedStorageKeyState] = useState('');

  useEffect(() => {
    if (!host) {
      setSelectedStorageKeyState('');
      return;
    }
    setSelectedStorageKeyState(current =>
      resolveSelectedEntryKey(host, current, domainConfig, entries),
    );
  }, [host, domainConfig, entries]);

  const setSelectedStorageKey = async (storageKey: string) => {
    setSelectedStorageKeyState(storageKey);
    await domainConfigStorage.setLastSelectedEntry(host, storageKey);
  };

  return {
    entries,
    selectedStorageKey: selectedStorageKey || host,
    setSelectedStorageKey,
    hasAccountEntries,
    hasMultipleAccounts: entries.length > 1,
  };
};
