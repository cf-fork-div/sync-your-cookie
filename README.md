<div align="center">
<img src="chrome-extension/public/icon-128.png" alt="logo"/>
<h1>Sync Your Cookie</h1>
<p>将浏览器 Cookie 与 LocalStorage 同步到 Cloudflare KV — 跨设备、跨浏览器共享登录态。</p>

![](https://img.shields.io/badge/version-1.6.0-blue)

</div>

[English](./README_EN.md) | [中文](./README.md)

**Sync Your Cookie** 是一款 Chromium 扩展（Chrome、Edge 及兼容浏览器），可将 Cookie 与 LocalStorage 同步到 **Cloudflare KV**。在不同设备间共享登录会话、为同一站点管理多个账号，并可选择部署 **Cloudflare Worker** 后端与密码保护的 Web 管理端。

> **说明：** 已移除 GitHub Gist 同步，**仅支持 Cloudflare Worker**（URL + 密码）后端。

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
- **Worker 连接：** 服务器 URL + 访问密码 → `/api/sync/*`
- **Pull 镜像远程** — 先应用远程 Cookie，再移除多余项；完整还原 hostOnly/第三方 Cookie（v1.5.3–1.5.5）
- **Push 采集一致** — Push 与 Cookie 编辑器共用采集逻辑，不遗漏 hostOnly Cookie（v1.5.2）
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
- **弹窗 Cookie 查看/编辑** — 增删改、复制值/JSON/Cookie 头、一键清空与刷新（v1.5.6–1.5.7）
- **侧边栏管理器** — 完整 Cookie 与 LocalStorage 详情
- **Web 管理端** — 可选 Worker 部署；界面与侧边栏对齐（搜索、文件夹/类型筛选）
- **多账户配置（Account Profiles）** — 每套配置独立凭据与域名规则
- **国际化** — 英文与简体中文（`en`、`zh_CN`）
- **版本显示** — 弹窗底部与 Options 页显示 `v1.6.0`

#### 安全

- 凭据与加密密码仅存于本地（不同步至 Chrome Sync）；详见 [docs/SECURITY.md](./docs/SECURITY.md)

#### Cloudflare Worker 后端

Git 连接 Cloudflare 部署 Worker（Web 管理端 + 同步 API），扩展用 Worker URL + 密码登录。部署见 [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md)。

### 截图

设置 — 同步服务器 URL 与访问密码

<img width="600" src="./screenshots/settings.png" alt="设置页"/>

弹窗 — 当前站点 Push/Pull 同步

<img width="600" src="./screenshots/popup.png" alt="弹窗同步"/>

弹窗 — Cookie 列表、编辑与复制（Cookie 头 / JSON）

<img width="600" src="./screenshots/popup-cookie-editor.png" alt="弹窗 Cookie 编辑"/>

侧边栏 — 站点列表与文件夹/类型筛选

<img width="600" src="./screenshots/sidepanel-manager.png" alt="侧边栏管理器"/>

### 安装配置

1. 从商店安装扩展，或 `pnpm build` 后加载 `dist/`。
2. 按 [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) 连接 Git 部署 Worker，设置 `WEB_ACCESS_PASSWORD`。
3. 扩展弹窗用 Worker URL + 密码登录 — 见 [how-to-use.md](./how-to-use.md)。

#### 从源码构建

```bash
pnpm install
pnpm dev          # 开发模式（HMR）
pnpm build        # 生产构建 → dist/
pnpm release:zip  # 商店用 zip → dist/release/
```

### 使用指引

1. **登录** — Worker URL + 密码。
2. **Push** — 上传当前标签页 Cookie（与远程不一致时弹出冲突对话框）。
3. **Pull** — 下载远程 Cookie；先应用远程数据，再移除多余项（镜像同步）。
4. **打开管理器** — 侧边栏查看完整 Cookie/LocalStorage。
5. **Web 管理端**（可选） — 浏览器打开 Worker URL，界面与侧边栏一致。

使用说明：[how-to-use.md](./how-to-use.md) · Worker 部署：[deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) · 商店发布：[STORE_PUBLISH.md](./STORE_PUBLISH.md)

### 更新日志

| 版本 | 要点 |
|------|------|
| **1.6.0** | 安全加固：消息校验、hostname 匹配、本地凭据、Worker 限流/会话/CORS、加密默认 |
| **1.5.8** | Popup「切换并拉取」多账号一键拉取 |
| **1.5.6** | 弹窗 Cookie 编辑器：增删改、复制值/JSON |
| **1.5.5** | Pull 部分失败不丢 Cookie；sameSite 修复 |
| **1.5.4** | 侧边栏 Pull 不再归零；跳过失败 Cookie 并提示 |
| **1.5.3** | Pull 完整还原 hostOnly/第三方 Cookie |
| **1.5.2** | Push 采集与编辑器对齐，不遗漏 hostOnly Cookie |
| **1.5.1** | Push 对话框支持文件夹/类型；entry meta UI 统一 |
| **1.5.0** | Worker 同步后端、Bitwarden 风格登录、同域名多账号、Push 冲突、Pull 镜像、弹窗 Cookie 编辑、Web 管理端对齐 |

完整记录：[CHANGELOG.md](./CHANGELOG.md)

### 隐私政策

详见 [隐私政策](./private-policy.md)。
