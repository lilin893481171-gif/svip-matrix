/**
 * @file xhs-session-keeper.mjs
 * 小红书会话保持工具
 */

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';

// 获取应用路径
function getResourcesPath() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return join(app.getAppPath(), 'resources');
}

// 创建隐藏窗口用于会话保持
async function createSessionKeeper(accountId) {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // 隐藏窗口
    webPreferences: {
      partition: `persist:chrome_data_${accountId}`,
      sandbox: true,
      contextIsolation: true,
      webSecurity: true
    }
  });

  // 定期访问小红书主页维持会话
  const keepAlive = async () => {
    try {
      await window.loadURL('https://www.xiaohongshu.com');
      console.log(`[SessionKeeper] 账号${accountId}会话保持成功`);
    } catch (error) {
      console.warn(`[SessionKeeper] 账号${accountId}会话保持失败:`, error.message);
    }
  };

  // 每10分钟执行一次会话保持
  const interval = setInterval(keepAlive, 10 * 60 * 1000);

  // 初始执行
  setTimeout(keepAlive, 5000);

  // 返回清理函数
  return () => {
    clearInterval(interval);
    if (!window.isDestroyed()) {
      window.destroy();
    }
  };
}

// 检查会话有效性
async function checkSessionValidity(accountId) {
  // 这里应该实现实际的会话检查逻辑
  // 可以通过读取Cookie等方式检查
  console.log(`[SessionKeeper] 检查账号${accountId}会话有效性`);
  return true; // 临时返回true
}

export { createSessionKeeper, checkSessionValidity };