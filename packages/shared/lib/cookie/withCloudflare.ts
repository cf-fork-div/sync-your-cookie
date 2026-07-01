import { accountStorage, type AccountInfo } from '@sync-your-cookie/storage/lib/accountStorage';
import { accountProfileStorage, getActiveProfileDomainConfig } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { settingsStorage } from '@sync-your-cookie/storage/lib/settingsStorage';

import { readCloudflareKV, writeCloudflareKV, WriteResponse } from '../cloudflare/api';
import { isServerSyncConfigured } from '../auth/accountAuth';
import { readSyncKV, writeSyncKV } from '../sync/api';
import { mergeEntryMetaOnWrite } from '../domain/entryMetaSync';

import { MessageErrorCode } from '@lib/message';
import { devLog } from '@lib/utils/devLog';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decodeCookiesMap,
  decryptBase64,
  encodeCookiesMap,
  encryptBase64,
  ICookie,
  ICookiesMap,
  ILocalStorageItem,
  isBase64Encrypted,
} from '@sync-your-cookie/protobuf';

export const check = (accountInfo?: AccountInfo) => {
  const info = accountInfo || accountStorage.getSnapshot();
  if (isServerSyncConfigured(info)) {
    if (!info?.serverUrl?.trim()) {
      return Promise.reject({ message: 'Server URL is empty', code: MessageErrorCode.AccountCheck });
    }
    if (!info?.authPassword?.trim()) {
      return Promise.reject({ message: 'Auth password is empty', code: MessageErrorCode.AccountCheck });
    }
    return info;
  }
  const cloudflareAccountInfo = info;
  if (!cloudflareAccountInfo?.accountId || !cloudflareAccountInfo.namespaceId || !cloudflareAccountInfo.token) {
    let message = 'Account ID is empty';
    if (!cloudflareAccountInfo?.namespaceId) {
      message = 'NamespaceId ID is empty';
    } else if (!cloudflareAccountInfo.token) {
      message = 'Token is empty';
    }

    return Promise.reject({
      message,
      code: MessageErrorCode.AccountCheck,
    });
  }
  return cloudflareAccountInfo;
};

const readRemoteKv = async (accountInfo: AccountInfo): Promise<string> => {
  if (isServerSyncConfigured(accountInfo)) {
    return readSyncKV(accountInfo.serverUrl!, accountInfo.authPassword!);
  }
  return readCloudflareKV(accountInfo.accountId!, accountInfo.namespaceId!, accountInfo.token!);
};

const writeRemoteKv = async (accountInfo: AccountInfo, value: string): Promise<WriteResponse> => {
  if (isServerSyncConfigured(accountInfo)) {
    return writeSyncKV(accountInfo.serverUrl!, accountInfo.authPassword!, value);
  }
  return writeCloudflareKV(value, accountInfo.accountId!, accountInfo.namespaceId!, accountInfo.token!);
};

export const readCookiesMap = async (accountInfo: AccountInfo): Promise<ICookiesMap> => {
  await check(accountInfo);
  const content = await readRemoteKv(accountInfo);

  if (content) {
    try {
      const settingsInfo = settingsStorage.getSnapshot();
      const encryptionEnabled = settingsInfo?.encryptionEnabled;
      const encryptionPassword = settingsInfo?.encryptionPassword;

      // Check if content is encrypted and decrypt if needed
      let processedContent = content;
      const protobufEncoding = !content.startsWith('{');

      if (protobufEncoding && isBase64Encrypted(content)) {
        if (!encryptionEnabled || !encryptionPassword) {
          return Promise.reject({
            message: 'Failed to decrypt data. Please check your encryption password.',
            code: MessageErrorCode.DecryptFailed,
          });
        }
        try {
          processedContent = await decryptBase64(content, encryptionPassword);
        } catch (decryptError) {
          console.error('Decryption failed:', decryptError);
          return Promise.reject({
            message: 'Failed to decrypt data. Please check your encryption password.',
            code: MessageErrorCode.DecryptFailed,
          });
        }
      }

      if (protobufEncoding) {
        const compressedBuffer = base64ToArrayBuffer(processedContent);
        const deMsg = await decodeCookiesMap(compressedBuffer);
        devLog('readCookiesMap decoded protobuf');
        return deMsg;
      } else {
        devLog('readCookiesMap decoded json');
        return JSON.parse(processedContent);
      }
    } catch (error) {
      devLog('Decode error', error);
      return Promise.reject({
        message: `Decode error: ${error}, please check your save settings`,
        code: MessageErrorCode.DecodeFailed,
      });
    }
  } else {
    return {};
  }
};

export const writeCookiesMap = async (accountInfo: AccountInfo, cookiesMap: ICookiesMap = {}, oldCookieMap: ICookiesMap = {}) => {
  const settingsInfo = settingsStorage.getSnapshot();
  const protobufEncoding = settingsInfo?.protobufEncoding;
  const encryptionEnabled = settingsInfo?.encryptionEnabled;
  const encryptionPassword = settingsInfo?.encryptionPassword;

  await accountProfileStorage.ensureMigrated();
  const domainConfig = getActiveProfileDomainConfig(await accountProfileStorage.get());
  const cookiesMapWithMeta = mergeEntryMetaOnWrite(cookiesMap, oldCookieMap, domainConfig);

  let encodingStr = '';
  if (protobufEncoding) {
    const buffered = await encodeCookiesMap(cookiesMapWithMeta);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    encodingStr = arrayBufferToBase64(buffered as any);

    // Encrypt the data if encryption is enabled
    if (encryptionEnabled && encryptionPassword) {
      encodingStr = await encryptBase64(encodingStr, encryptionPassword);
      devLog('writeCookiesMap data encrypted');
    }
  } else {
    encodingStr = JSON.stringify(cookiesMapWithMeta);
    devLog('writeCookiesMap json payload');
  }

  const res = await writeRemoteKv(accountInfo, encodingStr);
  return res;
};

