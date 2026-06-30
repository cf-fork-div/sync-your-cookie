<div align="center">
<img src="chrome-extension/public/icon-128.png" alt="logo"/>
<h1> Sync your cookie to Cloudflare KV</h1>
</div>

[English](./README.md) | [中文](./README_ZH.md)

`Sync your cookie` 是一个 Chrome 扩展程序，它可以帮助您将 Cookie 同步到 **Cloudflare KV**。它是一个有用的工具，用于在不同设备之间共享 Cookie，免去了登录流程的烦恼，此外也提供了 Cookie 管理面板查看、管理已经同步的 Cookie。

### 安装

Chrome: [Sync Your Cookie](https://chromewebstore.google.com/detail/sync-your-cookie/bcegpckmgklcpcapnbigfdadedcneopf)

Edge: [Sync Your Cookie](https://microsoftedge.microsoft.com/addons/detail/sync-your-cookie/ohlcghldllgnmkegocpcphdbbphikgfm)

### 功能

- 支持同步 Cookie 到 **Cloudflare KV**（支持 LocalStorage）
- 支持为不同站点配置 `Auto Merge` 和 `Auto Push` 规则
- Cookie 数据经过 protobuf 编码传输
- 提供管理面板，方便查看、复制、管理已同步的 Cookie 数据
- **多账户配置（Account Profiles）** — 每个配置独立保存 Cloudflare 凭据与域名规则，可快速切换
- **国际化（i18n）** — 扩展 UI 与 Web Viewer 支持英文（`en`）与简体中文（`zh_CN`）
- **Web Viewer** — 可选的浏览器端查看器，可部署到 Cloudflare Worker（见下方）

> **说明：** 已移除 GitHub Gist 同步，**仅支持 Cloudflare KV**。

### 项目截图

账号设置页面

<img width="600" src="./screenshots/settings_v2.png" alt="account settings"/>

Cookie 同步页面

<img width="600" src="./screenshots/sync.png" alt="cookie sync popup"/>

Cookie 管理侧边栏面板

<img width="600" src="./screenshots/panel.png" alt="cookie manager sidebar panel"/>

Cookie 详情

<img width="600" src="./screenshots/panel_item.png" alt="cookie manager sidebar panel"/>

LocalStorage 详情

<img width="600" src="./screenshots/panel_item_localStorage.png" alt="cookie manager sidebar panel"/>

Cloudflare 上传的 Cookie

<img width="600" src="./screenshots/key_value.png" alt="Pushed Cookie on Cloudflare"/>

### 使用指引

[How to use](./how-to-use.md)

### 仅使用扩展（无需部署 Web）

同步 Cookie **只需安装浏览器扩展**，不必部署 Web Viewer。在 Cloudflare 创建 KV 命名空间与 API Token（见 [how-to-use](./how-to-use.md)），将 **Account ID / Namespace ID / API Token** 填入扩展 Options 即可。下方 Web Viewer 为可选，用于在浏览器中管理 Cookie。

### Cloudflare Web Viewer（可选）

将 Web 查看器部署到 **Cloudflare Worker**（静态资源 + API）。一条命令还会自动创建 KV 命名空间并输出扩展凭据：

```bash
cp deploy/cloudflare/.env.example deploy/cloudflare/.env
# 在 .env 中设置 CLOUDFLARE_API_TOKEN（或使用 wrangler login）
pnpm deploy:cloudflare
```

部署后在 Cloudflare Dashboard 设置 `WEB_ACCESS_PASSWORD`，修改后立即生效，无需重新构建。直接访问 `https://你的域名/` 即可；可选设置 `WEB_BASE_PATH` 使用隐藏路径。完整说明：[deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md)。

**Git CI（可选）：** 在 Cloudflare Workers 中连接本仓库。构建：`pnpm install && pnpm build:cloudflare-worker`。部署：`npx wrangler deploy --config deploy/cloudflare/wrangler.toml`。限制见 [Git 部署说明](./deploy/CLOUDFLARE.md#git-仓库连接部署可选)。

### Privacy Policy

Please refer to [Privacy Policy](./private-policy.md) for more information.

### 赞赏

如果你觉得这个项目对你有帮助，欢迎通过以下方式支持我：

- 给项目点个 Star ⭐
- [通过 Ko-fi 赞助](https://ko-fi.com/jacklu) 💖
- 通过 微信支付 赞助
  <div>
    <img src="./screenshots/wechat_sponsor.jpg" alt="微信支付" style="width: 150px;">
  </div>
- 分享给更多需要的人 🚀
