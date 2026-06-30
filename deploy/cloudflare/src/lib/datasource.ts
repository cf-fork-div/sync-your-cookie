export const DATASOURCE_CONFIG_KEY = '__syc_datasource_config__';

export interface DatasourceConfig {
  accountId: string;
  namespaceId: string;
  token: string;
  storageKey: string;
}

export interface DatasourceStatus {
  configured: boolean;
  accountId?: string;
  namespaceId?: string;
  storageKey?: string;
  tokenMasked?: string;
}

export async function loadDatasourceConfig(kv: KVNamespace): Promise<DatasourceConfig | null> {
  const raw = await kv.get(DATASOURCE_CONFIG_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DatasourceConfig>;
    if (
      parsed.accountId?.trim() &&
      parsed.namespaceId?.trim() &&
      parsed.token?.trim() &&
      parsed.storageKey?.trim()
    ) {
      return {
        accountId: parsed.accountId.trim(),
        namespaceId: parsed.namespaceId.trim(),
        token: parsed.token.trim(),
        storageKey: parsed.storageKey.trim(),
      };
    }
  } catch {
    // ignore invalid config
  }
  return null;
}

export async function saveDatasourceConfig(kv: KVNamespace, config: DatasourceConfig): Promise<void> {
  await kv.put(DATASOURCE_CONFIG_KEY, JSON.stringify(config));
}

export function maskToken(token: string): string {
  if (token.length < 8) {
    return '****';
  }
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function toDatasourceStatus(config: DatasourceConfig | null): DatasourceStatus {
  if (!config) {
    return { configured: false };
  }
  return {
    configured: true,
    accountId: config.accountId,
    namespaceId: config.namespaceId,
    storageKey: config.storageKey,
    tokenMasked: maskToken(config.token),
  };
}

function kvValueUrl(config: DatasourceConfig, storageKey?: string): string {
  const key = encodeURIComponent(storageKey?.trim() || config.storageKey);
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${key}`;
}

export async function readKvValue(config: DatasourceConfig, storageKey?: string): Promise<string> {
  const url = kvValueUrl(config, storageKey);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (response.status === 404) {
    return '';
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KV read failed (${response.status}): ${text}`);
  }
  return (await response.text()).trim();
}

export async function writeKvValue(
  config: DatasourceConfig,
  value: string,
  storageKey?: string,
): Promise<void> {
  const url = kvValueUrl(config, storageKey);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'text/plain',
    },
    body: value,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KV write failed (${response.status}): ${text}`);
  }
  const result = (await response.json()) as { success?: boolean; errors?: { message?: string }[] };
  if (result.success === false) {
    throw new Error(result.errors?.[0]?.message || 'KV write failed');
  }
}
