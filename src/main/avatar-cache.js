/**
 * @file avatar-cache.js
 * @description 头像本地缓存 — fetch 下载 → base64 → 存入 DB
 *   防止外部头像链接失效后 UI 空白。
 */
import { getDB } from './database.js';

/**
 * 将头像 URL 下载为 base64 并存入 DB 的 base64_avatar 列
 * @param {number} accountId
 * @param {string} avatarUrl
 */
export async function cacheAvatar(accountId, avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('http')) return;

  try {
    const db = getDB();
    const acc = db.prepare('SELECT base64_avatar FROM accounts WHERE id = ?').get(accountId);
    if (acc?.base64_avatar) return; // 已有缓存，跳过

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(avatarUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);

    if (!res.ok) return;

    const contentLength = parseInt(res.headers.get('content-length') || '0');
    if (contentLength > 200 * 1024) return; // 超 200KB 跳过

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 200 * 1024) return;

    const mime = res.headers.get('content-type') || 'image/jpeg';
    const base64 = `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;

    db.prepare('UPDATE accounts SET base64_avatar = ? WHERE id = ?').run(base64, accountId);
    console.log(`[AvatarCache] ✓ #${accountId} 头像已缓存 (${Math.round(buffer.byteLength / 1024)}KB)`);
  } catch (e) {
    // 静默失败，保留原 URL
    if (e.name !== 'AbortError') {
      console.warn(`[AvatarCache] #${accountId} 缓存失败:`, e.message);
    }
  }
}
