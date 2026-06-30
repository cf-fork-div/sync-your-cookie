## How to use

`Sync Your Cookie` uses Cloudflare [KV](https://developers.cloudflare.com/kv/) to store cookie data (cookies + LocalStorage, protobuf-encoded).

> **Extension only:** You do **not** need to deploy the Web Viewer unless you want a browser-based admin UI.

## Connection modes

### Mode A — Worker sync (recommended)

Best when you deploy the Cloudflare Worker backend (`pnpm deploy:cloudflare`).

1. Deploy Worker and set `WEB_ACCESS_PASSWORD` in the Cloudflare Dashboard — see [deploy/CLOUDFLARE.md](./deploy/CLOUDFLARE.md).
2. Open the extension popup.
3. Enter:
   - **Profile name** — optional display name
   - **Server URL** — e.g. `https://sync-your-cookie.your-account.workers.dev`
   - **Access password** — same as `WEB_ACCESS_PASSWORD`
4. Push / Pull as usual. The extension talks to `/api/sync/*` on your Worker.

Admin can configure the underlying KV datasource once in the Web Viewer **Connect** form.

### Mode B — Direct Cloudflare KV API

Use when you only install the extension without deploying the Worker.

Manual setup — create a namespace, API token, and paste credentials into the extension **Options** page:

## Create Namespace

![create_namespace](./screenshots/kv//create_namepace.png)

Input
![created_namespace](./screenshots/kv/input_name.png)

Your NamespaceId
![namespaceId](./screenshots/kv/namespaceId.png)

## Your AccountId

![your_account_id](./screenshots/kv//account-id.png)

## Create Token

1. Enter Profile Page

![token_page](./screenshots/kv//create_token.png)

2. Custom Permission

![setting-up](./screenshots/kv//custom_token.png)

3. Select KV Read and Write Permission

![select-permission](./screenshots/kv/setting-permission.png)

4. Confirm Create

![confirm-create](./screenshots/kv/finish_create_token.png)

5. Copy Token

![copy-token](./screenshots/kv/copy_token.png)

6. Your Token List

![your-token-list](./screenshots/kv/created_token_list.png)

7. Paste Your Account Info And Save

![paste-and-save](./screenshots/kv/paste.png)

8. Push Your Cookie

![push-cookie](./screenshots/kv/push_cookie.png)

9. Check Your Cookie

The uploaded cookie is a protobuf-encoded string
![check your cookie](./screenshots/kv/reload_page.png)

## Multi-account on the same site

- Each push can target a **labeled account** on the same host.
- On **first push**, you will be asked for an account **label**.
- If remote data differs, choose **overwrite** an existing entry or **save as new**.
- Set **folder** and **type** (login / session / other) in the push dialog (v1.5.1+).

## Pull behavior

**Pull mirrors remote:** local cookies for that host are cleared before remote cookies are applied. Enable **Auto Pull** per entry in the popup switches.

## Reference

- [create-token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [account-owned-tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/)
- [Cloudflare deploy guide](./deploy/CLOUDFLARE.md)
- [Changelog](./CHANGELOG.md)
