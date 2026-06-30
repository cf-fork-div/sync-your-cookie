<div align="center">
<img src="chrome-extension/public/icon-128.png" alt="logo"/>
<h1>Sync Your Cookie</h1>
<p>Sync browser cookies and LocalStorage to Cloudflare KV — across devices and browsers.</p>

![](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/Typescript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://badges.aleen42.com/src/vitejs.svg)
![Version](https://img.shields.io/badge/version-1.5.1-blue)
![GitHub action badge](https://github.com/jackluson/sync-your-cookie/actions/workflows/build-zip.yml/badge.svg)

</div>

[English](./README.md) | [中文](./README_ZH.md)

**Sync Your Cookie** is a Chromium extension (Chrome, Edge, and compatible browsers) that syncs cookies and LocalStorage to **Cloudflare KV**. Share login sessions between devices without repeated sign-ins, manage multiple accounts per site, and optionally deploy a **Cloudflare Worker** backend with a password-protected web admin.

> **Note:** GitHub Gist sync has been removed. The only supported backend is a **Cloudflare Worker** (URL + password).

### Install

| Store | Link |
|-------|------|
| Chrome | [Sync Your Cookie](https://chromewebstore.google.com/detail/sync-your-cookie/bcegpckmgklcpcapnbigfdadedcneopf) |
| Edge | [Sync Your Cookie](https://microsoftedge.microsoft.com/addons/detail/sync-your-cookie/ohlcghldllgnmkegocpcphdbbphikgfm) |

Build from source: see [Setup](#setup) and [Store publishing](./STORE_PUBLISH.md).

### Features

#### Sync & storage
- Sync **cookies** and **LocalStorage** to Cloudflare KV (protobuf-encoded payload)
- **Cross-browser sync** — same backend works on Chrome, Edge, and other Chromium browsers
- **Worker connection:** Server URL + access password → `/api/sync/*`
- **Pull mirrors remote** — clears local cookies for the host before applying remote data
- Per-site **Auto Push** and **Auto Pull** rules

#### Multi-account & metadata
- **Multiple accounts per domain** — separate entries on the same host with labels
- **Folder & type** — Bitwarden-style folders plus entry types: login / session / other
- **`entryMetaMap` sync** — label, folder, and type travel with the cookie payload
- **First push** requires an account remark (label) when no remote entry exists
- **Push conflict dialog** — overwrite an existing entry or save as a new account

#### UI & management
- **Bitwarden-style login gate** — profile name, server URL, and password in popup / side panel
- **Auto refresh** before push, pull, and open manager (verifies server connection first)
- **Popup cookie view/edit** — inspect, edit, remove, or clear all cookies for the active tab
- **Side panel manager** — full cookie and LocalStorage detail view
- **Web admin manager** — optional Cloudflare Worker deployment; UI aligned with side panel (search, folder/type filters)
- **Multi-account profiles** — separate credentials and domain rules per profile
- **i18n** — English and Simplified Chinese (`en`, `zh_CN`)
- **Version display** — `v1.5.1` in popup footer and options page

#### Cloudflare Worker backend

Connect this Git repo in Cloudflare to deploy the Worker (web admin + sync API). Extension login uses Worker URL + password. See [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md).

### Screenshots

Settings — sync server URL and access password

<img width="600" src="./screenshots/settings.png" alt="Settings page"/>

Popup — Push/Pull sync for the current tab

<img width="600" src="./screenshots/popup.png" alt="Popup sync"/>

Popup — cookie list with view/edit mode

<img width="600" src="./screenshots/popup-cookie-editor.png" alt="Popup cookie editor"/>

Side panel — site list with folder and type filters

<img width="600" src="./screenshots/sidepanel-manager.png" alt="Side panel manager"/>

### Setup

1. Install the extension from the store, or load `dist/` after `pnpm build`.
2. Deploy the Worker via Git-connected Cloudflare Builds — [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) — and set `WEB_ACCESS_PASSWORD`.
3. Log in from the extension popup with **Server URL** + **access password** — [how-to-use.md](./how-to-use.md).

#### Build from source

```bash
pnpm install
pnpm dev          # development with HMR
pnpm build        # production → dist/
pnpm release:zip  # store-ready zip → dist/release/
```

### Usage

1. **Log in** — Worker URL + password.
2. **Push** — upload current tab cookies to remote (conflict dialog when data differs).
3. **Pull** — download remote cookies; local cookies for that host are cleared first (mirror sync).
4. **Open manager** — side panel for full cookie/LocalStorage management.
5. **Web admin** (optional) — open your Worker URL in a browser for the same manager UI.

Usage: [how-to-use.md](./how-to-use.md) · Worker deploy: [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) · Store publishing: [STORE_PUBLISH.md](./STORE_PUBLISH.md)

### Changelog

| Version | Highlights |
|---------|------------|
| **1.5.1** | Account folder/type in push dialog; entry meta UI shared across surfaces |
| **1.5.0** | Worker sync backend, Bitwarden-style login, multi-account per domain, push conflict dialog, pull mirror sync, popup cookie editor, web admin alignment |

Full history: [CHANGELOG.md](./CHANGELOG.md)

### Privacy Policy

Please refer to [Privacy Policy](./private-policy.md) for more information.

### Support

If you find this project helpful, you can support the development by:

- Starring the repository ⭐ — [github.com/jackluson/sync-your-cookie](https://github.com/jackluson/sync-your-cookie)
- [Sponsoring via Ko-fi](https://ko-fi.com/jacklu) 💖
- Sponsor via Wechat
  <div>
    <img src="./screenshots/wechat_sponsor.jpg" alt="微信支付" style="width: 150px;">
  </div>
- Sharing it with others 🚀
