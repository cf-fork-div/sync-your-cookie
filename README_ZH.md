<div align="center">
<img src="chrome-extension/public/icon-128.png" alt="logo"/>
<h1>Sync Your Cookie</h1>
<p>将浏览器 Cookie 与 LocalStorage 同步到 Cloudflare KV — 跨设备、跨浏览器共享登录态。</p>

![](https://img.shields.io/badge/version-1.5.1-blue)

</div>

[English](./README.md) | [中文](./README_ZH.md)

**Sync Your Cookie** 是一款 Chromium 扩展（Chrome、Edge 及兼容浏览器），可将 Cookie 与 LocalStorage 同步到 **Cloudflare KV**。在不同设备间共享登录会话、为同一站点管理多个账号，并可选择部署 **Cloudflare Worker** 后端与密码保护的 Web 管理端。

> **说明：** 已移除 GitHub Gist 同步，**仅支持 Cloudflare KV**（直连 API 或 Worker 代理）。

### 安装

| 商店 | 链接 |
|------|------|
| Chrome | [Sync Your Cookie](https://chromewebstore.google.com/detail/sync-your-cookie/bcegpckmgklcpcapnbigfdadedcneopf) |
| Edge | [Sync Your Cookie](https://microsoftedge.microsoft.com/addons/detail/sync-your-cookie/ohlcghldllgnmkegocpcphdbbphikgfm) |

从源码构建：见 [安装配置](#安装配置) 与 [商店发布说明](./STORE_PUBLISH.md)。

### 功能

#### 同步与存储
- 同步 **Cookie** 与 **LocalStorage** 到 Cloudflare KV（protobuf 编码）
- **跨浏览器同步** — 同一后端可在 Chrome、Edge 等 Chromium 浏览器间使用
- **两种连接方式：**
  - **Worker 模式（推荐）：** 服务器 URL + 访问密码 → Worker `/api/sync/*`
  - **直连 KV 模式：** Account ID + Namespace ID + API Token → Cloudflare REST API
- **Pull 镜像远程** — 应用远程数据前先清除该域名下的本地 Cookie
- 按站点配置 **Auto Push** 与 **Auto Pull**

#### 多账号与元数据
- **同域名多账号** — 同一 host 下多条记录，各自带标签
- **文件夹与类型** — Bitwarden 风格文件夹；类型：login / session / other
- **`entryMetaMap` 同步** — 标签、文件夹、类型随 Cookie 数据一并同步
- **首次 Push** 需填写账号备注（无远程记录时）
- **Push 冲突对话框** — 覆盖已有条目或另存为新账号

#### 界面与管理
- **Bitwarden 风格登录** — 弹窗/侧边栏输入配置名、服务器 URL、密码
- **操作前自动刷新** — Push、Pull、打开管理器前先验证服务器连接
- **弹窗 Cookie 查看/编辑** — 查看、编辑、删除或一键清空当前标签页 Cookie
- **侧边栏管理器** — 完整 Cookie 与 LocalStorage 详情
- **Web 管理端** — 可选 Worker 部署；界面与侧边栏对齐（搜索、文件夹/类型筛选）
- **多账户配置（Account Profiles）** — 每套配置独立凭据与域名规则
- **国际化** — 英文与简体中文（`en`、`zh_CN`）
- **版本显示** — 弹窗底部与 Options 页显示 `v1.5.1`

#### 可选 Cloudflare Worker 后端
- 一键部署：`pnpm deploy:cloudflare`
- 单个 Worker 提供静态 Web Viewer + 同步 API
- 登录密码（`WEB_ACCESS_PASSWORD`）可在 Dashboard 运行时修改，无需重新构建

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

### 安装配置

#### 仅扩展（直连 KV）

1. 从商店安装，或 `pnpm build` 后加载 `dist/`。
2. 在 Cloudflare 创建 KV 命名空间与 API Token — 见 [how-to-use.md](./how-to-use.md)。
3. 打开 **Options** → 填入 **Account ID / Namespace ID / API Token** → 保存。

无需部署 Worker。

#### 扩展 + Worker（推荐）

1. 部署 Worker：

```bash
cp deploy/cloudflare/.env.example deploy/cloudflare/.env
# 在 .env 中设置 CLOUDFLARE_API_TOKEN（或使用 wrangler login）
pnpm deploy:cloudflare
```

2. 在 Cloudflare Dashboard 设置 `WEB_ACCESS_PASSWORD`（见 [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md)）。
3. 在扩展弹窗用 **服务器 URL**（Worker 地址）与 **访问密码** 登录。

#### 从源码构建

```bash
pnpm install
pnpm dev          # 开发模式（HMR）
pnpm build        # 生产构建 → dist/
pnpm release:zip  # 商店用 zip → dist/release/
```

### 使用指引

1. **登录** — Worker URL + 密码，或在 Options 配置 KV 凭据。
2. **Push** — 上传当前标签页 Cookie（与远程不一致时弹出冲突对话框）。
3. **Pull** — 下载远程 Cookie；会先清除该 host 本地 Cookie（镜像同步）。
4. **打开管理器** — 侧边栏查看完整 Cookie/LocalStorage。
5. **Web 管理端**（可选） — 浏览器打开 Worker URL，界面与侧边栏一致。

详细 KV 配置：[how-to-use.md](./how-to-use.md)  
Worker 部署：[deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md)  
商店发布：[STORE_PUBLISH.md](./STORE_PUBLISH.md)

### 更新日志

| 版本 | 要点 |
|------|------|
| **1.5.1** | Push 对话框支持文件夹/类型；entry meta UI 统一 |
| **1.5.0** | Worker 同步后端、Bitwarden 风格登录、同域名多账号、Push 冲突、Pull 镜像、弹窗 Cookie 编辑、Web 管理端对齐 |

完整记录：[CHANGELOG.md](./CHANGELOG.md)

### Privacy Policy

Please refer to [Privacy Policy](./private-policy.md) for more information.

### 赞赏

如果你觉得这个项目对你有帮助，欢迎通过以下方式支持：

- 给项目点个 Star ⭐ — [github.com/jackluson/sync-your-cookie](https://github.com/jackluson/sync-your-cookie)
- [通过 Ko-fi 赞助](https://ko-fi.com/jacklu) 💖
- 通过 微信支付 赞助
  <div>
    <img src="./screenshots/wechat_sponsor.jpg" alt="微信支付" style="width: 150px;">
  </div>
- 分享给更多需要的人 🚀
