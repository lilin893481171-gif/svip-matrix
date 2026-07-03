/**
 * @file src/core/database/index.js
 * @description 统一数据库访问入口 - Sprint 2 Repository Pattern 架构
 *
 * 职责:
 *   - 初始化数据库
 *   - 提供数据库实例
 *   - 导出所有 Repository
 *   - 提供数据库工具函数
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// 导入底层实现
import {
  getDB as getOriginalDB,
  initDatabase as initOriginalDB,
  closeDatabase as closeOriginalDB,
  registerDatabaseIPC as registerOriginalDatabaseIPC
} from '../main/database.js';

// 导出 Repository 类
export { BaseRepository, ERROR_TYPES, normalizeError, withTransaction } from './BaseRepository.js';
export { AccountRepository, getAccountRepository } from './repository/AccountRepository.js';
export { EmailRepository, getEmailRepository } from './repository/EmailRepository.js';
export { PublishRepository, getPublishRepository } from './repository/PublishRepository.js';
export { AnalyticsRepository, getAnalyticsRepository } from './repository/AnalyticsRepository.js';
export { MediaRepository, getMediaRepository } from './repository/MediaRepository.js';
export { SettingsRepository, getSettingsRepository } from './repository/SettingsRepository.js';

// 数据库实例（单例）
let db = null;

/**
 * 初始化数据库
 */
export function initDatabase() {
  if (db) return db;
  db = initOriginalDB();
  return db;
}

/**
 * 获取数据库实例
 */
export function getDB() {
  if (!db) {
    throw new Error("数据库尚未初始化！请先调用 initDatabase()");
  }
  return db;
}

/**
 * 关闭数据库
 */
export function closeDatabase() {
  closeOriginalDB();
  db = null;
}

/**
 * 注册数据库 IPC
 */
export function registerDatabaseIPC() {
  registerOriginalDatabaseIPC();
}

/**
 * 数据库工具函数
 */
export const DBUtils = {
  /**
   * 格式化日期
   */
  formatDate(date) {
    try {
      const { format } = await import('date-fns');
      return format(date, 'yyyy-MM-dd');
    } catch {
      return date.toISOString().split('T')[0];
    }
  },

  /**
   * 安全添加列
   */
  safeAddColumn(db, table, column, type, defaultValue = '') {
    try {
      const columnExists = db.prepare(`
        SELECT name FROM pragma_table_info(?) WHERE name = ?
      `).get(table, column);

      if (!columnExists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultValue};`);
        console.log(`✅ 成功为${table}表添加${column}字段`);
      }
    } catch (e) {
      console.warn(`⚠️ 添加${table}.${column}字段失败：`, e.message);
    }
  },

  /**
   * 事务执行
   */
  transaction(db, callback) {
    const transaction = db.transaction(callback);
    return transaction();
  },

  /**
   * 批量插入
   */
  bulkInsert(db, table, rows, columns) {
    if (!rows.length) return [];

    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);

    const results = [];
    const tx = db.transaction(() => {
      for (const row of rows) {
        results.push(stmt.run(row));
      }
    });
    tx();

    return results;
  }
};

// 导出表结构常量
export const TABLES = {
  ACCOUNTS: 'accounts',
  DAILY_STATS: 'daily_stats',
  VIDEOS: 'videos',
  VIDEO_METRICS: 'video_metrics',
  MESSAGES: 'messages',
  EMAIL_ACCOUNTS: 'email_accounts',
  EMAIL_MESSAGES: 'email_messages',
  EMAIL_DRAFTS: 'email_drafts',
  TEMP_COVERS: 'temp_covers',
  APP_SETTINGS: 'app_settings'
};

// 导出默认数据库路径
export const DB_PATH = path.join(app.getPath('userData'), 'nikola_standalone_v1.db');
