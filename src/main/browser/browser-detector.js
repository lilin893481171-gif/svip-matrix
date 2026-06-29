/**
 * @file browser-detector.js
 * 浏览器检测模块 — 扫描本机 Chrome/Edge 安装路径
 */

import { execSync, exec } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';

/**
 * 检测本机 Chrome/Edge 安装路径
 */
export class BrowserDetector {
  constructor() {
    this.os = process.platform;
    this.detectedBrowsers = [];
  }

  /**
   * 获取 Chrome 安装路径
   */
  getChromePaths() {
    const paths = [];

    switch (this.os) {
      case 'win32':
        // Windows Chrome 路径
        paths.push(
          path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
        );
        paths.push(
          path.join(
            process.env.PROGRAMFILES || 'C:\\Program Files',
            'Google',
            'Chrome',
            'Application',
            'chrome.exe'
          )
        );
        // 用户目录下的 Chrome
        paths.push(
          path.join(
            process.env.LOCALAPPDATA || 'C:\\Users\\' + (process.env.USERNAME || 'default'),
            'AppData',
            'Local',
            'Google',
            'Chrome',
            'Application',
            'chrome.exe'
          )
        );
        break;

      case 'darwin':
        // macOS Chrome 路径
        paths.push(
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        );
        break;

      case 'linux':
        // Linux Chrome 路径
        paths.push('/usr/bin/google-chrome');
        paths.push('/usr/bin/chromium');
        paths.push('/usr/bin/chromium-browser');
        break;
    }

    return paths;
  }

  /**
   * 获取 Edge 安装路径
   */
  getEdgePaths() {
    const paths = [];

    switch (this.os) {
      case 'win32':
        // Windows Edge 路径
        paths.push(
          path.join(
            process.env.PROGRAMFILES || 'C:\\Program Files',
            'Microsoft',
            'Edge',
            'Application',
            'msedge.exe'
          )
        );
        paths.push(
          path.join(
            process.env.PROGRAMFILES || 'C:\\Program Files',
            'Microsoft',
            'Edge',
            'Application',
            'msedge.exe'
          )
        );
        break;

      case 'darwin':
        // macOS Edge 路径
        paths.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
        break;

      case 'linux':
        // Linux Edge 路径
        paths.push('/usr/bin/microsoft-edge');
        paths.push('/usr/bin/microsoft-edge-stable');
        break;
    }

    return paths;
  }

  /**
   * 检测浏览器是否存在
   */
  checkBrowserExists(browserPath) {
    try {
      return existsSync(browserPath);
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取浏览器版本
   */
  getBrowserVersion(browserPath) {
    try {
      const result = execSync(
        `"${browserPath}" --version`,
        { encoding: 'utf8', timeout: 5000 }
      );
      const versionMatch = result.match(/(\d+\.\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 检测所有可用的浏览器
   */
  detectAllBrowsers() {
    this.detectedBrowsers = [];

    // 检测 Chrome
    const chromePaths = this.getChromePaths();
    for (const chromePath of chromePaths) {
      if (this.checkBrowserExists(chromePath)) {
        const version = this.getBrowserVersion(chromePath);
        this.detectedBrowsers.push({
          type: 'chrome',
          path: chromePath,
          version: version,
          os: this.os
        });
        break; // 找到一个即可
      }
    }

    // 检测 Edge
    const edgePaths = this.getEdgePaths();
    for (const edgePath of edgePaths) {
      if (this.checkBrowserExists(edgePath)) {
        const version = this.getBrowserVersion(edgePath);
        this.detectedBrowsers.push({
          type: 'edge',
          path: edgePath,
          version: version,
          os: this.os
        });
        break; // 找到一个即可
      }
    }

    return this.detectedBrowsers;
  }

  /**
   * 获取最佳浏览器
   */
  getBestBrowser() {
    this.detectAllBrowsers();

    // 优先选择 Chrome，其次 Edge
    if (this.detectedBrowsers.length > 0) {
      return this.detectedBrowsers.find(b => b.type === 'chrome') ||
             this.detectedBrowsers[0];
    }

    return null;
  }

  /**
   * 获取检测报告
   */
  getDetectionReport() {
    return {
      os: this.os,
      detectedBrowsers: this.detectedBrowsers,
      hasChrome: this.detectedBrowsers.some(b => b.type === 'chrome'),
      hasEdge: this.detectedBrowsers.some(b => b.type === 'edge'),
      hasAnyBrowser: this.detectedBrowsers.length > 0,
      bestBrowser: this.getBestBrowser()
    };
  }
}

export default BrowserDetector;