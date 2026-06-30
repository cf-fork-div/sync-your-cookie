import { BaseStorage, createStorage, StorageType } from './base';
import type { DomainConfig } from './domainConfigTypes';
import { defaultDomainConfig } from './domainConfigTypes';
import type { ISettings } from './settingsTypes';
import { defaultKey, defaultSettings } from './settingsTypes';

export interface AccountProfile {
  id: string;
  name: string;
  accountId?: string;
  namespaceId?: string;
  token?: string;
  defaultStorageKey?: string;
  settings?: ISettings;
  domainConfig?: DomainConfig;
}

export interface AccountProfileState {
  accountProfileList: AccountProfile[];
  activeProfileId?: string;
  migrated?: boolean;
}

const PROFILE_STORAGE_KEY = 'account-profile-storage-key';
const LEGACY_ACCOUNT_KEY = 'cloudflare-account-storage-key';
const LEGACY_SETTINGS_KEY = 'settings-storage-key';
const LEGACY_DOMAIN_CONFIG_KEY = 'domainConfig-storage-key';

const cacheStorageMap = new Map();

/** Chinese defaults for migration; UI layer uses i18n when creating profiles. */
const DEFAULT_PROFILE_NAME = '默认';
const DEFAULT_PROFILE_NUMBER_NAME = '配置 1';

const createDefaultProfile = (overrides: Partial<AccountProfile> = {}): AccountProfile => ({
  id: crypto.randomUUID(),
  name: DEFAULT_PROFILE_NAME,
  settings: { ...defaultSettings },
  domainConfig: defaultDomainConfig(),
  ...overrides,
});

const normalizeAccountProfileState = (
  state: AccountProfileState | null | undefined,
): AccountProfileState => {
  const accountProfileList = state?.accountProfileList;
  return {
    accountProfileList: Array.isArray(accountProfileList) ? accountProfileList : [],
    activeProfileId: typeof state?.activeProfileId === 'string' ? state.activeProfileId : undefined,
    migrated: Boolean(state?.migrated),
  };
};

const setNormalized = async (
  valueOrUpdate:
    | AccountProfileState
    | ((prev: AccountProfileState) => AccountProfileState | Promise<AccountProfileState>),
): Promise<void> => {
  await storage.set(async current => {
    const normalized = normalizeAccountProfileState(current);
    const next =
      typeof valueOrUpdate === 'function' ? await valueOrUpdate(normalized) : valueOrUpdate;
    return normalizeAccountProfileState(next);
  });
};

const initStorage = (): BaseStorage<AccountProfileState> => {
  if (cacheStorageMap.has(PROFILE_STORAGE_KEY)) {
    return cacheStorageMap.get(PROFILE_STORAGE_KEY);
  }
  const storage = createStorage<AccountProfileState>(
    PROFILE_STORAGE_KEY,
    {
      accountProfileList: [],
      activeProfileId: undefined,
      migrated: false,
    },
    {
      storageType: StorageType.Sync,
      liveUpdate: true,
    },
  );
  cacheStorageMap.set(PROFILE_STORAGE_KEY, storage);
  return storage;
};

const storage = initStorage();

let migrationPromise: Promise<void> | null = null;

