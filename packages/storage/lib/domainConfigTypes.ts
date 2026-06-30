export type CookieEntryType = 'login' | 'session' | 'other';

export type DomainItemConfig = {
  autoPull?: boolean;
  autoPush?: boolean;
  favIconUrl?: string;
  sourceUrl?: string;
  /** Display name for multi-account entries on the same host */
  label?: string;
  /** Folder name for grouping entries (Bitwarden-style) */
  folder?: string;
  /** Entry category */
  type?: CookieEntryType;
};

export interface DomainConfig {
  domainMap: {
    [storageKey: string]: DomainItemConfig;
  };
  /** Known folder names for the active profile */
  folders?: string[];
  /** Popup/sidepanel last chosen entry per host (storage key) */
  lastSelectedEntryByHost?: Record<string, string>;
}

export const defaultDomainConfig = (): DomainConfig => ({
  domainMap: {},
});
