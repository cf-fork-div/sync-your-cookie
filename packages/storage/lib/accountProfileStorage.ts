import { BaseStorage, createCachedSnapshot, createStorage, StorageType } from './base';
import type { DomainConfig } from './domainConfigTypes';
import { defaultDomainConfig } from './domainConfigTypes';
import {
  profileSecretsStorage,
  type ProfileSecretEntry,
  type ProfileSecretsMap,
} from './profileSecretsStorage';
import type { ISettings } from './settingsTypes';
import { defaultKey, defaultSettings } from './settingsTypes';

export interface AccountProfile {
  id: string;
  name: string;
  serverUrl?: string;
  authPassword?: string;
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
const LEGACY_SETTINGS_KEY = 'settings-storage-key';
const LEGACY_DOMAIN_CONFIG_KEY = 'domainConfig-storage-key';

const cacheStorageMap = new Map();

/** Chinese defaults for migration; UI layer uses i18n when creating profiles. */
const DEFAULT_PROFILE_NAME = '默认';
const DEFAULT_PROFILE_NUMBER_NAME = '配置 1';

const EMPTY_DOMAIN_CONFIG: DomainConfig = { domainMap: {} };

const defaultSettingsSnapshot: ISettings = {
  ...defaultSettings,
  storageKeyList: defaultSettings.storageKeyList,
};

const createDefaultProfile = (overrides: Partial<AccountProfile> = {}): AccountProfile => ({
  id: crypto.randomUUID(),
  name: DEFAULT_PROFILE_NAME,
  settings: { ...defaultSettings, encryptionEnabled: true },
  domainConfig: defaultDomainConfig(),
  ...overrides,
});

const stripSecretsFromProfile = (profile: AccountProfile): AccountProfile => {
  const { authPassword: _auth, ...rest } = profile;
  const settings = profile.settings
    ? (() => {
        const { encryptionPassword: _enc, ...settingsRest } = profile.settings!;
        return settingsRest;
      })()
    : undefined;
  return {
    ...rest,
    settings,
  };
};

const mergeSecretsIntoProfile = (profile: AccountProfile, secrets?: ProfileSecretEntry): AccountProfile => {
  if (!secrets) {
    return profile;
  }
  return {
    ...profile,
    authPassword: secrets.authPassword ?? profile.authPassword,
    settings: profile.settings
      ? {
          ...profile.settings,
          encryptionPassword: secrets.encryptionPassword ?? profile.settings.encryptionPassword,
        }
      : profile.settings,
  };
};

const stripSecretsFromState = (state: AccountProfileState): AccountProfileState => ({
  ...state,
  accountProfileList: state.accountProfileList.map(stripSecretsFromProfile),
});

const buildSecretsMap = (profiles: AccountProfile[]): ProfileSecretsMap => {
  const secrets: ProfileSecretsMap = {};
  for (const profile of profiles) {
    const authPassword = profile.authPassword?.trim();
    const encryptionPassword = profile.settings?.encryptionPassword?.trim();
    if (authPassword || encryptionPassword) {
      secrets[profile.id] = {
        ...(authPassword ? { authPassword } : {}),
        ...(encryptionPassword ? { encryptionPassword } : {}),
      };
    }
  }
  return secrets;
};

const mergeSecretsIntoState = (state: AccountProfileState, secrets: ProfileSecretsMap): AccountProfileState => ({
  ...state,
  accountProfileList: state.accountProfileList.map(profile => mergeSecretsIntoProfile(profile, secrets[profile.id])),
});

const persistProfileSecrets = async (profiles: AccountProfile[]): Promise<void> => {
  const currentSecrets = await profileSecretsStorage.get();
  const nextSecrets = { ...currentSecrets, ...buildSecretsMap(profiles) };
  for (const profile of profiles) {
    if (!profile.authPassword?.trim() && !profile.settings?.encryptionPassword?.trim()) {
      delete nextSecrets[profile.id];
    }
  }
  await profileSecretsStorage.set(nextSecrets);
};

const stateHasInlineSecrets = (state: AccountProfileState): boolean =>
  state.accountProfileList.some(
    profile => Boolean(profile.authPassword?.trim() || profile.settings?.encryptionPassword?.trim()),
  );

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
    const secrets = await profileSecretsStorage.get();
    const normalizedCurrent = mergeSecretsIntoState(normalizeAccountProfileState(current), secrets);
    const next =
      typeof valueOrUpdate === 'function' ? await valueOrUpdate(normalizedCurrent) : valueOrUpdate;
    const normalized = normalizeAccountProfileState(next);
    await persistProfileSecrets(normalized.accountProfileList);
    return stripSecretsFromState(normalized);
  });
};

