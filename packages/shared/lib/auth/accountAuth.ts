import type { AccountProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';

type SyncCredentials = Pick<
  AccountProfile,
  'serverUrl' | 'authPassword' | 'accountId' | 'namespaceId' | 'token'
>;

export const isServerSyncConfigured = (profile?: SyncCredentials | null): boolean =>
  Boolean(profile?.serverUrl?.trim() && profile?.authPassword?.trim());

/** @deprecated Use isServerSyncConfigured */
export const isLegacyCloudflareConfigured = (profile?: SyncCredentials | null): boolean =>
  Boolean(profile?.accountId?.trim() && profile?.namespaceId?.trim() && profile?.token?.trim());

export const isAccountConfigured = (profile?: SyncCredentials | null): boolean =>
  isServerSyncConfigured(profile) || isLegacyCloudflareConfigured(profile);
