import {
  MessageErrorCode,
  pullCookieUsingMessage,
  pushCookieUsingMessage,
  removeCookieUsingMessage,
} from '@lib/message';
import type { MessageKey } from '@lib/i18n/messages';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { domainStatusStorage } from '@sync-your-cookie/storage/lib/domainStatusStorage';

import { toast as Toast } from 'sonner';
import { openExtensionOptionsPage } from '../constants';
import { useI18n } from '../i18n/useI18n';
import { useStorageSuspense } from './index';

const sceneFailKey: Record<'push' | 'pull' | 'remove' | 'delete' | 'edit', MessageKey> = {
  push: 'pushFail',
  pull: 'pullFailScene',
  remove: 'removeFail',
  delete: 'deleteFail',
  edit: 'editFail',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const catchHandler = (
  err: any,
  scene: 'push' | 'pull' | 'remove' | 'delete' | 'edit',
  toast: typeof Toast,
  t?: (key: MessageKey, params?: Record<string, string | number>) => string,
) => {
  const defaultMsg = t ? t(sceneFailKey[scene]) : `${scene} fail`;
  const code = err?.code;
  const settingErrors = [
    MessageErrorCode.AccountCheck,
    MessageErrorCode.CloudflareNotFoundRoute,
    MessageErrorCode.DecodeFailed,
    MessageErrorCode.DecryptFailed,
  ];
  if (settingErrors.includes(code)) {
    toast.error(err?.msg || err?.result?.message || defaultMsg, {
      action: {
        label: t ? t('goToSettings') : 'go to settings',
        onClick: () => {
          openExtensionOptionsPage();
        },
      },
    });
  } else {
    toast.error(err?.msg || defaultMsg);
  }
  console.log('err', err);
};

export const useCookieAction = (host: string, toast: typeof Toast) => {
  const { t } = useI18n();
  const domainStatus = useStorageSuspense(domainStatusStorage);
  const domainConfig = useStorageSuspense(domainConfigStorage);

  const handlePush = async (selectedHost = host, sourceUrl?: string, favIconUrl?: string) => {
    return pushCookieUsingMessage({
      host: selectedHost,
      sourceUrl,
      favIconUrl,
    })
      .then(res => {
        if (res.isOk) {
          toast.success(t('pushedSuccess'));
        } else {
          toast.error(res.msg || t('pushedFail'));
        }
        console.log('res', res);
      })
      .catch(err => {
        catchHandler(err, 'push', toast, t);
      });
  };

  const handlePull = async (activeTabUrl: string, selectedDomain = host, reload = true) => {
    return pullCookieUsingMessage({
      activeTabUrl: activeTabUrl,
      domain: selectedDomain,
      reload,
    })
      .then(res => {
        console.log('res', res);
        if (res.isOk) {
          toast.success(t('pullSuccess'));
        } else {
          toast.error(res.msg || t('pullFail'));
        }
      })
      .catch(err => {
        catchHandler(err, 'pull', toast, t);
      });
  };

  const handleRemove = async (selectedDomain = host) => {
    return removeCookieUsingMessage({
      domain: selectedDomain,
    })
      .then(async res => {
        console.log('res', res);
        if (res.isOk) {
          toast.success(res.msg || t('success'));
          await domainConfigStorage.removeItem(host);
        } else {
          toast.error(res.msg || t('removedFail'));
        }
        console.log('res', res);
      })
      .catch(err => {
        catchHandler(err, 'remove', toast, t);
      });
  };

  return {
    // domainConfig: domainConfig as typeof domainConfig,
    pulling: domainStatus.pulling,
    pushing: domainStatus.pushing,
    domainItemConfig: domainConfig?.domainMap?.[host] || {},
    domainItemStatus: domainStatus?.domainMap?.[host] || {},
    getDomainItemConfig: (selectedDomain: string) => {
      return domainConfig?.domainMap?.[selectedDomain] || {};
    },
    getDomainItemStatus: (selectedDomain: string) => {
      return domainStatus?.domainMap?.[selectedDomain] || {};
    },
    toggleAutoPullState: domainConfigStorage.toggleAutoPullState,
    toggleAutoPushState: domainConfigStorage.toggleAutoPushState,
    togglePullingState: domainStatusStorage.togglePullingState,
    togglePushingState: domainStatusStorage.togglePushingState,
    handlePush,
    handlePull,
    handleRemove,
  };
};
