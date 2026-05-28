/**
 * @file account-browser-manager.js
 * @title 原生账户沙盒引擎 — 零 Playwright 依赖，纯 Electron BrowserView
 * @desc 替代 browser-manager.js 的 launchSandbox，用于账户登录场景。
 *       指纹生成沿用 fingerprint-generator (纯JS)，
 *       注入通道使用 webContents.debugger (CDP Page.addScriptToEvaluateOnNewDocument)，
 *       代理使用 session.setProxy()，持久化使用 persist: 分区。
 */

import { BrowserView, BrowserWindow } from 'electron';
import { FingerprintGenerator } from 'fingerprint-generator';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app } from 'electron';
import { getDB } from './database.js';

// ======================================
// 0. 配置与全局状态
// ======================================

const FINGERPRINTS_DIR = path.join(process.cwd(), 'account_fingerprints');
const STATES_DIR = path.join(process.cwd(), 'account_states');

[FINGERPRINTS_DIR, STATES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const activeSessions = new Map();
const sslRetryCount = new Map();  // 防 SSL 重试死循环

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ======================================
// 1. 安全读写工具 (与 browser-manager.js 兼容)
// ======================================

function secureAtomicWriteFileSync(filePath, data, accountId) {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    const key = crypto.createHash('sha256').update(String(accountId)).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    fs.writeFileSync(tempPath, JSON.stringify({
      data: encrypted,
      iv: iv.toString('hex'),
      timestamp: Date.now()
    }), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

function secureReadFileSync(filePath, accountId) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const payload = JSON.parse(content);
    const key = crypto.createHash('sha256').update(String(accountId)).digest();
    const iv = Buffer.from(payload.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    throw error;
  }
}

// ======================================
// 2. 指纹生成 (fingerprint-generator 纯JS，无 Playwright 依赖)
// ======================================

function getOrCreateFingerprint(accountId) {
  const fingerprintPath = path.join(FINGERPRINTS_DIR, `${accountId}.json.enc`);

  if (fs.existsSync(fingerprintPath)) {
    try {
      const data = secureReadFileSync(fingerprintPath, accountId);
      console.log(`[原生沙盒] 加载账号 [${accountId}] 的固定硬件指纹`);
      return data;
    } catch (error) {
      console.warn(`[原生沙盒] 账号 [${accountId}] 指纹文件损坏，重新生成`);
    }
  }

  console.log(`[原生沙盒] 为账号 [${accountId}] 生成全新固定硬件指纹`);
  const generator = new FingerprintGenerator({
    devices: ['desktop'],
    browsers: [{ name: 'chrome', minVersion: 125, maxVersion: 130 }],
    operatingSystems: ['windows'],
    locales: ['zh-CN'],
    hardwareConcurrency: { min: 2, max: 16 },
    deviceMemory: { min: 1, max: 8 }
  });

  const fingerprintData = generator.getFingerprint();
  fingerprintData.fingerprint.webgl = {
    vendor: 'Intel Inc.',
    renderer: 'Intel Iris OpenGL Engine',
    version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
    shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'
  };

  secureAtomicWriteFileSync(fingerprintPath, fingerprintData, accountId);
  return fingerprintData;
}

// ======================================
// 3. 反指纹注入脚本构建
// ======================================

function buildAntiFingerprintScript(fp, accountId) {
  const nav = fp.navigator || {};
  const screen = fp.screen || {};
  const webgl = fp.webgl || {};

  // 基于 accountId 的确定性哈希种子 (AudioContext / WebGL 噪声用)
  var seed = String(accountId).split('').reduce(function(s, c) { return ((s << 5) - s) + c.charCodeAt(0) | 0; }, 0);

  return `
(function() {
  try {
    var __seed__ = ${seed};
    const nav = ${JSON.stringify(nav)};
    const scr = ${JSON.stringify(screen)};
    const wgl = ${JSON.stringify(webgl)};

    // 简易确定性随机 (Mulberry32, 基于 accountId seed)
    function detRandom() {
      __seed__ |= 0; __seed__ = __seed__ + 0x6D2B79F5 | 0;
      var t = Math.imul(__seed__ ^ __seed__ >>> 15, 1 | __seed__);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // ---- navigator 属性 ----
    const navProps = {
      webdriver: { get: () => undefined },
      hardwareConcurrency: { get: () => nav.hardwareConcurrency || 8 },
      deviceMemory: { get: () => nav.deviceMemory || 8 },
      platform: { get: () => 'Win32' },
      maxTouchPoints: { get: () => 0 },
      languages: { get: () => ['zh-CN', 'zh', 'en'] },
      plugins: { get: () => {
        var len = 5;
        var arr = new Array(len);
        for (var i = 0; i < len; i++) {
          arr[i] = {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format',
            length: 1,
            item: function() { return null; },
            namedItem: function() { return null; }
          };
        }
        Object.defineProperty(arr, 'length', { value: len });
        return arr;
      }},
      cookieEnabled: { get: () => true },
      doNotTrack: { get: () => null },
      vendor: { get: () => 'Google Inc.' },
      vendorSub: { get: () => '' },
      productSub: { get: () => '20030107' },
      appVersion: { get: () => nav.userAgent ? nav.userAgent.replace('Mozilla/', '') : '5.0' },
      appCodeName: { get: () => 'Mozilla' },
      appName: { get: () => 'Netscape' },
    };
    Object.defineProperties(Navigator.prototype, navProps);

    // ---- screen 属性 ----
    if (scr.width && scr.height) {
      Object.defineProperties(Screen.prototype, {
        width: { get: () => scr.width },
        height: { get: () => scr.height },
        availWidth: { get: () => scr.width },
        availHeight: { get: () => scr.height - 40 },
        colorDepth: { get: () => scr.colorDepth || 24 },
        pixelDepth: { get: () => scr.colorDepth || 24 },
      });
    }

    // ---- Canvas 指纹噪声 (HTMLCanvasElement.toDataURL 拦截, 随机多点噪声) ----
    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      var ctx = this.getContext('2d');
      if (ctx) {
        try {
          var w = this.width, h = this.height;
          for (var i = 0; i < 5; i++) {
            var x = Math.floor(Math.random() * w);
            var y = Math.floor(Math.random() * h);
            var px = ctx.getImageData(x, y, 1, 1);
            px.data[0] = (px.data[0] + Math.floor(Math.random() * 3) + 1) % 256;
            ctx.putImageData(px, x, y);
          }
        } catch(e) {}
      }
      return origToDataURL.apply(this, arguments);
    };

    // ---- WebGL 指纹伪装 (42 参数, 无指纹数据时用硬编码默认值兜底) ----
    var _vendor = wgl.vendor || 'Intel Inc.';
    var _renderer = wgl.renderer || 'Intel Iris OpenGL Engine';
    var _version = wgl.version || 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
    var _slv = wgl.shadingLanguageVersion || 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
      var origGetParam = WebGLRenderingContext.prototype.getParameter;
      var origGetExt = WebGLRenderingContext.prototype.getExtension;
      var origGetSuppExt = WebGLRenderingContext.prototype.getSupportedExtensions;

      // 常量映射 (WebGL 1.0 + WebGL 2.0 常用被检测参数)
      var spoofed = new Map([
        // -- 身份信息 --
        [37445, _vendor],                    // UNMASKED_VENDOR_WEBGL
        [37446, _renderer],                  // UNMASKED_RENDERER_WEBGL
        [7936, _vendor],                     // VENDOR
        [7937, _renderer],                   // RENDERER
        [7938, _version],
        [35724, _slv],
        // -- 纹理/视口上限 --
        [3379, 16384],                          // MAX_TEXTURE_SIZE
        [3386, new Int32Array([16384, 16384])],// MAX_VIEWPORT_DIMS
        [34024, 16384],                         // MAX_RENDERBUFFER_SIZE
        [34076, 16384],                         // MAX_CUBE_MAP_TEXTURE_SIZE
        [34047, 16],                            // MAX_TEXTURE_MAX_ANISOTROPY_EXT
        // -- 顶点/着色器能力 --
        [34921, 16],                            // MAX_VERTEX_ATTRIBS
        [36347, 4096],                          // MAX_VERTEX_UNIFORM_VECTORS
        [36348, 32],                            // MAX_VARYING_VECTORS
        [36349, 1024],                          // MAX_FRAGMENT_UNIFORM_VECTORS
        [35661, 80],                            // MAX_COMBINED_TEXTURE_IMAGE_UNITS
        [35660, 16],                            // MAX_VERTEX_TEXTURE_IMAGE_UNITS
        [34930, 16],                            // MAX_TEXTURE_IMAGE_UNITS
        // -- 精度范围 --
        [33902, new Float32Array([1, 1])],     // ALIASED_LINE_WIDTH_RANGE
        [33901, new Float32Array([1, 1024])],  // ALIASED_POINT_SIZE_RANGE
        // -- 像素/颜色位深 --
        [34964, 8],                             // SUBPIXEL_BITS
        [35658, 8],                             // RED_BITS
        [35659, 8],                             // GREEN_BITS
        [35663, 8],                             // BLUE_BITS
        [35662, 8],                             // ALPHA_BITS
        [35664, 24],                            // DEPTH_BITS
        [35665, 8],                             // STENCIL_BITS
        // -- 压缩纹理格式 --
        [34467, new Uint32Array([0x83F0, 0x83F1, 0x83F2, 0x83F3, 0x9274])],
        // -- WebGL 2.0 额外参数 --
        [34852, 8],                             // MAX_DRAW_BUFFERS
        [36063, 8],                             // MAX_COLOR_ATTACHMENTS
        [36183, 16],                            // MAX_SAMPLES
        [35371, 14],                            // MAX_VERTEX_UNIFORM_BLOCKS
        [35373, 14],                            // MAX_FRAGMENT_UNIFORM_BLOCKS
        [35374, 28],                            // MAX_COMBINED_UNIFORM_BLOCKS
        [35375, 72],                            // MAX_UNIFORM_BUFFER_BINDINGS
        [35376, 65536],                         // MAX_UNIFORM_BLOCK_SIZE
        [35377, 233472],                        // MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS
        [35379, 233472],                        // MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS
        [35981, 4294967295],                    // MAX_ELEMENT_INDEX
        [35368, 128],                           // MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS
        [35369, 4],                             // MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS
        [35370, 4],                             // MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS
      ]);

      // 受控扩展列表
      var spoofedExtensions = [
        'EXT_texture_filter_anisotropic',
        'EXT_color_buffer_float',
        'EXT_float_blend',
        'EXT_disjoint_timer_query',
        'EXT_clip_cull_distance',
        'OES_texture_float',
        'OES_texture_float_linear',
        'OES_texture_half_float',
        'OES_texture_half_float_linear',
        'OES_standard_derivatives',
        'OES_element_index_uint',
        'OES_fbo_render_mipmap',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_debug_renderer_info',
        'WEBGL_debug_shaders',
        'WEBGL_lose_context',
        'WEBGL_depth_texture',
        'WEBGL_draw_buffers',
        'WEBGL_multi_draw',
      ];

      WebGLRenderingContext.prototype.getExtension = function(name) {
        return origGetExt.call(this, name);
      };
      WebGLRenderingContext.prototype.getSupportedExtensions = function() {
        return origGetSuppExt.call(this);
      };
      WebGLRenderingContext.prototype.getParameter = function(p) {
        if (spoofed.has(p)) return spoofed.get(p);
        return origGetParam.call(this, p);
      };

      // WebGL 2.0 同步覆盖
      if (typeof WebGL2RenderingContext !== 'undefined') {
        WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getExtension = WebGLRenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
      }

    // ---- AudioContext 指纹噪声 (确定性种子, 基于 accountId) ----
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      var AC = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
      var origCreateOscillator = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function() {
        var osc = origCreateOscillator.call(this);
        var origStart = osc.start;
        osc.start = function(when) {
          if (osc.frequency) {
            var f = osc.frequency.value;
            osc.frequency.value = f + (detRandom() * 0.0001 - 0.00005);
          }
          return origStart.call(this, when);
        };
        return osc;
      };
      if (AC.prototype.createDynamicsCompressor) {
        var origCreateDynComp = AC.prototype.createDynamicsCompressor;
        AC.prototype.createDynamicsCompressor = function() {
          return origCreateDynComp.call(this);
        };
      }
    }

    // ---- WebRTC IP 泄漏防护 (隐形盾: 真实实例 + 方法覆盖, instanceof 原型链完整) ----
    (function() {
      if (typeof RTCPeerConnection === 'undefined') return;
      var _RealRTC = RTCPeerConnection;

      function RTCShield(config) {
        var pc = new _RealRTC(config);
        // 覆盖实例方法, 阻断所有网络活动
        pc.createOffer = function() { return Promise.resolve({ type: 'offer', sdp: '' }); };
        pc.createAnswer = function() { return Promise.resolve({ type: 'answer', sdp: '' }); };
        pc.setLocalDescription = function() { return Promise.resolve(); };
        pc.setRemoteDescription = function() { return Promise.resolve(); };
        pc.addIceCandidate = function() { return Promise.resolve(); };
        pc.createDataChannel = function() { return { close: function(){}, send: function(){} }; };
        pc.close = function() {};
        pc.addEventListener = function() {};
        pc.removeEventListener = function() {};
        pc.getStats = function() { return Promise.resolve(new Map()); };
        return pc;
      }
      RTCShield.prototype = _RealRTC.prototype;
      RTCShield.prototype.constructor = RTCShield;

      try {
        Object.defineProperty(window, 'RTCPeerConnection', {
          value: RTCShield, writable: true, configurable: true
        });
      } catch(e) {
        try { window.RTCPeerConnection = RTCShield; } catch(e2) {}
      }
      if (typeof webkitRTCPeerConnection !== 'undefined') {
        try {
          Object.defineProperty(window, 'webkitRTCPeerConnection', {
            value: RTCShield, writable: true, configurable: true
          });
        } catch(e) {}
      }
      if (typeof mozRTCPeerConnection !== 'undefined') {
        try {
          Object.defineProperty(window, 'mozRTCPeerConnection', {
            value: RTCShield, writable: true, configurable: true
          });
        } catch(e) {}
      }
      console.log('[Matrix Armor] WebRTC 隐形盾已部署 (真实实例+方法覆盖)');
    })();

    // ---- chrome.runtime 抹除 ----
    if (typeof chrome === 'undefined') {
      Object.defineProperty(window, 'chrome', { value: { runtime: {} }, writable: true, configurable: true });
    } else if (!chrome.runtime) {
      chrome.runtime = {};
    }

    // ---- 权限查询伪装 ----
    var origQuery = window.navigator.permissions.query;
    if (origQuery) {
      window.navigator.permissions.query = function(args) {
        if (args.name === 'notifications' || args.name === 'midi' || args.name === 'camera') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return origQuery.call(this, args);
      };
    }

    console.log('[Matrix Armor] 原生反指纹装甲已部署 (BrowserView/CDP)');
  } catch (e) {
    console.warn('[Matrix Armor] 反指纹注入部分失败:', e.message);
  }
})();
`;
}

// ======================================
// 4. 代理解析工具
// ======================================

function parseProxyString(proxyStr) {
  if (!proxyStr) return undefined;
  try {
    const parts = proxyStr.trim().split(':');
    if (parts.length === 4) {
      return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
    } else if (parts.length === 2) {
      return `http://${parts[0]}:${parts[1]}`;
    }
    return proxyStr;
  } catch (e) {
    return undefined;
  }
}

// ======================================
// 5. 核心：原生内嵌沙盒启动
// ======================================

/**
 * 启动原生内嵌账户浏览器
 * @param {string} accountId - 账户唯一ID
 * @param {object} options - { proxy?, headless? }
 * @returns {Promise<{success: boolean, webContents?, view?, sessionId?: string, message?: string}>}
 */
export async function launchEmbeddedAccountBrowser(accountId, options = {}) {
  // 统一键为字符串，避免 Map 查找时类型不匹配
  const key = String(accountId);

  // 已有同账号会话 → 先清理
  if (activeSessions.has(key)) {
    console.log(`[原生沙盒] 账号 ${key} 已有活跃会话，先销毁...`);
    await closeEmbeddedAccountBrowser(key);
  }

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) throw new Error('主窗口未找到');
  const mainWindow = windows[0];

  // --- 生成/加载指纹 ---
  const fingerprintData = getOrCreateFingerprint(key);
  const fp = fingerprintData.fingerprint;
  const headers = fingerprintData.headers || {};

  // --- 提前构建反指纹脚本 (供 CDP 注入 + did-finish-load 备份注入) ---
  const antiFingerprintScript = buildAntiFingerprintScript(fp, key);

  // --- 清除可能损坏的持久化分区数据（SSL 会话/HSTS/证书缓存）---
  try {
    const partitionDir = path.join(app.getPath('userData'), 'Partitions', `chrome_data_${key}`);
    if (fs.existsSync(partitionDir)) {
      // 只删除 SSL 相关文件，保留 Cookies
      const sslFiles = ['TransportSecurity', 'CertificateRevocation', 'CertificateTransparency', 'Cookies-journal'];
      for (const file of sslFiles) {
        const filePath = path.join(partitionDir, file);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
      // 清除 Cache 目录 (含 SSL 会话缓存)
      const cacheDir = path.join(partitionDir, 'Cache');
      if (fs.existsSync(cacheDir)) {
        try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (e) {}
      }
      console.log(`[原生沙盒] 账号 ${key} 分区 SSL 状态已清理`);
    }
  } catch (e) {
    console.warn('[原生沙盒] 清理分区数据失败:', e.message);
  }

  // --- 创建 BrowserView ---
  const view = new BrowserView({
    webPreferences: {
      partition: `persist:chrome_data_${key}`,
      sandbox: false,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  mainWindow.addBrowserView(view);

  const wc = view.webContents;

  // --- 转发 BrowserView 控制台消息到主进程 (诊断用) ---
  wc.on('console-message', (event, level, message) => {
    const prefix = level === 3 ? '[BV:ERROR]' : '[BV:LOG]';
    if (message && message.includes('[Matrix Armor]')) {
      console.log(`[原生沙盒-诊断] ${prefix} ${message}`);
    }
  });

  // 先声明 sessionData，避免事件处理器中 TDZ 崩溃
  let sessionData = null;

  // --- 清除 SSL 会话缓存，避免上次残留导致协议握手失败 ---
  try {
    await wc.session.clearHostResolverCache();
    await wc.session.clearCache();
  } catch (e) {
    console.warn('[原生沙盒] 清除会话缓存失败:', e.message);
  }

  // --- 阻止弹窗外逃 ---
  wc.setWindowOpenHandler(({ url }) => {
    wc.loadURL(url);
    return { action: 'deny' };
  });

  // --- 忽略 SSL 证书错误（代理/自签证书/某些平台 CDN）---
  wc.on('certificate-error', (event, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  // --- 页面加载诊断 + SSL 错误自动恢复 + 备份反指纹注入 ---
  wc.on('did-finish-load', () => {
    try {
      const url = wc.getURL();
      console.log(`[原生沙盒] 账号 ${key} 页面加载完成: ${url}`);
      if (sessionData) sessionData.currentUrl = url;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('account-browser-url-changed', { accountId: key, url });
      }
      // 备份注入: 确保反指纹脚本在每次页面加载后都在 (即使 CDP 注入失败)
      if (url && !url.startsWith('about:') && !url.startsWith('devtools://')) {
        wc.executeJavaScript(antiFingerprintScript).catch(() => {});
      }
    } catch (e) { /* 防止事件回调内异常导致原生层崩溃 */ }
  });
  wc.on('did-navigate', (_event, url) => {
    try {
      if (sessionData) sessionData.currentUrl = url;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('account-browser-url-changed', { accountId: key, url });
      }
    } catch (e) {}
  });
  wc.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      console.error(`[原生沙盒] 账号 ${key} 页面加载失败: ${validatedURL} — ${errorDescription} (code=${errorCode})`);
      const isSSLError = errorCode === -107 || errorCode === -105 || errorCode === -106 || errorCode === -200;
      const retries = sslRetryCount.get(key) || 0;
      if (isSSLError && retries < 2 && validatedURL && !validatedURL.startsWith('about:')) {
        sslRetryCount.set(key, retries + 1);
        console.log(`[原生沙盒] 检测到 SSL 错误 (code=${errorCode})，清除缓存并重试 (${retries + 1}/2)...`);
        try {
          await wc.session.clearHostResolverCache();
          await wc.session.clearCache();
          await sleep(800);
          wc.loadURL(validatedURL);
        } catch (retryErr) {
          console.error(`[原生沙盒] SSL 重试失败:`, retryErr.message);
        }
      }
    }
  });

  // --- 设置 UA ---
  const ua = fp.navigator?.userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  wc.setUserAgent(ua);

  // --- 设置代理 ---
  if (options.proxy) {
    const proxyRules = parseProxyString(options.proxy);
    if (proxyRules) {
      try {
        await wc.session.setProxy({ proxyRules });
        console.log(`[原生沙盒] 代理已设置: ${proxyRules}`);
      } catch (e) {
        console.warn(`[原生沙盒] 代理设置失败:`, e.message);
      }
    }
  }

  // --- CDP 附加 (用于指纹注入 + 强制桌面视口) ---
  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
    }
  } catch (e) {
    console.warn('[原生沙盒] debugger 附加失败:', e.message);
  }

  // --- 加载空白页以初始化 (必须等页面就绪才能注入 CDP 脚本) ---
  await wc.loadURL('about:blank');
  await sleep(500);

  // --- 注入反指纹脚本 (CDP: Page.addScriptToEvaluateOnNewDocument) ---
  try {
    if (wc.debugger.isAttached()) {
      await wc.debugger.sendCommand('Page.enable');
      await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: antiFingerprintScript
      });
      console.log('[原生沙盒] CDP 反指纹脚本已注入 (Page.addScriptToEvaluateOnNewDocument)');
    } else {
      await wc.executeJavaScript(antiFingerprintScript);
      console.log('[原生沙盒] 降级模式：反指纹脚本通过 executeJavaScript 注入');
    }
  } catch (e) {
    console.error('[原生沙盒] CDP 注入失败，尝试降级:', e.message);
    try { await wc.executeJavaScript(antiFingerprintScript); } catch (e2) {}
  }

  // --- CDP 级 WebRTC 防护: 屏蔽 STUN/TURN 服务器域名, 防止真实 IP 泄漏 ---
  try {
    if (wc.debugger.isAttached()) {
      await wc.debugger.sendCommand('Network.setBlockedURLs', {
        urls: ['*://*.stun.*/*', '*://*.turn.*/*', 'stun:*', 'turn:*', '*://*stun*:*/*', '*://*turn*:*/*']
      });
      console.log('[原生沙盒] CDP WebRTC 防护: STUN/TURN 域名已屏蔽');
    }
  } catch (e) {
    console.warn('[原生沙盒] CDP WebRTC 屏蔽失败:', e.message);
  }

  // --- 设置合理初始尺寸 (屏幕外但尺寸正常，加载页面时视口不塌缩) ---
  const [winW, winH] = mainWindow.getSize();
  view.setBounds({ x: -10000, y: -10000, width: Math.round(winW * 0.5), height: Math.round(winH * 0.7) });

  // --- 设置额外请求头 ---
  if (headers['accept-language']) {
    try {
      const ses = wc.session;
      ses.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Accept-Language'] = headers['accept-language'];
        callback({ requestHeaders: details.requestHeaders });
      });
    } catch (e) {}
  }

  // --- 存储会话 ---
  sessionData = {
    view,
    webContents: wc,
    mainWindow,
    accountId,
    fingerprintData,
    currentUrl: 'about:blank'
  };
  activeSessions.set(key, sessionData);

  console.log(`[原生沙盒] 账号 ${key} 原生内嵌浏览器启动成功`);
  return { success: true, webContents: wc, view };
}