const ensureMigrated = async (): Promise<void> => {
  if (migrationPromise) {
    return migrationPromise;
  }
  migrationPromise = (async () => {
    const state = normalizeAccountProfileState(await storage.get());
    const hasProfiles = state.accountProfileList.length > 0;

    if (state.migrated && hasProfiles) {
      await migrateLegacyDomainConfig(state);
      return;
    }

    const legacy = await chrome.storage.sync.get([LEGACY_ACCOUNT_KEY, LEGACY_SETTINGS_KEY]);
    const legacyDomain = await chrome.storage.local.get(LEGACY_DOMAIN_CONFIG_KEY);
    const legacyAccount = (legacy[LEGACY_ACCOUNT_KEY] || {}) as {
      accountId?: string;
      namespaceId?: string;
      token?: string;
    };
    const legacySettings = (legacy[LEGACY_SETTINGS_KEY] || defaultSettings) as ISettings;
    const legacyDomainConfig = legacyDomain[LEGACY_DOMAIN_CONFIG_KEY] as DomainConfig | undefined;

    if (state.accountProfileList.length === 0) {
      const profile = createDefaultProfile({
        name: legacyAccount.accountId ? DEFAULT_PROFILE_NAME : DEFAULT_PROFILE_NUMBER_NAME,
        accountId: legacyAccount.accountId,
        namespaceId: legacyAccount.namespaceId,
        token: legacyAccount.token,
        defaultStorageKey: legacySettings.storageKey || defaultKey,
        settings: {
          ...defaultSettings,
          ...legacySettings,
          storageKeyList: legacySettings.storageKeyList?.length
            ? legacySettings.storageKeyList
            : defaultSettings.storageKeyList,
        },
        domainConfig: legacyDomainConfig?.domainMap
          ? { domainMap: { ...legacyDomainConfig.domainMap } }
          : defaultDomainConfig(),
      });
      await setNormalized({
        accountProfileList: [profile],
        activeProfileId: profile.id,
        migrated: true,
      });
      return;
    }

    if (!state.migrated) {
      await setNormalized(current => ({ ...current, migrated: true }));
    }

    await migrateLegacyDomainConfig(normalizeAccountProfileState(await storage.get()));
  })();
  return migrationPromise;
};

export const getActiveProfile = (state?: AccountProfileState | null): AccountProfile | undefined => {
  const snapshot = normalizeAccountProfileState(state ?? storage.getSnapshot());
  const profiles = snapshot.accountProfileList;
  if (!snapshot.activeProfileId) {
    return profiles[0];
  }
  return profiles.find(profile => profile.id === snapshot.activeProfileId);
};

export const getActiveProfileSettings = (state?: AccountProfileState | null): ISettings => {
  const profile = getActiveProfile(state);
  return {
    ...defaultSettings,
    ...profile?.settings,
    storageKeyList: profile?.settings?.storageKeyList?.length
      ? profile.settings.storageKeyList
      : defaultSettings.storageKeyList,
  };
};

export const getActiveProfileDomainConfig = (state?: AccountProfileState | null): DomainConfig => {
  const profile = getActiveProfile(state);
  const domainMap = profile?.domainConfig?.domainMap;
  if (!domainMap || typeof domainMap !== 'object') {
    return defaultDomainConfig();
  }
  return { domainMap: { ...domainMap } };
};

const hasAnyProfileDomainConfig = (state: AccountProfileState): boolean =>
  state.accountProfileList.some(
    profile => profile.domainConfig?.domainMap && Object.keys(profile.domainConfig.domainMap).length > 0,
  );

const migrateLegacyDomainConfig = async (state: AccountProfileState): Promise<void> => {
  if (hasAnyProfileDomainConfig(state)) {
    return;
  }
  const legacy = await chrome.storage.local.get(LEGACY_DOMAIN_CONFIG_KEY);
  const legacyConfig = legacy[LEGACY_DOMAIN_CONFIG_KEY] as DomainConfig | undefined;
  if (!legacyConfig?.domainMap || Object.keys(legacyConfig.domainMap).length === 0) {
    return;
  }
  const active = getActiveProfile(state);
  if (!active) {
    return;
  }
  await setNormalized(current => ({
    ...current,
    accountProfileList: current.accountProfileList.map(profile =>
      profile.id === active.id
        ? { ...profile, domainConfig: { domainMap: { ...legacyConfig.domainMap } } }
        : profile,
    ),
  }));
};

