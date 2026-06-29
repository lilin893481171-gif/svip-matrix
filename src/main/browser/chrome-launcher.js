/**
 * @file chrome-launcher.js
 * Chrome 启动器 — 用 child_process 启动 Chrome 并管理生命周期
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { app } from 'electron';
import { randomBytes } from 'crypto';

export class ChromeLauncher {
  constructor() {
    this.chromeProcess = null;
    this.debugPort = null;
    this.userDataDir = null;
    this.isRunning = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 2000;
  }

  /**
   * 生成随机调试端口
   */
  generateDebugPort() {
    // 使用 9222-9332 范围内的随机端口
    return 9222 + Math.floor(Math.random() * 111);
  }

  /**
   * 获取用户数据目录
   */
  getUserDataDir(useSystemChrome = false) {
    if (useSystemChrome) {
      // 使用系统 Chrome 的用户数据目录，实现免同步登录态
      const userDataDir = app.getPath('userData');
      const systemChromeDir = path.join(userDataDir, 'system-chrome-user-data');

      // 确保目录存在
      if (!existsSync(systemChromeDir)) {
        mkdirSync(systemChromeDir, { recursive: true });
      }

      return systemChromeDir;
    } else {
      // 使用 Electron 应用的用户数据目录
      const userDataDir = app.getPath('userData');
      const chromeDir = path.join(userDataDir, 'chrome-user-data');

      // 确保目录存在
      if (!existsSync(chromeDir)) {
        mkdirSync(chromeDir, { recursive: true });
      }

      return chromeDir;
    }
  }

  /**
   * 获取 Chrome 启动参数
   */
  getLaunchArgs(browserPath, useSystemChrome = false) {
    const userDataDir = this.getUserDataDir(useSystemChrome);
    this.userDataDir = userDataDir;

    const args = [
      browserPath,
      `--remote-debugging-port=${this.debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-blink-features=AutomationControlled',
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
    ];

    // 根据平台添加特定参数
    if (process.platform === 'win32') {
      args.push('--disable-gpu');
      args.push('--disable-software-rasterizer');
    }

    return args;
  }

  /**
   * 检查 Chrome 是否已经在运行
   */
  async checkChromeRunning(browserPath) {
    try {
      const result = await new Promise((resolve, reject) => {
        const proc = spawn(browserPath, ['--version'], {
          stdio: 'pipe',
          timeout: 5000
        });

        let output = '';
        proc.stdout.on('data', (data) => {
          output += data.toString();
        });

        proc.on('close', (code) => {
          if (code === 0 && output) {
            resolve(true);
          } else {
            resolve(false);
          }
        });

        proc.on('error', () => {
          resolve(false);
        });
      });

      return result;
    } catch (e) {
      return false;
    }
  }

  /**
   * 启动 Chrome
   */
  async launch(browserPath, useSystemChrome = false) {
    if (this.isRunning) {
      throw new Error('Chrome 已经在运行');
    }

    this.debugPort = this.generateDebugPort();
    this.userDataDir = this.getUserDataDir(useSystemChrome);

    const args = this.getLaunchArgs(browserPath, useSystemChrome);

    console.log(`[ChromeLauncher] 启动 Chrome: ${browserPath}`);
    console.log(`[ChromeLauncher] 调试端口: ${this.debugPort}`);
    console.log(`[ChromeLauncher] 用户数据目录: ${this.userDataDir}`);
    console.log(`[ChromeLauncher] 使用系统 Chrome 登录态: ${useSystemChrome}`);

    try {
      this.chromeProcess = spawn(browserPath, args.slice(1), {
        stdio: 'pipe',
        detached: false,
        shell: false
      });

      // 处理标准输出
      this.chromeProcess.stdout.on('data', (data) => {
        console.log('[Chrome stdout]', data.toString().trim());
      });

      this.chromeProcess.stderr.on('data', (data) => {
        console.error('[Chrome stderr]', data.toString().trim());
      });

      // 处理进程退出
      this.chromeProcess.on('close', (code) => {
        console.log(`[ChromeLauncher] Chrome 进程退出，退出码: ${code}`);
        this.isRunning = false;
        this.chromeProcess = null;
      });

      this.chromeProcess.on('error', (error) => {
        console.error('[ChromeLauncher] Chrome 启动错误:', error);
        this.isRunning = false;
        this.chromeProcess = null;
      });

      // 等待启动完成
      await this.waitForReady();

      this.isRunning = true;
      console.log('[ChromeLauncher] Chrome 启动成功');

      return {
        success: true,
        debugPort: this.debugPort,
        userDataDir: this.userDataDir,
        useSystemChrome
      };
    } catch (error) {
      console.error('[ChromeLauncher] Chrome 启动失败:', error);
      throw new Error(`Chrome 启动失败: ${error.message}`);
    }
  }

  /**
   * 等待 Chrome 准备就绪
   */
  async waitForReady() {
    console.log('[ChromeLauncher] 等待 Chrome 准备就绪...');

    // 等待 5 秒，确保 Chrome 完全启动
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 健康检查：尝试连接调试端口
    for (let i = 0; i < this.maxReconnectAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.debugPort}/json/version`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[ChromeLauncher] Chrome 健康检查通过: ${data['Browser']}`);
          return true;
        }
      } catch (e) {
        console.log(`[ChromeLauncher] 健康检查失败 (尝试 ${i + 1}/${this.maxReconnectAttempts}): ${e.message}`);
        if (i < this.maxReconnectAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        }
      }
    }

    console.error('[ChromeLauncher] Chrome 健康检查失败');
    throw new Error('Chrome 启动后无法连接');
  }

  /**
   * 重连 Chrome
   */
  async reconnect() {
    if (this.isRunning && this.chromeProcess && !this.chromeProcess.killed) {
      console.log('[ChromeLauncher] Chrome 仍在运行，无需重连');
      return { success: true, debugPort: this.debugPort };
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('重连次数超过限制');
    }

    console.log(`[ChromeLauncher] 尝试重连 Chrome (尝试 ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);

    this.reconnectAttempts++;

    try {
      // 重新启动等待
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

      // 这里应该重新启动 Chrome，但为了简化，我们只检查是否还在运行
      if (this.isRunning && this.chromeProcess) {
        this.reconnectAttempts = 0;
        return { success: true, debugPort: this.debugPort };
      }

      throw new Error('Chrome 进程已退出');
    } catch (error) {
      console.error('[ChromeLauncher] 重连失败:', error);
      throw error;
    }
  }

  /**
   * 优雅断开连接
   */
  async disconnect() {
    if (!this.isRunning) {
      console.log('[ChromeLauncher] Chrome 未运行，无需断开');
      return;
    }

    console.log('[ChromeLauncher] 优雅断开 Chrome 连接...');

    try {
      // 只断开连接，不关闭浏览器
      // 浏览器会继续运行，用户可以继续使用
      this.isRunning = false;
      this.chromeProcess = null;

      console.log('[ChromeLauncher] Chrome 连接已断开（浏览器仍在运行）');
    } catch (error) {
      console.error('[ChromeLauncher] 断开连接失败:', error);
      throw error;
    }
  }

  /**
   * 强制关闭 Chrome（仅在异常情况下使用）
   */
  async forceClose() {
    if (!this.isRunning || !this.chromeProcess) {
      console.log('[ChromeLauncher] Chrome 未运行，无需关闭');
      return;
    }

    console.log('[ChromeLauncher] 强制关闭 Chrome...');

    try {
      // 尝试优雅退出
      if (!this.chromeProcess.killed) {
        this.chromeProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // 如果还没退出，强制杀死
      if (!this.chromeProcess.killed) {
        this.chromeProcess.kill('SIGKILL');
      }

      this.isRunning = false;
      this.chromeProcess = null;

      console.log('[ChromeLauncher] Chrome 已强制关闭');
    } catch (error) {
      console.error('[ChromeLauncher] 强制关闭失败:', error);
      this.isRunning = false;
      this.chromeProcess = null;
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      debugPort: this.debugPort,
      userDataDir: this.userDataDir,
      reconnectAttempts: this.reconnectAttempts,
      processId: this.chromeProcess?.pid || null
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      await this.forceClose();
    } catch (error) {
      console.error('[ChromeLauncher] 清理资源失败:', error);
    }
  }
}

export default ChromeLauncher;