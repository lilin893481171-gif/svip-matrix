/**
 * @file PlaywrightExecutor.js
 * Playwright 任务执行器 - 管理浏览器生命周期、Cookie 注入和脚本执行
 */

import { chromium } from 'playwright-core';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

// 获取 app 对象的函数
async function getApp() {
  try {
    const electron = await import('electron');

    // Electron 模块可能以不同的方式导出 app
    const app = electron.app || electron.default?.app || electron['module.exports'];

    if (app && typeof app.getPath === 'function') {
      return app;
    } else {
      throw new Error('Could not find app with getPath method in electron module');
    }
  } catch (e) {
    // 在非 Electron 环境中，提供一个模拟的 app 对象
    const mockApp = {
      getPath: (name) => {
        // 返回一个默认的用户数据目录
        const userDataPath = process.env.APPDATA || process.env.HOME || '/tmp';
        return path.join(userDataPath, 'playwright_test');
      }
    };
    return mockApp;
  }
}

/**
 * Playwright 任务执行器
 * 负责:
 * 1. 启动和管理 Playwright 浏览器实例
 * 2. 注入 Cookie 和用户代理
 * 3. 执行平台特定的发布脚本
 * 4. 处理浏览器生命周期和异常情况
 */
export class PlaywrightExecutor {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.accountId - 账户 ID
   * @param {string} options.platform - 平台名称 (e.g., '小红书')
   * @param {Object} options.taskData - 任务数据
   * @param {Function} options.onProgress - 进度更新回调
   * @param {Function} options.onLog - 日志输出回调
   */
  constructor(options = {}) {
    this.accountId = options.accountId;
    this.platform = options.platform;
    this.taskData = options.taskData;
    this.onProgress = options.onProgress || (() => {});
    this.onLog = options.onLog || (() => {});

    // Playwright 相关
    this.context = null;
    this.page = null;

    // 进程管理
    this.pids = new Set();

    // 状态
    this.isRunning = false;
    this.isCancelled = false;

    // 浏览器窗口信息
    this.browserWindow = null;
  }

