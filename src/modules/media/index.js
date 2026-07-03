/**
 * @file src/modules/media/index.js
 * @description 媒体模块 - 媒体文件管理业务逻辑
 *
 * 职责:
 *   - 临时封面管理
 *   - 媒体文件扫描
 *   - 头像缓存管理
 */

import { getMediaRepository } from '../../core/database/index.js';

/**
 * 媒体服务类
 * 封装媒体相关的业务逻辑
 */
export class MediaService {
  constructor() {
    this.repository = getMediaRepository();
  }

  /**
   * 保存临时封面
   */
  saveTempCover(filePath, fileName, fileSize, fileType = 'image') {
    return this.repository.saveTempCover(filePath, fileName, fileSize, fileType);
  }

  /**
   * 获取临时封面列表
   */
  getTempCovers() {
    return this.repository.getTempCovers();
  }

  /**
   * 删除临时封面
   */
  deleteTempCover(id) {
    this.repository.deleteTempCover(id);
  }

  /**
   * 清理过期临时封面
   */
  cleanupOldTempCovers() {
    return this.repository.cleanupOldTempCovers();
  }

  /**
   * 扫描媒体文件夹
   */
  scanMediaFolder(folderPath) {
    return this.repository.scanMediaFolder(folderPath);
  }

  /**
   * 保存头像缓存
   */
  saveAvatarCache(accountId, base64Data) {
    this.repository.saveAvatarCache(accountId, base64Data);
  }

  /**
   * 获取头像缓存
   */
  getAvatarCache(accountId) {
    return this.repository.getAvatarCache(accountId);
  }

  /**
   * 检查头像缓存
   */
  hasAvatarCache(accountId) {
    return this.repository.hasAvatarCache(accountId);
  }

  /**
   * 获取用户数据路径
   */
  getUserDataPath() {
    return this.repository.getUserDataPath();
  }

  /**
   * 获取浏览器配置文件路径
   */
  getBrowserProfilePath(accountId) {
    return this.repository.getBrowserProfilePath(accountId);
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filePath) {
    return this.repository.fileExists(filePath);
  }

  /**
   * 删除文件
   */
  deleteFile(filePath) {
    return this.repository.deleteFile(filePath);
  }
}

// 导出单例
let instance = null;
export function getMediaService() {
  if (!instance) {
    instance = new MediaService();
  }
  return instance;
}
