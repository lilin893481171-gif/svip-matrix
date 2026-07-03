/**
 * @file SettingsRepository.js
 * @description 设置仓储 - 应用设置数据的访问入口
 *
 * 包含:
 *   - 应用配置
 *   - 用户偏好
 *   - 系统设置
 */

import { BaseRepository } from '../BaseRepository.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class SettingsRepository extends BaseRepository {
  constructor() {
    super();
    this.settingsTable = 'app_settings';
    this.ensureTableExists();
  }

  /**
   * 创建设置表
   */
  ensureTableExists() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          type TEXT DEFAULT 'string',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      console.error('[SettingsRepository] 创建表失败:', e.message);
    }
  }

  // ========== Settings Operations ==========

  /**
   * 获取所有设置
   */
  getAllSettings() {
    const sql = `SELECT key, value, type, updated_at FROM ${this.settingsTable}`;
    const rows = this.query(sql);
    const settings = {};
    for (const row of rows) {
      settings[row.key] = this.deserializeValue(row.value, row.type);
    }
    return settings;
  }

  /**
   * 根据 key 获取设置
   */
  getSetting(key, defaultValue = null) {
    const sql = `SELECT value, type FROM ${this.settingsTable} WHERE key = ?`;
    const row = this.get(sql, [key]);

    if (!row) return defaultValue;
    return this.deserializeValue(row.value, row.type);
  }

  /**
   * 设置值
   */
  setSetting(key, value) {
    const type = this.determineType(value);
    const serialized = this.serializeValue(value, type);

    const sql = `
      INSERT INTO ${this.settingsTable} (key, value, type)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `;
    this.execute(sql, [key, serialized, type]);
  }

  /**
   * 批量设置
   */
  bulkSetSettings(settings) {
    const tx = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        this.setSetting(key, value);
      }
    });
    tx();
  }

  /**
   * 删除设置
   */
  deleteSetting(key) {
    this.execute(`DELETE FROM ${this.settingsTable} WHERE key = ?`, [key]);
  }

  /**
   * 清空所有设置
   */
  clearAllSettings() {
    this.execute(`DELETE FROM ${this.settingsTable}`);
  }

  // ========== Value Serialization ==========

  /**
   * 确定值类型
   */
  determineType(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * 序列化值
   */
  serializeValue(value, type) {
    if (type === 'null') return null;
    if (type === 'boolean') return value ? '1' : '0';
    if (type === 'number') return String(value);
    if (type === 'array' || type === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * 反序列化值
   */
  deserializeValue(value, type) {
    if (value === null) return null;
    if (type === 'boolean') return value === '1';
    if (type === 'number') return parseFloat(value);
    if (type === 'array' || type === 'object') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  // ========== Default Settings ==========

  /**
   * 获取默认设置
   */
  getDefaultSettings() {
    return {
      // UI 设置
      theme: 'light',
      language: 'zh-CN',
      autoCheckUpdate: true,
      showNotification: true,
      soundEnabled: true,

      // 账号设置
      autoSyncStats: false,
      syncInterval: 3600, // 秒
      maxAccounts: 50,

      // 发布设置
      defaultPlatform: '小红书',
      autoFillTitle: true,
      enableDraftSave: true,

      // 浏览器设置
      headlessMode: false,
      proxyEnabled: false,
      useCustomUA: false,

      // 高级设置
      debugMode: false,
      logLevel: 'info',
      maxLogs: 1000
    };
  }

  /**
   * 初始化默认设置
   */
  initDefaultSettings() {
    const defaults = this.getDefaultSettings();
    const current = this.getAllSettings();

    for (const [key, value] of Object.entries(defaults)) {
      if (current[key] === undefined) {
        this.setSetting(key, value);
      }
    }

    return defaults;
  }

  // ========== Theme Settings ==========

  /**
   * 获取主题
   */
  getTheme() {
    return this.getSetting('theme', 'light');
  }

  /**
   * 设置主题
   */
  setTheme(theme) {
    this.setSetting('theme', theme);
  }

  // ========== Language Settings ==========

  /**
   * 获取语言
   */
  getLanguage() {
    return this.getSetting('language', 'zh-CN');
  }

  /**
   * 设置语言
   */
  setLanguage(lang) {
    this.setSetting('language', lang);
  }

  // ========== Update Settings ==========

  /**
   * 获取自动检查更新设置
   */
  isAutoCheckUpdateEnabled() {
    return this.getSetting('autoCheckUpdate', true);
  }

  /**
   * 设置自动检查更新
   */
  setAutoCheckUpdate(enabled) {
    this.setSetting('autoCheckUpdate', enabled);
  }

  // ========== Notification Settings ==========

  /**
   * 获取通知设置
   */
  isNotificationEnabled() {
    return this.getSetting('showNotification', true);
  }

  /**
   * 设置通知
   */
  setNotificationEnabled(enabled) {
    this.setSetting('showNotification', enabled);
  }

  // ========== Debug Settings ==========

  /**
   * 获取调试模式
   */
  isDebugMode() {
    return this.getSetting('debugMode', false);
  }

  /**
   * 设置调试模式
   */
  setDebugMode(enabled) {
    this.setSetting('debugMode', enabled);
  }

  /**
   * 获取日志级别
   */
  getLogLevel() {
    return this.getSetting('logLevel', 'info');
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level) {
    this.setSetting('logLevel', level);
  }
}

// 单例
let instance = null;
export function getSettingsRepository() {
  if (!instance) {
    instance = new SettingsRepository();
  }
  return instance;
}
