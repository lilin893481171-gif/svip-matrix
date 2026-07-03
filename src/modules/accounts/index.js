/**
 * @file src/modules/accounts/index.js
 * @description 账号模块 - 账号管理业务逻辑
 *
 * 职责:
 *   - 账号生命周期管理
 *   - 账号同步任务调度
 *   - 账号状态监控
 */

import { getAccountRepository } from '../../core/database/repository/AccountRepository.js';
import { getDB } from '../../core/database/index.js';

/**
 * 账号服务类
 * 封装账号相关的业务逻辑
 */
export class AccountService {
  constructor() {
    this.repository = getAccountRepository();
  }

  /**
   * 获取所有账号
   */
  getAllAccounts() {
    return this.repository.getAllAccounts();
  }

  /**
   * 获取账号详情
   */
  getAccountById(id) {
    return this.repository.getAccountById(id);
  }

  /**
   * 创建新账号
   */
  createAccount(alias, platform, group_name = '默认分组', custom_url = null) {
    return this.repository.createAccount(alias, platform, group_name, custom_url);
  }

  /**
   * 更新账号配置
   */
  updateAccountConfig(accountId, config) {
    const { alias, group_name, custom_url } = config;

    if (alias !== undefined) {
      this.repository.updateAccountAlias(accountId, alias);
    }
    if (group_name !== undefined) {
      this.repository.updateAccountGroup(accountId, group_name);
    }
    if (custom_url !== undefined) {
      // custom_url 更新逻辑
      const sql = `UPDATE accounts SET custom_url = ? WHERE id = ?`;
      getDB().prepare(sql).run(custom_url, accountId);
    }
  }

  /**
   * 删除账号
   */
  deleteAccount(accountId) {
    this.repository.deleteAccount(accountId);
  }

  /**
   * 更新账号状态
   */
  updateAccountStatus(accountId, status) {
    this.repository.updateAccountStatus(accountId, status);
  }

  /**
   * 同步账号统计数据
   */
  async syncAccountStats(accountId, platform, stats) {
    // 更新账号概览
    await this.repository.upsertAccountProfile(accountId, stats, {
      platform,
      setStatus: true
    });
  }

  /**
   * 获取账号统计数据
   */
  getAccountStats(accountId, platform) {
    return this.repository.getAccountDataHistory(accountId, platform);
  }

  /**
   * 获取仪表盘统计
   */
  getDashboardStats() {
    return this.repository.getDashboardStats();
  }

  /**
   * 获取风险统计
   */
  getRiskStats() {
    return this.repository.getRiskStats();
  }
}

// 导出单例
let instance = null;
export function getAccountService() {
  if (!instance) {
    instance = new AccountService();
  }
  return instance;
}