type AccountProfileStorage = BaseStorage<AccountProfileState> & {
  ensureMigrated: () => Promise<void>;
  getActiveProfile: () => Promise<AccountProfile | undefined>;
  setActiveProfileId: (id: string) => Promise<void>;
  addProfile: (name: string) => Promise<AccountProfile>;
  updateProfile: (id: string, update: Partial<AccountProfile>) => Promise<void>;
  updateActiveProfile: (update: Partial<AccountProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  updateActiveProfileSettings: (update: Partial<ISettings>) => Promise<void>;
  updateActiveProfileDomainConfig: (
    updater: (current: DomainConfig) => DomainConfig,
  ) => Promise<void>;
  addStorageKeyToActive: (key: string) => Promise<void>;
  removeStorageKeyFromActive: (key: string) => Promise<void>;
};

export const accountProfileStorage: AccountProfileStorage = {
  ...storage,
  get: async () => {
    await ensureMigrated();
    return normalizeAccountProfileState(await storage.get());
  },
  getSnapshot: () => {
    const snapshot = storage.getSnapshot();
    return snapshot === null ? null : normalizeAccountProfileState(snapshot);
  },
  ensureMigrated,
  getActiveProfile: async () => {
    await ensureMigrated();
    const state = await storage.get();
    return getActiveProfile(state);
  },
  setActiveProfileId: async (id: string) => {
    await ensureMigrated();
    await setNormalized(current => {
      const exists = current.accountProfileList.some(profile => profile.id === id);
      if (!exists || current.activeProfileId === id) {
        return current;
      }
      return { ...current, activeProfileId: id };
    });
  },
  addProfile: async (name: string) => {
    await ensureMigrated();
    const trimmedName = name.trim();
    const profile = createDefaultProfile(trimmedName ? { name: trimmedName } : {});
    await setNormalized(current => ({
      ...current,
      accountProfileList: [...current.accountProfileList, profile],
      activeProfileId: profile.id,
    }));
    return profile;
  },
  updateProfile: async (id: string, update: Partial<AccountProfile>) => {
    await ensureMigrated();
    await setNormalized(current => ({
      ...current,
      accountProfileList: current.accountProfileList.map(profile =>
        profile.id === id ? { ...profile, ...update } : profile,
      ),
    }));
  },
  updateActiveProfile: async (update: Partial<AccountProfile>) => {
    await ensureMigrated();
    const active = await accountProfileStorage.getActiveProfile();
    if (!active) {
      return;
    }
    await accountProfileStorage.updateProfile(active.id, update);
  },
  deleteProfile: async (id: string) => {
    await ensureMigrated();
    await setNormalized(current => {
      if (current.accountProfileList.length <= 1) {
        return current;
      }
      const nextList = current.accountProfileList.filter(profile => profile.id !== id);
      let nextActiveId = current.activeProfileId;
      if (current.activeProfileId === id) {
        nextActiveId = nextList[0]?.id;
      }
      return {
        ...current,
        accountProfileList: nextList,
        activeProfileId: nextActiveId,
      };
    });
  },
  updateActiveProfileSettings: async (update: Partial<ISettings>) => {
    await ensureMigrated();
    const active = await accountProfileStorage.getActiveProfile();
    if (!active) {
      return;
    }
    await accountProfileStorage.updateProfile(active.id, {
      settings: {
        ...defaultSettings,
        ...active.settings,
        ...update,
      },
    });
  },
  updateActiveProfileDomainConfig: async (updater: (current: DomainConfig) => DomainConfig) => {
    await ensureMigrated();
    const active = await accountProfileStorage.getActiveProfile();
    if (!active) {
      return;
    }
    const current = getActiveProfileDomainConfig(storage.getSnapshot());
    await accountProfileStorage.updateProfile(active.id, {
      domainConfig: updater(current),
    });
  },
  addStorageKeyToActive: async (key: string) => {
    await ensureMigrated();
    const active = await accountProfileStorage.getActiveProfile();
    if (!active) {
      return;
    }
    const settings = getActiveProfileSettings(storage.getSnapshot());
    const exists = settings.storageKeyList.find(item => item.value === key);
    if (exists) {
      return;
    }
    await accountProfileStorage.updateActiveProfileSettings({
      storageKeyList: [...settings.storageKeyList, { value: key, label: key }],
    });
  },
  removeStorageKeyFromActive: async (key: string) => {
    await ensureMigrated();
    const settings = getActiveProfileSettings(storage.getSnapshot());
    const exists = settings.storageKeyList.find(item => item.value === key);
    if (!exists) {
      return;
    }
    await accountProfileStorage.updateActiveProfileSettings({
      storageKeyList: settings.storageKeyList.filter(item => item.value !== key),
    });
  },
};