const loadStateWithSecrets = async (): Promise<AccountProfileState> => {
  const raw = normalizeAccountProfileState(await storage.get());
  const secrets = await profileSecretsStorage.get();
  return mergeSecretsIntoState(raw, secrets);
};

const migrateInlineSecretsToLocal = async (): Promise<void> => {
  const raw = normalizeAccountProfileState(await storage.get());
  if (!stateHasInlineSecrets(raw)) {
    return;
  }
  await persistProfileSecrets(raw.accountProfileList);
  await storage.set(stripSecretsFromState(raw));
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

const getNormalizedSnapshot = createCachedSnapshot(
  () => ({
    state: storage.getSnapshot(),
    secrets: profileSecretsStorage.getSnapshot(),
  }),
  ({ state, secrets }) => {
    if (state === null) {
      return null;
    }
    return mergeSecretsIntoState(normalizeAccountProfileState(state), secrets ?? {});
  },
);

let migrationPromise: Promise<void> | null = null;

const ensureMigrated = async (): Promise<void> => {
  if (migrationPromise) {
    return migrationPromise;
  }
  migrationPromise = (async () => {
    await migrateInlineSecretsToLocal();
    const state = await loadStateWithSecrets();
    const hasProfiles = state.accountProfileList.length > 0;

    if (state.migrated && hasProfiles) {
      await migrateLegacyDomainConfig(state);
      return;
    }

    const legacy = await chrome.storage.sync.get([LEGACY_SETTINGS_KEY]);
    const legacyDomain = await chrome.storage.local.get(LEGACY_DOMAIN_CONFIG_KEY);
    const legacySettings = (legacy[LEGACY_SETTINGS_KEY] || defaultSettings) as ISettings;
    const legacyDomainConfig = legacyDomain[LEGACY_DOMAIN_CONFIG_KEY] as DomainConfig | undefined;

    if (state.accountProfileList.length === 0) {
      const profile = createDefaultProfile({
        name: DEFAULT_PROFILE_NUMBER_NAME,
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
      await migrateInlineSecretsToLocal();
      return;
    }

    if (!state.migrated) {
      await setNormalized(current => ({ ...current, migrated: true }));
    }

    await migrateLegacyDomainConfig(await loadStateWithSecrets());
  })();
  return migrationPromise;
};

export const getActiveProfile = (state?: AccountProfileState | null): AccountProfile | undefined => {
  const snapshot = normalizeAccountProfileState(state ?? getNormalizedSnapshot());
  const profiles = snapshot.accountProfileList;
  if (!snapshot.activeProfileId) {
    return profiles[0];
  }
  return profiles.find(profile => profile.id === snapshot.activeProfileId);
};

export const getActiveProfileSettings = (state?: AccountProfileState | null): ISettings => {
  const profile = getActiveProfile(state);
  if (!profile?.settings) {
    return defaultSettingsSnapshot;
  }
  return {
    ...defaultSettings,
    ...profile.settings,
    storageKeyList: profile.settings.storageKeyList?.length
      ? profile.settings.storageKeyList
      : defaultSettings.storageKeyList,
  };
};

export const getActiveProfileDomainConfig = (state?: AccountProfileState | null): DomainConfig => {
  const profile = getActiveProfile(state);
  const domainMap = profile?.domainConfig?.domainMap;
  if (!domainMap || typeof domainMap !== 'object' || Object.keys(domainMap).length === 0) {
    return EMPTY_DOMAIN_CONFIG;
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
    return loadStateWithSecrets();
  },
  getSnapshot: () => getNormalizedSnapshot(),
  subscribe: (listener: () => void) => {
    const unsubStorage = storage.subscribe(listener);
    const unsubSecrets = profileSecretsStorage.subscribe(listener);
    return () => {
      unsubStorage();
      unsubSecrets();
    };
  },
  ensureMigrated,
  getActiveProfile: async () => {
    await ensureMigrated();
    const state = await loadStateWithSecrets();
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
    const current = getActiveProfileDomainConfig(getNormalizedSnapshot());
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
    const settings = getActiveProfileSettings(getNormalizedSnapshot());
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
    const settings = getActiveProfileSettings(getNormalizedSnapshot());
    const exists = settings.storageKeyList.find(item => item.value === key);
    if (!exists) {
      return;
    }
    await accountProfileStorage.updateActiveProfileSettings({
      storageKeyList: settings.storageKeyList.filter(item => item.value !== key),
    });
  },
};
