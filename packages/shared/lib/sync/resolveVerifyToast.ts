import { formatSyncVerifyErrorMessage, getSyncVerifyErrorCode } from './api';

export function resolveSyncVerifyToast<K extends string>(
  err: unknown,
  t: (key: K, params?: Record<string, string | number>) => string,
): { variant: 'warning' | 'error'; message: string } {
  const code = getSyncVerifyErrorCode(err);

  if (code === 'missing_credentials') {
    return { variant: 'warning', message: t('serverUrlPasswordRequired' as K) };
  }
  if (code === 'wrong_password') {
    return { variant: 'error', message: t('wrongPassword' as K) };
  }
  if (code === 'datasource_not_configured') {
    return { variant: 'error', message: t('datasourceNotConfigured' as K) };
  }
  if (code === 'password_not_configured') {
    return { variant: 'error', message: t('accessPasswordNotConfigured' as K) };
  }
  if (code === 'rate_limited') {
    return {
      variant: 'error',
      message: t('verifyFailed' as K, { message: formatSyncVerifyErrorMessage(err) }),
    };
  }

  return {
    variant: 'error',
    message: t('verifyFailed' as K, { message: formatSyncVerifyErrorMessage(err) }),
  };
}
