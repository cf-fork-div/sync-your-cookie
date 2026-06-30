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

### Extension only (no Web deploy)

You only need the browser extension to sync cookies — **no Web Viewer deploy required**. Install the extension, set up a KV namespace and API token in Cloudflare ([how-to-use](./how-to-use.md)), and paste **Account ID / Namespace ID / API Token** into the extension Options page. The Web Viewer below is optional for managing cookies in a browser.

### Cloudflare Web Viewer (optional)

Deploy the Web Viewer to **Cloudflare Worker** (static assets + API). One command also creates the KV namespace and prints extension credentials:

```bash
cp deploy/cloudflare/.env.example deploy/cloudflare/.env
# Set CLOUDFLARE_API_TOKEN in .env (or use wrangler login)
pnpm deploy:cloudflare
```

After deploy, set `WEB_ACCESS_PASSWORD` and `WEB_BASE_PATH` in the Cloudflare Dashboard — they take effect immediately, no rebuild. Full guide: [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md).

**Git CI (optional):** connect the repo in Cloudflare Workers → Connect to Git. Build: `pnpm install && pnpm build:cloudflare-worker`. Deploy: `npx wrangler deploy --config deploy/cloudflare/wrangler.toml`. See [Git deploy notes](./deploy/CLOUDFLARE.md#git-仓库连接部署可选).

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
