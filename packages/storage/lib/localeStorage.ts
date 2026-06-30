import { BaseStorage, createStorage, StorageType } from './base';

export type LocalePreference = 'system' | 'en' | 'zh_CN';

export type ResolvedLocale = 'en' | 'zh_CN';

type LocaleStorage = BaseStorage<LocalePreference> & {
  setLocale: (locale: LocalePreference) => Promise<void>;
};

const cacheStorageMap = new Map();
const key = 'locale-storage-key';

const initStorage = (): BaseStorage<LocalePreference> => {
  if (cacheStorageMap.has(key)) {
    return cacheStorageMap.get(key);
  }
  const storage = createStorage<LocalePreference>(key, 'system', {
    storageType: StorageType.Local,
    liveUpdate: true,
  });
  cacheStorageMap.set(key, storage);
  return storage;
};

const storage = initStorage();

export const localeStorage: LocaleStorage = {
  ...storage,
  setLocale: async (locale: LocalePreference) => {
    await storage.set(locale);
  },
};

export const detectBrowserLocale = (): ResolvedLocale => {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return lang.toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
};

export const resolveLocale = (preference: LocalePreference): ResolvedLocale => {
  if (preference === 'system') {
    return detectBrowserLocale();
  }
  return preference;
};
