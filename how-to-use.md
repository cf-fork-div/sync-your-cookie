# 插件使用指南

## 插件说明

**Sync Your Cookie** 是一款 Chromium 浏览器扩展，将当前浏览器的 **Cookie** 与 **LocalStorage** 同步到你自建的 **Cloudflare Worker + KV** 后端，从而在多台设备、多个浏览器之间共享登录态。

**能做什么**

- **Push** — 把当前站点的 Cookie（及可选 LocalStorage）上传到云端
- **Pull** — 从云端下载并写入浏览器（镜像同步，完整还原登录态）
- **同站多账号** — 同一域名保存多个账号（如个人号 / 工作号），通过 **切换并拉取** 一键切换
- **Web 管理端** — 与扩展共用同一 Worker 地址，可在网页上查看、编辑已同步的数据

**v1.7.x 连接方式**

扩展只需两项配置：

| 配置项 | 说明 |
|--------|------|
| **服务器 URL** | 已部署的 Worker 地址，如 `https://sync-your-cookie.xxx.workers.dev`（无尾斜杠） |
| **访问密码** | 与 Cloudflare Build 中的 `WEB_ACCESS_PASSWORD` 相同 |

不再需要在扩展里填写 Cloudflare Account ID、Namespace ID 或 API Token（这些仅在 Worker 部署与 Web 管理端 Connect 表单中使用）。

**使用前**

须先按 [Cloudflare 部署指南](./deploy/CLOUDFLARE.md) 完成 Worker 部署；参数准备见 [CLOUDFLARE-PARAMS.md](./deploy/CLOUDFLARE-PARAMS.md)。

---

## 获取与安装

