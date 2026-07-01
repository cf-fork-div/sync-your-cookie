import { BaseStorage, createStorage, StorageType } from './base';

export interface ProfileSecretEntry {
  authPassword?: string;
  encryptionPassword?: string;
}

export type ProfileSecretsMap = Record<string, ProfileSecretEntry>;

const SECRETS_STORAGE_KEY = 'account-profile-secrets-key';

const storage = createStorage<ProfileSecretsMap>(SECRETS_STORAGE_KEY, {}, {
  storageType: StorageType.Local,
  liveUpdate: true,
});

export const profileSecretsStorage: BaseStorage<ProfileSecretsMap> = storage;
