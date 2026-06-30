import { useEffect, useMemo, useState } from 'react';
import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
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
    hasMultipleAccounts: entries.length > 1,
  };
};
