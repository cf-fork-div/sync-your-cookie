export const ENTRY_KEY_SEPARATOR = '::';

export type ParsedEntryKey = {
  storageKey: string;
  host: string;
  entryId?: string;
};

/** Build a storage key for a domain entry. Omit entryId for the default (legacy) entry. */
export const buildEntryKey = (host: string, entryId?: string): string => {
  if (!entryId) {
    return host;
  }
  return `${host}${ENTRY_KEY_SEPARATOR}${entryId}`;
};

export const parseEntryKey = (storageKey: string): ParsedEntryKey => {
  const separatorIndex = storageKey.indexOf(ENTRY_KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return { storageKey, host: storageKey };
  }
  return {
    storageKey,
    host: storageKey.slice(0, separatorIndex),
    entryId: storageKey.slice(separatorIndex + ENTRY_KEY_SEPARATOR.length),
  };
};

export const getHostFromStorageKey = (storageKey: string): string => parseEntryKey(storageKey).host;

export const listEntryKeysForHost = (domainCookieMap: Record<string, unknown> | undefined, host: string): string[] => {
  if (!domainCookieMap) {
    return [];
  }
  return Object.keys(domainCookieMap).filter(key => getHostFromStorageKey(key) === host);
};

export const createEntryKey = (host: string): string => buildEntryKey(host, crypto.randomUUID());
