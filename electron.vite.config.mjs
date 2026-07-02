import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // 💥 核心修复：把 date-fns 也加进白名单！
        external: [
          'cheerio', 
          'better-sqlite3', 
          'playwright', 
          'playwright-extra', 
          'puppeteer-extra-plugin-stealth',
          'date-fns' 
        ]
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    server: {
      fs: { strict: false },
      // 🛠️ 自定义 CSP 以允许 matrix-media:// 协议
      headers: {
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: http:; media-src 'self' https: http: matrix-media:; connect-src 'self' https: http: ws:;"
      }
    }
  }
})