import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// 部署到 GitHub Pages 时网站在 /storytellerplus/ 下面，由部署流程传 BASE_PATH 进来；本机开发还是 /
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
