/**
 * Proxy Cloudflare REST API to avoid browser CORS on the static web viewer.
 * Browser calls /cf-api/client/v4/... with Authorization header; this forwards to api.cloudflare.com.
 */
export async function handleCfApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/cf-api/, '') || '/';
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