// ======================================
// 6. BrowserView 吸附/隐藏
// ======================================

/**
 * 将浏览器画面吸附到主窗口的指定区域
 */
export function attachAccountBrowser(accountId, bounds) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.view) {
    console.warn(`[原生沙盒] 账号 ${key} 无活跃会话`);
    return;
  }
  try {
    if (session.mainWindow && !session.mainWindow.isDestroyed()) {
      session.mainWindow.setTopBrowserView(session.view);
    }
  } catch (e) {}
  try {
    session.view.setBounds(bounds);
  } catch (e) {}
  console.log(`[原生沙盒] 账号 ${accountId} 已吸附:`, bounds);
}

/**
 * 将浏览器隐藏到屏幕外 (不销毁)
 */
export function detachAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.view) return;
  try {
    session.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });
  } catch (e) {}
}

// ======================================
// 7. 关闭与销毁
// ======================================

/**
 * 关闭并销毁内嵌浏览器
 */
export async function closeEmbeddedAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session) return;

  try {
    if (session.view) {
      const wc = session.view.webContents;
      // 中止卡死的导航（如 SSL 协议错误），再强制关闭
      try { wc.stop(); } catch (e) {}
      try { wc.close(); } catch (e) {}
      try { wc.debugger.detach(); } catch (e) {}
      try { session.mainWindow.removeBrowserView(session.view); } catch (e) {}
    }
  } catch (e) {
    console.error('[原生沙盒] 关闭会话出错:', e.message);
  }

  activeSessions.delete(key);
  sslRetryCount.delete(key);
  console.log(`[原生沙盒] 账号 ${key} 会话已销毁`);
}

