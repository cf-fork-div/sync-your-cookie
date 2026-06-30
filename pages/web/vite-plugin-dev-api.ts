import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getWebAccessPassword, getWebBasePathPrefix, getWebBasePathSegment } from '../../deploy/cloudflare/src/lib/env';
import { createLogoutCookie, createSessionCookie, isValidSession } from '../../deploy/cloudflare/src/lib/session';

type DevEnv = {
  WEB_ACCESS_PASSWORD?: string;
  WEB_BASE_PATH?: string;
};

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers ?? {})) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

function parseCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function appendSetCookie(res: ServerResponse, value: string) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', value);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, value]);
    return;
  }
  res.setHeader('Set-Cookie', [String(existing), value]);
}

function getDevEnv(mode: string, env: Record<string, string>): DevEnv {
  const password = env.VITE_WEB_ACCESS_PASSWORD?.trim() || (mode === 'development' ? 'dev' : undefined);
  return {
    WEB_ACCESS_PASSWORD: password,
    WEB_BASE_PATH: env.VITE_WEB_BASE_PATH,
  };
}

type DevDatasourceConfig = {
  accountId: string;
  namespaceId: string;
  token: string;
  storageKey: string;
};

const devDatasourceConfig: { value: DevDatasourceConfig | null } = { value: null };
const devKvStore = new Map<string, string>();

