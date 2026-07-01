import { loadDatasourceConfig } from '../lib/datasource';
import { jsonResponse } from '../lib/response';

const ALLOWED_CF_API_PATH =
  /^\/client\/v4\/accounts\/[^/]+\/storage\/kv\/namespaces\/[^/]+\/values\/[^/?#]+$/;

const ALLOWED_METHODS = new Set(['GET', 'PUT', 'HEAD']);

/**
 * Proxy Cloudflare REST API to avoid browser CORS on the static web viewer.
 * Restricted to KV value read/write paths for the configured datasource namespace.
 */
export async function handleCfApi(request: Request, kv: KVNamespace): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/cf-api/, '') || '/';

  if (!ALLOWED_CF_API_PATH.test(apiPath)) {
    return jsonResponse({ ok: false, error: 'forbidden_path' }, { status: 403 });
  }

  const config = await loadDatasourceConfig(kv);
  if (config) {
    const match = apiPath.match(
      /^\/client\/v4\/accounts\/([^/]+)\/storage\/kv\/namespaces\/([^/]+)\/values\//,
    );
    if (match && (match[1] !== config.accountId || match[2] !== config.namespaceId)) {
      return jsonResponse({ ok: false, error: 'forbidden_namespace' }, { status: 403 });
    }
  }

  const targetUrl = `https://api.cloudflare.com${apiPath}${url.search}`;

  const headers = new Headers();
  const auth = request.headers.get('Authorization');
  if (auth) {
    headers.set('Authorization', auth);
  }
  const contentType = request.headers.get('Content-Type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  return fetch(targetUrl, init);
}
