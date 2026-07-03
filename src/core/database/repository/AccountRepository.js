/**
 * @file AccountRepository.js
 * @description 账号仓储 - 账号数据的唯一访问入口
 *
 * 迁移自:
 *   - src/main/account-store.js (upsertAccountProfile)
 *   - src/main/data-engine.js (autoBindAccount, runSingleSync, checkAccountStatus)
 *   - src/main/account-onboarding.js (updateStatus)
 *   - src/main/avatar-cache.js (cacheAvatar)
 *   - src/main/database.js (IPC handlers)
 */

import { BaseRepository, ERROR_TYPES, normalizeError } from '../BaseRepository.js';
import { cacheAvatar } from '../../main/avatar-cache.js';
import { guardScrapedData } from '../../main/platform-profiles.js';

/**
 * 账号仓储
 * 提供账号 CRUD 操作的统一入口
 */
export class AccountRepository extends BaseRepository {
  constructor() {
    super();
    this.table = 'accounts';
  }

  /**
   * 获取所有账号
   */
  getAllAccounts() {
    const sql = `
      SELECT id, alias, platform, group_name, custom_url, status,
             followers, following, posts, total_views,
             real_name, username, user_id, avatar, base64_avatar, trend_data,
             created_at
      FROM ${this.table}
      ORDER BY created_at DESC
    `;
    return this.query(sql);
  }

  /**
   * 根据 ID 获取账号
   */
  getAccountById(id) {
    const sql = `
      SELECT id, alias, platform, group_name, custom_url, status,
             followers, following, posts, total_views,
             real_name, username, user_id, avatar, base64_avatar, trend_data,
             created_at
      FROM ${this.table}
      WHERE id = ?
    `;
    return this.get(sql, [id]);
  }

  /**
   * 根据别名获取账号
   */
  getAccountByAlias(alias, platform) {
    const sql = `
      SELECT id, alias, platform, group_name, custom_url, status,
             followers, following, posts, total_views,
             real_name, username, user_id, avatar, base64_avatar, trend_data,
             created_at
      FROM ${this.table}
      WHERE alias = ? AND platform = ?
    `;
    return this.get(sql, [alias, platform]);
  }

  /**
   * 创建新账号
   */
  createAccount(alias, platform, group_name = '默认分组', custom_url = null, proxy = '') {
    const sql = `
      INSERT INTO ${this.table} (alias, platform, group_name, custom_url, proxy, status)
      VALUES (?, ?, ?, ?, ?, '等待扫码')
    `;
    const result = this.execute(sql, [alias, platform, group_name, custom_url, proxy]);
    return result.lastInsertRowid;
  }

