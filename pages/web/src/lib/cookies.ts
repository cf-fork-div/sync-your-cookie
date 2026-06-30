import { detectFormat } from '@src/lib/mutations';
import { fetchKvViaServer } from '@src/lib/datasource';

import type { CloudflareSource, DataSourceConfig, FormatInfo, ViewerSession } from '@src/lib/types';

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decodeCookiesMap,
  decryptBase64,
  encodeCookiesMap,
  encryptBase64,
  type ICookiesMap,
  isBase64Encrypted,
} from '@sync-your-cookie/protobuf';

export type { ViewerSession, DataSourceConfig, FormatInfo } from '@src/lib/types';

export type ParseOptions = {
  encryptionPassword?: string;
};

export async function parseRawContent(content: string, options: ParseOptions = {}): Promise<ICookiesMap> {
  const trimmed = content.trim();

  if (!trimmed) {
    return {};
  }

  let processedContent = trimmed;

  const protobufEncoding = !trimmed.startsWith('{');

  if (protobufEncoding && isBase64Encrypted(trimmed)) {
    if (!options.encryptionPassword) {
      throw new Error('数据已加密，请输入解密密码');
    }

    processedContent = await decryptBase64(trimmed, options.encryptionPassword);
  }

  if (protobufEncoding) {
    const compressedBuffer = base64ToArrayBuffer(processedContent);

    return decodeCookiesMap(compressedBuffer);
  }

  return JSON.parse(processedContent) as ICookiesMap;
}

export async function serializeCookiesMap(map: ICookiesMap, format: FormatInfo): Promise<string> {
  if (format.protobufEncoding) {
    const buffered = await encodeCookiesMap(map);

    let encodingStr = arrayBufferToBase64(buffered as ArrayBuffer);

    if (format.encryptionEnabled) {
      if (!format.encryptionPassword) {
        throw new Error('数据需要加密保存，请填写解密密码');
      }

      encodingStr = await encryptBase64(encodingStr, format.encryptionPassword);
    }

    return encodingStr;
  }

  return JSON.stringify(map);
}

export async function fetchFromCloudflareKV(config: CloudflareSource): Promise<string> {
  const { accountId, namespaceId, token, storageKey, useProxy = true } = config;

  const base = useProxy ? '/cf-api' : 'https://api.cloudflare.com';

  const url = `${base}/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(storageKey)}`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('网络请求失败。Cloudflare API 可能被 CORS 拦截，请使用 dev 模式或配置反向代理。');
  }

  if (response.status === 404) {
    return '';
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`Cloudflare 读取失败 (${response.status}): ${text}`);
  }

  return (await response.text()).trim();
}

export async function writeToCloudflareKV(config: CloudflareSource, content: string): Promise<void> {
  if (config.serverManaged) {
    const url = new URL('/api/sync/kv', window.location.origin);
    url.searchParams.set('storageKey', config.storageKey);
    const response = await fetch(url.toString(), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server write failed (${response.status}): ${text}`);
    }
    return;
  }

  const { accountId, namespaceId, token, storageKey, useProxy = true } = config;

  const base = useProxy ? '/cf-api' : 'https://api.cloudflare.com';

  const url = `${base}/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(storageKey)}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'PUT',

      headers: {
        Authorization: `Bearer ${token}`,

        'Content-Type': 'text/plain',
      },

      body: content,
    });
  } catch {
    throw new Error('Cloudflare 写入失败，请检查网络或 CORS 配置');
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`Cloudflare 写入失败 (${response.status}): ${text}`);
  }

  const result = await response.json();

  if (result.success === false) {
    throw new Error(result.errors?.[0]?.message || 'Cloudflare 写入失败');
  }
}

export async function saveCookiesMap(session: ViewerSession, map: ICookiesMap): Promise<void> {
  const content = await serializeCookiesMap(map, session.format);

  switch (session.dataSource.type) {
    case 'cloudflare':
      await writeToCloudflareKV(session.dataSource, content);

      break;

    default:
      throw new Error('当前连接方式不支持写入，请使用 Cloudflare KV 模式');
  }
}

export async function loadSession(params: {
  dataSource: DataSourceConfig;

  encryptionPassword?: string;
}): Promise<ViewerSession> {
  const { dataSource, encryptionPassword } = params;

  let content = '';

  switch (dataSource.type) {
    case 'cloudflare':
      if (dataSource.serverManaged) {
        content = await fetchKvViaServer(dataSource.storageKey);
      } else {
        content = await fetchFromCloudflareKV({
          ...dataSource,
          useProxy: dataSource.useProxy ?? true,
        });
      }

      break;

    case 'paste':
      throw new Error('paste 模式请直接传入内容');
  }

  const format = detectFormat(content, encryptionPassword);

  const parsed = await parseRawContent(content, { encryptionPassword });

  const cookieMap: ICookiesMap = {
    ...parsed,
    domainCookieMap: parsed.domainCookieMap ?? {},
  };

  return {
    cookieMap,

    dataSource,

    format,

    canWrite: dataSource.type === 'cloudflare',
  };
}

export function formatCookieHeader(
  _domain: string,
  cookies: { name?: string | null; value?: string | null }[],
): string {
  const pairs: string[] = [];

  for (const cookie of cookies) {
    if (cookie.name && cookie.value) {
      pairs.push(`${cookie.name}=${cookie.value}`);
    }
  }

  return pairs.join('; ');
}

export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error('当前环境不支持剪贴板，请手动复制');
  }

  await navigator.clipboard.writeText(text);
}
