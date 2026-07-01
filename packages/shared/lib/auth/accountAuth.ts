import type { AccountProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';

type SyncCredentials = Pick<AccountProfile, 'serverUrl' | 'authPassword'>;

export const isServerSyncConfigured = (profile?: SyncCredentials | null): boolean =>
  Boolean(profile?.serverUrl?.trim() && profile?.authPassword?.trim());

/** Whether the active profile has sync server URL + access password configured. */
export const isAccountConfigured = isServerSyncConfigured;
