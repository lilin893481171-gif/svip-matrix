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
      fs: { strict: false }
    }
  }
})