  /**
   * 更新账号信息 - 核心 upsert 逻辑
   *
   * @param {number} accountId
   * @param {object} data - { real_name, avatar, user_id, followers, total_views, ... }
   * @param {object} opts - { platform, fixAlias, setStatus }
   * @returns {Promise<{success: boolean, reason?: string}>}
   */
  async upsertAccountProfile(accountId, data, opts = {}) {
    const { platform, fixAlias = true, setStatus = false } = opts;

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

      this.execute(
        `UPDATE ${this.table} SET ${sets.join(', ')} WHERE id = ?`,
        [
          data.real_name || '',
          data.avatar || '',
          data.user_id || '',
          data.followers || 0, data.followers || 0,
          data.total_views || 0, data.total_views || 0,
          accountId
        ]
      );

      // 4. 别名修正：待绑定_xxx → 真实昵称
      if (fixAlias && data.real_name) {
        this.execute(
          `UPDATE ${this.table} SET alias = ? WHERE id = ? AND alias LIKE '待绑定_%'`,
          [data.real_name, accountId]
        );
      }

      // 5. 头像本地缓存（fire-and-forget）
      if (data.avatar) {
        cacheAvatar(accountId, data.avatar).catch(() => {});
      }

      return { success: true };
    } catch (e) {
      console.error(`[AccountRepository] 入库失败 #${accountId}:`, e.message);
      return { success: false, reason: e.message };
    }
  }

  /**
   * 更新账号状态
   */
  updateAccountStatus(accountId, status) {
    const sql = `UPDATE ${this.table} SET status = ? WHERE id = ?`;
    this.execute(sql, [status, accountId]);
  }

  /**
   * 更新账号统计信息
   */
  updateAccountStats(accountId, stats) {
    const { followers, following, posts, total_views, real_name, username, user_id, avatar } = stats;

    const sets = [];
    const params = [];

    if (followers !== undefined) {
      sets.push('followers = ?');
      params.push(followers);
    }
    if (following !== undefined) {
      sets.push('following = ?');
      params.push(following);
    }
    if (posts !== undefined) {
      sets.push('posts = ?');
      params.push(posts);
    }
    if (total_views !== undefined) {
      sets.push('total_views = ?');
      params.push(total_views);
    }
    if (real_name !== undefined) {
      sets.push('real_name = ?');
      params.push(real_name);
    }
    if (username !== undefined) {
      sets.push('username = ?');
      params.push(username);
    }
    if (user_id !== undefined) {
      sets.push('user_id = ?');
      params.push(user_id);
    }
    if (avatar !== undefined) {
      sets.push('avatar = ?');
      params.push(avatar);
    }

    if (sets.length === 0) return;

    params.push(accountId);
    const sql = `UPDATE ${this.table} SET ${sets.join(', ')} WHERE id = ?`;
    this.execute(sql, params);
  }

  /**
   * 更新账号分组
   */
  updateAccountGroup(accountId, newGroup) {
    const sql = `UPDATE ${this.table} SET group_name = ? WHERE id = ?`;
    this.execute(sql, [newGroup, accountId]);
  }

  /**
   * 更新账号别名
   */
  updateAccountAlias(accountId, newAlias) {
    const sql = `UPDATE ${this.table} SET alias = ? WHERE id = ?`;
    this.execute(sql, [newAlias, accountId]);
  }

  /**
   * 删除账号 - 带级联清理
   */
  deleteAccount(accountId) {
    // 事务删除关联数据
    const tx = this.db.transaction(() => {
      this.execute(`DELETE FROM ${this.table} WHERE id = ?`, [accountId]);
      this.execute(`DELETE FROM daily_stats WHERE account_id = ?`, [accountId]);

      const videos = this.query(`SELECT id FROM videos WHERE account_id = ?`, [accountId]);
      videos.forEach(video => {
        this.execute(`DELETE FROM video_metrics WHERE video_id = ?`, [video.id]);
      });
      this.execute(`DELETE FROM videos WHERE account_id = ?`, [accountId]);
    });
    tx();
  }

  /**
   * 检查账号是否存在
   */
  accountExists(accountId) {
    return this.exists(`${this.table}.id = ?`, [accountId]);
  }

  /**
   * 获取账号数量
   */
  getAccountCount() {
    return this.count(this.table);
  }

  /**
   * 获取账号历史数据
   */
  getAccountDataHistory(accountId, platform) {
    const sql = `
      SELECT date as fetch_date, fans_gain as fans, plays, interactions as likes
      FROM daily_stats
      WHERE account_id = ? AND platform = ?
      ORDER BY date DESC LIMIT 7
    `;
    const history = this.query(sql, [accountId, platform]);
    return { success: true, data: history.reverse() };
  }

  /**
   * 批量获取账号统计
   */
  getDashboardStats() {
    const stats = this.get(`
      SELECT
        SUM(IFNULL(followers, 0)) as total_followers,
        SUM(IFNULL(total_views, 0)) as total_views
      FROM ${this.table}
    `);

    const platformStats = this.query(`
      SELECT platform, COUNT(*) as count,
             SUM(IFNULL(followers, 0)) as platform_followers,
             SUM(IFNULL(total_views, 0)) as platform_views
      FROM ${this.table}
      GROUP BY platform
    `);

    return {
      success: true,
      data: {
        totalViews: stats.total_views || 0,
        totalFollowers: stats.total_followers || 0,
        platforms: platformStats.map(p => ({
          name: p.platform,
          count: p.count,
          followers: p.platform_followers
        }))
      }
    };
  }

  /**
   * 获取全局统计
   */
  getGlobalStats() {
    const stats = this.get(`
      SELECT
        SUM(IFNULL(followers, 0)) as total_followers,
        SUM(IFNULL(total_views, 0)) as total_views
      FROM ${this.table}
    `);

    const platformStats = this.query(`
      SELECT platform, COUNT(*) as count,
             SUM(IFNULL(followers, 0)) as platform_followers,
             SUM(IFNULL(total_views, 0)) as platform_views
      FROM ${this.table}
      GROUP BY platform
    `);

    return {
      totalPlays: (stats.total_views || 0).toLocaleString() + ' W',
      totalFans: (stats.total_followers || 0).toLocaleString(),
      interactions: '0 W',
      revenue: '¥0',
      trends: { plays: '+0%', fans: '+0%', interactions: '+0%', revenue: '+0%' },
      platformBreakdown: platformStats.map(p => ({
        name: p.platform,
        count: p.count,
        followers: p.platform_followers,
        views: p.platform_views
      }))
    };
  }

  /**
   * 获取风险统计
   */
  getRiskStats() {
    const accounts = this.query(`
      SELECT id, alias, platform, status
      FROM ${this.table}
    `);

    let warningCount = 0;
    const mappedAccounts = accounts.map(acc => {
      const isAbnormal = (acc.status === '异常' || acc.status === '封禁' ||
                         acc.status === '离线' || (acc.status && acc.status.includes('异常')));
      if (isAbnormal) warningCount++;

      return {
        id: acc.id,
        alias: acc.alias,
        platform: acc.platform,
        level: isAbnormal ? 'high' : 'low',
        reason: isAbnormal ? '未登录或平台拦截' : '环境指纹稳定',
        lastAction: '实时监控中',
        status: isAbnormal ? '已熔断' : '正常运行'
      };
    });

    return {
      success: true,
      data: {
        systemStatus: warningCount === 0 ? 'safe' : 'warning',
        warningCount,
        activeNodes: accounts.length,
        globalVelocity: 12.5,
        accounts: mappedAccounts
      }
    };
  }
}

// 单例
let instance = null;
export function getAccountRepository() {
  if (!instance) {
    instance = new AccountRepository();
  }
  return instance;
}
