/**
 * @file rpa/browser-controller.js
 * BrowserView 会话引擎 — 纯 Electron 原生 API，零 CDP 依赖
 */
import { BrowserWindow, BrowserView, app } from 'electron';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { teardownSessionAndClean } from '../safe-delete.js';
import { getTLSProxyRules, isTLSProxyRunning, isCAInstalled } from '../tls-proxy-launcher.js';

// 递归复制分区目录 — Session Storage / Local Storage 是目录层级，
// copyFileSync 遇到目录直接抛错，必须递归处理
function copyRecursive(src, dst) {
  if (!existsSync(src)) return;
  const st = statSync(src);
  if (st.isDirectory()) {
    mkdirSync(dst, { recursive: true });
    const entries = readdirSync(src);
    for (const entry of entries) {
      copyRecursive(join(src, entry), join(dst, entry));
    }
  } else {
    mkdirSync(join(dst, '..'), { recursive: true });
    copyFileSync(src, dst);
  }
}

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
    // 🔑 独立分区：加 _rpa 后缀，避免与账户浏览器共享 Cookie 存储
    // 共享分区会导致两个 BrowserView 竞争 SQLite WAL，损坏 Cookie → 登录态丢失
    this.partitionKey = `chrome_data_${accountId}_rpa`;
    this.view = null;
    this.mainWindow = null;
    this.webContents = null;
    this.nativeInteractions = null;
  }

  async launch() {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) throw new Error("主窗口未找到");
    this.mainWindow = windows[0];

    // 🔑 从账户浏览器分区复制 Cookie 到 RPA 独立分区
    // 这样 RPA 有完整登录态，同时不会污染账户浏览器
    const userDataPath = app.getPath('userData');
    const srcPartition = join(userDataPath, 'Partitions', `chrome_data_${this.accountId}`);
    const dstPartition = join(userDataPath, 'Partitions', this.partitionKey);

    if (existsSync(srcPartition)) {
      try {
        mkdirSync(dstPartition, { recursive: true });
        // 全量复制会话数据（排除大体积缓存目录）
        const SKIP = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'blob_storage', 'WebStorage']);
        const entries = readdirSync(srcPartition);
        for (const name of entries) {
          if (SKIP.has(name)) continue;
          const src = join(srcPartition, name);
          try { copyRecursive(src, join(dstPartition, name)); } catch (e) {
            console.warn(`[BrowserController] 复制 ${name} 失败:`, e.message);
          }
        }
        console.log(`[BrowserController] 会话分区已完整复制到 RPA 独立分区 (跳过缓存)`);
      } catch (e) {
        console.warn('[BrowserController] Cookie 复制失败:', e.message);
      }
    }

    this.view = new BrowserView({
      webPreferences: {
        partition: `persist:${this.partitionKey}`,
        sandbox: true,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: true
      }
    });

    this.mainWindow.addBrowserView(this.view);
    // 视口与 JS 层伪造的屏幕分辨率 (1920x1080) 对齐，消除物理/逻辑分辨率指纹差异
    this.view.setBounds({ x: -10000, y: -10000, width: 1920, height: 1080 });

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

    // 🔑 权限全开 — 防止 Chromium 静默拒绝导致页面内部状态机卡死
    // 小红书上传后需要: autoplay(视频预览解码) / clipboard(复制链接) / notifications 等
    const permHandler = (_webContents, permission, callback, details) => {
      // 所有权限请求均授权，避免静默拒绝阻塞页面渲染管线
      callback(true);
    };
    this.webContents.session.setPermissionRequestHandler(permHandler);

    // setPermissionCheckHandler — 阻止页面自主查询权限状态时拿到 denied
    // 某些 React SPA 在 PermissionStatus 为 denied 时会隐藏上传按钮
    if (typeof this.webContents.session.setPermissionCheckHandler === 'function') {
      this.webContents.session.setPermissionCheckHandler((_wc, permission) => true);
    }

    // UA 与 Electron 39 内置 Chromium 132 保持一致，避免平台深度环境校验检测到版本不匹配
    const chromeVersion = process.versions.chrome || '132.0.0.0';
    this.webContents.setUserAgent(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
    );

    // 🔐 TLS 指纹伪装代理：RPA 发布流量经 uTLS 代理中转 (JA3→Chrome133)
    if (isTLSProxyRunning()) {
      try {
        await this.webContents.session.setProxy({
          proxyRules: getTLSProxyRules(),
          proxyBypassRules: '*.xhscdn.com'
        });
      } catch (e) {
        console.warn('[BrowserController] TLS 代理挂载失败:', e.message);
      }
    }

    // 🚫 拦截平台 APM/监控/埋点上报 — 避免 disable-http2 导致 SSL 协议错误刷屏
    this.webContents.session.webRequest.onBeforeRequest(
      { urls: [
        '*://apm-fe.xiaohongshu.com/*',
        '*://apm.xiaohongshu.com/*',
        '*://t2.xiaohongshu.com/api/v2/collect*'
      ] },
      (_details, callback) => callback({ cancel: true })
    );

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

    this.nativeInteractions = new NativeInteractions(this.webContents, this.mainWindow);

    // 防检测加固：指纹伪装 + Canvas/Audio 噪声
    try {
      await this.nativeInteractions.applyFingerprintHardening();
    } catch (e) {
      console.warn('[BrowserController] 指纹加固注入失败:', e.message);
    }

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
      this.view.setBounds({ x: -10000, y: -10000, width: 1920, height: 1080 });
    }
  }

  async close() {
    try {
      const dstPartition = join(app.getPath('userData'), 'Partitions', this.partitionKey);
      if (existsSync(dstPartition)) {
        await teardownSessionAndClean(this.mainWindow, this.view, dstPartition, this.partitionKey);
      }
    } catch (e) {
      console.warn('[BrowserController] 拆除失败:', e.message);
    } finally {
      this.view = null;
      this.webContents = null;
      this.nativeInteractions = null;
    }
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
