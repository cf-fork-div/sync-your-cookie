import { BaseStorage, createCachedSnapshot } from './base';
import { accountProfileStorage, getActiveProfile } from './accountProfileStorage';

export interface AccountInfo {
  accountId?: string;
  namespaceId?: string;
  token?: string;
}

type AccountInfoStorage = BaseStorage<AccountInfo> & {
  update: (updateInfo: AccountInfo) => Promise<void>;
};

const toAccountInfo = (profile?: { accountId?: string; namespaceId?: string; token?: string }): AccountInfo => ({
  accountId: profile?.accountId,
  namespaceId: profile?.namespaceId,
  token: profile?.token,
});

const emitListeners: Array<() => void> = [];

const notify = () => {
  emitListeners.forEach(listener => listener());
};

accountProfileStorage.subscribe(() => {
  notify();
});

const getAccountInfoSnapshot = createCachedSnapshot(
  () => accountProfileStorage.getSnapshot(),
  state => toAccountInfo(getActiveProfile(state)),
);

export const accountStorage: AccountInfoStorage = {
  get: async () => {
    await accountProfileStorage.ensureMigrated();
    const profile = await accountProfileStorage.getActiveProfile();
    return toAccountInfo(profile);
  },
  getSnapshot: () => getAccountInfoSnapshot(),
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
    const current = toAccountInfo(getActiveProfile(accountProfileStorage.getSnapshot()));
    const next =
      typeof valueOrUpdate === 'function' ? await valueOrUpdate(current) : valueOrUpdate;
    await accountProfileStorage.updateActiveProfile(next);
    notify();
  },
  update: async (updateInfo: AccountInfo) => {
    await accountProfileStorage.updateActiveProfile(updateInfo);
    notify();
  },
};
