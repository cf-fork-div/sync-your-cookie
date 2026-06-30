import { BaseStorage, createCachedSnapshot } from './base';
import {
  accountProfileStorage,
  getActiveProfileDomainConfig,
} from './accountProfileStorage';
import type { DomainConfig, DomainItemConfig } from './domainConfigTypes';

export type { DomainConfig, DomainItemConfig };

type DomainConfigStorage = BaseStorage<DomainConfig> & {
  update: (updateInfo: Partial<DomainConfig>) => Promise<void>;
  updateItem: (host: string, updateConf: DomainItemConfig) => Promise<void>;
  removeItem: (domain: string) => Promise<void>;
  toggleAutoPullState: (domain: string, checked?: boolean) => Promise<void>;
  toggleAutoPushState: (domain: string, checked?: boolean) => Promise<void>;
  ensureFolder: (folderName: string) => Promise<void>;
  setLastSelectedEntry: (host: string, storageKey: string) => Promise<void>;
};

const emitListeners: Array<() => void> = [];

const notify = () => {
  emitListeners.forEach(listener => listener());
};

accountProfileStorage.subscribe(() => {
  notify();
});

const getDomainConfigSnapshot = createCachedSnapshot(
  () => accountProfileStorage.getSnapshot(),
  state => getActiveProfileDomainConfig(state),
);

export const domainConfigStorage: DomainConfigStorage = {
  get: async () => {
    await accountProfileStorage.ensureMigrated();
    return getActiveProfileDomainConfig(await accountProfileStorage.get());
  },
  getSnapshot: () => getDomainConfigSnapshot(),
  subscribe: (listener: () => void) => {
    emitListeners.push(listener);
    return () => {
      const index = emitListeners.indexOf(listener);
      if (index >= 0) {
        emitListeners.splice(index, 1);
      }
    };
  },
  set: async valueOrUpdate => {
    await accountProfileStorage.ensureMigrated();
    const current = getActiveProfileDomainConfig(accountProfileStorage.getSnapshot());
    const next =
      typeof valueOrUpdate === 'function' ? await valueOrUpdate(current) : valueOrUpdate;
    await accountProfileStorage.updateActiveProfileDomainConfig(() => next);
    notify();
  },
  update: async (updateInfo: Partial<DomainConfig>) => {
    await accountProfileStorage.updateActiveProfileDomainConfig(current => ({
      ...current,
      ...updateInfo,
    }));
    notify();
  },
  updateItem: async (host: string, updateConf: DomainItemConfig) => {
    await accountProfileStorage.updateActiveProfileDomainConfig(current => {
      const domainMap = { ...current.domainMap };
      domainMap[host] = {
        ...domainMap[host],
        ...updateConf,
      };
      return { domainMap };
    });
    notify();
  },
  removeItem: async (domain: string) => {
    await accountProfileStorage.updateActiveProfileDomainConfig(current => {
      const domainMap = { ...current.domainMap };
      delete domainMap[domain];
      return { domainMap };
    });
    notify();
  },
  toggleAutoPullState: async (domain: string, checked?: boolean) => {
    await accountProfileStorage.updateActiveProfileDomainConfig(current => {
      const domainMap = { ...current.domainMap };
      domainMap[domain] = {
        ...domainMap[domain],
        autoPull: checked ?? !domainMap[domain]?.autoPull,
      };
      return { domainMap };
    });
    notify();
  },
  toggleAutoPushState: async (domain: string, checked?: boolean) => {
    await accountProfileStorage.updateActiveProfileDomainConfig(current => {
      const domainMap = { ...current.domainMap };
      domainMap[domain] = {
        ...domainMap[domain],
        autoPush: checked ?? !domainMap[domain]?.autoPush,
      };
      return { domainMap };
    });
    notify();
  },
  ensureFolder: async (folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      return;
    }
    await accountProfileStorage.updateActiveProfileDomainConfig(current => {
      const folders = current.folders || [];
      if (folders.includes(trimmed)) {
        return current;
      }
      return { ...current, folders: [...folders, trimmed] };
    });
    notify();
  },
  setLastSelectedEntry: async (host: string, storageKey: string) => {
    await accountProfileStorage.updateActiveProfileDomainConfig(current => ({
      ...current,
      lastSelectedEntryByHost: {
        ...current.lastSelectedEntryByHost,
        [host]: storageKey,
      },
    }));
    notify();
  },
};
