<div align="center">
<img src="chrome-extension/public/icon-128.png" alt="logo"/>
<h1>Sync Your Cookie</h1>
<p>Sync browser cookies and LocalStorage to Cloudflare KV — across devices and browsers.</p>

![](https://img.shields.io/badge/version-1.7.2-blue)

</div>

[English](./README_EN.md) | [中文](./README.md)

**Sync Your Cookie** is a Chromium extension (Chrome, Edge, and compatible browsers) that syncs cookies and LocalStorage to **Cloudflare KV**. Share login sessions between devices without repeated sign-ins, manage multiple accounts per site, and optionally deploy a **Cloudflare Worker** backend with a password-protected web admin.

> **Note (v1.7.x):** GitHub Gist sync and direct KV credentials in the extension have been removed. The extension syncs **only via Worker** (server URL + access password); KV credentials are configured once in the web admin Connect form.

### Fork highlights

Based on upstream [jackluson/sync-your-cookie](https://github.com/jackluson/sync-your-cookie). This fork adds Worker-only sync, multi-account per domain, pull mirror sync, popup cookie editor, Git-connected Cloudflare deployment, and security hardening. See the [Chinese README](./README.md#与原版对比) for the full comparison table.

### Install

This fork is **not published to the stores separately**. Download `sync-your-cookie-{version}.zip` from **[GitHub Releases](https://github.com/cf-fork-div/sync-your-cookie/releases)**, extract it, and load the unpacked extension. Step-by-step: [how-to-use.md — Get & install](./how-to-use.md#获取与安装).

![Install from Release ZIP](deploy/images/install-from-release.png)

| Method | Notes |
|--------|-------|
| **Release ZIP (recommended)** | [Releases](https://github.com/cf-fork-div/sync-your-cookie/releases) — latest `sync-your-cookie-{version}.zip` |
| Build from source | `pnpm build` → load `dist/` — see [Setup](#setup) |
| Upstream stores (original) | [Chrome](https://chromewebstore.google.com/detail/sync-your-cookie/bcegpckmgklcpcapnbigfdadedcneopf) · [Edge](https://microsoftedge.microsoft.com/addons/detail/sync-your-cookie/ohlcghldllgnmkegocpcphdbbphikgfm) — upstream build, not this fork |

### Features

#### Sync & storage
- Sync **cookies** and **LocalStorage** to Cloudflare KV (protobuf-encoded payload)
- **Cross-browser sync** — same backend works on Chrome, Edge, and other Chromium browsers
- **Worker connection:** Server URL + access password → `/api/sync/*`
- **Pull mirrors remote** — applies remote cookies first, then removes extras; full hostOnly/third-party restore (v1.5.3–1.5.5)
- **Push gather aligned** — push uses the same cookie gathering as the editor, including hostOnly cookies (v1.5.2)
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
- **Popup cookie view/edit** — add/edit/delete, copy value/JSON/Cookie header, clear all, and refresh (v1.5.6–1.5.7)
- **Side panel manager** — full cookie and LocalStorage detail view
- **Web admin manager** — optional Cloudflare Worker deployment; UI aligned with side panel (search, folder/type filters)
- **Multi-account profiles** — separate credentials and domain rules per profile
- **i18n** — English and Simplified Chinese (`en`, `zh_CN`)
- **Version display** — current version in popup footer and options page (e.g. `v1.7.2`)

#### Security

- Credentials and encryption passwords stay local (not synced via Chrome Sync); see [docs/SECURITY.md](./docs/SECURITY.md)

#### Cloudflare Worker backend

Connect this Git repo in Cloudflare to deploy the Worker (web admin + sync API). Extension login uses Worker URL + password. Deploy: [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) · params: [deploy/CLOUDFLARE-PARAMS.md](./deploy/CLOUDFLARE-PARAMS.md).

### Screenshots

Settings — sync server URL and access password

<img width="600" src="./screenshots/settings.png" alt="Settings page"/>

Popup — Push/Pull sync for the current tab

<img width="600" src="./screenshots/popup.png" alt="Popup sync"/>

Popup — cookie list, edit mode, and copy (Cookie header / JSON)

<img width="600" src="./screenshots/popup-cookie-editor.png" alt="Popup cookie editor"/>

Side panel — site list with folder and type filters

<img width="600" src="./screenshots/sidepanel-manager.png" alt="Side panel manager"/>

### Setup

1. Download the ZIP from [GitHub Releases](https://github.com/cf-fork-div/sync-your-cookie/releases) and load the extension, or run `pnpm build` and load `dist/` — see [how-to-use.md](./how-to-use.md).
2. Deploy the Worker via Git-connected Cloudflare Builds — [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) — and set `WEB_ACCESS_PASSWORD`.
3. Log in from the extension popup with **Server URL** + **access password** — usage and scenarios: [how-to-use.md](./how-to-use.md).

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
3. **Pull** — download remote cookies; remote data is applied first, then extras are removed (mirror sync).
4. **Open manager** — side panel for full cookie/LocalStorage management.
5. **Web admin** (optional) — open your Worker URL in a browser for the same manager UI.

**Docs:** [how-to-use.md](./how-to-use.md) · Worker deploy: [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) · Download: [GitHub Releases](https://github.com/cf-fork-div/sync-your-cookie/releases)

### Changelog

| Version | Highlights |
|---------|------------|
| **1.7.2** | Popup account dropdown for single entry; auto pull on open |
| **1.7.1** | Release ZIP distribution; docs and deploy flow updates |
| **1.7.0** | Removed direct KV in extension; Worker URL + password only |
| **1.6.x** | Security hardening, clearer HTTP error messages |
| **1.5.8** | Popup “switch & pull” for multi-account |
| **1.5.6** | Popup cookie editor: add/edit/delete, copy value/JSON |
| **1.5.0** | Worker sync backend, Bitwarden-style login, multi-account per domain, push conflict dialog, pull mirror sync, popup cookie editor, web admin alignment |

Full history: [CHANGELOG.md](./CHANGELOG.md)

### Privacy Policy

Please refer to [Privacy Policy](./private-policy.md) for more information.

### Sponsor

<div align="center">

Thank you for your support!

<img width="200" src="./deploy/images/donation-qr.png" alt="WeChat donation QR code"/>

WeChat donation QR code

</div>
