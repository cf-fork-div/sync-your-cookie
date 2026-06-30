/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only override; production auth uses Cloudflare runtime WEB_ACCESS_PASSWORD */

  readonly VITE_WEB_ACCESS_PASSWORD?: string;

  /** Dev-only base path; production path uses Cloudflare runtime WEB_BASE_PATH */

  readonly VITE_WEB_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
