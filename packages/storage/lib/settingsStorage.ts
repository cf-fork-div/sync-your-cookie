import { BaseStorage, createCachedSnapshot } from './base';
import {
  accountProfileStorage,
  getActiveProfileSettings,
} from './accountProfileStorage';
import type { ISettings, IStorageItem } from './settingsTypes';
import { defaultKey, defaultSettings } from './settingsTypes';

export type { ISettings, IStorageItem };
export { defaultKey, defaultSettings };

type TSettingsStorage = BaseStorage<ISettings> & {
  update: (updateInfo: Partial<ISettings>) => Promise<void>;
  addStorageKey: (key: string) => Promise<void>;
  removeStorageKey: (key: string) => Promise<void>;
};

const emitListeners: Array<() => void> = [];

const notify = () => {
  emitListeners.forEach(listener => listener());
};

accountProfileStorage.subscribe(() => {
  notify();
});

const getSettingsSnapshot = createCachedSnapshot(
  () => accountProfileStorage.getSnapshot(),
  state => getActiveProfileSettings(state),
);

export const settingsStorage: TSettingsStorage = {
  get: async () => {
    await accountProfileStorage.ensureMigrated();
    return getActiveProfileSettings(await accountProfileStorage.get());
  },
  getSnapshot: () => getSettingsSnapshot(),
  subscribe: (listener: () => void) => {
    emitListeners.push(listener);
    const unsubscribeProfile = accountProfileStorage.subscribe(listener);
    return () => {
      const index = emitListeners.indexOf(listener);
      if (index >= 0) {
        emitListeners.splice(index, 1);
      }
      unsubscribeProfile();
    };
  },
  set: async valueOrUpdate => {
    await accountProfileStorage.ensureMigrated();
    const current = getActiveProfileSettings(accountProfileStorage.getSnapshot());
    const next =
      typeof valueOrUpdate === 'function'
        ? await valueOrUpdate(current)
        : valueOrUpdate;
    await accountProfileStorage.updateActiveProfileSettings(next);
    notify();
  },
  update: async (updateInfo: Partial<ISettings>) => {
    await accountProfileStorage.updateActiveProfileSettings(updateInfo);
    notify();
  },
  addStorageKey: async (key: string) => {
    await accountProfileStorage.addStorageKeyToActive(key);
    notify();
  },
  removeStorageKey: async (key: string) => {
    await accountProfileStorage.removeStorageKeyFromActive(key);
    notify();
  },
};

export const getActiveStorageItem = (): IStorageItem | undefined => {
  const snapshot = settingsStorage.getSnapshot();
  const storageKey = snapshot?.storageKey;
  return snapshot?.storageKeyList.find(item => item.value === storageKey);
};

export const initStorageKey = () => {
  settingsStorage.update({
    storageKeyList: [{ value: defaultKey, label: defaultKey }],
    storageKey: defaultKey,
  });
};
