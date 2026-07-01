# Cloudflare 部署指南

## 介绍

**Sync Your Cookie** 通过自建的 **Cloudflare Worker + KV** 后端，配合 **Web 管理端**与**浏览器扩展**，在多台设备、多个浏览器之间同步 Cookie 与 LocalStorage。

**解决什么痛点**

- **多设备 / 多浏览器**登录态不一致，换机或换浏览器就要重新登录
- **数据自主**：不依赖第三方 Cookie 同步服务，Cookie 存在你自己 Cloudflare 账号下的 Worker + KV
- **扩展配置简单**（v1.7.x）：只需 **Worker URL + 访问密码**；KV 凭据在 Web 管理端 Connect 表单配置一次即可
- **运维轻量**：Git 连接后 **push 即自动构建部署**
- **同步可控**：支持同站多账号、手动 Push / Pull；多账号推荐 **切换并拉取**（见 [how-to-use.md](../how-to-use.md#使用场景与推荐配置)）

---

## 从零部署 / 删除后重部署（推荐顺序）

删除旧 Worker 服务后，按下面顺序操作。**KV 命名空间与 API Token 可保留**，不必重建；删除 Worker 不会清空 KV 里的 Cookie 数据。

### 第 0 步：部署前准备好四个 Build 变量

在 **Settings → Build → Build variables and secrets**（高级设置）中，部署前须添加以下 **4 个变量**：

| 变量 | 类型 | 值 / 来源 | 用途 |
|------|------|-----------|------|
| `SYNC_KV_NAMESPACE_ID` | Variable | [创建 KV](#创建-workers-kv-命名空间) 后复制的 Namespace ID | 绑定 Worker 元数据 KV |
| `WEB_ACCESS_PASSWORD` | Secret | 自定强密码 | Web 管理端与扩展登录 |
| `CLOUDFLARE_API_TOKEN` | Secret | [创建 Token](#创建-api-tokenconnect-表单用) 得到的 `cfut_...` | `wrangler deploy` 与自动写入 Connect 配置 |
| `DEPLOY_SEED_DATASOURCE` | Variable | `1` | 首次 Deploy 自动把 KV 凭据写入 Connect 表单（覆盖已有用 `force`） |

另将 **Account ID** 抄到记事本（Connect 表单或种子写入时需要）：

| 信息 | 在哪里找 |
|------|----------|
| **Account ID** | Dashboard 右侧边栏 **Account ID**，或 **Workers & Pages** → 任意 Worker → **Settings** |
| **Namespace ID** | 与上表 `SYNC_KV_NAMESPACE_ID` 相同 |
| **API Token** | 与上表 `CLOUDFLARE_API_TOKEN` 相同，请自行保存一份 |

### 第 1 步：创建 Worker（Git 连接）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
2. 选择 **已 push 最新代码** 的仓库与分支（本 fork 示例：`cf-fork-div/sync-your-cookie`，分支 `main`）
3. 点击 **下一步**

![选择 GitHub 仓库 sync-your-cookie 并点击下一步](images/git-select-repo.png)

4. **项目名称** 填 **`sync-your-cookie`**（须与 `deploy/cloudflare/wrangler.toml` 中 `name` 一致）
5. **Root directory（路径）** 填 **`/`**
6. **Node.js 版本** 选 **20**（**高级设置**）
7. 先不要点保存，继续第 2、3 步填 Build 变量与命令

> **注意**：请连接 **你实际 push 代码的 fork**，不要连到未同步的上游仓库，否则 Deploy 可能找不到脚本文件。

### 第 2 步：Build 变量（高级设置）

**Settings → Build → Build variables and secrets** 中添加第 0 步准备的 **4 个变量**：

| 变量 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `SYNC_KV_NAMESPACE_ID` | Variable | 是 | KV 命名空间 ID |
| `WEB_ACCESS_PASSWORD` | Secret | 是 | Web / 扩展登录密码 |
| `CLOUDFLARE_API_TOKEN` | Secret | 是 | `cfut_...`，用于部署与 `DEPLOY_SEED_DATASOURCE` 写入 Connect |
| `DEPLOY_SEED_DATASOURCE` | Variable | 是 | 填 `1`；首次 Deploy 自动配置 Connect，免手动填 KV 凭据 |

可选 Variable：

| 变量 | 说明 |
|------|------|
| `WEB_BASE_PATH` | 自定义 URL 路径段，如 `my-vault` → 访问 `/my-vault/` |

> Cloudflare Git 连接有时也会自动注入 `CLOUDFLARE_API_TOKEN`；若 Build 日志仍报缺少 Token，请按上表 **手动添加 Secret**。

### 第 3 步：Build / Deploy 命令

![配置项目名称、构建命令与部署命令](images/worker-build-settings.png)

**构建命令**（原样复制）：

```text
pnpm install && pnpm build:cloudflare-worker
```

**部署命令**（原样复制，推荐）：

```text
node deploy/cloudflare/prepare-wrangler.mjs --deploy
```

若报 `Unknown option '--deploy'`（代码过旧），改用：

```text
node deploy/cloudflare/prepare-wrangler.mjs && cd deploy/cloudflare && npx wrangler deploy
```

**非生产分支部署命令**（可保持默认）：

```text
npx wrangler versions upload
```

| 项 | 值 |
|----|-----|
| Root directory | `/` |
| Build command | 见上 |
| Deploy command | 见上 |

> **勿用**带 `--config deploy/cloudflare/wrangler.toml` 的长命令：Dashboard 输入框可能把 `.toml` 截成 `.tom`，导致 `Missing entry-point`。
>
> **勿**只改 Dashboard 命令就对旧构建点 Retry：须 **Save and Deploy** 或 **向 Git push** 触发包含最新脚本的新构建。

### 第 4 步：保存并等待完成

1. 点击 **Save and Deploy**
2. 在 **Deployments** 页等待 **Build** 与 **Deploy** 均成功
3. 成功标志：日志末尾出现 Worker URL（`*.workers.dev`），无 `Failed`

### 第 5 步：部署后验证

**Web 管理端**

- [ ] 打开 Worker URL（`https://sync-your-cookie.<子域>.workers.dev`）
- [ ] 用 `WEB_ACCESS_PASSWORD` 登录
- [ ] 若未设置 `DEPLOY_SEED_DATASOURCE=1`：在 **Connect 表单** 填写 Account ID、Namespace ID、API Token 并保存
- [ ] 若设置了 `DEPLOY_SEED_DATASOURCE=1` 且 Deploy 成功：Connect 通常已自动配置

**浏览器扩展（v1.7.x）**

- [ ] **服务器 URL**：Worker 根地址，无尾斜杠（有 `WEB_BASE_PATH` 则带前缀）
- [ ] **访问密码**：与 `WEB_ACCESS_PASSWORD` 相同
- [ ] 试一次 Push / Pull

Connect 中的 KV 为 **Cookie 存储**；`SYNC_KV` 存 datasource 等 Worker 元数据（可与 Cookie KV 为同一 Namespace）。

---

## 前置条件（首次部署详解）

- [ ] Cloudflare 账号，GitHub 已授权 Cloudflare
- [ ] 对本仓库 fork 有 push 权限
- [ ] 已创建 KV 命名空间并记录 **Namespace ID**（→ `SYNC_KV_NAMESPACE_ID`）
- [ ] 已创建 API Token 并记录 **Token 字符串**（→ `CLOUDFLARE_API_TOKEN`）
- [ ] 已准备 **Web 访问密码**（→ `WEB_ACCESS_PASSWORD`）
- [ ] Build 变量 **`DEPLOY_SEED_DATASOURCE=1`** 已添加

### 创建 Workers KV 命名空间

Namespace ID 用于 Build 变量 `SYNC_KV_NAMESPACE_ID`，以及 Web 管理端 Connect 表单。

1. Dashboard → **Workers & Pages** → **KV** → **创建命名空间**
2. 名称填 **`sync-your-cookie`**，点击 **创建**
3. 在命名空间详情页复制 **Namespace ID**

![① 创建 KV 命名空间 sync-your-cookie；② 点击创建；③ 复制 Namespace ID](images/kv-create-namespace.png)

### 创建 API Token（Connect 表单用）

此 Token 供 **Web 管理端 Connect 表单**使用，Worker 通过它读写 **Cookie 存储 KV**（需 **Workers KV Storage:Edit** 权限）。

> 此 Token 同时填入 Build Secret **`CLOUDFLARE_API_TOKEN`**。若 Build 设置了 **`DEPLOY_SEED_DATASOURCE=1`**，Deploy 时会自动写入 Connect 表单，无需部署后再手动填写。

1. Dashboard → **我的个人资料** → **API 令牌** → **创建令牌**
2. 选择 **编辑 Cloudflare Workers** 模板 → **使用模板**
3. 名称填 **`sync-your-cookie`**
4. 确认含 **Workers KV Storage:Edit** → **创建令牌**
5. 复制 `cfut_...`，关闭页面前保存

![① 选择「编辑 Cloudflare Workers」模板；② 使用模板；③ 令牌名称 sync-your-cookie；④ 创建令牌；⑤ 复制 cfut_ Token](images/api-token-workers.png)

---

## 密码：Build Secret vs Production Secret

| 位置 | 何时生效 | 说明 |
|------|----------|------|
| **Build → Secrets** `WEB_ACCESS_PASSWORD` | 每次 Deploy | `prepare-wrangler.mjs --deploy` 自动 `wrangler secret put` |
| **Worker → Variables and Secrets → Production** | **立即** | 改密码无需 rebuild / redeploy |

日常改密码：在 **Production** 修改即可。删服务重部署时，须在 Build Secrets **重新添加** `WEB_ACCESS_PASSWORD`。

---

## 自定义域名（可选）

1. Worker → **Settings → Domains & Routes** → **Add Custom Domain**
2. 例如 `sync-your-cookie.example.com`
3. 扩展 **服务器 URL** 填 `https://sync-your-cookie.example.com`（无尾斜杠）
4. 若设置了 `WEB_BASE_PATH`，URL 需带前缀，如 `https://…/my-vault`

`workers.dev` 与自定义域名可并存；扩展填实际使用的地址即可。

---

## 后续更新

向 Git 连接分支 **push 即自动 redeploy**。`SYNC_KV_NAMESPACE_ID` 不变时 KV 数据保留。

---

## 常见问题

**Deploy 报 `Missing entry-point`？**

- Deploy 命令被截断（`wrangler.toml` → `wrangler.tom`）或未在 `deploy/cloudflare` 目录执行 wrangler
- 改为：`node deploy/cloudflare/prepare-wrangler.mjs --deploy`，**Save and Deploy** 或 push 触发新构建

**Deploy 报 `Cannot find module`？**

- Cloudflare 连的仓库/分支没有最新代码，或对旧 Deployment 点了 Retry
- 确认 Git 仓库与 push 的 fork 一致，push 最新 `main` 后再部署

**Build 成功、Deploy 失败？**

- 检查 Deploy 命令是否与第 3 步一致
- 确认 Build Secret 已设 `WEB_ACCESS_PASSWORD`
- 确认 `SYNC_KV_NAMESPACE_ID` 与 KV 命名空间 ID 一致

**无法登录 / 「未配置访问密码」？**

- Build Secrets 或 Production 中设置 `WEB_ACCESS_PASSWORD`
- 删服务重部署后须 **重新添加** Build Secret

**redeploy 后 Connect 表单要重填？**

- Build variables 固定 **`SYNC_KV_NAMESPACE_ID`**
- Deploy 使用 `prepare-wrangler.mjs --deploy`
- 或设置 `DEPLOY_SEED_DATASOURCE=1` 自动恢复

**Push/Pull「验证失败」/`verify_failed`？**（v1.6.1+ 会显示 HTTP 状态与响应体）

| 原因 | 处理 |
|------|------|
| Worker 版本过旧 | push 触发 redeploy |
| 密码不匹配 | Production 确认密码；扩展重新保存 |
| URL 错误 | 填根地址，不带 `/api`；有 `WEB_BASE_PATH` 则带前缀 |
| `datasource_not_configured` | Web Connect 表单保存 KV 凭据，或 `DEPLOY_SEED_DATASOURCE=1` |
| `network_error` | 检查 URL、DNS、Worker 是否在线 |

**Pull 失败 / 部分 Cookie 未写入？**

- Toast 会显示 `name@domain: reason`（v1.5.5+）
- 第三方 Cookie 可能被浏览器策略跳过，属正常

**「切换并拉取」失败？**（v1.7.1 修复同站多账号 URL 解析）

- 确认扩展 ≥ v1.7.1
- 先手动 Pull 验证连接

**本地调试 Worker？**

```bash
pnpm build:cloudflare-worker
cd deploy/cloudflare && npx wrangler dev
```

**本地一键部署（非 Git CI）？**

```bash
pnpm deploy:cloudflare
```

见 `deploy/cloudflare/.env.example` 配置 `CLOUDFLARE_API_TOKEN` 等。
