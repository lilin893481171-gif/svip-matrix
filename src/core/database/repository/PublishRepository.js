/**
 * @file PublishRepository.js
 * @description 发布仓储 - 发布相关数据的访问入口
 *
 * 包含:
 *   - videos 表操作
 *   - video_metrics 表操作
 *   - daily_stats 表操作
 */

import { BaseRepository } from '../BaseRepository.js';

export class PublishRepository extends BaseRepository {
  constructor() {
    super();
    this.videosTable = 'videos';
    this.videoMetricsTable = 'video_metrics';
    this.dailyStatsTable = 'daily_stats';
  }

  // ========== Videos ==========

  /**
   * 获取账号的所有视频
   */
  getVideosByAccountId(accountId) {
    const sql = `
      SELECT id, title, account_id, created_at
      FROM ${this.videosTable}
      WHERE account_id = ?
      ORDER BY created_at DESC
    `;
    return this.query(sql, [accountId]);
  }

  /**
   * 根据视频 ID 获取视频
   */
  getVideoById(videoId) {
    const sql = `
      SELECT id, title, account_id, created_at
      FROM ${this.videosTable}
      WHERE id = ?
    `;
    return this.get(sql, [videoId]);
  }

  /**
   * 创建视频记录
   */
  createVideo(videoData) {
    const { id, title, accountId } = videoData;

    const sql = `
      INSERT OR REPLACE INTO ${this.videosTable} (id, title, account_id)
      VALUES (?, ?, ?)
    `;
    this.execute(sql, [id, title, accountId]);
  }

  /**
   * 删除视频
   */
  deleteVideo(videoId) {
    this.execute(`DELETE FROM ${this.videosTable} WHERE id = ?`, [videoId]);
  }

  /**
   * 删除账号的所有视频（级联清理）
   */
  deleteVideosByAccountId(accountId) {
    this.execute(`DELETE FROM ${this.videosTable} WHERE account_id = ?`, [accountId]);
  }

  // ========== Video Metrics ==========

  /**
   * 获取视频的指标记录
   */
  getVideoMetrics(videoId) {
    const sql = `
      SELECT id, video_id, record_time, velocity, total_plays
      FROM ${this.videoMetricsTable}
      WHERE video_id = ?
      ORDER BY record_time DESC
    `;
    return this.query(sql, [videoId]);
  }

  /**
   * 获取视频的最新指标
   */
  getLatestVideoMetrics(videoId) {
    const sql = `
      SELECT id, video_id, record_time, velocity, total_plays
      FROM ${this.videoMetricsTable}
      WHERE video_id = ?
      ORDER BY record_time DESC
      LIMIT 1
    `;
    return this.get(sql, [videoId]);
  }

  /**
   * 创建视频指标记录
   */
  createVideoMetric(videoMetricData) {
    const { videoId, velocity = 0, totalPlays = 0 } = videoMetricData;

    const sql = `
      INSERT INTO ${this.videoMetricsTable} (video_id, velocity, total_plays)
      VALUES (?, ?, ?)
    `;
    const result = this.execute(sql, [videoId, velocity, totalPlays]);
    return result.lastInsertRowid;
  }

  /**
   * 批量插入视频指标
   */
  bulkInsertVideoMetrics(metrics) {
    const sql = `
      INSERT INTO ${this.videoMetricsTable} (video_id, velocity, total_plays)
      VALUES (?, ?, ?)
    `;

    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(sql);
      for (const m of metrics) {
        stmt.run(m.videoId, m.velocity || 0, m.totalPlays || 0);
      }
    });
    tx();
  }

  // ========== Daily Stats ==========

  /**
   * 获取账号的每日统计数据
   */
  getDailyStatsByAccountId(accountId, platform) {
    const sql = `
      SELECT id, account_id, platform, date, plays, fans_gain, interactions, revenue, conversion_rate
      FROM ${this.dailyStatsTable}
      WHERE account_id = ? AND platform = ?
      ORDER BY date DESC
    `;
    return this.query(sql, [accountId, platform]);
  }

  /**
   * 获取账号的最近 N 天统计
   */
  getRecentDailyStats(accountId, platform, days = 7) {
    const sql = `
      SELECT id, account_id, platform, date, plays, fans_gain, interactions, revenue, conversion_rate
      FROM ${this.dailyStatsTable}
      WHERE account_id = ? AND platform = ?
      ORDER BY date DESC
      LIMIT ?
    `;
    return this.query(sql, [accountId, platform, days]);
  }

  /**
   * 创建或更新每日统计（UPSERT）
   */
  upsertDailyStats(statsData) {
    const { accountId, platform, date, plays = 0, fansGain = 0, interactions = 0, revenue = 0, conversionRate = 0 } = statsData;

    const sql = `
      INSERT INTO ${this.dailyStatsTable}
      (account_id, platform, date, plays, fans_gain, interactions, revenue, conversion_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, platform, date) DO UPDATE SET
        plays = excluded.plays,
        fans_gain = excluded.fans_gain,
        interactions = excluded.interactions,
        revenue = excluded.revenue,
        conversion_rate = excluded.conversion_rate
    `;
    this.execute(sql, [accountId, platform, date, plays, fansGain, interactions, revenue, conversionRate]);
  }

  /**
   * 获取账号的汇总统计
   */
  getAccountSummary(accountId) {
    const sql = `
      SELECT
        COUNT(*) as total_days,
        SUM(plays) as total_plays,
        SUM(fans_gain) as total_fans,
        SUM(interactions) as total_interactions,
        SUM(revenue) as total_revenue
      FROM ${this.dailyStatsTable}
      WHERE account_id = ?
    `;
    return this.get(sql, [accountId]);
  }

  // ========== Combined Operations ==========

  /**
   * 获取视频及其指标
   */
  getVideosWithMetrics(accountId) {
    const sql = `
      SELECT v.id, v.title, v.account_id, v.created_at,
             vm.velocity, vm.total_plays, vm.record_time
      FROM ${this.videosTable} v
      LEFT JOIN ${this.videoMetricsTable} vm ON v.id = vm.video_id
      WHERE v.account_id = ?
      ORDER BY v.created_at DESC
    `;
    return this.query(sql, [accountId]);
  }

  /**
   * 获取带统计数据的账号列表
   */
  getAccountsWithStats() {
    const sql = `
      SELECT a.id, a.alias, a.platform, a.group_name, a.status,
             a.followers, a.following, a.posts, a.total_views,
             a.real_name, a.username, a.user_id, a.avatar,
             ds.plays, ds.fans_gain, ds.interactions, ds.revenue,
             ds.date as last_stat_date
      FROM ${this.tablePrefix}accounts a
      LEFT JOIN ${this.tablePrefix}daily_stats ds ON a.id = ds.account_id
      ORDER BY a.created_at DESC
    `;
    // Note: 需要在使用时传入正确的 tablePrefix
    return this.query(sql.replace(/tablePrefix\./g, ''));
  }
}

// 单例
let instance = null;
export function getPublishRepository() {
  if (!instance) {
    instance = new PublishRepository();
  }
  return instance;
}
