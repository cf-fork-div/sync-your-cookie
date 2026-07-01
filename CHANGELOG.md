# Changelog

All notable changes to **Sync Your Cookie** are documented here.

## [1.5.3] — 2026-07-01

### Fixed
- **Pull cookie round-trip** — apply every cookie stored for a domain entry on pull (including host-only subdomain and third-party cookies that push captured). Previously `cookieMatchesHost` dropped host-only cookies whose domain did not exactly match the storage host (e.g. `www.xkdaili.com` under `xkdaili.com`) and excluded third-party cookies (e.g. analytics on `.hm.baidu.com`).
- **Silent pull failures** — `setCookieInBrowser` now rejects when `chrome.cookies.set` fails; pull reports which cookie names failed instead of swallowing errors.

## [1.5.1] — 2026-07-01

### Added
- **Account meta in push dialog** — set folder and entry type (login / session / other) when pushing or resolving conflicts.
- **EntryMetaFields** shared UI component for label, folder, and type across popup, side panel, options, and web admin.

### Changed
- Entry metadata (`label`, `folder`, `type`) syncs via `entryMetaMap` in the protobuf payload and merges on push/pull.
- Documentation refresh: independent project branding, full feature list, store publish guide.

## [1.5.0] — 2026-06

### Added
- **Bitwarden-style login** — connect with **Server URL + access password** instead of raw Cloudflare KV credentials (Worker `/api/sync/*` backend).
- **Cloudflare Worker sync backend** — optional deploy of Web Viewer + sync API; extension can use direct KV API or Worker proxy.
- **Multi-account per domain** — multiple cookie entries on the same host with labels, folders, and types.
- **First-push remark** — first push to a host prompts for an account label before saving.
- **Push conflict dialog** — when cookies differ from remote, choose **overwrite existing entry** or **save as new account**.
- **Pull mirrors remote** — clears local cookies for the host before applying remote data (true mirror sync).
- **Auto refresh before actions** — push, pull, and open manager refresh the server connection first.
- **Popup cookie view/edit** — inline cookie editor with clear-all for the active tab host.
- **Web admin manager** — browser-based manager aligned with side panel (search, folder/type filters, entry detail).
- **Cross-browser sync** — same KV or Worker backend works across Chrome, Edge, and other Chromium browsers.
- **Version display** — `v{version}` shown in popup footer and options page.

### Changed
- Removed GitHub Gist sync; **Cloudflare KV** (direct or via Worker) is the only backend.
- Account profiles support Worker URL mode alongside legacy Account ID / Namespace ID / API Token mode.

## Earlier releases

See [GitHub Releases](https://github.com/jackluson/sync-your-cookie/releases) for history before 1.5.0.
