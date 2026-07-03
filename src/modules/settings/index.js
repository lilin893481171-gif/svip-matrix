/**
 * @file src/modules/settings/index.js
 * @description 设置模块 - 应用设置管理业务逻辑
 *
 * 职责:
 *   - 应用配置管理
 *   - 用户偏好存储
 *   - 系统设置维护
 */

import { getSettingsRepository } from '../../core/database/index.js';

/**
 * 设置服务类
 * 封装设置相关的业务逻辑
 */
export class SettingsService {
  constructor() {
    this.repository = getSettingsRepository();
  }

  /**
   * 获取所有设置
   */
  getAllSettings() {
    return this.repository.getAllSettings();
  }

  /**
   * 获取单个设置
   */
  getSetting(key, defaultValue = null) {
    return this.repository.getSetting(key, defaultValue);
  }

  /**
   * 设置值
   */
  setSetting(key, value) {
    this.repository.setSetting(key, value);
  }

  /**
   * 批量设置
   */
  bulkSetSettings(settings) {
    this.repository.bulkSetSettings(settings);
  }

  /**
   * 删除设置
   */
  deleteSetting(key) {
    this.repository.deleteSetting(key);
  }

  // ========== Theme ==========

  getTheme() {
    return this.repository.getTheme();
  }

  setTheme(theme) {
    this.repository.setTheme(theme);
  }

  // ========== Language ==========

  getLanguage() {
    return this.repository.getLanguage();
  }

  setLanguage(lang) {
    this.repository.setLanguage(lang);
  }

  // ========== Update ==========

  isAutoCheckUpdateEnabled() {
    return this.repository.isAutoCheckUpdateEnabled();
  }

  setAutoCheckUpdate(enabled) {
    this.repository.setAutoCheckUpdate(enabled);
  }

  // ========== Notification ==========

  isNotificationEnabled() {
    return this.repository.isNotificationEnabled();
  }

  setNotificationEnabled(enabled) {
    this.repository.setNotificationEnabled(enabled);
  }

  // ========== Debug ==========

  isDebugMode() {
    return this.repository.isDebugMode();
  }

  setDebugMode(enabled) {
    this.repository.setDebugMode(enabled);
  }

  getLogLevel() {
    return this.repository.getLogLevel();
  }

  setLogLevel(level) {
    this.repository.setLogLevel(level);
  }
}

// 导出单例
let instance = null;
export function getSettingsService() {
  if (!instance) {
    instance = new SettingsService();
  }
  return instance;
}
