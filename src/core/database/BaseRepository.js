/**
 * @file BaseRepository.js
 * @description 基础仓储类 - 所有仓储的父类
 *
 * 提供:
 *   - 统一的 DB 实例访问
 *   - 共享的 CRUD 辅助方法
 *   - 事务包装器
 *   - 错误标准化
 */

import { getDB } from './index.js';

/**
 * 错误类型常量
 */
export const ERROR_TYPES = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  INTEGRITY: 'INTEGRITY',
  DATABASE: 'DATABASE',
  TIMEOUT: 'TIMEOUT'
};

/**
 * 标准化数据库错误
 */
export function normalizeError(error, context = {}) {
  const message = error.message || 'Database error';

  // 检查是否为 SQLite 错误
  if (error.code) {
    // 外键约束失败
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error.message.includes('FOREIGN KEY')) {
      return {
        ...error,
        name: ERROR_TYPES.INTEGRITY,
        message: `数据关联约束失败: ${context.action || '操作'}无法完成`
      };
    }

    // 唯一性约束失败
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE')) {
      return {
        ...error,
        name: ERROR_TYPES.INTEGRITY,
        message: `数据唯一性约束失败: ${context.field || '字段'}已存在`
      };
    }
  }

  return {
    ...error,
    name: ERROR_TYPES.DATABASE,
    message: `数据库操作失败: ${message}`
  };
}

/**
 * 事务包装器
 */
export async function withTransaction(callback) {
  const db = getDB();
  const transaction = db.transaction(callback);
  return transaction();
}

/**
 * 基础仓储类
 */
export class BaseRepository {
  constructor() {
    this.db = getDB();
  }

  /**
   * 获取数据库实例
   */
  getDatabase() {
    return this.db;
  }

  /**
   * 执行查询
   */
  query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      throw normalizeError(error, { sql, params });
    }
  }

  /**
   * 执行单行查询
   */
  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (error) {
      throw normalizeError(error, { sql, params });
    }
  }

  /**
   * 执行插入/更新/删除
   */
  execute(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    } catch (error) {
      throw normalizeError(error, { sql, params });
    }
  }

  /**
   * 批量插入
   */
  bulkInsert(table, rows, columns) {
    if (!rows.length) return [];

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    const results = [];
    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(sql);
      for (const row of rows) {
        results.push(stmt.run(...row));
      }
    });
    tx();

    return results;
  }

  /**
   * 事务执行
   */
  async transaction(callback) {
    return withTransaction(callback);
  }

  /**
   * 检查记录是否存在
   */
  exists(table, whereClause, params = []) {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${whereClause}) as exists`;
    const result = this.get(sql, params);
    return !!result?.exists;
  }

  /**
   * 获取计数
   */
  count(table, whereClause = '1=1', params = []) {
    const sql = `SELECT COUNT(*) as cnt FROM ${table} WHERE ${whereClause}`;
    const result = this.get(sql, params);
    return result?.cnt || 0;
  }
}
