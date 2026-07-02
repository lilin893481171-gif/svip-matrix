/**
 * @file src/main/session-identity-ipc.js
 * 会话身份提取 IPC 处理器
 *
 * 从 network-interceptor.js 解耦迁出。
 * 供 Publisher.js / ProtocolAggregator 提取 BrowserView 中的登录态身份。
 */
import { ipcMain, webContents } from 'electron'
import { extractSessionIdentity, getSession, getActiveSessions } from './session-store.js'

let _registered = false

export function initSessionIdentityIPC() {
  if (_registered) return
  _registered = true

  console.log('[SessionIdentity] 注册身份提取 IPC Handlers...')

  // ── 从指定 BrowserView session 提取 Cookie/UA/bili_jct ──
  ipcMain.handle('identity:extract-session', async (_event, { accountId, webContentsId }) => {
    try {
      const wc = webContents.fromId(webContentsId)
      if (!wc || wc.isDestroyed()) {
        return { success: false, error: 'webContents 不可用' }
      }
      let ua = 'unknown'
      try { ua = wc.getUserAgent() } catch (_) {}
      const identity = await extractSessionIdentity(wc.session, accountId, ua)
      return { success: true, identity }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ── ProtocolAggregator "提取身份" 按钮 — 从活跃会话中选 B站 BrowserView ──
  ipcMain.handle('identity:request-extract', async () => {
    try {
      const sessions = getActiveSessions()
      if (!sessions.length) {
        return { success: false, error: '没有活跃的 BrowserView 会话' }
      }

      let target = sessions.find(s =>
        s.currentUrl && s.currentUrl.includes('member.bilibili.com')
      ) || sessions[0]

      const sessionData = getSession(target.accountId)
      if (!sessionData || !sessionData.webContents || sessionData.webContents.isDestroyed()) {
        return { success: false, error: '会话 webContents 不可用' }
      }

      const wc = sessionData.webContents
      let ua = 'unknown'
      try { ua = wc.getUserAgent() } catch (_) {}

      const identity = await extractSessionIdentity(wc.session, target.accountId, ua)
      return { success: true, identity }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  console.log('[SessionIdentity] IPC Handlers 注册完成')
}
