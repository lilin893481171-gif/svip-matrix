/**
 * @file src/main/session-store.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 会话身份存储 — 解耦 account-browser-manager ↔ network-interceptor 死结
 *
 * 职责:
 *   1. extractSessionIdentity() — 从 Electron session 提取 Cookie/UA/bili_jct
 *   2. activeSessions Map     — 活跃 BrowserView 会话状态 (原在 account-browser-manager)
 *   3. getSessionByAccountId / getActiveSessions — 跨模块共享查询
 *
 * 采用发布/订阅模式: session-store 是共享状态中立层，任何模块都可以直接 import
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════
// 活跃会话 Map (从 account-browser-manager 移出)
// ═══════════════════════════════════════════

const activeSessions = new Map();

// ═══════════════════════════════════════════
// 1. 活跃会话 API
// ═══════════════════════════════════════════

export function setSession(accountId, sessionData) {
  activeSessions.set(String(accountId), sessionData);
}

export function getSession(accountId) {
  return activeSessions.get(String(accountId)) || null;
}

export function removeSession(accountId) {
  activeSessions.delete(String(accountId));
}

export function hasSession(accountId) {
  return activeSessions.has(String(accountId));
}

export function getActiveSessions() {
  const sessions = [];
  for (const [id, session] of activeSessions) {
    try {
      let url = 'about:blank';
      if (session.currentUrl) url = session.currentUrl;
      else if (session.webContents && !session.webContents.isDestroyed()) url = session.webContents.getURL();
      sessions.push({ accountId: id, currentUrl: url });
    } catch (e) {
      sessions.push({ accountId: id, currentUrl: 'about:blank' });
    }
  }
  return sessions;
}

export function getAllSessions() {
  return new Map(activeSessions);
}

// ═══════════════════════════════════════════
// 2. 身份提取 (从 network-interceptor 迁入)
// ═══════════════════════════════════════════

/**
 * 从 Electron session 提取完整身份信息
 * 供 Publisher.js (纯 Node.js API 引擎) 使用
 *
 * @param {Electron.Session} ses - BrowserView 的 webContents.session
 * @param {string} accountId - 账户 ID
 * @param {string} [ua] - User-Agent 字符串
 * @returns {{ cookies: string, ua: string, biliJct: string|null, rawCookies: Array }}
 */
export async function extractSessionIdentity(ses, accountId, ua) {
  try {
    const rawCookies = await ses.cookies.get({});

    // 构建 Cookie 字符串
    const cookieStr = rawCookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 提取 bili_jct (B站 CSRF token)
    const biliJctCookie = rawCookies.find(c => c.name === 'bili_jct');
    const biliJct = biliJctCookie ? biliJctCookie.value : null;

    console.log('[SessionStore] 身份提取完成:', {
      accountId,
      cookieCount: rawCookies.length,
      hasBiliJct: !!biliJct,
      biliJctPreview: biliJct ? biliJct.slice(0, 6) + '...' : null,
      uaPreview: ua ? ua.slice(0, 60) + '...' : 'unknown',
    });

    return {
      cookies: cookieStr,
      ua: ua || 'unknown',
      biliJct,
      rawCookies,
      accountId,
    };
  } catch (e) {
    console.error('[SessionStore] 身份提取失败:', e.message);
    return { cookies: '', ua: 'unknown', biliJct: null, rawCookies: [], accountId };
  }
}

/**
 * 检查小红书会话是否仍然有效
 * @param {Electron.Session} ses - BrowserView 的 webContents.session
 * @param {string} accountId - 账户 ID
 * @returns {Promise<{isValid: boolean, reason: string}>}
 */
export async function checkXHSSessionValidity(ses, accountId) {
  try {
    // 获取所有Cookie
    const rawCookies = await ses.cookies.get({});

    // 检查关键Cookie是否存在且未过期
    const criticalCookies = ['web_session', 'lgin', 'xids'];
    const now = Date.now();

    for (const cookieName of criticalCookies) {
      const cookie = rawCookies.find(c => c.name === cookieName);
      if (!cookie) {
        return { isValid: false, reason: `缺少关键Cookie: ${cookieName}` };
      }

      // 检查是否过期
      if (cookie.expirationDate && cookie.expirationDate * 1000 < now) {
        return { isValid: false, reason: `Cookie已过期: ${cookieName}` };
      }
    }

    // 检查是否有登录相关标识
    const hasLoginIndicator = rawCookies.some(c =>
      c.name.includes('login') || c.name.includes('session') || c.name.includes('lgin')
    );

    if (!hasLoginIndicator) {
      return { isValid: false, reason: '未找到登录状态标识' };
    }

    console.log(`[SessionStore] 小红书会话检查通过: ${accountId}`);
    return { isValid: true, reason: '会话有效' };

  } catch (e) {
    console.error('[SessionStore] 会话检查失败:', e.message);
    return { isValid: false, reason: `检查异常: ${e.message}` };
  }
}

/**
 * 刷新小红书会话（通过访问主页维持登录状态）
 * @param {Electron.WebContents} wc - BrowserView 的 webContents
 * @param {string} accountId - 账户 ID
 * @returns {Promise<boolean>}
 */
export async function refreshXHSSession(wc, accountId) {
  try {
    console.log(`[SessionStore] 开始刷新小红书会话: ${accountId}`);

    // 访问小红书主页维持会话
    await wc.loadURL('https://www.xiaohongshu.com');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 检查是否仍然在登录状态
    const isLoggedIn = await wc.executeJavaScript(`
      !document.querySelector('.login-btn, .signin-btn') &&
      !!document.querySelector('.user-avatar, .profile-link, [class*="user"]')
    `);

    if (isLoggedIn) {
      console.log(`[SessionStore] 小红书会话刷新成功: ${accountId}`);
      return true;
    } else {
      console.warn(`[SessionStore] 小红书会话刷新后未登录: ${accountId}`);
      return false;
    }

  } catch (e) {
    console.error(`[SessionStore] 小红书会话刷新失败: ${accountId}`, e.message);
    return false;
  }
}

/**
 * 启动小红书会话保持器
 * @param {string} accountId - 账户 ID
 * @deprecated 小红书专用模块已移除，需要迁移至 PlatformRegistry
 */
export async function startXHSSessionKeeper(accountId) {
  console.warn(`[SessionStore] startXHSSessionKeeper 已废弃，需要迁移至新架构`);
  return null;
}
