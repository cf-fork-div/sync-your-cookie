# Cloudflare 部署指南

## 是什么

将 **Web 管理端**与 **Cookie 同步 API** 部署到 Cloudflare Worker。连接 Git 后 push 即自动构建部署；Worker 元数据（含 datasource 配置）存在 **SYNC_KV** 命名空间，Cookie 数据存在 Connect 表单指定的 KV 命名空间。

**扩展 v1.7.x** 仅支持 **Worker URL + 访问密码**，不再在选项页填写 Cloudflare Account ID / Namespace / Token。KV 凭据在 Web 管理端 **Connect 表单**配置一次即可。

> 使用场景、Push/Pull、切换并拉取等说明见 [how-to-use.md](../how-to-use.md)。

## 前置条件

- [ ] Cloudflare 账号，Git 仓库已授权
- [ ] Node.js **20+**
- [ ] 对本仓库有 push 权限（或 fork 后连接 fork）

## 部署 checklist

### 1. 创建 Worker（Git 连接）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
2. **Worker name** = `sync-your-cookie`（须与 `deploy/cloudflare/wrangler.toml` 中 `name` 一致）
3. Node.js 版本选 **20**

### 2. 创建 KV 命名空间

**Workers & Pages → KV** → 创建 `sync-your-cookie` → 复制 **Namespace ID**

### 3. Build 变量（Settings → Build → Build variables and secrets）

| 变量 | 类型 | 说明 |
|------|------|------|
| `SYNC_KV_NAMESPACE_ID` | Variable | 上一步 Namespace ID（固定绑定，redeploy 不换绑） |
| `WEB_ACCESS_PASSWORD` | Secret | Web / 扩展登录密码（Deploy 时由 prepare-wrangler 推送到 Worker） |

可选 Build Variable：

| 变量 | 说明 |
|------|------|
| `WEB_BASE_PATH` | 自定义 URL 路径段，如 `my-vault` → 访问 `/my-vault/` |
| `DEPLOY_SEED_DATASOURCE=1` | 首次 Deploy 自动将 KV 凭据写入 SYNC_KV（免手动 Connect）；已有配置时用 `force` 覆盖 |

`CLOUDFLARE_API_TOKEN` 由 Cloudflare Builds **自动注入**，无需手动添加。

### 4. Build / Deploy 命令

| 项 | 值 |
|----|-----|
| Root directory | `/` |
| Build command | `pnpm install && pnpm build:cloudflare-worker` |
| Deploy command | `node deploy/cloudflare/prepare-wrangler.mjs && npx wrangler deploy --config deploy/cloudflare/wrangler.toml` |

### 5. 保存并部署

**Save and Deploy** 或向连接分支 push，等待 Build + Deploy 完成。

## 密码：Build Secret vs Production Secret

| 位置 | 何时生效 | 说明 |
|------|----------|------|
| **Build → Secrets** `WEB_ACCESS_PASSWORD` | 每次 Deploy | `prepare-wrangler.mjs` 自动执行 `wrangler secret put` |
| **Worker → Variables and Secrets → Production** | **立即** | 改密码无需 rebuild / redeploy |

日常改密码：在 **Production** 修改即可。首次部署或 CI 未注入密码时，在 Build Secrets 添加并 redeploy。

## 自定义域名（可选）

1. Worker → **Settings → Domains & Routes** → **Add Custom Domain**
2. 例如 `sync-your-cookie.onlydev.ccwu.cc`
3. 扩展 **服务器 URL** 填 `https://sync-your-cookie.onlydev.ccwu.cc`（无尾斜杠）
4. 若设置了 `WEB_BASE_PATH`，URL 需带前缀，如 `https://…/my-vault`

`workers.dev` 子域与自定义域名可并存；扩展填实际使用的地址即可。

## 部署后

### Web 管理端

- [ ] 打开 Worker URL（或自定义域名），输入 `WEB_ACCESS_PASSWORD` 登录
- [ ] **Connect 表单**：填写 **Account ID**、**Namespace ID**、**API Token**（需 Workers KV Storage:Edit 权限），保存
- [ ] 若 Build 时设置了 `DEPLOY_SEED_DATASOURCE=1` 且 Deploy 成功，Connect 通常已自动配置

Connect 中的 KV 为 **Cookie 存储**；`SYNC_KV` 存 datasource 配置等 Worker 元数据（可与 Cookie KV 为同一 Namespace）。

### 扩展（v1.7.x）

弹窗或侧边栏填写 **服务器 URL**（Worker 根地址，无尾斜杠）与 **访问密码**（同上）。登录后即可 Push / Pull / **切换并拉取**。详见 [how-to-use.md](../how-to-use.md#使用场景与推荐配置)。

## 后续更新

向 Git 连接分支 **push 即自动 redeploy**；`SYNC_KV_NAMESPACE_ID` 不变时 KV 数据保留。

## 常见问题

**无法登录 / 「未配置访问密码」？**
- 确认 Build Secrets 或 Production 中已设置 `WEB_ACCESS_PASSWORD`
- 若 Build 未注入：添加 Build Secret 后 redeploy，或直接在 Production 设置

**redeploy 后 Connect 表单要重填？**
- Build variables **固定 `SYNC_KV_NAMESPACE_ID`**
- Deploy 命令须含 `prepare-wrangler.mjs`
- 或设置 `DEPLOY_SEED_DATASOURCE=1` 自动恢复

**Push/Pull「验证失败」/`verify_failed`？**（v1.6.1+ 会显示 HTTP 状态与响应体）

| 原因 | 处理 |
|------|------|
| Worker 版本过旧 | push 触发 redeploy 到 v1.6.0+ |
| 密码不匹配 | Production 确认密码；扩展重新保存 |
| URL 错误 | 填根地址，不带 `/api`；有 `WEB_BASE_PATH` 则带前缀 |
| `datasource_not_configured` | Web 管理端 Connect 表单保存 KV 凭据，或 `DEPLOY_SEED_DATASOURCE=1` |
| `network_error` | 检查 URL、域名 DNS、Worker 是否在线 |

**Pull 失败 / 部分 Cookie 未写入？**
- Toast 会显示 `name@domain: reason`（v1.5.5+）
- 第三方 Cookie 可能被浏览器策略跳过，属正常

**「切换并拉取」失败？**（v1.7.1 修复同站多账号 URL 解析）
- 确认扩展 ≥ v1.7.1
- 先手动 Pull 验证连接；仍失败则检查 datasource 与密码

**本地调试 Worker？**

```bash
pnpm build:cloudflare-worker
cd deploy/cloudflare && npx wrangler dev
```
