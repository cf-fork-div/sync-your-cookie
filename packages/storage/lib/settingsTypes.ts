export interface IStorageItem {
  value: string;
  label: string;
  [key: string]: unknown;
}

export interface ISettings {
  storageKeyList: IStorageItem[];
  storageKey?: string;
  protobufEncoding?: boolean;
  includeLocalStorage?: boolean;
  localStorageGetting?: boolean;
  contextMenu?: boolean;
  encryptionEnabled?: boolean;
  encryptionPassword?: string;
}

export const defaultKey = 'sync-your-cookie';

export const defaultSettings: ISettings = {
  storageKeyList: [{ value: defaultKey, label: defaultKey }],
  storageKey: defaultKey,
  protobufEncoding: false,
  includeLocalStorage: true,
  contextMenu: false,
};
