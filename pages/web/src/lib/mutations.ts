import type { FormatInfo } from '@src/lib/types';
import type { ICookie, ICookiesMap } from '@sync-your-cookie/protobuf';
import { isBase64Encrypted } from '@sync-your-cookie/protobuf';
import type { DomainEntryRow } from '@sync-your-cookie/shared';

export type EntryMetaUpdate = {
  label?: string;
  folder?: string;
  type?: DomainEntryRow['type'];
};

export function getCookieId(cookie: ICookie): string {
  return `${cookie.domain}_${cookie.name}`;
}

function cloneMap(map: ICookiesMap): ICookiesMap {
  return JSON.parse(JSON.stringify(map)) as ICookiesMap;
}

export function editCookie(map: ICookiesMap, domain: string, oldItem: ICookie, newItem: ICookie): ICookiesMap {
  const next = cloneMap(map);
  const cookies = next.domainCookieMap?.[domain]?.cookies;
  if (!cookies) return next;

  for (let i = 0; i < cookies.length; i++) {
    const item = cookies[i];
    if (item?.name === oldItem.name && item?.domain === oldItem.domain) {
      cookies[i] = { ...item, ...newItem };
      break;
    }
  }

  if (next.domainCookieMap?.[domain]) {
    next.domainCookieMap[domain].updateTime = Date.now();
  }
  next.updateTime = Date.now();
  return next;
}

export function removeCookie(map: ICookiesMap, domain: string, cookie: ICookie): ICookiesMap {
  const id = getCookieId(cookie);
  const next = cloneMap(map);
  const domainData = next.domainCookieMap?.[domain];
  if (!domainData?.cookies) return next;

  domainData.cookies = domainData.cookies.filter(item => getCookieId(item) !== id);
  domainData.updateTime = Date.now();
  next.updateTime = Date.now();
  return next;
}

export function removeDomain(map: ICookiesMap, storageKey: string): ICookiesMap {
  const next = cloneMap(map);
  if (next.domainCookieMap) {
    delete next.domainCookieMap[storageKey];
  }
  if (next.entryMetaMap) {
    delete next.entryMetaMap[storageKey];
  }
  next.updateTime = Date.now();
  return next;
}

export function editLocalStorageItem(map: ICookiesMap, domain: string, key: string, value: string): ICookiesMap {
  const next = cloneMap(map);
  const domainData = next.domainCookieMap?.[domain];
  if (!domainData) return next;

  const items = domainData.localStorageItems || [];
  const index = items.findIndex(item => item.key === key);
  if (index >= 0) {
    items[index] = { key, value };
  } else {
    items.push({ key, value });
  }
  domainData.localStorageItems = items;
  domainData.updateTime = Date.now();
  next.updateTime = Date.now();
  return next;
}

export function updateEntryMeta(map: ICookiesMap, storageKey: string, update: EntryMetaUpdate): ICookiesMap {
  const next = cloneMap(map);
  const entryMetaMap = { ...(next.entryMetaMap as Record<string, Record<string, string>> | undefined) };

  const meta: Record<string, string> = { ...(entryMetaMap[storageKey] || {}) };

  const label = update.label?.trim();
  if (label) {
    meta.label = label;
  } else {
    delete meta.label;
  }

  const folder = update.folder?.trim();
  if (folder) {
    meta.folder = folder;
  } else {
    delete meta.folder;
  }

  if (update.type === 'login' || update.type === 'session' || update.type === 'other') {
    meta.type = update.type;
  } else {
    delete meta.type;
  }

  if (Object.keys(meta).length === 0) {
    delete entryMetaMap[storageKey];
  } else {
    entryMetaMap[storageKey] = meta;
  }

  if (Object.keys(entryMetaMap).length === 0) {
    delete next.entryMetaMap;
  } else {
    next.entryMetaMap = entryMetaMap;
  }

  next.updateTime = Date.now();
  return next;
}

export function removeLocalStorageItem(map: ICookiesMap, domain: string, key: string): ICookiesMap {
  const next = cloneMap(map);
  const domainData = next.domainCookieMap?.[domain];
  if (!domainData?.localStorageItems) return next;

  domainData.localStorageItems = domainData.localStorageItems.filter(item => item.key !== key);
  domainData.updateTime = Date.now();
  next.updateTime = Date.now();
  return next;
}

export function detectFormat(rawContent: string, encryptionPassword?: string): FormatInfo {
  const trimmed = rawContent.trim();
  return {
    protobufEncoding: !trimmed.startsWith('{'),
    encryptionEnabled: trimmed.length > 0 && !trimmed.startsWith('{') && isBase64Encrypted(trimmed),
    encryptionPassword,
  };
}
