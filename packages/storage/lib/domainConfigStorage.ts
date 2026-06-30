import { BaseStorage } from './base';
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
};

const emitListeners: Array<() => void> = [];

const notify = () => {
  emitListeners.forEach(listener => listener());
};

accountProfileStorage.subscribe(() => {
  notify();
});

export const domainConfigStorage: DomainConfigStorage = {
  get: async () => {
    await accountProfileStorage.ensureMigrated();
    return getActiveProfileDomainConfig(await accountProfileStorage.get());
  },
  getSnapshot: () => getActiveProfileDomainConfig(accountProfileStorage.getSnapshot()),
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
};
