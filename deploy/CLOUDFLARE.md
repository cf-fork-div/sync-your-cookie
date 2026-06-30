# Cloudflare 部署指南

将 **Web Viewer**（`pages/web`）部署到 **Cloudflare Worker**（静态资源 + 运行时 API）。Worker 绑定 **SYNC_KV** 命名空间，用于 `/api/admin/datasource` 与 `/api/sync/*`；扩展仍可通过同一 KV 凭据直连 Cloudflare REST API 或使用 Worker 同步 API。

> **仅使用扩展？** 同步 Cookie 只需安装扩展并在 Options 填入 KV 凭据（见 [how-to-use.md](../how-to-use.md)），**不必**部署 Web Viewer。本文档面向需要浏览器端管理界面的用户。

> **English summary:** Run `pnpm deploy:cloudflare` for one-command deploy (KV + Worker + credentials output). Web password (`WEB_ACCESS_PASSWORD`) is a runtime Dashboard setting — no rebuild needed. Access `https://your-domain/` directly; optionally set `WEB_BASE_PATH` for a hidden path. Alternative: connect this repo to Cloudflare Workers Builds with build `pnpm install && pnpm build:cloudflare-worker` and deploy `node deploy/cloudflare/prepare-wrangler.mjs && npx wrangler deploy --config deploy/cloudflare/wrangler.toml` (see [Git deploy](#git-仓库连接部署可选)).

> **重要**：Web 登录密码与访问路径为 **Cloudflare 运行时配置**，修改后**立即生效**，**无需重新构建或重新部署**。部署命令**不要求**在 `.env` 中设置密码。

## 前置条件

- Node.js ≥ 20.12
- 已安装依赖：`pnpm install`
- Cloudflare 账户

## 方式一：一键部署（推荐）

```bash
# 1. 复制部署配置（可选，用于 Token 与首次路径）
cp deploy/cloudflare/.env.example deploy/cloudflare/.env
# 编辑 .env：至少设置 CLOUDFLARE_API_TOKEN（推荐）

# 2. 授权（二选一）
export CLOUDFLARE_API_TOKEN=你的Token   # 推荐
# 或
pnpm exec wrangler login

# 3. 一键部署（无需预先配置密码）
pnpm deploy:cloudflare
```

部署完成后，终端会输出 **Account ID**、**Namespace ID**、**API Token**（若通过环境变量提供）及 Web Viewer 访问地址。

**首次访问前**，在 Cloudflare Dashboard 设置 `WEB_ACCESS_PASSWORD`（见下方「运行时配置」）。未设置密码时 Web Viewer 无法登录，但不影响扩展 Push/Pull。

将 **Account ID / Namespace ID / API Token** 填入扩展 Options 页面即可使用同步功能。

### 一键部署自动化项

| 项目 | 自动化 |
|------|--------|
| KV 命名空间创建/复用并绑定 Worker（SYNC_KV） | ✅ |
| Worker 静态资源 + API 路由部署 | ✅ |
| Account ID / Namespace ID 输出 | ✅ |
| WEB_ACCESS_PASSWORD | ⚠️ Dashboard 手动设置，或 `DEPLOY_RUNTIME_SECRETS=1` |
| WEB_BASE_PATH | 否（默认根路径 `/`）；可选在 Dashboard 设置自定义路径 |
| 扩展 Options 凭据 | ❌ 需手动粘贴 |

## 方式二：Git 仓库连接部署（可选）

适用于已在 Cloudflare Dashboard 连接 GitHub/GitLab 仓库、希望 push 后自动构建的场景。

### Worker 项目设置

在 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Workers** → **Connect to Git**，选择本仓库后配置：

| 设置项 | 值 |
|--------|-----|
| Build command | `pnpm install && pnpm build:cloudflare-worker` |
| Deploy command | `node deploy/cloudflare/prepare-wrangler.mjs && npx wrangler deploy --config deploy/cloudflare/wrangler.toml` |
| Root directory | `/`（仓库根目录） |
| Node.js version | `20` 或更高 |

Worker 名称须为 **`sync-your-cookie`**（与 `wrangler.toml` 中 `name` 一致，须与 Dashboard 中 Git 连接项目同名）。

`build:cloudflare-worker` 会构建 Web Viewer（`base=/`）到 `dist/web`，由 Worker `[assets]` 绑定提供静态文件；`deploy/cloudflare/src/worker.ts` 处理 `/api/*`、`/cf-api/*` 与路径中间件。

**Deploy 前必须运行 `prepare-wrangler.mjs`**：它会查找或创建 KV 命名空间 `SYNC_YOUR_COOKIE`，将真实 ID 写入 `wrangler.toml` 的 `SYNC_KV` 绑定（仓库内不提交占位 ID）。Cloudflare Builds 会自动注入 `CLOUDFLARE_API_TOKEN`，脚本可自动创建/复用命名空间。

若已在 Dashboard 手动创建 KV，可在 Worker 项目 **Settings → Variables** 设置普通变量 **`SYNC_KV_NAMESPACE_ID`** = 你的 Namespace ID，跳过自动创建。

### Git 部署的限制（与一键部署对比）

| 能力 | 一键 `pnpm deploy:cloudflare` | Git 连接部署 |
|------|------------------------------|--------------|
| 自动创建/复用 KV 并绑定 SYNC_KV | ✅ | ✅（`prepare-wrangler.mjs`） |
| 输出 Account ID / Namespace ID | ✅ | ❌ 需手动查阅 Dashboard |
| 自动推送 WEB_ACCESS_PASSWORD | ⚠️ 可选 | ❌ 需在 Dashboard 设置 Secret |
| WEB_BASE_PATH | 否（默认 `/`） | 否（可选自定义路径） |
| Push 触发自动构建 | ❌ | ✅ |
| 扩展 Push/Pull（直连 KV API 或 Worker `/api/sync`） | ✅ | ✅ |

**Git 部署后仍需手动完成：**

1. 确认 Deploy 命令包含 `prepare-wrangler.mjs`（见上表）
2. 在 Worker 项目 **Settings → Variables and Secrets → Production** 设置：
   - Secret：`WEB_ACCESS_PASSWORD`（必填）
   - Variable：`WEB_BASE_PATH`（可选，自定义 URL 路径段以隐藏入口）
   - Variable（可选）：`SYNC_KV_NAMESPACE_ID` — 若 KV 已手动创建，填入 Namespace ID
3. 记录 **Account ID**、**Namespace ID**（Deploy 日志或 Dashboard → KV），创建具备 **Workers KV Storage:Edit** 权限的 **API Token**
4. 将 Account ID / Namespace ID / API Token 填入扩展 Options（或使用 Worker URL + 访问密码走 `/api/sync`）

## 运行时配置（无需重新构建）

Web Viewer 的**登录密码**由 Worker 在每次请求时从 Cloudflare 环境读取。修改后**立即生效**，无需重新 `pnpm deploy:cloudflare` 或重新触发 Git 构建。

| 变量 | 类型 | 说明 |
|------|------|------|
| `WEB_ACCESS_PASSWORD` | **Encrypted Secret** | Web Viewer 登录密码，**不会**写入前端 JS（必填） |
| `WEB_BASE_PATH` | 普通环境变量（可选） | 自定义 URL 路径段，如 `my-cookie-vault` → `https://xxx.workers.dev/my-cookie-vault/`；**不设置时**直接访问 `https://xxx.workers.dev/` |

### 在 Dashboard 中设置（推荐）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **sync-your-cookie**
2. **Settings** → **Variables and Secrets** → **Production**
3. 添加：
   - **Secret**：`WEB_ACCESS_PASSWORD` = 你的强密码
   - **Variable**（可选）：`WEB_BASE_PATH` = 任意路径段（**不要**以 `/` 开头或结尾），用于隐藏入口
4. 保存后，新请求立即使用新值

### 用 Wrangler CLI 设置（可选）

```bash
cd deploy/cloudflare

# 推送登录密码（Encrypted Secret）
pnpm exec wrangler secret put WEB_ACCESS_PASSWORD

# WEB_BASE_PATH 为普通变量，建议在 Dashboard 修改；
# 仅在需要自定义隐藏路径时设置；默认直接访问根路径 /
```

### 部署时自动推送 Secret（可选，仅一键部署）

在 `deploy/cloudflare/.env` ：

```env
WEB_ACCESS_PASSWORD=your-strong-password
DEPLOY_RUNTIME_SECRETS=1
```

部署脚本会通过 `wrangler secret put WEB_ACCESS_PASSWORD` 推送。之后仍可在 Dashboard 随时修改，**无需重新部署**。

> **注意**：`WEB_ACCESS_PASSWORD` **不是**部署必填项。可以先部署，稍后在 Dashboard 补设密码。

### 修改密码后的行为

- 密码校验在 Worker `POST /api/login` 服务端完成
- 会话为 httpOnly Cookie（HMAC 签名，与当前密码绑定）
- 修改 `WEB_ACCESS_PASSWORD` 后，旧 Cookie 自动失效，用户需重新登录
- **无需重新部署或重新构建**

### 修改访问路径后的行为（可选）

- 默认在根路径 `/` 提供 Web Viewer，仅需密码登录
- 若设置 `WEB_BASE_PATH`，静态资源由 Worker 中间件做路径重写
- 在 Dashboard 修改 `WEB_BASE_PATH` 后刷新即可从新路径访问
- 一键部署时若 `deploy/.env` 设置了 `WEB_BASE_PATH`，会写入 `wrangler.toml` [vars]

## 环境变量

在 `deploy/cloudflare/.env` 或 shell 中设置（**一键部署**使用；Git 部署仅需 Dashboard 运行时变量）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `CLOUDFLARE_API_TOKEN` | 推荐 | API Token，需 **Workers KV Storage:Edit** + **Workers Scripts:Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | 否 | 多账户时可手动指定 |
| `WEB_ACCESS_PASSWORD` | 否 | 运行时登录密码（Secret）；可在部署后于 Dashboard 设置 |
| `WEB_BASE_PATH` | 否 | 可选自定义访问路径；不设置时默认为根路径 `/` |
| `DEPLOY_RUNTIME_SECRETS` | 否 | 设为 `1` 且已设置 `WEB_ACCESS_PASSWORD` 时，一键部署时自动 `wrangler secret put` |
| `SYNC_KV_NAMESPACE_ID` | 否 | Git 部署可选：已有 KV 时跳过自动创建，直接绑定该 Namespace ID |

**请勿**在 `deploy/cloudflare/.env` 中使用旧版 `VITE_WEB_*` 变量。部署脚本会忽略它们，避免密码被打进 JS 包。

### 本地开发（`pnpm dev:web`）

本地仍使用 **VITE_** 前缀变量（见 `pages/web/.env.example` 或 `pages/web/.env.local`）：

| 变量 | 说明 |
|------|------|
| `VITE_WEB_ACCESS_PASSWORD` | 本地密码，未设置时默认 `dev` |
| `VITE_WEB_BASE_PATH` | 本地路径，未设置时默认 `/syc/` |

Vite 开发服务器内置 `/api/login`、`/api/session`、`/api/logout` 模拟（与生产逻辑一致）。

## 架构说明

```
浏览器
  →  /                            静态 Web Viewer（默认，密码登录）
  →  /{WEB_BASE_PATH}/            可选隐藏路径（设置 WEB_BASE_PATH 时）
  →  /api/login|session|logout  Worker 路由（httpOnly Cookie 认证）
  →  /api/admin/datasource     Worker 读写 SYNC_KV（管理员 CF 凭据）
  →  /api/sync/*                Worker 扩展同步 API（SYNC_KV）
  →  /cf-api/*                  Worker 代理 → api.cloudflare.com（需登录，中间件校验 Cookie）

Chrome 扩展  →  api.cloudflare.com  (直连 KV REST API，不经 Worker)
              或 Worker /api/sync/*  (使用服务器 URL + 访问密码)
```

### 认证流程

1. 用户 POST `/api/login` `{ password }`
2. Worker 比对 `env.WEB_ACCESS_PASSWORD`
3. 成功则设置 `syc_session` httpOnly Cookie（Secure + SameSite=Lax）
4. `/cf-api/*` 与受保护 API 由 Worker 中间件校验 Cookie
5. 前端通过 GET `/api/session` 获取 `{ authenticated, basePath }`

### 安全说明

- 生产环境密码**不会**出现在构建后的 JS 中
- 扩展用的 Token / Account ID / Namespace ID **仅**在扩展 Options 配置，不写入 Cloudflare Secrets
- Cookie：httpOnly、SameSite=Lax、生产环境 Secure

## 从旧版 VITE_ 构建时配置迁移

| 旧方式 | 新方式 |
|--------|--------|
| `VITE_WEB_ACCESS_PASSWORD` 写入 deploy/.env 并打入 JS | Dashboard Secret `WEB_ACCESS_PASSWORD` |
| `VITE_WEB_BASE_PATH` 构建时固定 base | 运行时 `WEB_BASE_PATH` + Worker 中间件重写 |
| 改密码/路径需重新 deploy | Dashboard 修改后立即生效 |

迁移步骤：

1. 重新 `pnpm deploy:cloudflare`（新构建不含密码）
2. 在 Dashboard 设置 `WEB_ACCESS_PASSWORD`（可选 `WEB_BASE_PATH` 隐藏路径）
3. 从 `deploy/cloudflare/.env` 删除 `VITE_WEB_*`（本地 dev 可保留在 `pages/web/.env.local`）

## 命令

```bash
# 完整一键部署（KV + Worker + 凭据输出）
pnpm deploy:cloudflare

# 构建 Web 静态资源（Git Worker CI 用）
pnpm build:cloudflare-worker

# Git 部署前：解析/创建 KV 并写入 wrangler.toml（CI Deploy 步骤用）
pnpm prepare:cloudflare-worker

# 仅构建与准备，不创建 KV、不部署 Worker
pnpm deploy:cloudflare -- --dry-run
```

## 文件结构

```
deploy/cloudflare/
  wrangler.toml              # Worker + [assets]；SYNC_KV 由 prepare/deploy 脚本写入
  deploy.mjs                 # 一键部署脚本
  prepare-wrangler.mjs       # Git CI：KV 解析 + wrangler.toml 绑定
  build-worker.mjs           # Git Worker 构建脚本
  src/
    worker.ts                # Worker 入口（路由 + 静态资源）
    middleware.ts            # 路径重写 + Cookie 鉴权
    handlers/                # /api/*、/cf-api/*
    lib/                     # 共享 env / session 工具
  .env.example
  .deploy-state.json         # 本地 KV ID（gitignore）
```

## 常见问题

**Q: 部署时必须在 .env 里设密码吗？**  
不需要。可以先部署，再在 Dashboard 设置 `WEB_ACCESS_PASSWORD`。

**Q: 部署后无法登录？**  
确认 Dashboard Production 环境已设置 `WEB_ACCESS_PASSWORD` Secret。

**Q: 修改密码后旧会话还能用吗？**  
不能。Cookie 与密码 HMAC 绑定，改密码后需重新登录。

**Q: 如何更换访问路径？**  
默认在根路径 `/` 访问。若需隐藏入口，在 Dashboard 设置 `WEB_BASE_PATH`，无需重新部署。

**Q: deploy/.env 里还有 VITE_WEB_ACCESS_PASSWORD 会怎样？**  
部署脚本会忽略该变量，不会将其打入 JS，并提示迁移到 `WEB_ACCESS_PASSWORD`。

**Q: Git 连接部署和一键部署选哪个？**  
需要本地一键完成构建 + KV + 部署 + 凭据输出 → 用 `pnpm deploy:cloudflare`。需要 push 自动发布 Web Viewer → 用 Git 连接 Worker，Deploy 命令须包含 `prepare-wrangler.mjs`。

**Q: Git CI 报 Worker name mismatch 或 KV 0000… not found？**  
确认 Dashboard 项目名为 `sync-your-cookie`，Deploy 命令为 `node deploy/cloudflare/prepare-wrangler.mjs && npx wrangler deploy ...`（不要单独 `wrangler deploy`）。

**Q: 部署后 Web Viewer 无法读写 KV？**  
确认已登录（Cookie 有效），且 Worker `/cf-api` 路由已部署。

**Q: Token 权限不足？**  
确保 Token 包含 Workers KV Storage:Edit；扩展 Options 中「验证」可测试。

**Q: 再次一键部署会重复创建 KV 吗？**  
不会。脚本读取 `.deploy-state.json` 或按名称查找已有命名空间。

**Q: 以前用 Cloudflare Pages 部署怎么办？**  
项目已迁移至 Worker。运行 `pnpm deploy:cloudflare` 或按上文 Git Worker 配置重新部署；访问地址为 `https://sync-your-cookie.<account>.workers.dev/`（或自定义域名根路径），需在 Worker 项目设置 `WEB_ACCESS_PASSWORD`。扩展 Options 中的 KV 凭据不变。
