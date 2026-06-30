<div align="center">
<img src="chrome-extension/public/icon-128.png" alt="logo"/>
<h1> Sync your cookie to Cloudflare KV</h1>

![](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://badges.aleen42.com/src/vitejs.svg)
![GitHub action badge](https://github.com/jackluson/sync-your-cookie/actions/workflows/build-zip.yml/badge.svg)

</div>

[English](./README.md) | [中文](./README_ZH.md)

`Sync your cookie` is a Chrome extension that helps you sync cookies to **Cloudflare KV**. It is a useful tool for web developers to share cookies between different devices without repeated logins, and includes a management panel for viewing and managing synced data.

### Install

Chrome: [Sync Your Cookie](https://chromewebstore.google.com/detail/sync-your-cookie/bcegpckmgklcpcapnbigfdadedcneopf)

Edge: [Sync Your Cookie](https://microsoftedge.microsoft.com/addons/detail/sync-your-cookie/ohlcghldllgnmkegocpcphdbbphikgfm)

### Features

- Sync cookies to **Cloudflare KV** (includes LocalStorage)
- Configure **Auto Merge** and **Auto Push** rules per site
- Cookie data transmitted via protobuf encoding
- Management panel to view, copy, and manage synced cookie data
- **Multi-account profiles** — separate Cloudflare credentials and domain rules per profile
- **i18n** — English and Simplified Chinese (`en`, `zh_CN`) in the extension UI and Web Viewer
- **Web Viewer** — optional browser-based viewer deployed to Cloudflare Worker (see below)

> **Note:** GitHub Gist sync has been removed. Cloudflare KV is the only supported backend.

### Project Screenshots

Account Settings Page

<img width="600" src="./screenshots/settings_v2.png" alt="account settings"/>

Cookie Sync Popup Page

<img width="600" src="./screenshots/sync.png" alt="cookie sync popup"/>

Cookie Manager Sidebar Panel

<img width="600" src="./screenshots/panel.png" alt="cookie manager sidebar panel"/>

Cookie Detail

<img width="600" src="./screenshots/panel_item.png" alt="cookie manager sidebar panel"/>

LocalStorage Detail

<img width="600" src="./screenshots/panel_item_localStorage.png" alt="cookie manager sidebar panel"/>

Pushed Cookie on Cloudflare

<img width="600" src="./screenshots/key_value.png" alt="Pushed Cookie on Cloudflare"/>

### Usage

[How to use](./how-to-use.md)

### Cloudflare Web Viewer (one-command deploy)

Deploy the Web Viewer to Cloudflare Worker and auto-create the KV namespace used by the extension. See [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) for full details (Chinese).

Web login password (`WEB_ACCESS_PASSWORD`) and access path (`WEB_BASE_PATH`) are **runtime Cloudflare settings**: change them in the Dashboard and they take effect **immediately** — no rebuild required. A password is **not** required before deploy.

```bash
cp deploy/cloudflare/.env.example deploy/cloudflare/.env
# Edit .env: set CLOUDFLARE_API_TOKEN (recommended); password can be set in Dashboard after deploy
pnpm deploy:cloudflare
```

**Alternative:** connect this repo to Cloudflare Workers (Git-based deploy). Build command: `pnpm install && pnpm build:cloudflare-worker`, deploy: `npx wrangler deploy --config deploy/cloudflare/wrangler.toml`. See [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md#git-仓库连接部署可选) for limitations (no auto KV creation, manual credentials).

### TODO

- [x] Custom Save Configure
- [x] Multi-account synchronization based on Storage-key
- [x] Sync LocalStorage
- [x] Multi-account profiles
- [x] i18n (en / zh_CN)
- [x] Cloudflare Web Viewer one-command deploy

### Privacy Policy

Please refer to [Privacy Policy](./private-policy.md) for more information.

### Support

If you find this project helpful, you can support the development by:

- Starring the repository ⭐
- [Sponsoring via Ko-fi](https://ko-fi.com/jacklu) 💖
- Sponsor via Wechat
  <div>
    <img src="./screenshots/wechat_sponsor.jpg" alt="微信支付" style="width: 150px;">
  </div>
- Sharing it with others 🚀
