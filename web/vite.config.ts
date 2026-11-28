import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
// 部署到 GitHub Pages 时网站在 /storytellerplus/ 下面，由部署流程传 BASE_PATH 进来；本机开发还是 /
// 两个页面：index.html 是说书人用的魔典，online/index.html 是玩家用的“说书人联机”
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        online: resolve(import.meta.dirname, 'online/index.html'),
      },
    },
  },
})
