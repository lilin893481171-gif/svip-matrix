/**
 * @file renderer/src/utils/interceptor-helpers.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 拦截器辅助工具 — 身份提取专用
 *
 * 职责：
 *   1. 从沙盒会话中提取完整 Cookie 字符串（含 bili_jct）
 *   2. 提取真实的 User-Agent
 *   3. 监控资产上传接口返回值（filename, cid, coverUrl）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════
// 1. Cookie 提取器
// ═══════════════════════════════════════════

/**
 * 从 webContents.session.cookies.get() 提取完整 Cookie 字符串
 * @param {Electron.WebContents} wc - BrowserView 的 webContents
 * @returns {Promise<string>} Cookie 字符串（用于 Publisher.js）
 */
export async function extractCookieString(wc) {
  if (!wc || wc.isDestroyed()) return '';

  try {
    const cookies = await wc.session.cookies.get({});
    const cookieMap = {};

    for (const c of cookies) {
      cookieMap[c.name] = c.value;
    }

    // 格式化为标准 Cookie header 格式
    return Object.entries(cookieMap)
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join('; ');
  } catch (e) {
    console.warn('[CookieExtractor] 提取失败:', e.message);
    return '';
  }
}

/**
 * 仅提取关键身份字段（轻量级版）
 */
export async function extractIdentity(wc) {
  if (!wc || wc.isDestroyed()) return null;

  try {
    const cookies = await wc.session.cookies.get({});
    const identity = {
      cookies: {},
      userAgent: wc.getUserAgent(),
      timestamp: Date.now(),
    };

    // 只提取关键 Cookie
    const criticalCookies = ['bili_jct', 'SESSDATA', 'DedeUserID', 'bili_jct'];
    for (const c of cookies) {
      if (criticalCookies.includes(c.name)) {
        identity.cookies[c.name] = c.value;
      }
    }

    // 尝试从页面 localStorage 获取 bili_jct（更可靠）
    try {
      const bili_jct = await wc.executeJavaScript(`
        (() => {
          try {
            const s = localStorage.getItem('bili_upload_state') || '{}';
            const d = JSON.parse(s);
            return d.csrf || d.bili_jct || '';
          } catch(e) {}
          return '';
        })()
      `);
      if (bili_jct) identity.cookies.bili_jct = bili_jct;
    } catch (_) {}

    return identity;
  } catch (e) {
    console.warn('[IdentityExtractor] 提取失败:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════
// 2. 资产上传监控器
// ═══════════════════════════════════════════

/**
 * 监控 B站预上传接口返回值（filename, cid）
 * @param {Electron.WebContents} wc
 * @param {number} timeoutMs - 轮询超时时间
 * @returns {Promise<{filename: string, cid: number}>}
 */
export async function pollVideoInfo(wc, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const info = await wc.executeJavaScript(`
        (() => {
          try {
            const s = JSON.parse(localStorage.getItem('bili_upload_state') || '{}');
            if (s.videoList?.[0]) {
              const v = s.videoList[0];
              if (v.cid && v.filename) return { filename: v.filename, cid: v.cid };
            }
          } catch(e) {}
          return null;
        })()
      `);

      if (info?.cid) return info;
    } catch (e) {
      console.warn('[PollVideoInfo] 轮询异常:', e.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error('视频上传超时');
}

/**
 * 监控封面上传接口返回值（coverUrl）
 * @param {Electron.WebContents} wc
 * @returns {Promise<string>} coverUrl
 */
export async function pollCoverUrl(wc, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const coverUrl = await wc.executeJavaScript(`
        (() => {
          try {
            const s = JSON.parse(localStorage.getItem('bili_upload_state') || '{}');
            return s.videoList?.[0]?.cover || s.cover || '';
          } catch(e) {}
          return '';
        })()
      `);

      if (coverUrl) return coverUrl;
    } catch (e) {
      console.warn('[PollCoverUrl] 轮询异常:', e.message);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.warn('[PollCoverUrl] 超时，返回空');
  return '';
}