function getBearerPassword(req: IncomingMessage): string | null {
  const auth = req.headers.authorization?.trim();
  if (!auth) {
    return null;
  }
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function isDevAuthorized(req: IncomingMessage, devEnv: DevEnv): Promise<boolean> {
  const password = getWebAccessPassword(devEnv);
  if (!password) {
    return false;
  }
  const bearer = getBearerPassword(req);
  if (bearer && bearer === password) {
    return true;
  }
  const token = parseCookie(req, 'syc_session');
  if (!token) {
    return false;
  }
  return isValidSession(
    new Request('http://localhost', {
      headers: { Cookie: `syc_session=${encodeURIComponent(token)}` },
    }),
    password,
  );
}

function getStorageKeyFromUrl(req: IncomingMessage): string {
  const rawUrl = req.url || '';
  const query = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
  const params = new URLSearchParams(query);
  return params.get('storageKey')?.trim() || devDatasourceConfig.value?.storageKey || 'sync-your-cookie';
}

function normalizeDevApiPath(rawPath: string, devEnv: DevEnv): string | null {
  const baseSegment = getWebBasePathSegment(devEnv);
  if (baseSegment) {
    const prefix = `/${baseSegment}`;
    if (rawPath === `${prefix}/api` || rawPath.startsWith(`${prefix}/api/`)) {
      return rawPath.slice(prefix.length);
    }
  }
  if (rawPath === '/api' || rawPath.startsWith('/api/')) {
    return rawPath;
  }
  return null;
}

export function devWebApiPlugin(mode: string, env: Record<string, string>): Plugin {
  const devEnv = getDevEnv(mode, env);

  return {
    name: 'dev-web-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url?.split('?')[0] ?? '';
        const url = normalizeDevApiPath(rawUrl, devEnv);
        if (!url) {
          next();
          return;
        }

        try {
          if (url === '/api/session' && req.method === 'GET') {
            const configuredPassword = getWebAccessPassword(devEnv);
            const basePath = getWebBasePathPrefix(devEnv);
            if (!configuredPassword) {
              sendJson(res, 200, { authenticated: false, passwordConfigured: false, basePath });
              return;
            }
            const token = parseCookie(req, 'syc_session');
            const authenticated = token
              ? await isValidSession(
                  new Request('http://localhost', {
                    headers: { Cookie: `syc_session=${encodeURIComponent(token)}` },
                  }),
                  configuredPassword,
                )
              : false;
            sendJson(res, 200, { authenticated, passwordConfigured: true, basePath });
            return;
          }

          if (url === '/api/login' && req.method === 'POST') {
            const configuredPassword = getWebAccessPassword(devEnv);
            if (!configuredPassword) {
              sendJson(res, 503, { ok: false, error: 'password_not_configured' });
              return;
            }
            const body = (await readJsonBody(req)) as { password?: string };
            const password = body.password?.trim();
            if (!password) {
              sendJson(res, 400, { ok: false, error: 'missing_password' });
              return;
            }
            if (password !== configuredPassword) {
              sendJson(res, 401, { ok: false, error: 'wrong_password' });
              return;
            }
            const setCookie = await createSessionCookie(configuredPassword, false);
            appendSetCookie(res, setCookie);
            sendJson(res, 200, { ok: true });
            return;
          }

          if (url === '/api/logout' && req.method === 'POST') {
            appendSetCookie(res, createLogoutCookie(false));
            sendJson(res, 200, { ok: true });
            return;
          }

          if (url === '/api/admin/datasource') {
            const authorized = await isDevAuthorized(req, devEnv);
            if (!authorized) {
              sendJson(res, 401, { ok: false, error: 'unauthorized' });
              return;
            }
            if (req.method === 'GET') {
              const config = devDatasourceConfig.value;
              sendJson(res, 200, {
                ok: true,
                configured: Boolean(config),
                accountId: config?.accountId,
                namespaceId: config?.namespaceId,
                storageKey: config?.storageKey,
                tokenMasked: config?.token ? `${config.token.slice(0, 4)}…${config.token.slice(-4)}` : undefined,
              });
              return;
            }
            if (req.method === 'PUT') {
              const body = (await readJsonBody(req)) as Partial<DevDatasourceConfig>;
              const accountId = body.accountId?.trim();
              const namespaceId = body.namespaceId?.trim();
              const token = body.token?.trim();
              const storageKey = body.storageKey?.trim() || 'sync-your-cookie';
              if (!accountId || !namespaceId || !token) {
                sendJson(res, 400, { ok: false, error: 'missing_fields' });
                return;
              }
              devDatasourceConfig.value = { accountId, namespaceId, token, storageKey };
              sendJson(res, 200, {
                ok: true,
                configured: true,
                accountId,
                namespaceId,
                storageKey,
                tokenMasked: `${token.slice(0, 4)}…${token.slice(-4)}`,
              });
              return;
            }
          }

          if (url === '/api/sync/status' && req.method === 'GET') {
            const authorized = await isDevAuthorized(req, devEnv);
            if (!authorized) {
              sendJson(res, 401, { ok: false, error: 'unauthorized' });
              return;
            }
            sendJson(res, 200, {
              ok: true,
              datasourceConfigured: Boolean(devDatasourceConfig.value),
              storageKey: devDatasourceConfig.value?.storageKey,
            });
            return;
          }

          if (url === '/api/sync/kv') {
            const authorized = await isDevAuthorized(req, devEnv);
            if (!authorized) {
              sendJson(res, 401, { ok: false, error: 'unauthorized' });
              return;
            }
            if (!devDatasourceConfig.value) {
              sendJson(res, 503, { ok: false, error: 'datasource_not_configured' });
              return;
            }
            const key = getStorageKeyFromUrl(req);
            if (req.method === 'GET') {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.end(devKvStore.get(key) || '');
              return;
            }
            if (req.method === 'PUT') {
              const chunks: Buffer[] = [];
              await new Promise<void>((resolve, reject) => {
                req.on('data', chunk => chunks.push(Buffer.from(chunk)));
                req.on('end', () => resolve());
                req.on('error', reject);
              });
              devKvStore.set(key, Buffer.concat(chunks).toString('utf8'));
              sendJson(res, 200, { ok: true });
              return;
            }
          }

          sendJson(res, 404, { ok: false, error: 'not_found' });
        } catch {
          sendJson(res, 500, { ok: false, error: 'internal_error' });
        }
      });
    },
  };
}