// ======================================
// 7.5 地址栏导航
// ======================================

export function navigateAccountBrowser(accountId, url) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session) return false;
  let finalUrl = url.trim();
  if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('about:') && !finalUrl.startsWith('file:')) {
    finalUrl = 'https://' + finalUrl;
  }
  session.webContents.loadURL(finalUrl);
  return true;
}

export function getAccountBrowserUrl(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session) return null;
  if (session.currentUrl) return session.currentUrl;
  try {
    if (session.webContents && !session.webContents.isDestroyed()) {
      return session.webContents.getURL();
    }
  } catch (e) {}
  return 'about:blank';
}

export function goBackAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  if (session.webContents.canGoBack()) session.webContents.goBack();
}

export function goForwardAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  if (session.webContents.canGoForward()) session.webContents.goForward();
}

export function reloadAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  session.webContents.reload();
}

export function stopAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  session.webContents.stop();
}

export function openAccountBrowserDevTools(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return false;
  session.webContents.openDevTools({ mode: 'detach' });
  return true;
}

// ======================================
// 8. 状态查询
// ======================================

export function getActiveSessions() {
  const sessions = [];
  for (const [id, session] of activeSessions) {
    try {
      let url = 'about:blank';
      if (session.currentUrl) {
        url = session.currentUrl;
      } else if (session.webContents && !session.webContents.isDestroyed()) {
        url = session.webContents.getURL();
      }
      sessions.push({ accountId: id, currentUrl: url });
    } catch (e) {
      sessions.push({ accountId: id, currentUrl: 'about:blank' });
    }
  }
  return sessions;
}

