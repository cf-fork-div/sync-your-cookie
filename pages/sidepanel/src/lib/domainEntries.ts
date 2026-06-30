import type { CookieEntryType, DomainItemConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import type { DomainConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import { getHostFromStorageKey, parseEntryKey } from '@sync-your-cookie/shared';

export type DomainEntryRow = {
  id: string;
  storageKey: string;
  host: string;
  entryId?: string;
  label: string;
  folder?: string;
  type?: CookieEntryType;
  sourceUrl?: string;
  favIconUrl?: string;
  autoPush: boolean;
  autoPull: boolean;
  createTime: number;
  cookieCount: number;
  localStorageCount: number;
};

export const buildDomainEntryList = (
  cookieMap: ICookiesMap | null | undefined,
  domainConfig: DomainConfig,
  defaultLabel: string,
): DomainEntryRow[] => {
  const rows: DomainEntryRow[] = [];
  for (const [storageKey, value] of Object.entries(cookieMap?.domainCookieMap || {})) {
    const { host } = parseEntryKey(storageKey);
    const config: DomainItemConfig = domainConfig.domainMap[storageKey] || {};
    rows.push({
      id: storageKey,
      storageKey,
      host,
      entryId: parseEntryKey(storageKey).entryId,
      label: config.label || defaultLabel,
      folder: config.folder,
      type: config.type,
      sourceUrl: config.sourceUrl,
      favIconUrl: config.favIconUrl,
      autoPush: config.autoPush ?? false,
      autoPull: config.autoPull ?? false,
      createTime: value.createTime || 0,
      cookieCount: value.cookies?.length || 0,
      localStorageCount: value.localStorageItems?.length || 0,
    });
  }
  return rows.sort((a, b) => b.createTime - a.createTime);
};

export const countUniqueHosts = (rows: DomainEntryRow[]): number => new Set(rows.map(r => r.host)).size;

export const getAccountsCountForHost = (rows: DomainEntryRow[], host: string): number =>
  rows.filter(row => getHostFromStorageKey(row.storageKey) === host).length;

export const ENTRY_TYPE_OPTIONS: CookieEntryType[] = ['login', 'session', 'other'];
