import { ICookie, ICookiesMap, ILocalStorageItem } from '@sync-your-cookie/protobuf';
import { Cookie, cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { accountProfileStorage, getActiveProfileDomainConfig } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { domainStatusStorage } from '@sync-your-cookie/storage/lib/domainStatusStorage';

import { AccountInfo, accountStorage } from '@sync-your-cookie/storage/lib/accountStorage';

import { trySetLocalStorageForHost } from '@lib/message';
import { getHostFromStorageKey } from '../domain/entryKey';
import { WriteResponse } from '../cloudflare';
import {
  editAndWriteCookies,
  mergeAndWriteCookies,
  mergeAndWriteMultipleDomainCookies,
  readCookiesMap,
  removeAndWriteCookies,
} from './withCloudflare';
import { gatherRawBrowserCookies, pullCookieKey, removeBrowserCookie, resolveDomainUrl, toBrowserCookieItem } from './browserCookies';
import { buildPullCookieSetDetails, setCookieInBrowser } from './setDetails';
import { mergeEntryMetaIntoDomainConfig, mergeEntryMetaOnWrite } from '../domain/entryMetaSync';

export const readCookiesMapWithStatus = async (cloudflareInfo: AccountInfo) => {
  let cookieMap: Cookie | null = null;
  const domainStatus = await domainStatusStorage.get();
  if (domainStatus.pushing) {
    cookieMap = await cookieStorage.getSnapshot();
  }
  if (cookieMap && Object.keys(cookieMap.domainCookieMap || {}).length > 0) {
    return cookieMap;
  }
  return await readCookiesMap(cloudflareInfo);
};

export const pullCookies = async (isInit = false): Promise<Cookie> => {
  const cloudflareInfo = await accountStorage.get();
  if (
    isInit &&
    !cloudflareInfo.serverUrl &&
    (!cloudflareInfo.accountId || !cloudflareInfo.namespaceId || !cloudflareInfo.token)
  ) {
    return {};
  }
  try {
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pulling) {
      const cookieMap = await cookieStorage.getSnapshot();
      if (cookieMap && Object.keys(cookieMap.domainCookieMap || {}).length > 0) {
        return cookieMap;
      }
    }
    await domainStatusStorage.update({
      pulling: true,
    });
    const cookieMap = await readCookiesMapWithStatus(cloudflareInfo);
    const res = await cookieStorage.update(cookieMap, isInit);
    if (cookieMap.entryMetaMap && Object.keys(cookieMap.entryMetaMap).length > 0) {
      await accountProfileStorage.ensureMigrated();
      await accountProfileStorage.updateActiveProfileDomainConfig(current =>
        mergeEntryMetaIntoDomainConfig(current, cookieMap.entryMetaMap),
      );
    }
    await domainStatusStorage.update({
      pulling: false,
    });
    return res;
  } catch (e) {
    console.error('pullCookies fail', e);
    await domainStatusStorage.update({
      pulling: false,
    });
    return Promise.reject(e);
  }
};
export type PullAndSetCookiesResult = {
  cookieMap: Cookie;
  warnings: string[];
};

