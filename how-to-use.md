## 使用说明

`Sync Your Cookie` 将 Cookie 与 LocalStorage 同步到 Cloudflare [KV](https://developers.cloudflare.com/kv/)（protobuf 编码）。扩展通过已部署的 **Cloudflare Worker** 连接后端。

## 登录扩展

1. 按 [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md) 部署 Worker 并设置 `WEB_ACCESS_PASSWORD`。
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

## 参考

- [Cloudflare 部署指南](./deploy/CLOUDFLARE.md)
- [更新日志](./CHANGELOG.md)