  /**
   * 启动浏览器并执行任务
   * @returns {Promise<Object>} 执行结果
   */
  async execute() {
    this.isRunning = true;
    this.isCancelled = false;

    try {
      this.onLog(`🚀 开始执行 ${this.platform} 任务 (账号: ${this.accountId})`);

      // 1. 启动浏览器
      await this._launchBrowser();

      // 2. 创建上下文并注入 Cookie
      await this._setupContext();

      // 3. 导航到目标页面
      await this._navigateToTarget();

      // 4. 执行平台脚本
      const result = await this._runPlatformScript();

      // 5. 清理资源
      await this._cleanup();

      this.onLog(`✅ ${this.platform} 任务执行完成`);
      return { success: true, data: result };

    } catch (error) {
      this.onLog(`❌ ${this.platform} 任务执行失败: ${error.message}`);
      await this._cleanup();
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 启动 Playwright 浏览器
   * @private
   */
  async _launchBrowser() {
    this.onProgress(10, '正在启动浏览器...');
    this.onLog('正在启动 Chromium 浏览器...');

    try {
      // 获取 app 对象
      const app = await getApp();

      // 创建用户数据目录
      const userDataPath = app.getPath('userData');
      const userDataDir = path.join(
        userDataPath,
        'playwright_profiles',
        `${this.accountId}_${Date.now()}`
      );

      // 使用 launchPersistentContext 启动浏览器
      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // 开发阶段设为 false 便于调试
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-popup-blocking',
          '--disable-translate',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions',
          '--disable-default-browser-check',
          '--disable-domain-reliability',
          '--disable-features=VizDisplayCompositor',
          '--disable-features=TranslateUI',
          '--disable-features=BackForwardCache',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-logging',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--no-first-run',
          '--no-default-browser-check',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });

      // 创建页面
      this.page = await this.context.newPage();

      // 注意：在 PersistentContext 模式下，我们无法直接访问浏览器进程对象
      this.onLog('浏览器启动成功');

      // 提供一些浏览器窗口信息（虽然我们无法直接控制窗口，但可以提供一些信息）
      this.onLog(`浏览器窗口已启动，可以在系统任务栏中找到并切换到该窗口进行查看`);
    } catch (error) {
      this.onLog(`浏览器启动失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 设置浏览器上下文并注入 Cookie
   * @private
   */
  async _setupContext() {
    this.onProgress(20, '正在配置浏览器上下文...');
    this.onLog('正在配置浏览器上下文...');

    try {
      // 在 launchPersistentContext 中已经创建了上下文和页面
      // 我们只需要进行一些额外的配置

      // 设置视口
      await this.page.setViewportSize({ width: 1280, height: 800 });

      // 注入 Cookie (需要从加密存储中获取)
      // await this._injectCookies();

      this.onLog('浏览器上下文配置完成');
    } catch (error) {
      this.onLog(`上下文配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 导航到目标页面
   * @private
   */
  async _navigateToTarget() {
    this.onProgress(30, '正在导航到目标页面...');
    this.onLog('正在导航到小红书发布页面...');

    try {
      // 根据平台确定目标 URL
      let targetUrl;
      switch (this.platform) {
        case '小红书':
          targetUrl = 'https://creator.xiaohongshu.com/publish/publish';
          break;
        // 其他平台...
        default:
          throw new Error(`不支持的平台: ${this.platform}`);
      }

      await this.page.goto(targetUrl, { waitUntil: 'networkidle' });
      this.onLog(`已导航到: ${targetUrl}`);
    } catch (error) {
      this.onLog(`导航失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 运行平台特定的发布脚本
   * @private
   */
  async _runPlatformScript() {
    this.onProgress(40, '正在执行发布脚本...');
    this.onLog(`正在执行 ${this.platform} 发布脚本...`);

    try {
      // 根据平台确定脚本路径
      let scriptPath;
      switch (this.platform) {
        case '小红书':
          scriptPath = path.join(
            app.getAppPath(),
            'resources',
            'rpa-scripts',
            'xiaohongshu-playwright.mjs'
          );
          break;
        // 其他平台...
        default:
          throw new Error(`不支持的平台: ${this.platform}`);
      }

      // 加载并执行脚本
      const scriptResult = await this._executeScript(scriptPath);

      this.onLog(`${this.platform} 脚本执行完成`);
      return scriptResult;
    } catch (error) {
      this.onLog(`脚本执行失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 执行具体的脚本逻辑
   * @private
   * @param {string} scriptPath - 脚本路径
   */
  async _executeScript(scriptPath) {
    const scriptName = path.basename(scriptPath);
    this.onLog(`正在加载脚本: ${scriptName}`);

    try {
      // 动态导入脚本
      const scriptModule = await import(`file://${scriptPath}`);

      // 检查脚本是否有 execute 函数
      if (typeof scriptModule.execute !== 'function') {
        throw new Error('脚本缺少 execute 函数');
      }

      // 准备 API 对象
      const api = {
        page: this.page,
        task: this.taskData,
        broadcast: (message) => {
          this.onLog(`[脚本] ${message}`);
          // 可以在这里解析消息并更新进度
          if (message.includes('Phase 0')) this.onProgress(45, '正在导航到发布页面...');
          if (message.includes('Phase 1')) this.onProgress(60, '正在上传视频...');
          if (message.includes('Phase 2')) this.onProgress(80, '正在填写表单...');
          if (message.includes('完成')) this.onProgress(90, '正在发布...');
        }
      };

      // 执行脚本
      const result = await scriptModule.execute(api);

      return result;
    } catch (error) {
      this.onLog(`脚本执行失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 注入 Cookie
   * @private
   */
  async _injectCookies() {
    // 这里将实现从加密存储读取 Cookie 并注入的逻辑
    this.onLog('正在注入 Cookie...');

    // 从加密存储中获取 Cookie
    // 注意：这需要与应用现有的 Cookie 管理机制集成
    const cookies = await this._getCookiesFromStorage();

    if (cookies && cookies.length > 0) {
      await this.context.addCookies(cookies);
      this.onLog(`Cookie 注入完成，共注入 ${cookies.length} 个 Cookie`);
    } else {
      this.onLog('未找到有效的 Cookie，跳过注入');
    }
  }

  /**
   * 从加密存储中获取 Cookie
   * @private
   * @returns {Promise<Array>} Cookie 数组
   */
  async _getCookiesFromStorage() {
    // 这里需要实现与应用现有加密存储的集成
    // 示例实现（需要根据实际的存储结构进行调整）：
    try {
      // 假设有一个函数可以从加密存储中获取 Cookie
      // const { deserializeCookies } = await import('../browser/cookie-manager.js');
      // const serializedCookies = await getSerializedCookies(this.accountId, this.platform);
      // const cookies = deserializeCookies(serializedCookies);

      // 临时返回示例数据用于测试
      return [
        {
          name: 'web_session',
          value: 'example_session_value',
          domain: '.xiaohongshu.com',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax'
        }
        // ... 更多 Cookie
      ];
    } catch (error) {
      this.onLog(`从存储中获取 Cookie 失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 验证登录态
   * @private
   * @returns {Promise<boolean>} 是否登录
   */
  async _verifyLoginStatus() {
    this.onLog('正在验证登录态...');

    try {
      // 导航到一个需要登录的页面来验证登录态
      // 例如，小红书的个人主页
      await this.page.goto('https://www.xiaohongshu.com', { waitUntil: 'networkidle' });

      // 检查页面上是否有登录用户的标识
      // 这需要根据具体页面的结构来实现
      const isLoggedIn = await this.page.evaluate(() => {
        // 示例检查逻辑（需要根据实际页面结构调整）
        const userAvatar = document.querySelector('.user-avatar');
        const loginButton = document.querySelector('.login-btn');
        return !!userAvatar && !loginButton;
      });

      if (isLoggedIn) {
        this.onLog('登录态验证成功');
        return true;
      } else {
        this.onLog('登录态验证失败，可能需要重新登录');
        return false;
      }
    } catch (error) {
      this.onLog(`登录态验证失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 清理资源
   * @private
   */
  async _cleanup() {
    this.onLog('正在清理资源...');

    try {
      // 关闭页面
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }

      // 关闭上下文
      if (this.context) {
        await this.context.close();
      }

      // 注意：在 PersistentContext 模式下，关闭上下文会自动关闭浏览器
      // 我们不需要单独关闭浏览器

      // 清理进程
      await this._killBrowserProcesses();

      this.onLog('资源清理完成');
    } catch (error) {
      this.onLog(`资源清理失败: ${error.message}`);
    }
  }

  /**
   * 强制终止浏览器相关进程
   * @private
   */
  async _killBrowserProcesses() {
    if (this.pids.size === 0) return;

    this.onLog(`正在清理 ${this.pids.size} 个浏览器进程...`);

    for (const pid of this.pids) {
      try {
        if (process.platform === 'win32') {
          await execPromise(`taskkill /PID ${pid} /T /F`);
        } else {
          await execPromise(`kill -9 ${pid}`);
        }
        this.onLog(`进程 ${pid} 已终止`);
      } catch (error) {
        this.onLog(`终止进程 ${pid} 失败: ${error.message}`);
      }
    }

    this.pids.clear();
  }

  /**
   * 取消任务执行
   */
  async cancel() {
    if (!this.isRunning) return;

    this.isCancelled = true;
    this.onLog('正在取消任务...');

    await this._cleanup();
    this.isRunning = false;

    this.onLog('任务已取消');
  }

  /**
   * 获取执行器状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isCancelled: this.isCancelled,
      hasContext: !!this.context,
      hasPage: !!this.page,
      browserInfo: {
        type: 'Playwright',
        headless: false,
        // 提供一些有用的信息，虽然我们无法直接控制窗口
        message: 'Playwright 浏览器已启动，请在系统任务栏中查找并切换到相应的浏览器窗口'
      }
    };
  }
}

export default PlaywrightExecutor;