import type { MessageKey } from '@sync-your-cookie/shared';

/** Resolve API URL relative to the current page (respects WEB_BASE_PATH / Vite base). */
export function apiUrl(apiPath: string): URL {
  const relative = apiPath.replace(/^\//, '');
  return new URL(relative, window.location.href);
}

export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.trimStart().startsWith('<!')) {
      throw new Error('api_html_response');
    }
    throw new Error(text.slice(0, 300) || `HTTP ${res.status}`);
  }
}

export function mapApiErrorCode(code: string, t: (key: MessageKey) => string): string {
  switch (code) {
    case 'unauthorized':
      return t('apiUnauthorized');
    case 'api_html_response':
      return t('apiHtmlResponse');
    case 'fetch_datasource_failed':
    case 'save_datasource_failed':
      return t('loadFailed');
    case 'missing_fields':
      return t('fillCloudflareConfig');
    default:
      return code;
  }
}
