import react from '@vitejs/plugin-react-swc';

import { resolve } from 'path';

import { defineConfig, loadEnv, type Plugin } from 'vite';

import { getDevViteBasePath } from './src/lib/basePath';
import { devWebApiPlugin } from './vite-plugin-dev-api';

const rootDir = resolve(__dirname);

const srcDir = resolve(rootDir, 'src');

function blockRootWhenCustomBase(base: string): Plugin {
  return {
    name: 'block-root-when-custom-base',

    configureServer(server) {
      if (base === '/') {
        return;
      }

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        if (url === '/' || url === '/index.html') {
          res.statusCode = 404;

          res.end('Not Found');

          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '');

  const isDev = mode === 'development';

  const base = isDev ? getDevViteBasePath(env.VITE_WEB_BASE_PATH) : '/';

  if (!isDev && base === '/') {
    console.log('[web] Production build uses base /. Custom path is applied at runtime via WEB_BASE_PATH.');
  }

  return {
    base,

    resolve: {
      alias: {
        '@src': srcDir,
      },
    },

    plugins: [react(), devWebApiPlugin(mode, env), blockRootWhenCustomBase(base)],

    server: {
      port: 5173,

      proxy: {
        '/cf-api': {
          target: 'https://api.cloudflare.com',

          changeOrigin: true,

          rewrite: path => path.replace(/^\/cf-api/, ''),
        },
      },
    },

    build: {
      outDir: resolve(rootDir, '..', '..', 'dist', 'web'),

      sourcemap: false,

      minify: true,
    },
  };
});
