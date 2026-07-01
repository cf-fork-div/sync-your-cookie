# Cloudflare 部署 — 前置参数获取

部署 Worker 前，在 Dashboard **Build variables and secrets** 中需要以下 4 个变量。本文说明各参数含义及获取方式。

返回主流程：[CLOUDFLARE.md](./CLOUDFLARE.md)

---

## 参数总览

| 参数名称 | 说明 | 是否加密 | 参数来源 |
|----------|------|----------|----------|
| `SYNC_KV_NAMESPACE_ID` | KV 命名空间 ID，绑定 Worker 元数据存储 | 否（Variable） | [创建 KV 命名空间](#创建-kv-命名空间) 后复制 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（`cfut_...`），用于部署与 Connect 自动配置 | 是（Secret） | [创建 API Token](#创建-api-token) |
| `WEB_ACCESS_PASSWORD` | Web 管理端与扩展登录密码 | 是（Secret） | [准备 Web 访问密码](#准备-web-访问密码) |
| `DEPLOY_SEED_DATASOURCE` | 填 `1`：首次 Deploy 自动写入 Connect 配置；覆盖已有填 `force` | 否（Variable） | 固定填 `1` |

> 设置 `DEPLOY_SEED_DATASOURCE=1` 且配置了 `CLOUDFLARE_API_TOKEN` 后，Deploy 会**自动解析 Account ID** 并写入 Connect 表单，**无需**手动复制 Account ID。仅当未设置 `DEPLOY_SEED_DATASOURCE`、需部署后手动填 Connect 表单时，才要在 Dashboard 右侧边栏查找 Account ID。

---

## 创建 KV 命名空间

1. Dashboard → **Workers & Pages** → **KV** → **创建命名空间**
2. 名称填 **`sync-your-cookie`**，点击 **创建**
3. 在命名空间详情页复制 **Namespace ID** → 填入 `SYNC_KV_NAMESPACE_ID`

![① 创建 KV 命名空间 sync-your-cookie；② 点击创建；③ 复制 Namespace ID](images/kv-create-namespace.png)

---

## 创建 API Token

Token 用于部署脚本与 Connect 自动配置，需含 **Workers KV Storage:Edit** 权限，填入 Secret **`CLOUDFLARE_API_TOKEN`**。

1. Dashboard → **我的个人资料** → **API 令牌** → **创建令牌**
2. 选择 **编辑 Cloudflare Workers** 模板 → **使用模板**
3. 名称填 **`sync-your-cookie`**
4. 确认含 **Workers KV Storage:Edit** → **创建令牌**
5. 复制 `cfut_...`，关闭页面前保存

![① 选择「编辑 Cloudflare Workers」模板；② 使用模板；③ 令牌名称 sync-your-cookie；④ 创建令牌；⑤ 复制 cfut_ Token](images/api-token-workers.png)

---

## 准备 Web 访问密码

自定强密码，填入 Build Secret **`WEB_ACCESS_PASSWORD`**。

日常改密码可在 Worker → **Variables and Secrets → Production** 修改，**立即生效**、无需 rebuild；删服务重部署时须在 Build Secrets **重新添加**。
