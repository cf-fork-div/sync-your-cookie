# Security

This document summarizes security measures in **Sync Your Cookie** and how to report vulnerabilities.

## Overview

Sync Your Cookie stores session cookies and optional localStorage in Cloudflare KV (direct API or Worker proxy). Treat access passwords, encryption passwords, and Cloudflare API tokens as secrets.

## Security model (v1.6.0+)

### Extension

| Area | Mitigation |
|------|------------|
| Content script messaging | No `window.$messageListener` exposure; only `chrome.runtime.onMessage` with `sender.id === chrome.runtime.id` |
| Background messaging | Same sender validation on all cookie/localStorage handlers |
| Domain match (localStorage) | Strict hostname match (`hostnameMatchesPage`), not `location.origin.includes()` |
| Credentials storage | `authPassword` and `encryptionPassword` stored in `chrome.storage.local`, not sync; migrated automatically from legacy sync data |
| Storage keys | Extension read/write only keys listed in profile `storageKeyList` |
| Content script scope | `<all_urls>` retained for broad site compatibility; optional host permissions deferred |
| Logging | Sensitive paths use `devLog` (stripped in production builds) |

### Cloudflare Worker

| Area | Mitigation |
|------|------------|
| Login | KV rate limit: 5 failed attempts per IP per 15 minutes |
| Web sessions | Random session IDs stored in `SYNC_KV` (7-day TTL); legacy HMAC cookies accepted during transition |
| Sync API CORS | Allows `chrome-extension://` / `moz-extension://` and same-origin only (no arbitrary Origin echo) |
| `/cf-api/*` | Whitelist: KV value GET/PUT only, scoped to configured account/namespace |
| `/api/sync/kv` | Storage key allowlist: default key + optional `allowedStorageKeys` in datasource config |
| Auth | Bearer password (extension) or HttpOnly session cookie (web admin) |

### Encryption defaults

- **New profiles:** `encryptionEnabled` defaults to `true` (requires password before encrypted writes).
- **Existing users:** unchanged; Options shows a warning when Protobuf is on but encryption is off.

### Legacy direct Cloudflare mode

Deprecated but supported: Account ID / Namespace ID / API Token profiles remain readable until cleared. Prefer Worker URL + password for new setups.

### Extension vs web credentials

Extension sync and Web Viewer currently share the same access password. Session cookies are server-side random IDs (not deterministic HMAC-only). Scoped extension tokens are planned; not yet implemented to avoid breaking existing deployments.

## Session migration (Worker deploy)

After upgrading to v1.6.0:

1. Existing **legacy HMAC session cookies** continue to work until they expire (max 7 days).
2. New logins receive random session IDs stored in KV.
3. Logout revokes KV session entries.
4. To force re-login for all users, redeploy and optionally purge `__syc_session__:*` keys in `SYNC_KV`.

## Reporting vulnerabilities

If you discover a security issue:

1. **Do not** open a public GitHub issue for exploitable vulnerabilities.
2. Email the maintainer via [GitHub profile contact](https://github.com/jackluson) or repository security advisories if enabled.
3. Include: affected version, reproduction steps, impact assessment, and suggested fix if any.

We aim to acknowledge reports within 7 days and release fixes for confirmed issues as patch releases.

## Dependency audits

Run periodically:

```bash
pnpm audit
pnpm update protobufjs
```

Report protobufjs and other CVEs via the process above if patches are unavailable.

## Audit history

| Date | Version | Notes |
|------|---------|-------|
| 2026-07-01 | 1.6.0 | Full audit remediation: messaging, hostname match, local credential storage, Worker rate limit/sessions/CORS/cf-api/sync allowlist, encryption defaults |

See [CHANGELOG.md](../CHANGELOG.md) for release details.
