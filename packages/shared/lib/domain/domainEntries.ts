import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import type { CookieEntryType, DomainConfig, DomainItemConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import { getHostFromStorageKey, parseEntryKey } from './entryKey';
import { entryMetaMapToDomainConfig, getEntryLabel } from './entryMetaSync';
import { inferEntryLabelFromCookies } from './hostEntries';

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
  updateTime: number;
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
    const fallbackLabel = inferEntryLabelFromCookies(value.cookies ?? undefined, defaultLabel);
    rows.push({
      id: storageKey,
      storageKey,
      host,
      entryId: parseEntryKey(storageKey).entryId,
      label: config.label?.trim() || fallbackLabel,
      folder: config.folder,
      type: config.type,
      sourceUrl: config.sourceUrl,
      favIconUrl: config.favIconUrl,
      autoPush: config.autoPush ?? false,
      autoPull: config.autoPull ?? false,
      createTime: value.createTime || 0,
      cookieCount: value.cookies?.length || 0,
      localStorageCount: value.localStorageItems?.length || 0,
      updateTime: value.updateTime || 0,
    });
  }
  return rows.sort((a, b) => b.updateTime - a.updateTime);
};

export const buildDomainEntryListFromCookieMap = (
  cookieMap: ICookiesMap | null | undefined,
  defaultLabel: string,
): DomainEntryRow[] => {
  const domainConfig = entryMetaMapToDomainConfig(cookieMap?.entryMetaMap as Record<string, { label?: string; folder?: string; type?: CookieEntryType }> | undefined);
  return buildDomainEntryList(cookieMap, domainConfig, defaultLabel);
};

export const countUniqueHosts = (rows: DomainEntryRow[]): number => new Set(rows.map(r => r.host)).size;

export const getAccountsCountForHost = (rows: DomainEntryRow[], host: string): number =>
  rows.filter(row => getHostFromStorageKey(row.storageKey) === host).length;

export const shouldShowEntryLabel = (
  row: DomainEntryRow,
  rows: DomainEntryRow[],
  defaultLabel: string,
): boolean => {
  const accountsOnHost = getAccountsCountForHost(rows, row.host);
  if (accountsOnHost > 1) {
    return true;
  }
  const label = row.label.trim();
  return Boolean(label && label !== defaultLabel && label !== row.host);
};

export const getDisplayTitle = (row: DomainEntryRow): string => row.host;

export const getDisplaySubtitle = (
  row: DomainEntryRow,
  rows: DomainEntryRow[],
  defaultLabel: string,
): string | undefined => {
  if (!shouldShowEntryLabel(row, rows, defaultLabel)) {
    return undefined;
  }
  return row.label;
};

export { getEntryLabel };

export const ENTRY_TYPE_OPTIONS: CookieEntryType[] = ['login', 'session', 'other'];
