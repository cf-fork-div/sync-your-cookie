import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import type { CookieEntryType, DomainConfig, DomainItemConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import { defaultDomainConfig } from '@sync-your-cookie/storage/lib/domainConfigTypes';

export type SyncableEntryMeta = {
  label?: string | null;
  folder?: string | null;
  type?: CookieEntryType | string | null;
};

export type EntryMetaMap = Record<string, SyncableEntryMeta>;

const pickSyncableMeta = (config: DomainItemConfig | undefined): SyncableEntryMeta | undefined => {
  if (!config) {
    return undefined;
  }
  const meta: SyncableEntryMeta = {};
  const label = config.label?.trim();
  if (label) {
    meta.label = label;
  }
  const folder = config.folder?.trim();
  if (folder) {
    meta.folder = folder;
  }
    if (config.type && (config.type === 'login' || config.type === 'session' || config.type === 'other')) {
      meta.type = config.type;
    }
  return Object.keys(meta).length > 0 ? meta : undefined;
};

export const domainConfigToEntryMetaMap = (domainConfig: DomainConfig): EntryMetaMap => {
  const map: EntryMetaMap = {};
  for (const [storageKey, config] of Object.entries(domainConfig.domainMap)) {
    const meta = pickSyncableMeta(config);
    if (meta) {
      map[storageKey] = meta;
    }
  }
  return map;
};

export const entryMetaMapToDomainConfig = (entryMetaMap?: EntryMetaMap | null): DomainConfig => {
  if (!entryMetaMap || Object.keys(entryMetaMap).length === 0) {
    return defaultDomainConfig();
  }
  const domainMap: DomainConfig['domainMap'] = {};
  for (const [storageKey, meta] of Object.entries(entryMetaMap)) {
    const config: DomainItemConfig = {};
    const label = meta.label?.trim();
    if (label) {
      config.label = label;
    }
    const folder = meta.folder?.trim();
    if (folder) {
      config.folder = folder;
    }
    if (meta.type === 'login' || meta.type === 'session' || meta.type === 'other') {
      config.type = meta.type;
    }
    if (Object.keys(config).length > 0) {
      domainMap[storageKey] = config;
    }
  }
  return { domainMap };
};

export const mergeEntryMetaIntoDomainConfig = (
  current: DomainConfig,
  entryMetaMap?: EntryMetaMap | null,
): DomainConfig => {
  if (!entryMetaMap || Object.keys(entryMetaMap).length === 0) {
    return current;
  }
  const domainMap = { ...current.domainMap };
  for (const [storageKey, meta] of Object.entries(entryMetaMap)) {
    if (!meta) {
      continue;
    }
    const syncMeta = meta as SyncableEntryMeta;
    domainMap[storageKey] = {
      ...domainMap[storageKey],
      ...(syncMeta.label?.trim() ? { label: syncMeta.label.trim() } : {}),
      ...(syncMeta.folder?.trim() ? { folder: syncMeta.folder.trim() } : {}),
      ...(syncMeta.type === 'login' || syncMeta.type === 'session' || syncMeta.type === 'other'
        ? { type: syncMeta.type }
        : {}),
    };
  }
  return { ...current, domainMap };
};

export const mergeEntryMetaOnWrite = (
  cookiesMap: ICookiesMap,
  oldCookieMap: ICookiesMap,
  domainConfig: DomainConfig,
): ICookiesMap => {
  const merged: EntryMetaMap = {
    ...(oldCookieMap.entryMetaMap as EntryMetaMap | undefined),
  };
  for (const [storageKey, config] of Object.entries(domainConfig.domainMap)) {
    const meta = pickSyncableMeta(config);
    if (meta) {
      merged[storageKey] = meta;
    } else {
      delete merged[storageKey];
    }
  }
  const activeKeys = new Set(Object.keys(cookiesMap.domainCookieMap || {}));
  for (const key of Object.keys(merged)) {
    if (!activeKeys.has(key)) {
      delete merged[key];
    }
  }
  if (Object.keys(merged).length === 0) {
    const { entryMetaMap: _removed, ...rest } = cookiesMap;
    return rest;
  }
  return { ...cookiesMap, entryMetaMap: merged };
};

export const getEntryLabel = (
  storageKey: string,
  entryMetaMap: EntryMetaMap | undefined,
  defaultLabel: string,
): string => {
  const label = entryMetaMap?.[storageKey]?.label?.trim();
  return label || defaultLabel;
};
