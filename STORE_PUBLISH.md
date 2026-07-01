# Browser Extension Store Publishing

This guide covers building a production package and submitting **Sync Your Cookie** to the Chrome Web Store and Microsoft Edge Add-ons.

> **Credentials:** This repository does not contain store API keys. Publishing requires your own developer accounts and secrets (never commit them).

## Prerequisites

- [Chrome Web Store Developer](https://chrome.google.com/webstore/devconsole) account ($5 one-time)
- [Microsoft Partner Center](https://partner.microsoft.com/dashboard) account (free)
- Node.js ≥ 20.12, pnpm 9.x

## 1. Build production package

From the repository root:

```bash
pnpm install
pnpm release:zip
```

This runs a production build and creates:

| Output | Description |
|--------|-------------|
| `dist/` | Unpacked extension (load unpacked for testing) |
| `dist-zip/extension-{version}-{date}-{time}.zip` | Timestamped archive |
| `dist/release/sync-your-cookie-{version}.zip` | **Store-ready** archive (stable name) |
| `dist/release/extension-{version}-chrome.zip` | Same build, upstream-style name for GitHub Releases |
| `dist/release/extension-{version}-edge.zip` | Same build, upstream-style name for GitHub Releases |

Verify locally:

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Confirm version **1.5.1** in extension details and popup/options footer

## 2. Chrome Web Store

**Listing:** [Sync Your Cookie](https://chromewebstore.google.com/detail/sync-your-cookie/bcegpckmgklcpcapnbigfdadedcneopf)

### Manual upload (recommended)

1. Sign in to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Open the existing **Sync Your Cookie** item (or create new)
3. **Package** → **Upload new package**
4. Upload `dist/release/sync-your-cookie-1.5.1.zip`
5. Update **Detailed description** to match [README_EN.md](./README_EN.md) features
6. Set version notes from [CHANGELOG.md](./CHANGELOG.md)
7. Submit for review

### CLI upload (optional)

Install [`chrome-webstore-upload-cli`](https://www.npmjs.com/package/chrome-webstore-upload-cli) and set environment variables (do **not** commit):

```bash
export EXTENSION_ID=bcegpckmgklcpcapnbigfdadedcneopf
export CLIENT_ID=your-oauth-client-id
export CLIENT_SECRET=your-oauth-client-secret
export REFRESH_TOKEN=your-refresh-token

npx chrome-webstore-upload upload \
  --source dist/release/sync-your-cookie-1.5.1.zip

npx chrome-webstore-upload publish --target default
```

Obtain OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → OAuth, linked to your Web Store developer account.

## 3. Microsoft Edge Add-ons

**Listing:** [Sync Your Cookie](https://microsoftedge.microsoft.com/addons/detail/sync-your-cookie/ohlcghldllgnmkegocpcphdbbphikgfm)

Edge accepts the **same ZIP** as Chrome (Manifest V3).

1. Sign in to [Partner Center](https://partner.microsoft.com/dashboard)
2. **Edge** → **Extensions** → open existing listing or **Create new extension**
3. Upload `dist/release/sync-your-cookie-1.5.1.zip`
4. Update store description and release notes from CHANGELOG
5. Submit for certification

No separate Edge build is required unless you add Edge-specific manifest changes.

## 4. Release checklist

- [ ] Version bumped in root `package.json` and `chrome-extension/package.json` (manifest reads root version)
- [ ] `CHANGELOG.md` updated
- [ ] `pnpm release:zip` succeeds
- [ ] Smoke test: login (Server URL + password), push, pull, conflict dialog, side panel manager
- [ ] Privacy policy link valid: [private-policy.md](./private-policy.md)
- [ ] Upload ZIP to Chrome Web Store
- [ ] Upload same ZIP to Edge Add-ons
- [ ] Tag and push to trigger GitHub Release: `git tag v1.5.1 && git push origin v1.5.1`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| ZIP too large | Source maps excluded by default; ensure `dist/` has no dev artifacts |
| Review rejection (permissions) | `<all_urls>` and `cookies` are required for sync; explain in store notes |
| Version mismatch | Manifest version comes from root `package.json` via `chrome-extension/manifest.js` |

## CI artifacts and GitHub Releases

| Workflow | Trigger | Output |
|----------|---------|--------|
| `.github/workflows/build-zip.yml` | Push to `main` / PR | Artifact: unpacked `dist/*` |
| `.github/workflows/release.yml` | Tag push `v*` | [GitHub Release](https://github.com/cf-fork-div/sync-your-cookie/releases) with `sync-your-cookie-{version}.zip` plus `extension-{version}-chrome.zip` / `-edge.zip` (same MV3 build) and SHA256 checksums in release notes |

For store submission, prefer local `pnpm release:zip` smoke test before tagging. Push a version tag matching root `package.json` (e.g. `v1.7.1`) to publish release assets automatically.
