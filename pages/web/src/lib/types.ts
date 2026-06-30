import type { ICookiesMap } from '@sync-your-cookie/protobuf';

export type FormatInfo = {
  protobufEncoding: boolean;

  encryptionEnabled: boolean;

  encryptionPassword?: string;
};

export type CloudflareSource = {
  type: 'cloudflare';

  accountId: string;

  namespaceId: string;

  token: string;

  storageKey: string;

  useProxy?: boolean;

  /** Credentials stored server-side via /api/admin/datasource */
  serverManaged?: boolean;
};

export type PasteSource = {
  type: 'paste';
};

export type DataSourceConfig = CloudflareSource | PasteSource;

export type ViewerSession = {
  cookieMap: ICookiesMap;

  dataSource: DataSourceConfig;

  format: FormatInfo;

  canWrite: boolean;
};
