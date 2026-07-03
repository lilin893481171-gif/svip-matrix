/**
 * @file src/modules/publish/index.js
 * @description 发布模块 - 视频发布业务逻辑
 *
 * 职责:
 *   - 视频管理
   - 发布任务执行
 *   - 发布历史记录
 */

import { getPublishRepository, getAccountRepository } from '../../core/database/index.js';
import { executePublishTask } from '../../main/Publisher.js';

/**
 * 发布服务类
 * 封装发布相关的业务逻辑
 */
export class PublishService {
  constructor() {
    this.publishRepo = getPublishRepository();
    this.accountRepo = getAccountRepository();
  }

  /**
   * 获取账号的所有视频
   */
  getVideosByAccountId(accountId) {
    return this.publishRepo.getVideosByAccountId(accountId);
  }

  /**
   * 创建视频记录
   */
  createVideo(videoId, title, accountId) {
    this.publishRepo.createVideo({ id: videoId, title, accountId });
  }

  /**
   * 删除视频
   */
  deleteVideo(videoId) {
    this.publishRepo.deleteVideo(videoId);
  }

  /**
   * 获取视频指标
   */
  getVideoMetrics(videoId) {
    return this.publishRepo.getVideoMetrics(videoId);
  }

  /**
   * 记录视频指标
   */
  recordVideoMetric(videoId, velocity, totalPlays) {
    this.publishRepo.createVideoMetric({ videoId, velocity, totalPlays });
  }

  /**
   * 获取每日统计
   */
  getDailyStats(accountId, platform) {
    return this.publishRepo.getDailyStatsByAccountId(accountId, platform);
  }

  /**
   * 执行发布任务
   */
  async executePublish(taskConfig, masterTemplate, requestUrl, cookies, options = {}) {
    return await executePublishTask(taskConfig, masterTemplate, requestUrl, cookies, options);
  }

  /**
   * 获取账号的发布统计
   */
  getAccountPublishStats(accountId) {
    return this.publishRepo.getAccountSummary(accountId);
  }
}

// 导出单例
let instance = null;
export function getPublishService() {
  if (!instance) {
    instance = new PublishService();
  }
  return instance;
}
