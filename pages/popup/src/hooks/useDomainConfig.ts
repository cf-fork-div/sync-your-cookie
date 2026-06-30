import { useCookieAction, useHostEntrySelection, useI18n, usePushWithAccountChoice, useStorageSuspense } from '@sync-your-cookie/shared';
import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { useState } from 'react';
import { toast } from 'sonner';

export const useDomainConfig = () => {
  const { t } = useI18n();
  const [domain, setDomain] = useState('');
  const cookieMap = useStorageSuspense(cookieStorage);
  const { entries, selectedStorageKey, setSelectedStorageKey, hasMultipleAccounts } = useHostEntrySelection(domain);
  const activeStorageKey = selectedStorageKey || domain;
  const cookieAction = useCookieAction(activeStorageKey, toast);

  const pushChoice = usePushWithAccountChoice({
    cookieMap,
    defaultNewLabel: t('newProfile'),
    onPush: cookieAction.handlePush,
    onEntrySelected: (_host: string, storageKey: string) => {
      void setSelectedStorageKey(storageKey);
    },
  });

  const requestPush = async (sourceUrl?: string, favIconUrl?: string) => {
    if (!domain) {
      return;
    }
    await pushChoice.requestPush({
      host: domain,
      selectedStorageKey: activeStorageKey,
      sourceUrl,
      favIconUrl,
    });
  };

  return {
    domain,
    setDomain,
    activeStorageKey,
    entryOptions: entries,
    hasMultipleAccounts,
    setSelectedStorageKey,
    requestPush,
    pushChoice,
    ...cookieAction,
  };
};
