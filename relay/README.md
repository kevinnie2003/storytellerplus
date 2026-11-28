# 说书人联机 中转服务

说书人联机用的中转服务，跑在 Cloudflare Workers 上。每个房间是一个 Durable Object，存座位、说书人发的信息、玩家的已读和选择，用 WebSocket 推给说书人和玩家。房间一天没人用就自动删掉。

消息格式和网页共用一份：`web/src/net/protocol.ts`。

## 本机开发

```bash
npm install
npm run dev
```

中转跑在 8787 端口。网页（`web/`）在 localhost 上打开时会自动连这个端口。

推送通知要一对 VAPID 密钥：公钥写在 `wrangler.jsonc` 的 `VAPID_PUBLIC`，私钥（JWK 格式）本机放在 `.dev.vars` 里，写成 `VAPID_PRIVATE_JWK='{"kty":"EC",...}'`。没有私钥时只是不推送，其他功能照常。

## 部署

1. 注册一个免费的 Cloudflare 账号。
2. 在这个目录运行 `npx wrangler login` 登录，然后 `npm run deploy`。
3. 第一次部署前设置推送私钥：`npx wrangler secret put VAPID_PRIVATE_JWK`，粘贴 JWK。换密钥的话 `VAPID_PUBLIC` 也要一起换，玩家要重新开一次通知。
4. 部署后会得到一个地址，比如 `https://storyteller-relay.<你的子域名>.workers.dev`。把它填到 GitHub 仓库的 Settings → Secrets and variables → Actions → Variables 里，名字叫 `RELAY_URL`，再重新部署一次网页。