export const pullAndSetCookies = async (
  activeTabUrl: string,
  host: string,
  isReload = true,
): Promise<PullAndSetCookiesResult> => {
  const cookieMap = await pullCookies();
  const cookieDetails = cookieMap?.domainCookieMap?.[host]?.cookies || [];
  const localStorageItems = cookieMap?.domainCookieMap?.[host]?.localStorageItems || [];
  if (cookieDetails.length === 0 && localStorageItems.length === 0) {
    console.warn('no cookies to pull, push first please', host, cookieMap);
    throw new Error('No cookies to pull, push first please');
  }

  const tabUrl = await resolveDomainUrl(host, activeTabUrl);
  const warnings: string[] = [];

  // Apply remote cookies first so failed sets leave existing browser cookies intact.
  const cookiesPromiseList = cookieDetails.map(cookie => {
    const cookieDetail = buildPullCookieSetDetails(cookie, tabUrl);
    return setCookieInBrowser(cookieDetail);
  });
  const cookieResults = await Promise.allSettled(cookiesPromiseList);
  const failedCookies = cookieResults.flatMap((result, index) => {
    if (result.status === 'rejected') {
      const cookie = cookieDetails[index];
      return [`${cookie.name ?? '?'}@${cookie.domain ?? '?'}: ${result.reason?.message ?? result.reason}`];
    }
    return [];
  });
  const successCount = cookieResults.filter(result => result.status === 'fulfilled').length;

  if (cookieDetails.length > 0 && successCount === 0) {
    console.error('failed to set cookies during pull', failedCookies);
    throw new Error(`Failed to set cookies during pull: ${failedCookies.join('; ')}`);
  }
  if (failedCookies.length > 0) {
    console.warn('some cookies skipped during pull', failedCookies);
    warnings.push(`Skipped ${failedCookies.length} cookie(s): ${failedCookies.join('; ')}`);
  }

  // Mirror sync: remove browser cookies not present in the remote payload.
  const remoteKeys = new Set(cookieDetails.map(pullCookieKey));
  const localCookies = await gatherRawBrowserCookies(host, tabUrl);
  for (const [index, local] of localCookies.entries()) {
    if (!remoteKeys.has(pullCookieKey(local))) {
      await removeBrowserCookie(toBrowserCookieItem(local, index), tabUrl);
    }
  }

  const localStorageResult = await trySetLocalStorageForHost(host, localStorageItems, true);
  if (!localStorageResult.ok && localStorageItems.length > 0) {
    console.warn('localStorage not updated during pull', localStorageResult.msg);
    warnings.push(localStorageResult.msg || 'localStorage was not updated');
  }

  if (isReload) {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach(function (tab) {
        const tabHost = getHostFromStorageKey(host);
        if (tab.url && tab.url.includes(tabHost) && tab.id) {
          console.log('tab', tab);
          chrome.tabs.reload(tab.id);
        }
      });
    });
  }
  return { cookieMap, warnings };
};

export type PushCookiesResponse = WriteResponse;

const checkSuccessAndUpdate = async (res: WriteResponse, cookieMap: ICookiesMap) => {
  if (res.success) {
    await accountProfileStorage.ensureMigrated();
    const domainConfig = getActiveProfileDomainConfig(await accountProfileStorage.get());
    const withMeta = mergeEntryMetaOnWrite(cookieMap, cookieMap, domainConfig);
    await cookieStorage.update(withMeta);
  }
};

export const pushCookies = async (
  domain: string,
  cookies: ICookie[],
  localStorageItems: ILocalStorageItem[] = [],
  userAgent = '',
): Promise<PushCookiesResponse> => {
  const accountInfo = await accountStorage.get();
  try {
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pushing) return Promise.reject('the cookie is pushing');
    await domainStatusStorage.update({
      pushing: true,
    });
    const oldCookie = await readCookiesMapWithStatus(accountInfo);
    const [res, cookieMap] = await mergeAndWriteCookies(
      accountInfo,
      domain,
      cookies,
      localStorageItems,
      userAgent,
      oldCookie,
    );
    console.log('res->pushCookies', res);
    await checkSuccessAndUpdate(res, cookieMap);
    await domainStatusStorage.update({
      pushing: false,
    });
    return res;
  } catch (e) {
    console.error('pushCookies fail err', e);
    await domainStatusStorage.update({
      pushing: false,
    });
    return Promise.reject(e);
  }
};

