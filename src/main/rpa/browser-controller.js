/**
 * @file rpa/browser-controller.js
 * BrowserView 会话引擎 — 纯 Electron 原生 API，零 CDP 依赖
 */
import { BrowserWindow, BrowserView } from 'electron';

import { NativeInteractions } from '../native-interactions.js';
import { getOrCreateSessionProfile, buildSessionEnvironmentScript } from '../account-browser-manager.js';

const sleep = (ms, wc = null) => {
  const jitter = ms * 0.1;
  const finalMs = ms + (Math.random() * jitter * 2 - jitter);
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, finalMs)),
    ...(wc ? [new Promise((_, reject) => {
      if (wc.isDestroyed()) reject(new Error('浏览器强制中断'));
      else wc.once('destroyed', () => reject(new Error('浏览器强制中断')));
    })] : [])
  ]);
};

export class BrowserController {
  constructor(accountId) {
    this.accountId = accountId;
    this.view = null;
    this.mainWindow = null;
    this.webContents = null;
    this.nativeInteractions = null;
  }

  async launch() {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) throw new Error("主窗口未找到");
    this.mainWindow = windows[0];

    this.view = new BrowserView({
      webPreferences: {
        partition: `persist:chrome_data_${this.accountId}`,
        sandbox: true,
        contextIsolation: true,
        webSecurity: false
      }
    });