export const mergeAndWriteCookies = async (
  accountInfo: AccountInfo,
  domain: string,
  cookies: ICookie[],
  localStorageItems: ILocalStorageItem[] = [],
  userAgent = '',
  oldCookieMap: ICookiesMap = {},
): Promise<[WriteResponse, ICookiesMap]> => {
  await check(accountInfo);
  const cookiesMap: ICookiesMap = {
    updateTime: Date.now(),
    createTime: oldCookieMap?.createTime || Date.now(),
    domainCookieMap: {
      ...(oldCookieMap.domainCookieMap || {}),
      [domain]: {
        updateTime: Date.now(),
        createTime: oldCookieMap.domainCookieMap?.[domain]?.createTime || Date.now(),
        cookies: cookies,
        localStorageItems: localStorageItems,
        userAgent: userAgent || oldCookieMap.domainCookieMap?.[domain]?.userAgent || '',
      },
    },
  };

  const res = await writeCookiesMap(accountInfo, cookiesMap, oldCookieMap);
  return [res, cookiesMap];
};

export const mergeAndWriteMultipleDomainCookies = async (
  cloudflareAccountInfo: AccountInfo,
  domainCookies: { domain: string; cookies: ICookie[]; localStorageItems: ILocalStorageItem[]; userAgent?: string }[],
  oldCookieMap: ICookiesMap = {},
): Promise<[WriteResponse, ICookiesMap]> => {
  await check(cloudflareAccountInfo);

  const newDomainCookieMap = {
    ...(oldCookieMap.domainCookieMap || {}),
  };
  for (const { domain, cookies, localStorageItems, userAgent } of domainCookies) {
    newDomainCookieMap[domain] = {
      updateTime: Date.now(),
      createTime: oldCookieMap.domainCookieMap?.[domain]?.createTime || Date.now(),
      cookies: cookies,
      localStorageItems: localStorageItems || [],
      userAgent: userAgent || oldCookieMap.domainCookieMap?.[domain]?.userAgent || '',
    };
  }
  const cookiesMap: ICookiesMap = {
    updateTime: Date.now(),
    createTime: oldCookieMap?.createTime || Date.now(),
    domainCookieMap: newDomainCookieMap,
  };

  const res = await writeCookiesMap(cloudflareAccountInfo, cookiesMap, oldCookieMap);
  return [res, cookiesMap];
};

export const removeAndWriteCookies = async (
  cloudflareAccountInfo: AccountInfo,
  domain: string,
  oldCookieMap: ICookiesMap = {},
  id?: string,
): Promise<[WriteResponse, ICookiesMap]> => {
  await check(cloudflareAccountInfo);
  const cookiesMap: ICookiesMap = {
    updateTime: Date.now(),
    createTime: oldCookieMap?.createTime || Date.now(),
    domainCookieMap: {
      ...(oldCookieMap.domainCookieMap || {}),
    },
  };
  if (cookiesMap.domainCookieMap) {
    if (id !== undefined) {
      if (cookiesMap.domainCookieMap[domain]?.cookies) {
        const oldLength = cookiesMap.domainCookieMap[domain]?.cookies?.length || 0;
        cookiesMap.domainCookieMap[domain].cookies =
          cookiesMap.domainCookieMap[domain].cookies?.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cookie: any) => `${cookie.domain}_${cookie.name}` !== id,
          ) || [];
        const newLength = cookiesMap.domainCookieMap[domain]?.cookies?.length || 0;
        if (oldLength === newLength) {
          throw new Error(`${id}: cookie not found`);
        }
      }
    } else {
      delete cookiesMap.domainCookieMap[domain];
      if (cookiesMap.entryMetaMap) {
        delete cookiesMap.entryMetaMap[domain];
      }
    }
  }

  const res = await writeCookiesMap(cloudflareAccountInfo, cookiesMap, oldCookieMap);
  return [res, cookiesMap];
};

export const editAndWriteCookies = async (
  cloudflareAccountInfo: AccountInfo,
  host: string,
  oldCookieMap: ICookiesMap = {},
  oldItem: ICookie,
  newItem: ICookie,
): Promise<[WriteResponse, ICookiesMap]> => {
  await check(cloudflareAccountInfo);
  const cookiesMap: ICookiesMap = {
    updateTime: Date.now(),
    createTime: oldCookieMap?.createTime || Date.now(),
    domainCookieMap: {
      ...(oldCookieMap.domainCookieMap || {}),
    },
  };
  if (cookiesMap.domainCookieMap) {
    const cookieLength = cookiesMap.domainCookieMap[host]?.cookies?.length || 0;
    for (let i = 0; i < cookieLength; i++) {
      const cookieItem = cookiesMap.domainCookieMap[host]?.cookies?.[i];
      if (cookieItem?.name === oldItem.name && cookieItem?.domain === oldItem.domain) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cookiesMap.domainCookieMap[host].cookies as any)[i] = {
          ...cookieItem,
          ...newItem,
        };
        break;
      }
    }
  }

  const res = await writeCookiesMap(cloudflareAccountInfo, cookiesMap, oldCookieMap);
  return [res, cookiesMap];
};
