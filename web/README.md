# 说书人普拉斯 网页版

在线使用：https://kevinnie2003.github.io/storytellerplus/

iPad 版（`../说书人普拉斯/`）的网页移植，大屏（iPad 横屏、电脑）上的界面和功能和 iPad 版一致。不需要 Mac，用浏览器打开就能用，可以“添加到主屏幕”全屏使用，打开过一次之后断网也能用。

## 发布

main 分支上 `web/` 有改动时，GitHub Actions 会自动打包并发布到 GitHub Pages（`.github/workflows/deploy-web.yml`）。

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 打包到 dist/
```

移植时的对照规则和各模块说明见 [PORTING.md](PORTING.md)。

## 和 iPad 版的不同

- 存档、设置、AI Key 都存在浏览器里，和 iPad app 不互通。
- 生成长图、复盘图时，跨站的角色图标通过公共图片中转 wsrv.nl 取，才能画进图片。
- 通义千问、Kimi、智谱等提供商可能不允许网页直接调用，推荐用 Claude 或 OpenRouter。
