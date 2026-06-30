import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getWebAccessPassword, getWebBasePathPrefix } from '../../deploy/cloudflare/src/lib/env';
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

export function devWebApiPlugin(mode: string, env: Record<string, string>): Plugin {
  const devEnv = getDevEnv(mode, env);

  return {
    name: 'dev-web-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/api/')) {
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

          sendJson(res, 404, { ok: false, error: 'not_found' });
        } catch {
          sendJson(res, 500, { ok: false, error: 'internal_error' });
        }
      });
    },
  };
}
