import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import type { DomainConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import { getHostFromStorageKey, listEntryKeysForHost, parseEntryKey } from './entryKey';

export type HostEntryOption = {
  storageKey: string;
  host: string;
  entryId?: string;
  label: string;
};

const IDENTITY_COOKIE_NAMES = [
  'email',
  'username',
  'user',
  'login',
  'account',
  'user_email',
  'useremail',
  'userid',
  'user_id',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const inferEntryLabelFromCookies = (
  cookies: { name?: string | null; value?: string | null }[] | undefined,
  defaultLabel: string,
): string => {
  if (!cookies?.length) {
    return defaultLabel;
  }

  for (const identityName of IDENTITY_COOKIE_NAMES) {
    const cookie = cookies.find(item => {
      const name = item.name?.toLowerCase() || '';
      return name === identityName || name.includes(identityName);
    });
    const value = cookie?.value?.trim();
    if (value && value.length > 0 && value.length < 80) {
      return value;
    }
  }

  for (const cookie of cookies) {
    const value = cookie.value?.trim();
    if (value && EMAIL_PATTERN.test(value)) {
      return value;
    }
  }

  return defaultLabel;
};

export const listHostEntryOptions = (
  host: string,
  domainConfig: DomainConfig,
  cookieMap: ICookiesMap | null | undefined,
  defaultLabel: string,
): HostEntryOption[] => {
  if (!host) {
    return [];
  }

  const storageKeys = new Set<string>();
  listEntryKeysForHost(cookieMap?.domainCookieMap ?? undefined, host).forEach(key => storageKeys.add(key));
  Object.keys(domainConfig.domainMap)
    .filter(key => getHostFromStorageKey(key) === host)
    .forEach(key => storageKeys.add(key));

  if (storageKeys.size === 0) {
    storageKeys.add(host);
  }

  return [...storageKeys]
    .map(storageKey => {
      const configLabel = domainConfig.domainMap[storageKey]?.label?.trim();
      const cookies = cookieMap?.domainCookieMap?.[storageKey]?.cookies ?? undefined;
      const fallbackLabel = inferEntryLabelFromCookies(cookies, defaultLabel);
      return {
        storageKey,
        host,
        entryId: parseEntryKey(storageKey).entryId,
        label: configLabel || fallbackLabel,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const resolveSelectedEntryKey = (
  host: string,
  currentKey: string,
  domainConfig: DomainConfig,
  entries: HostEntryOption[],
): string => {
  const entryKeys = new Set(entries.map(entry => entry.storageKey));

  if (currentKey && entryKeys.has(currentKey)) {
    return currentKey;
  }

  const lastSelected = domainConfig.lastSelectedEntryByHost?.[host];
  if (lastSelected && entryKeys.has(lastSelected)) {
    return lastSelected;
  }

  if (entryKeys.has(host)) {
    return host;
  }

  if (entries.length === 1) {
    return entries[0].storageKey;
  }

  return entries[0]?.storageKey || host;
};

export const resolveAutoPullEntryKey = (
  tabHost: string,
  domainConfig: DomainConfig,
): string | undefined => {
  const matchingKeys = Object.keys(domainConfig.domainMap).filter(key => {
    return getHostFromStorageKey(key) === tabHost && domainConfig.domainMap[key]?.autoPull;
  });

  if (matchingKeys.length === 0) {
    return undefined;
  }

  if (matchingKeys.length === 1) {
    return matchingKeys[0];
  }

  const lastSelected = domainConfig.lastSelectedEntryByHost?.[tabHost];
  if (lastSelected && matchingKeys.includes(lastSelected)) {
    return lastSelected;
  }

  return matchingKeys[0];
};