export const pushMultipleDomainCookies = async (
  domainCookies: { domain: string; cookies: ICookie[]; localStorageItems: ILocalStorageItem[]; userAgent?: string }[],
): Promise<WriteResponse> => {
  const accountInfo = await accountStorage.get();
  try {
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pushing) return Promise.reject('cookie is pushing');
    await domainStatusStorage.update({
      pushing: true,
    });
    const oldCookie = await readCookiesMapWithStatus(accountInfo);
    const [res, cookieMap] = await mergeAndWriteMultipleDomainCookies(accountInfo, domainCookies, oldCookie);
    await domainStatusStorage.update({
      pushing: false,
    });
    await checkSuccessAndUpdate(res, cookieMap);
    return res;
  } catch (e) {
    console.error('pushMultipleDomainCookies fail err', e);
    await domainStatusStorage.update({
      pushing: false,
    });
    return Promise.reject(e);
  }
};

export const removeCookies = async (domain: string): Promise<WriteResponse> => {
  const accountInfo = await accountStorage.get();
  try {
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pushing) return Promise.reject('the cookie is pushing');
    await domainStatusStorage.update({
      pushing: true,
    });
    const oldCookie = await readCookiesMapWithStatus(accountInfo);
    const [res, cookieMap] = await removeAndWriteCookies(accountInfo, domain, oldCookie);
    await domainStatusStorage.update({
      pushing: false,
    });
    await checkSuccessAndUpdate(res, cookieMap);
    return res;
  } catch (e) {
    console.error('removeCookies fail err', e);
    await domainStatusStorage.update({
      pushing: false,
    });
    return Promise.reject(e);
  }
};

export const removeCookieItem = async (domain: string, id: string): Promise<WriteResponse> => {
  const accountInfo = await accountStorage.get();
  try {
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pushing) return Promise.reject('the cookie is pushing');
    await domainStatusStorage.update({
      pushing: true,
    });
    const oldCookie = await readCookiesMapWithStatus(accountInfo);
    const [res, cookieMap] = await removeAndWriteCookies(accountInfo, domain, oldCookie, id);
    await domainStatusStorage.update({
      pushing: false,
    });
    await checkSuccessAndUpdate(res, cookieMap);
    return res;
  } catch (e) {
    console.error('removeCookieItem fail err', e);
    await domainStatusStorage.update({
      pushing: false,
    });
    return Promise.reject(e);
  }
};

export const editCookieItem = async (domain: string, name: string): Promise<WriteResponse> => {
  const accountInfo = await accountStorage.get();
  try {
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pushing) return Promise.reject('the cookie is pushing');
    await domainStatusStorage.update({
      pushing: true,
    });
    const oldCookie = await readCookiesMapWithStatus(accountInfo);
    const [res, cookieMap] = await removeAndWriteCookies(accountInfo, domain, oldCookie, name);
    await domainStatusStorage.update({
      pushing: false,
    });
    await checkSuccessAndUpdate(res, cookieMap);
    return res;
  } catch (e) {
    console.error('removeCookieItem fail err', e);
    await domainStatusStorage.update({
      pushing: false,
    });
    return Promise.reject(e);
  }
};

export class CookieOperator {
  static async prepare() {
    const cloudflareInfo = await accountStorage.get();
    const domainStatus = await domainStatusStorage.get();
    if (domainStatus.pushing) return Promise.reject('the cookie is pushing');
    return { cloudflareInfo };
  }

  static async setPushing(open: boolean) {
    await domainStatusStorage.update({
      pushing: open,
    });
  }

  static async editCookieItem(host: string, oldItem: ICookie, newItem: ICookie) {
    try {
      const { cloudflareInfo } = await this.prepare();
      await this.setPushing(true);
      const oldCookie = await readCookiesMapWithStatus(cloudflareInfo);
      const [res, cookieMap] = await editAndWriteCookies(cloudflareInfo, host, oldCookie, oldItem, newItem);
      await this.setPushing(false);

      await checkSuccessAndUpdate(res, cookieMap);

      return res;
    } catch (e) {
      console.error('removeCookieItem fail err', e);
      await this.setPushing(false);
      return Promise.reject(e);
    }
  }
}
