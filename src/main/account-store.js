/**
 * @file account-store.js
 * @description 统一数据入库入口 — 归一化 avatar URL + COALESCE SQL + 别名修正 + 可选通知
 *   所有 platform 嗅探/同步/手动更新统一走这里，避免 SQL 散落各处。
 */
import { getDB } from './database.js';
import { BrowserWindow } from 'electron';
import { guardScrapedData } from './platform-profiles.js';

/**
 * 统一写入账户 profile 数据
 * @param {number} accountId
 * @param {object} data - { real_name, avatar, user_id, followers, total_views, ... }
 * @param {object} opts
 * @param {string} [opts.platform] - 平台名，传了就跑 guardScrapedData
 * @param {boolean} [opts.notify=false] - 是否通知 renderer
 * @param {boolean} [opts.fixAlias=true] - real_name 存在时自动修正 待绑定_xxx 别名
 * @param {boolean} [opts.setStatus=false] - 是否同步更新 status 为 '在线'
 */
export function upsertAccountProfile(accountId, data, opts = {}) {
  const { platform, notify = false, fixAlias = true, setStatus = false } = opts;
  const db = getDB();

  // 1. avatar URL 归一化
  if (data.avatar) {
    let av = data.avatar;
    if (av.startsWith('//')) av = 'https:' + av;
    if (av.startsWith('http://')) av = av.replace('http://', 'https://');
    data.avatar = av;
  }

  // 2. 数据有效性校验（仅在传了 platform 时）
  if (platform) {
    try {
      guardScrapedData(data, platform);
    } catch (e) {
      console.warn(e.message);
      return { success: false, reason: 'guard_reject' };
    }
  }

  // 3. COALESCE SQL — 空字符串 / 0 / undefined 不覆盖已有真数据
  try {
    const sets = [
      "real_name = COALESCE(NULLIF(?, ''), real_name)",
      "avatar    = COALESCE(NULLIF(?, ''), avatar)",
      "user_id   = COALESCE(NULLIF(?, ''), user_id)",
      "followers = CASE WHEN ? > 0 THEN ? ELSE followers END",
      "total_views = CASE WHEN ? > 0 THEN ? ELSE total_views END",
    ];
    if (setStatus) sets.push("status = '在线'");

    db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(
      data.real_name || '',
      data.avatar || '',
      data.user_id || '',
      data.followers || 0, data.followers || 0,
      data.total_views || 0, data.total_views || 0,
      accountId
    );

    // 4. 别名修正：待绑定_xxx → 真实昵称
    if (fixAlias && data.real_name) {
      db.prepare("UPDATE accounts SET alias = ? WHERE id = ? AND alias LIKE '待绑定_%'")
        .run(data.real_name, accountId);
    }

    // 5. 通知 renderer
    if (notify) {
      try {
        const wins = BrowserWindow.getAllWindows();
        for (const win of wins) {
          if (!win.isDestroyed()) {
            win.webContents.send('onboarding-data', {
              accountId: String(accountId),
              ...data,
              _status: 'complete'
            });
          }
        }
      } catch (e) { /* ignore */ }
    }

    return { success: true };
  } catch (e) {
    console.error(`[AccountStore] 入库失败 #${accountId}:`, e.message);
    return { success: false, reason: e.message };
  }
}
