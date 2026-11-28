# 说书人普肉 联机中转

说书人普肉（线下联机）用的中转服务，跑在 Cloudflare Workers 上。每个房间是一个 Durable Object，存座位、说书人发的信息、玩家的已读和选择，用 WebSocket 推给说书人和玩家。房间一天没人用就自动删掉。

消息格式和网页共用一份：`web/src/net/protocol.ts`。

## 本机开发

```bash
npm install
npm run dev
```

中转跑在 8787 端口。网页（`web/`）在 localhost 上打开时会自动连这个端口。

## 部署

1. 注册一个免费的 Cloudflare 账号。
2. 在这个目录运行 `npx wrangler login` 登录，然后 `npm run deploy`。
3. 部署后会得到一个地址，比如 `https://storyteller-relay.<你的子域名>.workers.dev`。把它填到 GitHub 仓库的 Settings → Secrets and variables → Actions → Variables 里，名字叫 `RELAY_URL`，再重新部署一次网页。
