import {
  GITHUB_REPO_URL,
  resolveSyncVerifyToast,
  useAccountAuth,
  useI18n,
  useStorageSuspense,
} from '@sync-your-cookie/shared';
import { getActiveProfile, accountProfileStorage } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { AccountLoginScreen, type AccountLoginFormValues } from '@sync-your-cookie/ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type AccountLoginGateProps = {
  compact?: boolean;
};

export function AccountLoginGate({ compact = false }: AccountLoginGateProps) {
  const { t } = useI18n();
  const { loggingIn, login } = useAccountAuth();
  const profileState = useStorageSuspense(accountProfileStorage);
  const activeProfile = getActiveProfile(profileState);
  const [values, setValues] = useState<AccountLoginFormValues>({
    profileName: activeProfile?.name || '',
    serverUrl: activeProfile?.serverUrl || '',
    authPassword: '',
  });

  useEffect(() => {
    setValues(current => ({
      ...current,
      profileName: activeProfile?.name || current.profileName,
      serverUrl: activeProfile?.serverUrl || current.serverUrl,
    }));
  }, [activeProfile?.serverUrl, activeProfile?.name]);

  const handleSubmit = async () => {
    if (!values.serverUrl.trim() || !values.authPassword.trim()) {
      toast.warning(t('serverUrlPasswordRequired'));
      return;
    }
    try {
      await login(values);
      toast.success(t('loginSuccessSync'));
    } catch (err: unknown) {
      const { variant, message } = resolveSyncVerifyToast(err, t);
      if (variant === 'warning') {
        toast.warning(message);
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <AccountLoginScreen
      compact={compact}
      loggingIn={loggingIn}
      values={values}
      onChange={patch => setValues(current => ({ ...current, ...patch }))}
      onSubmit={handleSubmit}
      githubUrl={GITHUB_REPO_URL}
      labels={{
        title: t('extensionLoginTitle'),
        description: t('extensionLoginDesc'),
        profileName: t('profileName'),
        profileNamePlaceholder: t('profileNamePlaceholder'),
        serverUrl: t('syncServerUrl'),
        serverUrlPlaceholder: t('syncServerUrlPlaceholder'),
        authPassword: t('accessPassword'),
        authPasswordPlaceholder: t('accessPasswordPlaceholder'),
        submit: t('loginAndSync'),
        settingsHint: t('extensionLoginHint'),
      }}
    />
  );
}