    this.mainWindow.addBrowserView(this.view);
    this.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });

    this.webContents = this.view.webContents;

    // Session 级 WebRTC 物理隔离
    try {
      if (typeof this.webContents.session.setWebRTCIPHandlingPolicy === 'function') {
        this.webContents.session.setWebRTCIPHandlingPolicy('default_public_interface_only');
      }
    } catch (e) {
      console.warn('[BrowserController] WebRTC 分区策略设置失败:', e.message);
    }

    this.webContents.setWindowOpenHandler(({ url }) => {
      this.webContents.loadURL(url);
      return { action: 'deny' };
    });

    this.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

    await this.webContents.loadURL('about:blank');

    // 附加 debugger
    try {
      if (!this.webContents.debugger.isAttached()) {
        this.webContents.debugger.attach('1.3');
      }
    } catch (e) {
      console.warn('[BrowserController] debugger attach failed:', e.message);
    }

    // 构建会话环境脚本
    let sessionEnvironmentScript;
    try {
      const fpData = getOrCreateSessionProfile(this.accountId);
      sessionEnvironmentScript = buildSessionEnvironmentScript(fpData.fingerprint, this.accountId);
    } catch (e) {
      console.warn('[BrowserController] 会话配置加载失败，使用默认值:', e.message);
      sessionEnvironmentScript = buildSessionEnvironmentScript({
        navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
        screen: { width: 1920, height: 1080, colorDepth: 24 },
        webgl: {
          vendor: 'Intel Inc.',
          renderer: 'Intel Iris OpenGL Engine',
          version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
          shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'
        }
      }, this.accountId);
    }

    // CDP 持久化注入
    try {
      if (this.webContents.debugger.isAttached()) {
        await this.webContents.debugger.sendCommand('Page.enable');
        await this.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: sessionEnvironmentScript
        });

        // CDP 级 WebRTC 防护
        try {
          await this.webContents.debugger.sendCommand('Network.setBlockedURLs', {
            urls: ['*://*.stun.*/*', '*://*.turn.*/*', 'stun:*', 'turn:*', '*://*stun*:*/*', '*://*turn*:*/*']
          });
        } catch (e) {
          console.warn('[BrowserController] CDP WebRTC 屏蔽失败:', e.message);
        }
      } else {
        await this.webContents.executeJavaScript(sessionEnvironmentScript);
      }
    } catch (e) {
      console.error('[BrowserController] CDP 注入失败，降级:', e.message);
      try { await this.webContents.executeJavaScript(sessionEnvironmentScript); } catch (e2) {}
    }

    // did-finish-load 备份注入
    this.webContents.on('did-finish-load', () => {
      try {
        if (!this.webContents || this.webContents.isDestroyed()) return;
        const url = this.webContents.getURL();
        if (url && !url.startsWith('about:') && !url.startsWith('devtools://')) {
          this.webContents.executeJavaScript(sessionEnvironmentScript).catch(() => {});
        }
      } catch (e) {}
    });

    this.nativeInteractions = new NativeInteractions(this.webContents);

    return { webContents: this.webContents, interactions: this.nativeInteractions };
  }

  attachToWindow(bounds) {
    if (this.mainWindow && this.view) {
      try { this.mainWindow.setTopBrowserView(this.view); } catch (e) {}
      this.view.setBounds(bounds);
    }
  }

  detachFromWindow() {
    if (this.mainWindow && this.view) {
      this.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });
    }
  }

  async close() {
    if (this.mainWindow && this.view) {
      try { this.mainWindow.removeBrowserView(this.view); } catch (e) {}
    }
    if (this.webContents) {
      try {
        if (this.webContents.debugger.isAttached()) {
          this.webContents.debugger.detach();
        }
      } catch (e) {}
      try { this.webContents.close(); } catch (e) {}
      this.webContents = null;
    }
    this.view = null;
    this.nativeInteractions = null;
  }

  async verifyFingerprint() {
    const wc = this.webContents;
    if (!wc || wc.isDestroyed()) return { ok: false, error: 'webContents 已销毁' };

    const results = { accountId: this.accountId, steps: [] };

    await wc.loadURL('data:text/html,<h1>Step1-FingerprintCheck</h1>');
    await sleep(1500, wc).catch(() => {});

    try {
      const raw = await wc.executeJavaScript(`
        JSON.stringify({
          webdriver: navigator.webdriver,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: navigator.deviceMemory,
          vendor: navigator.vendor,
          screenW: screen.width,
          screenH: screen.height,
          colorDepth: screen.colorDepth,
          hasWebGLParams: typeof WebGLRenderingContext !== 'undefined',
          hasFontSpoof: typeof window.queryLocalFonts === 'function',
          chromeRuntime: typeof chrome !== 'undefined' ? JSON.stringify(chrome.runtime) : 'undefined',
          hasMediaDevicesSpoof: navigator.mediaDevices && navigator.mediaDevices.enumerateDevices ? true : false
        })
      `);
      results.steps.push({ page: 'A (初检)', data: JSON.parse(raw) });
    } catch (e) {
      results.steps.push({ page: 'A (初检)', error: e.message });
    }

    await wc.loadURL('data:text/html,<h1>Step2-NavigationPersistence</h1>');
    await sleep(1500, wc).catch(() => {});

    try {
      const raw = await wc.executeJavaScript(`
        JSON.stringify({
          webdriver: navigator.webdriver,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency,
          screenW: screen.width,
          screenH: screen.height,
          colorDepth: screen.colorDepth
        })
      `);
      const stepB = { page: 'B (导航后)', data: JSON.parse(raw) };
      const d = stepB.data;
      stepB.survived = d.webdriver === undefined && d.platform === 'Win32' && d.screenW === 1920;
      results.steps.push(stepB);
    } catch (e) {
      results.steps.push({ page: 'B (导航后)', error: e.message, survived: false });
    }

    try {
      if (wc.debugger.isAttached()) {
        results.cdpAttached = true;
        results.steps.push({ page: 'CDP 诊断', cdpOk: true });
      } else {
        results.cdpAttached = false;
        results.steps.push({ page: 'CDP 诊断', cdpOk: false, warning: 'debugger 未附加，可能回退到 executeJavaScript 模式' });
      }
    } catch (e) {
      results.steps.push({ page: 'CDP 诊断', error: e.message });
    }

    const survived = results.steps.find(s => s.page === 'B (导航后)');
    results.ok = survived?.survived === true;
    results.verdict = results.ok
      ? '✅ CDP 持久化注入验证通过 — 会话环境脚本在页面导航后存活'
      : '❌ 验证失败 — 会话环境在导航后丢失，CDP 注入可能未生效';

    return results;
  }
}
