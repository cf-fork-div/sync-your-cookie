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

### 一次性配置（避免每次 redeploy 重填）

复制 `deploy/cloudflare/.env.example` → `.env`，首次部署前填入：

```env
CLOUDFLARE_API_TOKEN=your-api-token
WEB_ACCESS_PASSWORD=your-strong-password
DEPLOY_RUNTIME_SECRETS=1
DEPLOY_SEED_DATASOURCE=1
# 可选：若已有 KV，固定绑定（推荐 Git CI 也在 Dashboard 设同名变量）
# SYNC_KV_NAMESPACE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

之后 `pnpm deploy:cloudflare` 会：复用同名 KV `sync-your-cookie`（或旧名 `SYNC_YOUR_COOKIE`）、推送登录密码 Secret、将 ConnectForm 凭据写入 SYNC_KV。**redeploy 不会清除** Dashboard Secret 或 KV 内已存配置，只要 namespace 绑定不变。

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

**Deploy 前必须运行 `prepare-wrangler.mjs`**：它会按名称 **`sync-your-cookie`**（或旧名 **`SYNC_YOUR_COOKIE`**）通过 Cloudflare REST API 查找并复用已有 KV 命名空间，将真实 ID 写入 `wrangler.toml` 的 `SYNC_KV` 绑定。Cloudflare Builds 会自动注入 `CLOUDFLARE_API_TOKEN`，脚本可查找已有命名空间；**不会**解析 wrangler CLI 的人类可读输出。

**强烈建议**在 **Settings → Build → Build variables and secrets** 设置 **`SYNC_KV_NAMESPACE_ID`** = 你的 Namespace ID（Deploy 步骤中 `prepare-wrangler.mjs` 读取；**不是**运行时 Worker 环境变量）。设置后脚本**跳过查找与创建**，直接绑定该 ID。这样每次 Git 构建都会绑定**同一个** KV，Worker 内保存的 datasource 配置（`__syc_datasource_config__`）不会因 redeploy 而“丢失”。

> **Build 变量 vs 运行时变量**：Cloudflare 有两套独立配置，勿混淆（见下方 [Git 部署：变量应设在哪里](#git-部署变量应设在哪里)）。

若已在 Dashboard 手动创建 KV（例如名为 `sync-your-cookie`），填入 **`SYNC_KV_NAMESPACE_ID`** 可跳过自动创建并固定绑定。Git CI 默认**不会**自动创建 KV；如需创建，设置 `DEPLOY_ALLOW_KV_CREATE=1`。

### Git 部署：变量应设在哪里

Cloudflare Workers Builds 有 **两套** 环境变量，互不相通：

| 用途 | Dashboard 路径 | 何时可用 | 示例 |
|------|----------------|----------|------|
| **构建 / Deploy 脚本** | **Settings → Build → Build variables and secrets** | `pnpm build:cloudflare-worker`、`prepare-wrangler.mjs`、`wrangler deploy` 执行期间 | `SYNC_KV_NAMESPACE_ID`、`WEB_ACCESS_PASSWORD`（由脚本 `wrangler secret put` 推送）、`DEPLOY_SEED_DATASOURCE` |
| **Worker 运行时** | **Settings → Variables and Secrets → Production** | 用户访问站点、`/api/login` 等请求处理时 | `WEB_ACCESS_PASSWORD`、`WEB_BASE_PATH` |

`CLOUDFLARE_API_TOKEN` 由 Builds **自动注入**到 Deploy 步骤，无需手动添加。

**常见踩坑**：只在 **Build variables** 里设了 `WEB_ACCESS_PASSWORD`，Dashboard 的 **Variables and Secrets** 仍显示为空——这是正常的；密码需由 `prepare-wrangler.mjs` 在 Deploy 时 `wrangler secret put` 写入（本仓库已支持），或直接在 **Variables and Secrets → Production** 手动添加 Secret。

**为何 redeploy 后 Variables 变空？** 默认情况下 `wrangler deploy` 以 `wrangler.toml` 为唯一来源，会**删除**未写在配置文件里的 Dashboard 普通变量。本仓库已在 `wrangler.toml` 设置 **`keep_vars = true`**，保留你在 Dashboard 设置的运行时变量。若仍变空，检查是否 Worker 名称从旧名（如 `sync-your-cookie-web`）改成了 `sync-your-cookie`——那是**另一个 Worker**，旧 Worker 上的 Secret 不会迁移。

### Git 部署：推荐配置（一次设置，push 不丢）

**方案 A — Build Secret 自动推送（推荐）**

1. **Workers & Pages → sync-your-cookie → Settings → Build → Build variables and secrets**
   - Secret：`WEB_ACCESS_PASSWORD` = 登录密码
   - Variable：`SYNC_KV_NAMESPACE_ID` = KV Namespace ID（从 KV 页面复制）
   - Variable（可选）：`DEPLOY_SEED_DATASOURCE=1`
2. Deploy 命令保持：`node deploy/cloudflare/prepare-wrangler.mjs && npx wrangler deploy --config deploy/cloudflare/wrangler.toml`
3. 每次 push：`prepare-wrangler.mjs` 自动 `wrangler secret put WEB_ACCESS_PASSWORD` 并绑定 KV

**方案 B — 仅 Dashboard 运行时 Secret**

1. **Settings → Variables and Secrets → Production** 添加 Secret `WEB_ACCESS_PASSWORD`
2. **Settings → Build → Build variables and secrets** 添加 Variable `SYNC_KV_NAMESPACE_ID`
3. 依赖 `keep_vars = true`（已写入 `wrangler.toml`）在 redeploy 时保留运行时 Secret/变量

### Git 部署：Dashboard 一次性变量（参考表）

在 **Build variables** 和/或 **Variables and Secrets → Production** 设置后，**后续 push 部署无需再手动配置**：

| 变量 | 类型 | 设在哪里 | 必填 | 说明 |
|------|------|----------|------|------|
| `WEB_ACCESS_PASSWORD` | **Secret** | Build secret（推荐）或 Production Secret | 是 | 登录密码；Build secret 时 prepare 脚本每次 deploy 自动推送 |
| `SYNC_KV_NAMESPACE_ID` | Variable | **Build variables** | **强烈建议** | 固定 SYNC_KV 绑定；prepare 脚本读取，非运行时变量 |
| `DEPLOY_ALLOW_KV_CREATE` | Variable | Build variables | 否 | 设为 `1` 时，未找到命名空间时允许自动创建（Git CI 默认关闭） |
| `DEPLOY_SEED_DATASOURCE` | Variable | Build variables | 否 | 设为 `1` 时，部署脚本将 KV 凭据写入 SYNC_KV |
| `DEPLOY_RUNTIME_SECRETS` | Variable | Build variables | 否 | Git 构建**不需要**（有 `WEB_ACCESS_PASSWORD` Build secret 即自动推送） |
| `WEB_BASE_PATH` | Variable | Production 或 Build（写入 wrangler [vars]） | 否 | 自定义 URL 路径段 |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Build variables | 否 | 多账户时指定；单账户可省略 |
| `COOKIE_KV_NAMESPACE_ID` | Variable | Build variables | 否 | Cookie 所在 KV Namespace（默认与 `SYNC_KV_NAMESPACE_ID` 相同） |
| `DATASOURCE_STORAGE_KEY` | Variable | Build variables | 否 | KV 中的 Cookie 键名，默认 `sync-your-cookie` |

`CLOUDFLARE_API_TOKEN` 由 Cloudflare Workers Builds **自动注入**，无需手动添加。

启用 `DEPLOY_SEED_DATASOURCE=1` 时，`prepare-wrangler.mjs` 会用上述 Token/Account/Namespace 写入 `/api/admin/datasource` 使用的 SYNC_KV 配置；**已存在配置时不会覆盖**（除非设为 `force`）。

### Git 部署的限制（与一键部署对比）

| 能力 | 一键 `pnpm deploy:cloudflare` | Git 连接部署 |
|------|------------------------------|--------------|
| 自动创建/复用 KV 并绑定 SYNC_KV | ✅ | ✅（`prepare-wrangler.mjs`） |
| 输出 Account ID / Namespace ID | ✅ | ❌ 需手动查阅 Dashboard |
| 自动推送 WEB_ACCESS_PASSWORD | ⚠️ 可选（`DEPLOY_RUNTIME_SECRETS=1`） | ✅ Build secret 时 prepare 自动推送 |
| 自动写入 ConnectForm 配置 | ⚠️ 可选（`DEPLOY_SEED_DATASOURCE=1`） | ⚠️ 可选（Dashboard 设 `DEPLOY_SEED_DATASOURCE=1`） |
| WEB_BASE_PATH | 否（默认 `/`） | 否（可选自定义路径） |
| Push 触发自动构建 | ❌ | ✅ |
| 扩展 Push/Pull（直连 KV API 或 Worker `/api/sync`） | ✅ | ✅ |

**Git 部署后仍需手动完成（若未用 Build / Dashboard 变量自动化）：**

1. 确认 Deploy 命令包含 `prepare-wrangler.mjs`（见上表）
2. 在 **Build variables** 设置 `SYNC_KV_NAMESPACE_ID`；在 **Build secret** 或 **Production Secret** 设置 `WEB_ACCESS_PASSWORD`
3. 若未启用 `DEPLOY_SEED_DATASOURCE`：登录 Web 管理端，在「连接数据源」保存凭据（**同一 SYNC_KV 下只需一次**）
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

### 部署时自动写入 ConnectForm 配置（可选）

在 `deploy/cloudflare/.env`：

```env
CLOUDFLARE_API_TOKEN=your-token
CLOUDFLARE_ACCOUNT_ID=your-account-id   # 可选，多账户时填写
DEPLOY_SEED_DATASOURCE=1
# COOKIE_KV_NAMESPACE_ID=...            # 可选，默认与 SYNC_KV 相同
# DATASOURCE_STORAGE_KEY=sync-your-cookie
```

一键部署或 Git CI（Dashboard 设同名变量）会在 SYNC_KV 写入 `__syc_datasource_config__`。Web 管理端登录后 Account ID / Namespace ID 会自动回填；**API Token 出于安全不在 UI 回显**，需重新输入一次以加载 Cookie（扩展 `/api/sync` 不受此影响）。

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
| `DEPLOY_SEED_DATASOURCE` | 否 | 设为 `1` 时，部署时将 ConnectForm 凭据写入 SYNC_KV；`force` 覆盖已有配置 |
| `COOKIE_KV_NAMESPACE_ID` | 否 | 种子写入时 Cookie 所在 KV Namespace（默认与 SYNC_KV 相同） |
| `DATASOURCE_STORAGE_KEY` | 否 | 种子写入时的 Storage Key，默认 `sync-your-cookie` |
| `SYNC_KV_NAMESPACE_ID` | 否 | 固定绑定已有 KV（**Git CI 设在 Build variables**）；设置后跳过查找/创建 |
| `DEPLOY_ALLOW_KV_CREATE` | 否 | 设为 `1` 时允许自动创建 KV（Git CI 默认关闭；一键部署默认开启） |

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
  wrangler.toml              # Worker + [assets] + keep_vars；SYNC_KV 由 prepare/deploy 脚本写入
  deploy.mjs                 # 一键部署脚本
  prepare-wrangler.mjs       # Git CI：KV 解析 + wrangler.toml 绑定 + 可选 datasource 种子
  seed-datasource.mjs        # 可选：单独写入 datasource 配置（Git CI 备用）
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
不会。脚本按名称 `sync-your-cookie` / `SYNC_YOUR_COOKIE` 通过 Cloudflare API 查找并复用；本地还有 `.deploy-state.json` 缓存。Git CI 请设置 Dashboard 变量 **`SYNC_KV_NAMESPACE_ID`** 固定绑定。

**Q: Git CI 报 `Unexpected token '⛅'` 或 KV JSON 解析失败？**  
旧版脚本曾将 wrangler CLI 输出当作 JSON 解析。请更新到最新版 `prepare-wrangler.mjs`，并在 Dashboard 设置 **`SYNC_KV_NAMESPACE_ID`**（你的 `sync-your-cookie` 命名空间 ID）。

**Q: 每次 Git push 后 Dashboard Variables and Secrets 变空、登录提示「未配置访问密码」？**  
常见原因有三：（1）`wrangler deploy` 默认会清除未写在 `wrangler.toml` 里的 Dashboard **普通变量**——本仓库已加 `keep_vars = true` 修复；（2）变量设在了 **Build variables**，运行时 **Variables and Secrets** 本就不会显示 Build 专用变量——请用 Build secret `WEB_ACCESS_PASSWORD` 让 prepare 脚本自动 `wrangler secret put`，或改在 **Production → Secret** 手动设置；（3）Worker 从旧名（如 `sync-your-cookie-web`）改名为 `sync-your-cookie`，Secret 留在旧 Worker 上。修复：在 **Build → Build variables and secrets** 设 `SYNC_KV_NAMESPACE_ID` + Secret `WEB_ACCESS_PASSWORD`，重新 push 一次。

**Q: wrangler deploy 会清除 Dashboard Secret 吗？**  
Encrypted Secret 通常会在 redeploy 后保留；但若在 `wrangler.toml` `[vars]` 里写了同名键（哪怕是空字符串），会覆盖 Secret。本仓库**不会**把 `WEB_ACCESS_PASSWORD` 写入 `[vars]`。

**Q: 每次 redeploy 都要重新填 ConnectForm / 密码吗？**  
**不应如此。** redeploy 不会清除 Worker Secret 或 KV 数据。若每次部署后 Namespace ID 为空、需重新配置，通常是 Worker 被绑到了**新的** KV namespace（未设置 `SYNC_KV_NAMESPACE_ID` 且按名称查找失败时会新建）。修复：在 Dashboard 固定 `SYNC_KV_NAMESPACE_ID`，并可选 `DEPLOY_SEED_DATASOURCE=1` 自动写入凭据。ConnectForm 中 **API Token 字段始终为空**（安全设计），但 Account ID / Namespace ID 在配置存在时会自动回填。

**Q: redeploy 会 wipe SYNC_KV 里的 datasource 配置吗？**  
不会，只要 `wrangler.toml` 绑定的 `SYNC_KV` namespace ID **不变**。配置保存在 KV 键 `__syc_datasource_config__` 中，与 Worker 代码部署无关。

**Q: 以前用 Cloudflare Pages 部署怎么办？**  
项目已迁移至 Worker。运行 `pnpm deploy:cloudflare` 或按上文 Git Worker 配置重新部署；访问地址为 `https://sync-your-cookie.<account>.workers.dev/`（或自定义域名根路径），需在 Worker 项目设置 `WEB_ACCESS_PASSWORD`。扩展 Options 中的 KV 凭据不变。
