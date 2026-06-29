/**
 * @file engine-selector.js
 * 引擎选择器 — 根据检测结果选择合适的浏览器引擎
 */

import { BrowserDetector } from './browser-detector.js';
import { ChromeLauncher } from './chrome-launcher.js';
import { PuppeteerConnector } from './puppeteer-connector.js';

export class EngineSelector {
  constructor() {
    this.browserDetector = new BrowserDetector();
    this.chromeLauncher = new ChromeLauncher();
    this.puppeteerConnector = new PuppeteerConnector();
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
      return this.selectEmbeddedEngine();
    }

    // 优先选择 Chrome，其次 Edge
    const bestBrowser = detectionReport.bestBrowser;

    if (bestBrowser && userPreference !== 'embedded') {
      console.log(`[EngineSelector] 选择真实浏览器: ${bestBrowser.type}`);
      return await this.selectRealBrowserEngine(bestBrowser, useSystemChrome);
    }

    // 未检测到浏览器或用户未指定，降级为内嵌浏览器
    console.log('[EngineSelector] 未检测到浏览器，降级为内嵌浏览器');
    return this.selectEmbeddedEngine();
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

      // 连接 Puppeteer
      const connectResult = await this.puppeteerConnector.connect(launchResult.debugPort);
      console.log('[EngineSelector] Puppeteer 连接成功:', connectResult);

      this.selectedEngine = {
        type: 'puppeteer',
        browser: connectResult.browser,
        chromeLauncher: this.chromeLauncher,
        puppeteerConnector: this.puppeteerConnector,
        debugPort: launchResult.debugPort,
        userDataDir: launchResult.userDataDir,
        useSystemChrome: launchResult.useSystemChrome,
        browserInfo: browser
      };

      this.engineType = 'puppeteer';

      console.log('[EngineSelector] 真实浏览器引擎已就绪');
      return this.selectedEngine;
    } catch (error) {
      console.error('[EngineSelector] 真实浏览器引擎启动失败:', error);

      // 启动失败，降级为内嵌浏览器
      console.log('[EngineSelector] 降级为内嵌浏览器');
      return this.selectEmbeddedEngine();
    }
  }

  /**
   * 选择内嵌浏览器引擎
   */
  selectEmbeddedEngine() {
    this.selectedEngine = {
      type: 'embedded',
      // 内嵌浏览器的具体实现在这里占位
      browser: null,
      launcher: null,
      connector: null
    };

    this.engineType = 'embedded';

    console.log('[EngineSelector] 内嵌浏览器引擎已就绪');
    return this.selectedEngine;
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

    if (this.engineType === 'puppeteer') {
      return this.puppeteerConnector.isConnected;
    }

    if (this.engineType === 'embedded') {
      // 内嵌浏览器的就绪状态检查
      return true;
    }

    return false;
  }

  /**
   * 重连引擎
   */
  async reconnect() {
    if (this.engineType === 'puppeteer') {
      try {
        const status = this.chromeLauncher.getStatus();
        if (status.debugPort) {
          return await this.puppeteerConnector.reconnect(status.debugPort);
        }
      } catch (error) {
        console.error('[EngineSelector] 引擎重连失败:', error);
        throw error;
      }
    }

    throw new Error('当前引擎不支持重连');
  }

  /**
   * 优雅断开引擎连接
   */
  async disconnect() {
    if (this.engineType === 'puppeteer') {
      try {
        await this.puppeteerConnector.disconnect();
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
   * 强制关闭引擎
   */
  async forceClose() {
    if (this.engineType === 'puppeteer') {
      try {
        await this.puppeteerConnector.forceDisconnect();
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
    if (this.engineType === 'puppeteer') {
      return {
        type: this.engineType,
        isReady: this.isEngineReady(),
        browserInfo: this.selectedEngine?.browserInfo,
        chromeStatus: this.chromeLauncher.getStatus(),
        puppeteerStatus: this.puppeteerConnector.getStatus()
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