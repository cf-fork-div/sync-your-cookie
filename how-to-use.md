## 使用说明

`Sync Your Cookie` 将 Cookie 与 LocalStorage 同步到 Cloudflare [KV](https://developers.cloudflare.com/kv/)（protobuf 编码）。扩展通过已部署的 **Cloudflare Worker** 连接后端。

## 登录扩展

1. 按 [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) 部署 Worker；参数准备见 [deploy/CLOUDFLARE-PARAMS.md](./deploy/CLOUDFLARE-PARAMS.md)。
2. 打开扩展弹窗或侧边栏，填写：
   - **配置名** — 可选显示名
   - **服务器 URL** — 如 `https://sync-your-cookie.your-account.workers.dev`（无尾斜杠）
   - **访问密码** — 与 `WEB_ACCESS_PASSWORD` 相同
3. 登录后即可 Push / Pull。扩展请求 Worker 的 `/api/sync/*` 接口。

Web 管理端（同一 Worker URL）可在 Connect 表单查看底层 KV 数据源，通常无需手动配置。

## Push / Pull

- **Push** — 上传当前标签页 Cookie；远程已有数据且不一致时弹出冲突对话框（覆盖或另存为新账号）。
- **Pull** — 下载远程 Cookie；会先清除该 host 的本地 Cookie（镜像同步）。可在弹窗中为每条记录开启 **Auto Pull**。
- **首次 Push** 需填写账号备注（标签）；v1.5.1+ 可在 Push 对话框设置 **文件夹** 与 **类型**（login / session / other）。
- **同域名多账号** — 同一 host 下可保存多条带标签的记录。

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
| **加密** | 开启 | Protobuf 开启后建议同时开启；需设置加密密码 |

### 切换并拉取（多账号）

同站保存了多个账号时，弹窗会显示账号下拉框：

1. 在下拉框中选择目标账号（标签 / 文件夹 / 类型）。
2. 点击 **切换并拉取** — 刷新连接 → 拉取该账号 Cookie → 刷新当前站点标签页。
3. 各账号的 Auto Push / Auto Pull 开关**独立**，在弹窗或侧边栏按条目配置。

> 切换并拉取会覆盖当前浏览器中该 host 的 Cookie（镜像同步），请先确认选中的是正确账号。

## 参考

- [Cloudflare 部署指南](./deploy/CLOUDFLARE.md)
- [更新日志](./CHANGELOG.md)
