/**
 * @file user-data-manager.js
 * 用户数据管理器 - 管理 Chrome 用户数据目录
 */

import { app } from 'electron';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';

/**
 * 获取系统 Chrome 用户数据目录
 * @returns {string|null} 系统 Chrome 用户数据目录路径
 */
export function getSystemChromeUserDataDir() {
  try {
    const userDataPath = app.getPath('userData');
    const systemChromeDir = join(userDataPath, 'system-chrome-user-data');

    // 确保目录存在
    if (!existsSync(systemChromeDir)) {
      mkdirSync(systemChromeDir, { recursive: true });
    }

    return systemChromeDir;
  } catch (error) {
    console.error('[UserDataManager] 获取系统 Chrome 用户数据目录失败:', error.message);
    return null;
  }
}

/**
 * 获取 Electron 应用的 Chrome 用户数据目录
 * @returns {string} Electron 应用的 Chrome 用户数据目录路径
 */
export function getAppChromeUserDataDir() {
  try {
    const userDataPath = app.getPath('userData');
    const appChromeDir = join(userDataPath, 'chrome-user-data');

    // 确保目录存在
    if (!existsSync(appChromeDir)) {
      mkdirSync(appChromeDir, { recursive: true });
    }

    return appChromeDir;
  } catch (error) {
    console.error('[UserDataManager] 获取应用 Chrome 用户数据目录失败:', error.message);
    return null;
  }
}

/**
 * 检查用户是否在系统 Chrome 中登录过
 * @param {string} platform - 平台名称
 * @returns {boolean} 是否在系统 Chrome 中登录过
 */
export function checkUserLoggedInSystemChrome(platform) {
  try {
    const systemChromeDir = getSystemChromeUserDataDir();
    if (!systemChromeDir || !existsSync(systemChromeDir)) {
      return false;
    }

    // 检查默认配置文件目录是否存在
    const defaultProfileDir = join(systemChromeDir, 'Default');
    if (!existsSync(defaultProfileDir)) {
      return false;
    }

    // 根据平台检查对应的 Cookie 文件
    switch (platform.toLowerCase()) {
      case 'xiaohongshu':
      case '小红书':
        // 检查是否存在小红书相关的 Cookie 或缓存
        return checkPlatformDataExists(defaultProfileDir, 'xiaohongshu');
      case 'douyin':
      case '抖音':
        return checkPlatformDataExists(defaultProfileDir, 'douyin');
      case 'bilibili':
      case 'b站':
        return checkPlatformDataExists(defaultProfileDir, 'bilibili');
      default:
        return false;
    }
  } catch (error) {
    console.error('[UserDataManager] 检查系统 Chrome 登录状态失败:', error.message);
    return false;
  }
}

/**
 * 检查平台数据是否存在
 * @param {string} profileDir - 配置文件目录
 * @param {string} platform - 平台名称
 * @returns {boolean} 平台数据是否存在
 */
function checkPlatformDataExists(profileDir, platform) {
  try {
    // 检查 Cookies 文件
    const cookiesFile = join(profileDir, 'Cookies');
    if (!existsSync(cookiesFile)) {
      return false;
    }

    // 检查 Local Storage
    const localStorageDir = join(profileDir, 'Local Storage');
    if (existsSync(localStorageDir)) {
      const files = readdirSync(localStorageDir);
      const platformFiles = files.filter(file =>
        file.toLowerCase().includes(platform.toLowerCase())
      );
      if (platformFiles.length > 0) {
        return true;
      }
    }

    // 检查 Session Storage
    const sessionStorageDir = join(profileDir, 'Session Storage');
    if (existsSync(sessionStorageDir)) {
      const files = readdirSync(sessionStorageDir);
      const platformFiles = files.filter(file =>
        file.toLowerCase().includes(platform.toLowerCase())
      );
      if (platformFiles.length > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`[UserDataManager] 检查平台数据失败 (${platform}):`, error.message);
    return false;
  }
}

/**
 * 清理旧的用户数据目录
 * @param {number} days - 保留天数
 */
export function cleanupOldUserData(days = 7) {
  try {
    const userDataPath = app.getPath('userData');
    const chromeDirs = [
      join(userDataPath, 'chrome-user-data'),
      join(userDataPath, 'system-chrome-user-data')
    ];

    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    for (const dir of chromeDirs) {
      if (existsSync(dir)) {
        cleanupDirectory(dir, cutoffTime);
      }
    }

    console.log(`[UserDataManager] 用户数据清理完成 (保留${days}天)`);
  } catch (error) {
    console.error('[UserDataManager] 清理用户数据失败:', error.message);
  }
}

/**
 * 递归清理目录
 * @param {string} dir - 目录路径
 * @param {number} cutoffTime - 截止时间
 */
function cleanupDirectory(dir, cutoffTime) {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      const stats = statSync(filePath);

      if (stats.isDirectory()) {
        // 递归清理子目录
        cleanupDirectory(filePath, cutoffTime);
      } else if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
        // 删除旧文件
        unlinkSync(filePath);
      }
    }

    // 如果目录为空，删除目录
    const remainingFiles = readdirSync(dir);
    if (remainingFiles.length === 0) {
      rmdirSync(dir);
    }
  } catch (error) {
    console.error(`[UserDataManager] 清理目录失败 (${dir}):`, error.message);
  }
}

export default {
  getSystemChromeUserDataDir,
  getAppChromeUserDataDir,
  checkUserLoggedInSystemChrome,
  cleanupOldUserData
};