> **本 fork 尚未单独上架商店。** 请使用下方 [从源码加载](#从源码加载推荐) 或 [从 Release ZIP 加载](#从-release-zip-加载) 安装。

### 从源码加载（推荐）

适用于本 fork 及需要最新功能的用户。

**环境要求：** Node.js **20+**，包管理器 **pnpm**。

```bash
git clone https://github.com/cf-fork-div/sync-your-cookie.git
cd sync-your-cookie
pnpm install
pnpm build
```

构建产物在 **`dist/`** 目录。

**Chrome / Edge 加载未打包扩展：**

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录下的 **`dist`** 文件夹
5. 确认工具栏出现扩展图标，弹窗底部版本号与构建一致（当前 **v1.7.1+**）

> 修改代码后需重新执行 `pnpm build`，并在扩展管理页点击 **重新加载**。

### 从 Release ZIP 加载

适用于不想从源码构建、但需使用本 fork 发布包的用户。

**下载地址：** [GitHub Releases](https://github.com/cf-fork-div/sync-your-cookie/releases) — 选择对应版本（如 `v1.7.1`），下载以下任一 ZIP（内容相同）：

| 文件名 | 说明 |
|--------|------|
| `sync-your-cookie-{version}.zip` | 本 fork 稳定命名 |
| `extension-{version}-chrome.zip` | 与 upstream 发布页命名一致（Chrome） |
| `extension-{version}-edge.zip` | 与 upstream 发布页命名一致（Edge） |

Release 说明中会附带各文件的 SHA256 校验和。维护者本地构建见 [STORE_PUBLISH.md](./STORE_PUBLISH.md)（`pnpm release:zip` → `dist/release/`）。

**触发新 Release（维护者）：** 确保 `package.json` 版本已更新后，打 tag 并推送即可由 CI 自动上传：

```bash
git tag v1.7.1
git push origin v1.7.1
```

**安装步骤：**

1. 从 [Releases 页面](https://github.com/cf-fork-div/sync-your-cookie/releases) 下载对应版本的 ZIP 并解压到任意文件夹
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择解压后的文件夹（内含 `manifest.json`）

> 不能将 ZIP 或 CRX 文件直接拖入扩展管理页加载；Chrome / Edge 会显示「开发者扩展」警告属正常现象。更新版本需重新下载 ZIP，解压后在扩展管理页点击 **重新加载**。

---

## 登录扩展

1. 点击工具栏图标打开 **弹窗**，或打开 **侧边栏** / **选项页**。
2. 填写：
   - **配置名** — 可选显示名（多配置场景用，如「配置 1」）
   - **服务器 URL** — Worker 根地址，如 `https://sync-your-cookie.your-account.workers.dev`（无尾斜杠；若使用自定义域名，填实际域名）
   - **访问密码** — 与 `WEB_ACCESS_PASSWORD` 相同
3. 点击 **保存** / 登录。成功后即可 Push / Pull；扩展请求 Worker 的 `/api/sync/*` 接口。

Web 管理端（浏览器打开同一 Worker URL）可在 Connect 表单查看底层 KV 数据源；若部署时设置了 `DEPLOY_SEED_DATASOURCE=1`，通常已自动配置，无需手动填写。

---

## Push / Pull

- **Push** — 上传当前标签页 Cookie；远程已有数据且不一致时弹出冲突对话框（覆盖或另存为新账号）。
- **Pull** — 下载远程 Cookie；会先清除该 host 的本地 Cookie（镜像同步）。可在弹窗中为每条记录开启 **Auto Pull**。
- **首次 Push** 需填写账号备注（标签）；v1.5.1+ 可在 Push 对话框设置 **文件夹** 与 **类型**（login / session / other）。
- **同域名多账号** — 同一 host 下可保存多条带标签的记录。

---

## 使用场景与推荐配置

### 自动 vs 手动

| 方式 | 适用场景 |
|------|----------|
| **手动 Push / Pull** | 默认推荐；多账号同站、需精确控制同步时机 |
| **Auto Push** | 单账号、登录后 Cookie 会频繁变化且需自动备份 |
| **Auto Pull** | 单账号、新设备/新浏览器首次打开站点时自动还原登录态 |

> 多账号场景优先用手动 + **切换并拉取**，不要依赖 Auto Push / Auto Pull。

### Auto Push 行为

- 监听 Cookie 变化，**10 秒防抖**后 Push（连续变化会重置计时）。
- **非定时**任务，仅在 Cookie 实际变更时触发。
- 同一 host 下若多条记录都开了 Auto Push，**只会同步一条**
  - 优先 `lastSelectedEntryByHost`（弹窗最近选中的账号）
  - 否则同步列表中第一条

### Auto Pull 行为

- 标签页 **首次 loading** 时触发（该 host 无其他已打开标签页）。
- **非定时**任务，不会周期性拉取。
- 同一 host 下若多条记录都开了 Auto Pull，**只会拉取一个**（规则同 Auto Push）。

### 典型场景

| 场景 | 推荐做法 |
|------|----------|
| **单账号站点** | 手动 Push 保存；可选开启 Auto Pull，新浏览器打开站点自动登录 |
| **同站多账号**（如 railgun.info） | 手动 Push 各账号；切换账号用 **切换并拉取**；关闭 Auto Push / Auto Pull |
| **Auto Push 慎用** | 误操作或临时登录可能把错误状态覆盖到云端，影响其他设备 |
| **跨设备共享** | 设备 A Push → 设备 B 手动 Pull 或（单账号时）Auto Pull |

### 推荐全局设置（Options）

| 配置项 | 推荐 | 说明 |
|--------|------|------|
| **服务器 URL + 访问密码** | 必填 | Worker 根地址 + `WEB_ACCESS_PASSWORD`；见 [部署指南](./deploy/CLOUDFLARE.md) |
| **Storage Key** | `sync-your-cookie`（默认） | KV 中的数据键；多配置/多租户时可自定义 |
| **Protobuf 编码** | 开启 | 体积更小、读写更快 |
| **同步 LocalStorage** | 按需 | 站点登录态依赖 localStorage 时开启 |
| **加密** | 按需 | 个人使用可关闭；开启后须记住加密密码 |

### 切换并拉取（多账号）

同站保存了多个账号时，弹窗会显示账号下拉框：

1. 在下拉框中选择目标账号（标签 / 文件夹 / 类型）。
2. 点击 **切换并拉取** — 刷新连接 → 拉取该账号 Cookie → 刷新当前站点标签页。
3. 各账号的 Auto Push / Auto Pull 开关**独立**，在弹窗或侧边栏按条目配置。

> 切换并拉取会覆盖当前浏览器中该 host 的 Cookie（镜像同步），请先确认选中的是正确账号。

---

## 参考

- [Cloudflare 部署指南](./deploy/CLOUDFLARE.md)
- [部署参数获取](./deploy/CLOUDFLARE-PARAMS.md)
- [更新日志](./CHANGELOG.md)
- [商店发布说明](./STORE_PUBLISH.md)
