const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function isExtensionOrigin(origin: string | null): boolean {
  return Boolean(origin?.startsWith('chrome-extension://'));
}

export function corsPreflightResponse(request: Request): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }
  const origin = request.headers.get('Origin');
  if (!origin) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    },
  });
}

export function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin');
  if (!origin) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
