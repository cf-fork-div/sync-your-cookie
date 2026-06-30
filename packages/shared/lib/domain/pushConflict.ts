import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import type { DomainConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import { getBrowserCookiesForHost } from './browserCookies';
import { findMatchingKvEntryKey } from './cookieCompare';
import { getHostFromStorageKey } from './entryKey';
import type { HostEntryOption } from './hostEntries';
import { inferEntryLabelFromCookies } from './hostEntries';

export type PushConflictMode = 'conflict' | 'firstPush';

export type PushConflictResult =
  | {
      needsDialog: false;
      targetKey: string;
    }
  | {
      needsDialog: true;
      mode: PushConflictMode;
      host: string;
      overwriteOptions: HostEntryOption[];
      defaultOverwriteKey: string;
      suggestedNewLabel: string;
    };

export const getEntriesWithKvData = (
  host: string,
  entryOptions: HostEntryOption[],
  cookieMap: ICookiesMap | null | undefined,
): HostEntryOption[] => {
  return entryOptions.filter(entry => {
    const kvEntry = cookieMap?.domainCookieMap?.[entry.storageKey];
    return (kvEntry?.cookies?.length ?? 0) > 0;
  });
};

export const evaluatePushConflict = async (params: {
  host: string;
  sourceUrl?: string;
  cookieMap: ICookiesMap | null | undefined;
  entryOptions: HostEntryOption[];
  selectedStorageKey: string;
  defaultNewLabel: string;
  domainConfig?: DomainConfig;
}): Promise<PushConflictResult> => {
  const { host, sourceUrl, cookieMap, entryOptions, selectedStorageKey, defaultNewLabel, domainConfig } = params;
  const entriesWithData = getEntriesWithKvData(host, entryOptions, cookieMap);

  if (entriesWithData.length === 0) {
    const targetKey = selectedStorageKey || host;
    const existingLabel = domainConfig?.domainMap[targetKey]?.label?.trim();
    if (existingLabel) {
      return {
        needsDialog: false,
        targetKey,
      };
    }

    const browserCookies = await getBrowserCookiesForHost(host, sourceUrl);
    return {
      needsDialog: true,
      mode: 'firstPush',
      host,
      overwriteOptions: [],
      defaultOverwriteKey: targetKey,
      suggestedNewLabel: inferEntryLabelFromCookies(browserCookies, defaultNewLabel),
    };
  }

  const browserCookies = await getBrowserCookiesForHost(host, sourceUrl);
  const kvEntries = entriesWithData.map(entry => ({
    storageKey: entry.storageKey,
    kvCookies: cookieMap?.domainCookieMap?.[entry.storageKey]?.cookies ?? undefined,
  }));

  const matchingKey = findMatchingKvEntryKey(browserCookies, kvEntries);
  if (matchingKey) {
    return {
      needsDialog: false,
      targetKey: matchingKey,
    };
  }

  const defaultOverwriteKey =
    entriesWithData.find(entry => entry.storageKey === selectedStorageKey)?.storageKey ||
    entriesWithData[0].storageKey;

  return {
    needsDialog: true,
    mode: 'conflict',
    host,
    overwriteOptions: entriesWithData,
    defaultOverwriteKey,
    suggestedNewLabel: inferEntryLabelFromCookies(browserCookies, defaultNewLabel),
  };
};

export const resolveAutoPushEntryKeys = (tabHost: string, domainConfig: DomainConfig): string[] => {
  const autoPushKeys = Object.keys(domainConfig.domainMap).filter(key => {
    return getHostFromStorageKey(key) === tabHost && domainConfig.domainMap[key]?.autoPush;
  });

  if (autoPushKeys.length <= 1) {
    return autoPushKeys;
  }

  const lastSelected = domainConfig.lastSelectedEntryByHost?.[tabHost];
  if (lastSelected && autoPushKeys.includes(lastSelected)) {
    return [lastSelected];
  }

  return [autoPushKeys[0]];
};
