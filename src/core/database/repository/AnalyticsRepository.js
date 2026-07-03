/**
 * @file AnalyticsRepository.js
 * @description 分析仓储 - 分析相关数据的访问入口
 *
 * 包含:
 *   - messages 表操作（评论消息）
 *   - daily_stats 汇总分析
 */

import { BaseRepository } from '../BaseRepository.js';

export class AnalyticsRepository extends BaseRepository {
  constructor() {
    super();
    this.messagesTable = 'messages';
    this.dailyStatsTable = 'daily_stats';
  }

  // ========== Messages (评论消息) ==========

  /**
   * 获取所有消息
   */
  getAllMessages() {
    const sql = `
      SELECT id, platform, account_alias, username, avatar, video_cover,
             content, time, type, status, reply_content
      FROM ${this.messagesTable}
      ORDER BY id DESC
    `;
    return this.query(sql);
  }

  /**
   * 获取指定账号的消息
   */
  getMessagesByAccount(accountAlias, platform) {
    const sql = `
      SELECT id, platform, account_alias, username, avatar, video_cover,
             content, time, type, status, reply_content
      FROM ${this.messagesTable}
      WHERE account_alias = ? AND platform = ?
      ORDER BY id DESC
    `;
    return this.query(sql, [accountAlias, platform]);
  }

  /**
   * 获取未回复的消息
   */
  getUnrepliedMessages() {
    const sql = `
      SELECT id, platform, account_alias, username, avatar, video_cover,
             content, time, type, status, reply_content
      FROM ${this.messagesTable}
      WHERE status = '未回复'
      ORDER BY id DESC
    `;
    return this.query(sql);
  }

  /**
   * 获取消息详情
   */
  getMessageById(id) {
    const sql = `
      SELECT id, platform, account_alias, username, avatar, video_cover,
             content, time, type, status, reply_content
      FROM ${this.messagesTable}
      WHERE id = ?
    `;
    return this.get(sql, [id]);
  }

  /**
   * 创建消息
   */
  createMessage(messageData) {
    const { platform, accountAlias, username, avatar, videoCover,
            content, time, type = '评论', status = '未回复', replyContent = null } = messageData;

    const sql = `
      INSERT INTO ${this.messagesTable}
      (platform, account_alias, username, avatar, video_cover, content, time, type, status, reply_content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = this.execute(sql, [
      platform, accountAlias, username, avatar, videoCover,
      content, time, type, status, replyContent
    ]);
    return result.lastInsertRowid;
  }

  /**
   * 更新消息回复
   */
  updateMessageReply(messageId, replyContent, status = '已回复') {
    const sql = `
      UPDATE ${this.messagesTable}
      SET status = ?, reply_content = ?
      WHERE id = ?
    `;
    this.execute(sql, [status, replyContent, messageId]);
  }

  /**
   * 批量更新消息状态
   */
  bulkUpdateMessageStatus(messageIds, status) {
    const placeholders = messageIds.map(() => '?').join(', ');
    const sql = `UPDATE ${this.messagesTable} SET status = ? WHERE id IN (${placeholders})`;
    this.execute(sql, [status, ...messageIds]);
  }

  /**
   * 删除消息
   */
  deleteMessage(id) {
    this.execute(`DELETE FROM ${this.messagesTable} WHERE id = ?`, [id]);
  }

  // ========== Daily Stats (每日统计) ==========

  /**
   * 获取所有账号的每日统计
   */
  getAllDailyStats() {
    const sql = `
      SELECT id, account_id, platform, date, plays, fans_gain, interactions, revenue, conversion_rate
      FROM ${this.dailyStatsTable}
      ORDER BY date DESC
    `;
    return this.query(sql);
  }

  /**
   * 获取指定平台的统计数据
   */
  getStatsByPlatform(platform) {
    const sql = `
      SELECT id, account_id, platform, date, plays, fans_gain, interactions, revenue, conversion_rate
      FROM ${this.dailyStatsTable}
      WHERE platform = ?
      ORDER BY date DESC
    `;
    return this.query(sql, [platform]);
  }

  /**
   * 获取账号的统计汇总
   */
  getAccountStatsSummary(accountId) {
    const sql = `
      SELECT
        COUNT(*) as stat_days,
        SUM(plays) as total_plays,
        SUM(fans_gain) as total_fans,
        SUM(interactions) as total_interactions,
        SUM(revenue) as total_revenue,
        AVG(conversion_rate) as avg_conversion_rate
      FROM ${this.dailyStatsTable}
      WHERE account_id = ?
    `;
    return this.get(sql, [accountId]);
  }

  /**
   * 获取最新统计（按平台分组）
   */
  getLatestStatsByPlatform() {
    const sql = `
      SELECT DISTINCT ON (platform)
        platform, account_id, date, plays, fans_gain, interactions, revenue, conversion_rate
      FROM ${this.dailyStatsTable}
      ORDER BY platform, date DESC
    `;
    // SQLite 不支持 DISTINCT ON，使用子查询
    const subQuery = `
      SELECT platform, MAX(date) as latest_date
      FROM ${this.dailyStatsTable}
      GROUP BY platform
    `;
    const platforms = this.query(subQuery);

    const results = [];
    for (const p of platforms) {
      const stats = this.get(
        `SELECT * FROM ${this.dailyStatsTable} WHERE platform = ? AND date = ?`,
        [p.platform, p.latest_date]
      );
      if (stats) results.push(stats);
    }
    return results;
  }

  // ========== Combined Analytics ==========

  /**
   * 获取平台整体分析
   */
  getPlatformAnalytics() {
    const accounts = this.query(`
      SELECT platform, COUNT(*) as count,
             SUM(followers) as total_followers,
             SUM(total_views) as total_views
      FROM accounts
      GROUP BY platform
    `);

    const stats = this.get(`
      SELECT
        SUM(fans_gain) as total_fans_gain,
        SUM(interactions) as total_interactions,
        SUM(revenue) as total_revenue
      FROM daily_stats
    `);

    return {
      accounts: accounts,
      totalFansGain: stats?.total_fans_gain || 0,
      totalInteractions: stats?.total_interactions || 0,
      totalRevenue: stats?.total_revenue || 0
    };
  }

  /**
   * 获取时间序列数据（用于图表）
   */
  getTimeSeriesData(days = 30) {
    const sql = `
      SELECT date, SUM(plays) as total_plays, SUM(fans_gain) as total_fans
      FROM ${this.dailyStatsTable}
      WHERE date >= date('now', '-${days} days')
      GROUP BY date
      ORDER BY date ASC
    `;
    return this.query(sql);
  }
}

// 单例
let instance = null;
export function getAnalyticsRepository() {
  if (!instance) {
    instance = new AnalyticsRepository();
  }
  return instance;
}