export function isNativeSandboxActive(accountId) {
  return activeSessions.has(String(accountId));
}

// ======================================
// 9. Cookie 导出 (供 Playwright 侧使用)
// ======================================

/**
 * 将 Electron session 的 cookies 导出为 Playwright storageState 格式
 * 用于将登录态从 BrowserView 同步到 Playwright 自动化流程
 */
export async function exportCookiesForPlaywright(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session) return null;

  try {
    const cookies = await session.webContents.session.cookies.get({});
    const origins = {};

    for (const cookie of cookies) {
      const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
      if (!origins[domain]) {
        origins[domain] = { localStorage: [] };
      }
    }

    const state = { cookies, origins };
    const stateFilePath = path.join(STATES_DIR, `${key}.json.enc`);
    secureAtomicWriteFileSync(stateFilePath, state, key);
    console.log(`[原生沙盒] 账号 ${key} cookies 已导出到 Playwright 兼容格式`);
    return state;
  } catch (e) {
    console.error(`[原生沙盒] Cookie 导出失败:`, e.message);
    return null;
  }
}

/**
 * 从 Playwright 存储格式导入 cookies 到 Electron session
 */
export async function importCookiesFromPlaywright(accountId) {
  const key = String(accountId);
  const stateFilePath = path.join(STATES_DIR, `${key}.json.enc`);
  if (!fs.existsSync(stateFilePath)) return false;

  try {
    const state = secureReadFileSync(stateFilePath, key);
    if (!state.cookies) return false;

    const session = activeSessions.get(key);
    if (!session) return false;

    for (const cookie of state.cookies) {
      const electronCookie = {
        url: (cookie.secure ? 'https' : 'http') + '://' + cookie.domain + cookie.path,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
      };
      if (cookie.expires && cookie.expires !== -1) {
        electronCookie.expirationDate = cookie.expires;
      }
      try {
        await session.webContents.session.cookies.set(electronCookie);
      } catch (e) {}
    }
    console.log(`[原生沙盒] 账号 ${key} cookies 已从 Playwright 格式导入`);
    return true;
  } catch (e) {
    console.error(`[原生沙盒] Cookie 导入失败:`, e.message);
    return false;
  }
}
