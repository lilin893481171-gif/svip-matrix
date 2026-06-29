/**
 * @file platform-ipc-adapter.js
 * 平台 IPC 适配层 - 让 Electron 主进程能调用新架构的平台适配器
 */

import { ipcMain } from 'electron';
import { EngineSelector } from './engine-selector.js';
import { XiaohongshuAdapter } from '../rpa/adapters/xiaohongshu-adapter.js';
import { checkUserLoggedInSystemChrome } from './user-data-manager.js';
import { exportAndSerializeCookies } from './cookie-manager.js';
import { deserializeCookies } from './cookie-manager.js';
import { injectCookiesBeforeNavigation } from './cookie-injector.js';
import { prePublishLoginCheck } from './login-status-checker.js';

// 全局引擎选择器实例
const engineSelector = new EngineSelector();

// 缓存已初始化的适配器实例
const adapterInstances = new Map();

/**
 * 获取或创建适配器实例
 * @param {string} platform - 平台名称
 * @param {Object} task - 任务数据
 * @returns {Promise<Object>} 适配器实例
 */
async function getAdapterInstance(platform, task) {
  const key = `${platform}-${task.accountId}`;

  // 如果已有缓存的适配器实例，直接返回
  if (adapterInstances.has(key)) {
    return adapterInstances.get(key);
  }

  // 优先尝试免同步方案
  const useSystemChrome = checkUserLoggedInSystemChrome(platform);
  console.log(`[PlatformIPC] 检查系统 Chrome 登录状态: ${platform} = ${useSystemChrome}`);

  // 选择引擎
  const engine = await engineSelector.selectEngine(useSystemChrome);

  // 创建适配器实例
  let adapter;
  switch (platform) {
    case 'xiaohongshu':
      adapter = new XiaohongshuAdapter();
      break;
    case 'douyin':
      adapter = new DouyinAdapter();
      break;
    case 'wechat-channels':
      adapter = new WechatChannelsAdapter();
      break;
    case 'bilibili':
      adapter = new BilibiliAdapter();
      break;
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }

  // 初始化适配器
  if (engine.type === 'puppeteer') {
    // 使用 Puppeteer 引擎
    const page = await engine.browser.newPage();

    // 如果不使用系统 Chrome 登录态，需要同步 Cookie
    if (!useSystemChrome && task.accountId) {
      try {
        console.log(`[PlatformIPC] 开始同步 Cookie: ${platform} - ${task.accountId}`);

        // 从内嵌浏览器导出 Cookie
        const serializedCookies = await exportAndSerializeCookies(task.accountId, platform);
        const cookies = deserializeCookies(serializedCookies);

        // 在导航前注入 Cookie
        const targetUrl = `https://creator.xiaohongshu.com/publish/publish`;
        await injectCookiesBeforeNavigation(page, cookies, targetUrl);

        console.log(`[PlatformIPC] Cookie 同步完成: ${platform} - ${task.accountId}`);
      } catch (error) {
        console.error(`[PlatformIPC] Cookie 同步失败: ${error.message}`);
        // 即使 Cookie 同步失败，也继续执行，让用户手动登录
      }
    } else {
      // 使用系统 Chrome 登录态，直接导航到发布页面
      await page.goto('https://creator.xiaohongshu.com/publish/publish', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
    }

    await adapter.init(engine.browser, page, task.config);
  } else {
    // 使用内嵌浏览器引擎（降级处理）
    throw new Error('内嵌浏览器引擎暂未实现');
  }

  // 缓存适配器实例
  adapterInstances.set(key, { adapter, engine });
  return { adapter, engine };
}

/**
 * 清理适配器实例
 * @param {string} platform - 平台名称
 * @param {Object} task - 任务数据
 */
async function cleanupAdapterInstance(platform, task) {
  const key = `${platform}-${task.accountId}`;

  if (adapterInstances.has(key)) {
    const { adapter, engine } = adapterInstances.get(key);

    // 清理适配器
    try {
      await adapter.cleanup();
    } catch (error) {
      console.error(`[PlatformIPC] 适配器清理失败: ${error.message}`);
    }

    // 断开引擎连接
    try {
      await engine.disconnect();
    } catch (error) {
      console.error(`[PlatformIPC] 引擎断开连接失败: ${error.message}`);
    }

    // 从缓存中移除
    adapterInstances.delete(key);
  }
}

/**
 * 注册平台 IPC 适配层
 */
export function registerPlatformIPC() {
  /**
   * 处理平台发布任务
   */
  ipcMain.handle('platform:publish', async (event, task) => {
    const { platform, accountId, title, description, videoPath } = task;

    console.log(`[PlatformIPC] 开始处理发布任务: ${platform} - ${accountId}`);

    try {
      // 获取适配器实例
      const { adapter, engine } = await getAdapterInstance(platform, task);

      // 发送日志到渲染进程
      const sendLog = (message) => {
        event.sender.send('platform:publish:log', {
          taskId: task.taskId,
          message,
          timestamp: new Date().toISOString()
        });
      };

      // 发送进度到渲染进程
      const sendProgress = (progress) => {
        event.sender.send('platform:publish:progress', {
          taskId: task.taskId,
          progress,
          timestamp: new Date().toISOString()
        });
      };

      sendLog(`开始发布任务 - 引擎类型: ${engine.getEngineType()}`);

      // 发布前检查登录状态
      sendLog('检查登录状态...');
      const loginCheck = await prePublishLoginCheck(adapter.page, platform);
      if (!loginCheck.canPublish) {
        throw new Error(loginCheck.message);
      }
      sendLog(loginCheck.message);

      // 1. 导航到发布页面
      sendProgress(20);
      sendLog('导航到发布页面...');
      await adapter.navigateToPublish();

      // 2. 上传视频并捕获ID
      sendProgress(40);
      sendLog(`开始上传视频: ${videoPath}`);
      const uploadResult = await adapter.uploadAndCaptureId(videoPath);
      sendLog(`视频上传完成，获得 video_file_id: ${uploadResult.video_file_id}`);

      // 3. 填写发布表单
      sendProgress(60);
      sendLog('填写发布表单...');
      await adapter.fillForm({
        title,
        description,
        videoFileId: uploadResult.video_file_id
      });

      // 4. 发布内容
      sendProgress(80);
      sendLog('开始发布内容...');
      const publishResult = await adapter.publish();

      if (publishResult.success) {
        sendProgress(100);
        sendLog('内容发布成功！');
      } else {
        sendLog(`发布失败: ${publishResult.error}`);
        throw new Error(publishResult.error);
      }

      // 清理适配器实例
      await cleanupAdapterInstance(platform, task);

      return {
        success: true,
        message: '发布任务完成',
        data: publishResult
      };
    } catch (error) {
      console.error(`[PlatformIPC] 发布任务失败: ${error.message}`);

      // 清理适配器实例
      try {
        await cleanupAdapterInstance(platform, task);
      } catch (cleanupError) {
        console.error(`[PlatformIPC] 适配器清理失败: ${cleanupError.message}`);
      }

      return {
        success: false,
        message: error.message,
        error: error.stack
      };
    }
  });

  /**
   * 测试浏览器引擎连接
   */
  ipcMain.handle('platform:test-engine', async () => {
    try {
      const engine = await engineSelector.selectEngine();
      const status = engine.getStatus();

      return {
        success: true,
        data: status
      };
    } catch (error) {
      console.error(`[PlatformIPC] 引擎测试失败: ${error.message}`);
      return {
        success: false,
        message: error.message
      };
    }
  });

  /**
   * 获取引擎状态
   */
  ipcMain.handle('platform:get-engine-status', async () => {
    try {
      const status = engineSelector.getStatus();
      return {
        success: true,
        data: status
      };
    } catch (error) {
      console.error(`[PlatformIPC] 获取引擎状态失败: ${error.message}`);
      return {
        success: false,
        message: error.message
      };
    }
  });
}

export default registerPlatformIPC;