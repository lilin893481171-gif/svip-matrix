/**
 * @file puppeteer-connector.js
 * Puppeteer 连接器 — 连接已启动的 Chrome 并管理连接生命周期
 */

import puppeteer from 'puppeteer-core';
import { setTimeout } from 'timers/promises';

export class PuppeteerConnector {
  constructor() {
    this.browser = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 2000;
  }

  /**
   * 连接到已启动的 Chrome
   */
  async connect(debugPort, options = {}) {
    if (this.isConnected && this.browser) {
      throw new Error('Puppeteer 已经连接');
    }

    const browserURL = `http://localhost:${debugPort}`;
    console.log(`[PuppeteerConnector] 连接到 Chrome: ${browserURL}`);

    try {
      // 连接到已启动的 Chrome
      this.browser = await puppeteer.connect({
        browserURL,
        defaultViewport: null,
        ...options
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log('[PuppeteerConnector] Puppeteer 连接成功');

      // 监听断开事件
      this.browser.on('disconnected', () => {
        console.log('[PuppeteerConnector] 浏览器连接断开');
        this.isConnected = false;
        this.browser = null;
      });

      return {
        success: true,
        browser: this.browser,
        version: await this.browser.version()
      };
    } catch (error) {
      console.error('[PuppeteerConnector] Puppeteer 连接失败:', error);
      throw new Error(`Puppeteer 连接失败: ${error.message}`);
    }
  }

  /**
   * 断线重连机制
   */
  async reconnect(debugPort, options = {}) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('重连次数超过限制');
    }

    console.log(`[PuppeteerConnector] 尝试重连 (尝试 ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);

    this.reconnectAttempts++;

    try {
      // 等待一段时间再重试
      await setTimeout(this.reconnectDelay);

      // 尝试重新连接
      const result = await this.connect(debugPort, options);

      // 重置重连计数
      this.reconnectAttempts = 0;

      console.log('[PuppeteerConnector] 重连成功');
      return result;
    } catch (error) {
      console.error(`[PuppeteerConnector] 重连失败 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // 递归重试
        return await this.reconnect(debugPort, options);
      } else {
        throw new Error(`重连失败: ${error.message}`);
      }
    }
  }

  /**
   * 优雅断开连接（不关闭浏览器）
   */
  async disconnect() {
    if (!this.isConnected || !this.browser) {
      console.log('[PuppeteerConnector] Puppeteer 未连接，无需断开');
      return;
    }

    console.log('[PuppeteerConnector] 优雅断开 Puppeteer 连接...');

    try {
      // 只断开连接，不关闭浏览器
      await this.browser.disconnect();

      this.isConnected = false;
      this.browser = null;
      this.reconnectAttempts = 0;

      console.log('[PuppeteerConnector] Puppeteer 连接已断开（浏览器仍在运行）');
    } catch (error) {
      console.error('[PuppeteerConnector] 断开连接失败:', error);
      throw error;
    }
  }

  /**
   * 强制断开连接（超时强制 disconnect）
   */
  async forceDisconnect(timeout = 5000) {
    if (!this.isConnected || !this.browser) {
      console.log('[PuppeteerConnector] Puppeteer 未连接，无需断开');
      return;
    }

    console.log('[PuppeteerConnector] 强制断开 Puppeteer 连接...');

    try {
      // 设置超时
      const disconnectPromise = this.browser.disconnect();
      const timeoutPromise = setTimeout(timeout);

      // 等待断开连接或超时
      await Promise.race([disconnectPromise, timeoutPromise]);

      this.isConnected = false;
      this.browser = null;
      this.reconnectAttempts = 0;

      console.log('[PuppeteerConnector] Puppeteer 连接已强制断开');
    } catch (error) {
      console.error('[PuppeteerConnector] 强制断开连接失败:', error);

      // 即使出错也要清理状态
      this.isConnected = false;
      this.browser = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * 获取浏览器实例
   */
  getBrowser() {
    if (!this.isConnected || !this.browser) {
      throw new Error('Puppeteer 未连接');
    }
    return this.browser;
  }

  /**
   * 创建新页面
   */
  async newPage() {
    if (!this.isConnected || !this.browser) {
      throw new Error('Puppeteer 未连接');
    }

    try {
      const page = await this.browser.newPage();

      // 设置页面默认行为
      await page.setRequestInterception(false);

      // 监听页面关闭事件
      page.on('close', () => {
        console.log('[PuppeteerConnector] 页面已关闭');
      });

      return page;
    } catch (error) {
      console.error('[PuppeteerConnector] 创建页面失败:', error);
      throw error;
    }
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      browserVersion: this.browser ? this.browser.version() : null,
      pagesCount: this.browser ? this.browser.pages().length : 0
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      await this.forceDisconnect();
    } catch (error) {
      console.error('[PuppeteerConnector] 清理资源失败:', error);
    }
  }
}

export default PuppeteerConnector;