import { accountProfileStorage, getActiveProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { domainStatusStorage } from '@sync-your-cookie/storage/lib/domainStatusStorage';
import { pullCookies } from '../cookie/withStorage';
import { normalizeServerUrl, verifySyncServer } from '../sync/api';
import { useCallback, useMemo, useState } from 'react';
import { isAccountConfigured } from '../auth/accountAuth';
import { useStorageSuspense } from './useStorageSuspense';

export type AccountLoginForm = {
  serverUrl: string;
  authPassword: string;
  profileName?: string;
};

export const useAccountAuth = () => {
  const profileState = useStorageSuspense(accountProfileStorage);
  const activeProfile = getActiveProfile(profileState);
  const [loggingIn, setLoggingIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAuthenticated = useMemo(() => isAccountConfigured(activeProfile), [activeProfile]);

  const login = useCallback(async (form: AccountLoginForm) => {
    const serverUrl = normalizeServerUrl(form.serverUrl);
    const authPassword = form.authPassword.trim();
    if (!serverUrl || !authPassword) {
      throw new Error('missing_credentials');
    }
    setLoggingIn(true);
    try {
      await verifySyncServer(serverUrl, authPassword);
      await accountProfileStorage.updateActiveProfile({
        name: form.profileName?.trim() || activeProfile?.name,
        serverUrl,
        authPassword,
        accountId: undefined,
        namespaceId: undefined,
        token: undefined,
      });
      await pullCookies();
    } finally {
      setLoggingIn(false);
    }
  }, [activeProfile?.name]);

  const refreshConnection = useCallback(async () => {
    const serverUrl = normalizeServerUrl(activeProfile?.serverUrl || '');
    const authPassword = activeProfile?.authPassword?.trim() || '';
    if (!serverUrl || !authPassword) {
      throw new Error('missing_credentials');
    }
    setRefreshing(true);
    try {
      await verifySyncServer(serverUrl, authPassword);
      await domainStatusStorage.resetState();
      await pullCookies();
      if (activeProfile?.serverUrl !== serverUrl) {
        await accountProfileStorage.updateActiveProfile({ serverUrl });
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeProfile?.serverUrl, activeProfile?.authPassword]);

  return {
    activeProfile,
    isAuthenticated,
    loggingIn,
    refreshing,
    login,
    refreshConnection,
  };
};
