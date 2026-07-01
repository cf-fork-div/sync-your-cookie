# Changelog

All notable changes to **Sync Your Cookie** are documented here.

## [1.6.0] — 2026-07-01

### Security
- **Content script:** removed `window.$messageListener`; validate `sender.id === chrome.runtime.id` on all extension messages.
- **localStorage domain match:** strict hostname comparison instead of `location.origin.includes()`.
- **Credentials:** `authPassword` and `encryptionPassword` moved to `chrome.storage.local` with automatic migration from sync.
- **Worker login rate limiting** (5 failures / 15 min per IP).
- **Web sessions:** random session IDs in KV; legacy HMAC cookies accepted during transition.
- **`/cf-api/*`:** restricted to KV value paths for the configured namespace.
- **`/api/sync/kv`:** storage key allowlist on Worker and extension.
- **CORS:** extension origins + same host only for sync API.
- **Encryption:** default on for new profiles; warning banner when Protobuf is on without encryption.
- **Dependencies:** protobufjs upgraded to patched release.
- See [docs/SECURITY.md](./docs/SECURITY.md) for full details and reporting.

## [1.5.8] — 2026-07-01

### Added
- **Popup「切换并拉取」** — when a site has multiple saved accounts, choose an account in the dropdown and use one click to refresh the connection, pull that account’s cookies, and reload tabs (same flow as Pull, placed next to the account selector).

## [1.5.7] — 2026-07-01

### Added
- **Popup cookie editor toolbar** — copy Cookie header (icon) and copy all cookies as JSON (icon) next to clear all and refresh, matching side panel domain detail.

## [1.5.6] — 2026-07-01

### Added
- **Popup cookie editor** — full management: add cookie dialog, copy value, copy single cookie as JSON, copy all cookies as JSON, inline edit/save (expand row), delete, clear all, and refresh.

## [1.5.5] — 2026-07-01

### Fixed
- **Pull losing cookies on partial failure** — pull no longer clears all browser cookies before applying remote data. Remote cookies are set first; only extras not in the remote payload are removed afterward. Failed sets leave existing cookies intact so a partial pull cannot drop you from 8 to 6.
- **Invalid sameSite on pull** — protobuf defaults and empty `sameSite` values are normalized before `chrome.cookies.set`, avoiding silent rejections.
- **Pull failure toasts** — skipped cookies are reported as `name@domain: reason` in the warning toast (popup and side panel).

## [1.5.4] — 2026-07-01

### Fixed
- **Side panel pull leaving 0 cookies** — pull no longer aborts after `clearAllBrowserCookies` when localStorage sync fails (wrong active tab, multi-account storage key, or no open site tab). Cookies are applied first; localStorage is best-effort on a matching domain tab.
- **Partial pull failures** — third-party or blocked cookies (e.g. analytics on `.hm.baidu.com`) are skipped with a warning instead of failing the entire pull.
- **Pull error toasts** — show the actual error message instead of the generic “pull fail, please try again”.
- **Side panel pull URL** — use saved `sourceUrl` from domain config when pulling, not just `protocol//host`.

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
