/**
 * @file MediaRepository.js
 * @description 媒体仓储 - 媒体文件相关数据的访问入口
 *
 * 包含:
 *   - 本地媒体文件缓存
 *   - 封面图缓存
 *   - 视频元数据
 */

import { BaseRepository } from '../BaseRepository.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class MediaRepository extends BaseRepository {
  constructor() {
    super();
    this.tempCoversTable = 'temp_covers';
    // 确保表存在
    this.ensureTableExists();
  }

  /**
   * 创建临时封面表
   */
  ensureTableExists() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS temp_covers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_size INTEGER DEFAULT 0,
          file_type TEXT DEFAULT 'image',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      console.error('[MediaRepository] 创建表失败:', e.message);
    }
  }

  // ========== Temp Covers (临时封面) ==========

  /**
   * 保存临时封面
   */
  saveTempCover(filePath, fileName, fileSize, fileType = 'image') {
    const sql = `
      INSERT INTO temp_covers (file_path, file_name, file_size, file_type)
      VALUES (?, ?, ?, ?)
    `;
    const result = this.execute(sql, [filePath, fileName, fileSize, fileType]);
    return result.lastInsertRowid;
  }

  /**
   * 获取临时封面列表
   */
  getTempCovers() {
    const sql = `
      SELECT id, file_path, file_name, file_size, file_type, created_at
      FROM temp_covers
      ORDER BY created_at DESC
    `;
    return this.query(sql);
  }

  /**
   * 删除临时封面
   */
  deleteTempCover(id) {
    const cover = this.get(`SELECT file_path FROM temp_covers WHERE id = ?`, [id]);
    if (cover?.file_path) {
      try {
        fs.unlinkSync(cover.file_path);
      } catch (e) {
        console.error('[MediaRepository] 删除封面文件失败:', e.message);
      }
    }
    this.execute(`DELETE FROM temp_covers WHERE id = ?`, [id]);
  }

  /**
   * 清理过期临时封面（超过24小时）
   */
  cleanupOldTempCovers() {
    const sql = `
      DELETE FROM temp_covers
      WHERE created_at < datetime('now', '-24 hours')
    `;
    const result = this.execute(sql);
    return result.changes;
  }

  /**
   * 清空所有临时封面
   */
  clearTempCovers() {
    const covers = this.getTempCovers();
    for (const cover of covers) {
      try {
        fs.unlinkSync(cover.file_path);
      } catch (e) {
        console.error('[MediaRepository] 清理封面失败:', e.message);
      }
    }
    this.execute(`DELETE FROM temp_covers`);
  }

  // ========== Media Files ==========

  /**
   * 获取媒体文件夹中的视频
   */
  scanMediaFolder(folderPath) {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { success: true, files: [] };
    }

    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && videoExts.includes(path.extname(e.name).toLowerCase()))
      .map(e => {
        const fullPath = path.join(folderPath, e.name);
        let stat = {};
        try { stat = fs.statSync(fullPath); } catch (_) {}
        return {
          name: e.name,
          path: fullPath,
          size: stat.size || 0,
          date: stat.mtime ? stat.mtime.toISOString() : null
        };
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { success: true, files };
  }

  // ========== Avatar Cache ==========

  /**
   * 保存头像缓存
   */
  saveAvatarCache(accountId, base64Data) {
    const sql = `UPDATE accounts SET base64_avatar = ? WHERE id = ?`;
    this.execute(sql, [base64Data, accountId]);
  }

  /**
   * 获取头像缓存
   */
  getAvatarCache(accountId) {
    const result = this.get(`SELECT base64_avatar FROM accounts WHERE id = ?`, [accountId]);
    return result?.base64_avatar || null;
  }

  /**
   * 检查头像缓存是否存在
   */
  hasAvatarCache(accountId) {
    const result = this.get(`SELECT base64_avatar FROM accounts WHERE id = ?`, [accountId]);
    return !!result?.base64_avatar;
  }

  // ========== User Data Paths ==========

  /**
   * 获取用户数据目录
   */
  getUserDataPath() {
    return app.getPath('userData');
  }

  /**
   * 获取浏览器配置文件路径
   */
  getBrowserProfilePath(accountId) {
    const userDataPath = this.getUserDataPath();
    return path.join(userDataPath, 'playwright_profiles', `chrome_data_${accountId}`);
  }

  /**
   * 获取分区路径
   */
  getPartitionPath(accountId) {
    const userDataPath = this.getUserDataPath();
    return path.join(userDataPath, 'Partitions', `chrome_data_${accountId}`);
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  getFileStats(filePath) {
    try {
      return fs.statSync(filePath);
    } catch (e) {
      return null;
    }
  }

  /**
   * 删除文件
   */
  deleteFile(filePath) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      console.error('[MediaRepository] 删除文件失败:', e.message);
      return false;
    }
  }

  /**
   * 创建目录
   */
  ensureDirectory(dirPath) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch (e) {
      console.error('[MediaRepository] 创建目录失败:', e.message);
      return false;
    }
  }
}

// 单例
let instance = null;
export function getMediaRepository() {
  if (!instance) {
    instance = new MediaRepository();
  }
  return instance;
}
