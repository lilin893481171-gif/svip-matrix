/**
 * @file engine-selector.js
 * 引擎选择器 — 根据检测结果选择合适的浏览器引擎
 */

import { BrowserDetector } from './browser-detector.js';
import { ChromeLauncher } from './chrome-launcher.js';
// import { PuppeteerConnector } from './puppeteer-connector.js'; // 已移除 Puppeteer 依赖

export class EngineSelector {
  constructor() {
    this.browserDetector = new BrowserDetector();
    this.chromeLauncher = new ChromeLauncher();
    // this.puppeteerConnector = new PuppeteerConnector(); // 已移除 Puppeteer 依赖
    this.selectedEngine = null;
    this.engineType = null;
  }

  /**
   * 检测并选择最佳引擎
   */
  async selectEngine(useSystemChrome = false) {
    console.log('[EngineSelector] 开始检测可用浏览器...');

    // 检测所有可用浏览器
    const detectionReport = this.browserDetector.getDetectionReport();
    console.log('[EngineSelector] 浏览器检测报告:', detectionReport);

    // 检查用户是否在设置中手动指定了引擎
    const userPreference = await this.getUserEnginePreference();

    if (userPreference === 'embedded') {
      console.log('[EngineSelector] 用户指定使用内嵌浏览器');
      throw new Error('发布功能不支持内嵌浏览器，请安装 Chrome 或 Edge 浏览器');
    }

    // 优先选择 Chrome，其次 Edge
    const bestBrowser = detectionReport.bestBrowser;

    if (bestBrowser && userPreference !== 'embedded') {
      console.log(`[EngineSelector] 选择真实浏览器: ${bestBrowser.type}`);
      return await this.selectRealBrowserEngine(bestBrowser, useSystemChrome);
    }

    // 未检测到浏览器，直接抛出错误
    console.log('[EngineSelector] 未检测到浏览器，发布功能需要 Chrome 或 Edge 浏览器');
    throw new Error('未检测到 Chrome 或 Edge 浏览器，请安装 Chrome 或 Edge 浏览器以进行内容发布');
  }

  /**
   * 选择真实浏览器引擎
   */
  async selectRealBrowserEngine(browser, useSystemChrome = false) {
    try {
      console.log(`[EngineSelector] 启动 ${browser.type}: ${browser.path}`);

      // 启动 Chrome/Edge
      const launchResult = await this.chromeLauncher.launch(browser.path, useSystemChrome);
      console.log('[EngineSelector] 浏览器启动成功:', launchResult);

      this.selectedEngine = {
        type: 'real',
        chromeLauncher: this.chromeLauncher,
        debugPort: launchResult.debugPort,
        userDataDir: launchResult.userDataDir,
        useSystemChrome: launchResult.useSystemChrome,
        browserInfo: browser
      };

      this.engineType = 'real';

      console.log('[EngineSelector] 真实浏览器引擎已就绪');
      return this.selectedEngine;
    } catch (error) {
      console.error('[EngineSelector] 真实浏览器引擎启动失败:', error);
      throw new Error(`真实浏览器启动失败: ${error.message}，请确保 Chrome 或 Edge 浏览器已正确安装`);
    }
  }

  /**
   * 获取用户引擎偏好设置
   */
  async getUserEnginePreference() {
    // 这里应该从配置文件或用户设置中读取
    // 暂时返回 null 表示没有用户偏好
    return null;
  }

  /**
   * 获取当前选中的引擎
   */
  getSelectedEngine() {
    return this.selectedEngine;
  }

  /**
   * 获取引擎类型
   */
  getEngineType() {
    return this.engineType;
  }

  /**
   * 检查引擎是否就绪
   */
  isEngineReady() {
    if (!this.selectedEngine) {
      return false;
    }

    if (this.engineType === 'real') {
      // 检查 Chrome 是否仍在运行
      const status = this.chromeLauncher.getStatus();
      return status.isRunning;
    }

    if (this.engineType === 'embedded') {
      // 内嵌浏览器的就绪状态检查
      return true;
    }

    return false;
  }

  /**
   * 重连引擎 (对于真实浏览器，这通常意味着检查进程是否仍在运行)
   */
  async reconnect() {
    if (this.engineType === 'real') {
      try {
        const status = this.chromeLauncher.getStatus();
        if (status.isRunning) {
          console.log('[EngineSelector] 浏览器仍在运行，无需重连');
          return { success: true };
        } else {
          console.log('[EngineSelector] 浏览器已停止，需要重新启动');
          throw new Error('浏览器已停止运行');
        }
      } catch (error) {
        console.error('[EngineSelector] 引擎状态检查失败:', error);
        throw error;
      }
    }

    throw new Error('当前引擎不支持重连');
  }

  /**
   * 优雅断开引擎连接 (对于真实浏览器，这通常意味着不关闭浏览器进程)
   */
  async disconnect() {
    if (this.engineType === 'real') {
      try {
        await this.chromeLauncher.disconnect();
      } catch (error) {
        console.error('[EngineSelector] 引擎断开连接失败:', error);
        throw error;
      }
    }

    this.selectedEngine = null;
    this.engineType = null;
  }

  /**
   * 强制关闭引擎 (对于真实浏览器，这会强制关闭浏览器进程)
   */
  async forceClose() {
    if (this.engineType === 'real') {
      try {
        await this.chromeLauncher.forceClose();
      } catch (error) {
        console.error('[EngineSelector] 引擎强制关闭失败:', error);
      }
    }

    this.selectedEngine = null;
    this.engineType = null;
  }

  /**
   * 获取引擎状态
   */
  getStatus() {
    if (this.engineType === 'real') {
      return {
        type: this.engineType,
        isReady: this.isEngineReady(),
        browserInfo: this.selectedEngine?.browserInfo,
        chromeStatus: this.chromeLauncher.getStatus()
      };
    }

    if (this.engineType === 'embedded') {
      return {
        type: this.engineType,
        isReady: this.isEngineReady(),
        // 内嵌浏览器的状态信息
      };
    }

    return {
      type: null,
      isReady: false
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      await this.forceClose();
    } catch (error) {
      console.error('[EngineSelector] 清理资源失败:', error);
    }
  }
}

export default EngineSelector;