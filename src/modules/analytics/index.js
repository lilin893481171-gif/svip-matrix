/**
 * @file src/modules/analytics/index.js
 * @description 分析模块 - 数据分析业务逻辑
 *
 * 职责:
 *   - 评论消息管理
 *   - 统计数据汇总
 *   - 平台分析报告
 */

import { getAnalyticsRepository } from '../../core/database/index.js';

/**
 * 分析服务类
 * 封装分析相关的业务逻辑
 */
export class AnalyticsService {
  constructor() {
    this.repository = getAnalyticsRepository();
  }

  /**
   * 获取所有消息
   */
  getAllMessages() {
    return this.repository.getAllMessages();
  }

  /**
   * 获取指定账号的消息
   */
  getMessagesByAccount(accountAlias, platform) {
    return this.repository.getMessagesByAccount(accountAlias, platform);
  }

  /**
   * 获取未回复的消息
   */
  getUnrepliedMessages() {
    return this.repository.getUnrepliedMessages();
  }

  /**
   * 创建消息
   */
  createMessage(messageData) {
    return this.repository.createMessage(messageData);
  }

  /**
   * 更新消息回复
   */
  updateMessageReply(messageId, replyContent, status = '已回复') {
    this.repository.updateMessageReply(messageId, replyContent, status);
  }

  /**
   * 获取平台整体分析
   */
  getPlatformAnalytics() {
    return this.repository.getPlatformAnalytics();
  }

  /**
   * 获取时间序列数据
   */
  getTimeSeriesData(days = 30) {
    return this.repository.getTimeSeriesData(days);
  }

  /**
   * 获取账号统计汇总
   */
  getAccountStatsSummary(accountId) {
    return this.repository.getAccountStatsSummary(accountId);
  }
}

// 导出单例
let instance = null;
export function getAnalyticsService() {
  if (!instance) {
    instance = new AnalyticsService();
  }
  return instance;
}
