# Cloudflare 部署指南

## 是什么

将 **Web 管理端**与 **Cookie 同步 API** 部署到 Cloudflare Worker。连接 Git 后 push 即自动构建部署，数据存在 **SYNC_KV** 命名空间。扩展通过 Worker URL + 密码访问 `/api/sync/*`。

> 登录密码 `WEB_ACCESS_PASSWORD` 在 Dashboard 修改后**立即生效**，无需重新构建。

## 前置条件

1. Cloudflare 账号，Git 仓库已授权
2. Node.js **20** 或更高
3. 对本仓库有 push 权限（或 fork 后连接 fork）

## 部署步骤

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Workers** → **Connect to Git**，选择本仓库。
2. **Worker name** 填 `sync-your-cookie`（须与 `deploy/cloudflare/wrangler.toml` 中 `name` 一致）。
3. **Workers KV** → 创建命名空间 `sync-your-cookie`，复制 **Namespace ID**。
4. **Settings → Build → Build variables and secrets** 添加：
  - Variable `SYNC_KV_NAMESPACE_ID` = 上一步的 Namespace ID
  - Secret `WEB_ACCESS_PASSWORD` = Web / 扩展登录密码
5. 填写 Build / Deploy 命令（见下表），Node.js 版本选 **20**。
6. **Save and Deploy**（或向连接分支 push），等待 Build + Deploy 完成。
7. 浏览器打开 `https://sync-your-cookie.<你的子域>.workers.dev/`，用密码登录。

### Build / Deploy 命令


| 项              | 值                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Root directory | `/`                                                                                                           |
| Build command  | `pnpm install && pnpm build:cloudflare-worker`                                                                |
| Deploy command | `node deploy/cloudflare/prepare-wrangler.mjs && npx wrangler deploy --config deploy/cloudflare/wrangler.toml` |


## 必配变量


| 变量                     | 类型       | 说明                             |
| ---------------------- | -------- | ------------------------------ |
| `SYNC_KV_NAMESPACE_ID` | Variable | KV 命名空间 ID；固定绑定，避免 redeploy 换绑 |
| `WEB_ACCESS_PASSWORD`  | Secret   | Web 管理端与扩展的登录密码                |


可选：`WEB_BASE_PATH`（Variable，自定义 URL 路径段，如 `my-vault`）；`DEPLOY_SEED_DATASOURCE=1`（首次 Deploy 自动写入 Connect 凭据到 KV）。

`CLOUDFLARE_API_TOKEN` 由 Cloudflare Builds **自动注入**，无需手动添加。

## 部署后

### Web 管理端

访问 Worker URL（设了 `WEB_BASE_PATH` 则在路径前加前缀，如 `/my-vault/`），输入 `WEB_ACCESS_PASSWORD` 登录。可在 Connect 表单查看 KV 数据源配置。

### 扩展

弹窗或侧边栏填写 **服务器 URL**（Worker 地址，无尾斜杠）与 **访问密码**（同上）。登录后即可 Push / Pull。详见 [how-to-use.md](../how-to-use.md)。

> **v1.7.0 起**：扩展不再支持在选项页填写 Cloudflare Account ID / Namespace / API Token 直连 KV。请部署 Worker 后仅使用 **服务器 URL + 访问密码**；KV 凭据仅在 Web 管理端 Connect 表单配置一次。

## 常见问题

**无法登录 / 提示「未配置访问密码」？**  
确认 Build secrets 已添加 `WEB_ACCESS_PASSWORD`，保存后重新 Deploy 一次。

**redeploy 后 Connect 表单要重填？**  
在 Build variables **固定 `SYNC_KV_NAMESPACE_ID`**；Deploy 命令须含 `prepare-wrangler.mjs`。

**改密码要重新部署吗？**  
不用。Dashboard → **Settings → Variables and Secrets → Production** 修改 `WEB_ACCESS_PASSWORD` 即可。

**后续如何更新？**  
向 Git 连接分支 push 即自动 redeploy；KV 数据在 Namespace ID 不变时保留。

**Push/Pull 提示「验证失败」或 `verify_failed`？**  
1.6.0 起扩展会在验证失败时显示 HTTP 状态码与服务器返回内容。常见原因：
- **Worker 未 redeploy 到 v1.6.0+**：扩展已升级但 Worker 仍是旧版，或 `/api/sync/status` 路由缺失。向 Git 连接分支 push 触发 redeploy，或手动执行 Deploy command。
- **访问密码不匹配**：Dashboard → **Settings → Variables and Secrets → Production** 确认 `WEB_ACCESS_PASSWORD` 与扩展中填写的一致；修改后无需 rebuild，但需在扩展选项页重新保存密码。
- **服务器 URL 错误**：填 Worker 根地址（如 `https://sync-your-cookie.<子域>.workers.dev`），不要带 `/api` 或 `/api/session` 后缀；若设置了 `WEB_BASE_PATH`，可填带前缀的 URL（如 `https://…/my-vault`）。
- **数据源未配置**：登录 Web 管理端，在 Connect 表单保存 KV 凭据。
- **CORS 通常不是问题**：扩展 origin（`chrome-extension://`）在 v1.6.0 Worker 中已允许；若 toast 显示 `network_error` 或 `Failed to fetch`，再检查 URL 与 Worker 是否在线。

**本地调试 Worker？**  
先 `pnpm build:cloudflare-worker`，再 `cd deploy/cloudflare && npx wrangler dev`。