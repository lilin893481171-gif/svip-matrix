/**
 * @file account-browser-manager.js
 * @title 原生账户会话管理引擎 — 零 Playwright 依赖，纯 Electron BrowserView
 * @desc 替代 browser-manager.js 的 launchSandbox，用于账户登录场景。
 * 指纹生成沿用 fingerprint-generator (纯JS)，
 * 注入通道使用 webContents.debugger (CDP Page.addScriptToEvaluateOnNewDocument)，
 * 代理使用 session.setProxy()，持久化使用 persist: 分区。
 */

import { BrowserView, BrowserWindow } from 'electron';
import { FingerprintGenerator } from 'fingerprint-generator';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { getDB } from './database.js';
import { attachOnboardingSniffer, teardownOnboardingSniffer } from './account-onboarding.js';
import { getTLSProxyRules, isTLSProxyRunning } from './tls-proxy-launcher.js';
import { secureAtomicWriteFileSync, secureReadFileSync } from '../shared/crypto-io.js';
import { setSession, getSession, removeSession, hasSession, getActiveSessions, getAllSessions, extractSessionIdentity } from './session-store.js';


// ======================================
// 0. 配置与全局状态
// ======================================

const FINGERPRINTS_DIR = path.join(process.cwd(), 'account_fingerprints');
const STATES_DIR = path.join(process.cwd(), 'account_states');

[FINGERPRINTS_DIR, STATES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const sslRetryCount = new Map();  // 防 SSL 重试死循环

let debugPanelMargin = 0

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ======================================
// 1. 安全读写工具 — 由 utils/crypto-io.js 提供
// ======================================

// ======================================
// 2. 指纹生成 (fingerprint-generator 纯JS)
// ======================================

export function getOrCreateSessionProfile(accountId) {
  const fingerprintPath = path.join(FINGERPRINTS_DIR, `${accountId}.json.enc`);

  if (fs.existsSync(fingerprintPath)) {
    try {
      const data = secureReadFileSync(fingerprintPath, accountId);
      console.log(`[Session Manager] 加载账号 [${accountId}] 的固定硬件指纹`);
      return data;
    } catch (error) {
      console.warn(`[Session Manager] 账号 [${accountId}] 指纹文件损坏，重新生成`);
    }
  }

  console.log(`[Session Manager] 为账号 [${accountId}] 生成全新固定硬件指纹`);
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
// 3. 会话环境注入脚本构建 (终极防线)
// ======================================

export function buildSessionEnvironmentScript(fp, accountId) {
  const nav = fp.navigator || {};
  const screen = fp.screen || {};
  const webgl = fp.webgl || {};

  // 基于 accountId 的确定性哈希种子
  var seed = String(accountId).split('').reduce(function(s, c) { return ((s << 5) - s) + c.charCodeAt(0) | 0; }, 0);

  return `
(function() {
  try {
    var __seed__ = ${seed};
    const nav = ${JSON.stringify(nav)};
    const scr = ${JSON.stringify(screen)};
    const wgl = ${JSON.stringify(webgl)};

    // 简易确定性随机 (Mulberry32)
    function detRandom() {
      __seed__ |= 0; __seed__ = __seed__ + 0x6D2B79F5 | 0;
      var t = Math.imul(__seed__ ^ __seed__ >>> 15, 1 | __seed__);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // 无状态空间哈希 (防漂移)
    function getStatelessNoise(seed, index) {
      var h = Math.imul(seed + index | 0, 0x85ebca6b);
      h ^= h >>> 13;
      h = Math.imul(h, 0xc2b2ae35);
      h ^= h >>> 16;
      return h;
    }

    // 🌟 终极修复：原生函数 toString 伪装 (防止俄罗斯套娃级泄漏)
    var _nativeStrings = new WeakMap();
    function makeNative(fn, name) {
      _nativeStrings.set(fn, 'function ' + name + '() { [native code] }');
      return fn;
    }
    var _origFuncToString = Function.prototype.toString;
    Function.prototype.toString = makeNative(function() {
      if (_nativeStrings.has(this)) return _nativeStrings.get(this);
      return _origFuncToString.call(this);
    }, 'toString');

    // ---- navigator 属性伪装 ----
    try {
      // navigator.webdriver: 由 --disable-blink-features=AutomationControlled 从内核层抹除。
      // 禁止在此定义 getter — 属性描述符的存在本身就是特征。
      try { delete Navigator.prototype.webdriver; } catch(e) {}
      try { delete navigator.webdriver; } catch(e) {}
      var navDefs = [
        ['hardwareConcurrency', nav.hardwareConcurrency || 8],
        ['deviceMemory', nav.deviceMemory || 8],
        ['platform', 'Win32'],
        ['maxTouchPoints', 0],
        ['languages', ['zh-CN', 'zh', 'en']],
        ['cookieEnabled', true],
        ['doNotTrack', null],
        ['vendor', 'Google Inc.'],
        ['vendorSub', ''],
        ['productSub', '20030107'],
        ['appCodeName', 'Mozilla'],
        ['appName', 'Netscape']
      ];
      for (var i = 0; i < navDefs.length; i++) {
        try {
          Object.defineProperty(Navigator.prototype, navDefs[i][0], {
            get: function(v) { return function() { return v; }; }(navDefs[i][1]),
            configurable: true
          });
        } catch(e) {}
      }
      try {
        Object.defineProperty(Navigator.prototype, 'plugins', {
          get: function() {
            var _types = [
              [{type:'application/pdf',description:'Portable Document Format',suffixes:'pdf'}],
              [{type:'application/pdf',description:'',suffixes:'pdf'}],
              [{type:'application/x-nacl',description:'Native Client Executable',suffixes:''},{type:'application/x-pnacl',description:'Portable Native Client Executable',suffixes:''}]
            ];
            var _names = ['Chrome PDF Plugin','Chrome PDF Viewer','Native Client'];
            var _files = ['internal-pdf-viewer','mhjfbmdgcfjbbpaeojofohoefgiehjai','internal-nacl-plugin'];
            var _descs = ['Portable Document Format','',''];
            var plugins = [];
            for (var pi = 0; pi < 3; pi++) {
              (function(pIdx) {
                var mimes = [];
                for (var mi = 0; mi < _types[pIdx].length; mi++) {
                  (function(mIdx) {
                    var mime = { type: _types[pIdx][mIdx].type, description: _types[pIdx][mIdx].description, suffixes: _types[pIdx][mIdx].suffixes };
                    Object.defineProperty(mime, 'enabledPlugin', { get: function() { return plugins[pIdx]; }, configurable: true });
                    mimes.push(mime);
                  })(mi);
                }
                var plugin = { name: _names[pIdx], filename: _files[pIdx], description: _descs[pIdx], length: mimes.length };
                plugin.item = function(i) { return i < mimes.length ? mimes[i] : null; };
                plugin.namedItem = function(n) { for (var k=0;k<mimes.length;k++) { if (mimes[k].type===n) return mimes[k]; } return null; };
                // MimeTypeArray 兼容: plugins[pIdx][0] 可索引
                for (var mi2 = 0; mi2 < mimes.length; mi2++) { plugin[mi2] = mimes[mi2]; }
                plugins.push(plugin);
              })(pi);
            }
            // PluginArray 兼容
            plugins.item = function(i) { return i < plugins.length ? plugins[i] : null; };
            plugins.namedItem = function(n) { for (var k=0;k<plugins.length;k++) { if (plugins[k].name===n) return plugins[k]; } return null; };
            plugins.refresh = function() {};
            for (var qi = 0; qi < plugins.length; qi++) { plugins[qi] = plugins[qi]; }
            Object.defineProperty(plugins, 'length', { value: plugins.length });
            return plugins;
          },
          configurable: true
        });
        Object.defineProperty(Navigator.prototype, 'mimeTypes', {
          get: function() {
            var plugins = navigator.plugins;
            var mimes = [];
            for (var i = 0; i < plugins.length; i++) {
              for (var j = 0; j < plugins[i].length; j++) {
                mimes.push(plugins[i][j]);
              }
            }
            mimes.item = function(i) { return i < mimes.length ? mimes[i] : null; };
            mimes.namedItem = function(n) { for (var k=0;k<mimes.length;k++) { if (mimes[k].type===n) return mimes[k]; } return null; };
            for (var mi = 0; mi < mimes.length; mi++) { mimes[mi] = mimes[mi]; }
            Object.defineProperty(mimes, 'length', { value: mimes.length });
            return mimes;
          },
          configurable: true
        });
      } catch(e) {}
      try {
        Object.defineProperty(Navigator.prototype, 'appVersion', {
          get: function() { return nav.userAgent ? nav.userAgent.replace('Mozilla/', '') : '5.0'; },
          configurable: true
        });
      } catch(e) {}
    } catch(e) {}

    // ---- screen 属性伪装 (双重覆盖防穿透) ----
    try {
      var _w = scr.width || 1920;
      var _h = scr.height || 1080;
      var _cd = scr.colorDepth || 24;
      var scrDefs = [
        ['width', _w],
        ['height', _h],
        ['availWidth', _w],
        ['availHeight', _h - 40],
        ['colorDepth', _cd],
        ['pixelDepth', _cd]
      ];
      for (var i = 0; i < scrDefs.length; i++) {
        try {
          Object.defineProperty(Screen.prototype, scrDefs[i][0], {
            get: function(v) { return function() { return v; }; }(scrDefs[i][1]),
            configurable: true
          });
        } catch(e) {}
      }
      try {
        Object.defineProperty(screen, 'width', { get: function() { return _w; }, configurable: true });
        Object.defineProperty(screen, 'height', { get: function() { return _h; }, configurable: true });
        Object.defineProperty(screen, 'availWidth', { get: function() { return _w; }, configurable: true });
        Object.defineProperty(screen, 'availHeight', { get: function() { return _h - 40; }, configurable: true });
        Object.defineProperty(screen, 'colorDepth', { get: function() { return _cd; }, configurable: true });
        Object.defineProperty(screen, 'pixelDepth', { get: function() { return _cd; }, configurable: true });
      } catch(e) {}
    } catch(e) {}

    // ---- WebGL 1.0 & 2.0 指纹伪装 (仅身份参数, 不碰像素数据/容量) ----
    try {
      var _vendor = wgl.vendor || 'Intel Inc.';
      var _renderer = wgl.renderer || 'Intel Iris OpenGL Engine';
      var _version = wgl.version || 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
      var _slv = wgl.shadingLanguageVersion || 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
      
      var origGetParam = WebGLRenderingContext.prototype.getParameter;
      var origGetExt = WebGLRenderingContext.prototype.getExtension;
      var origGetSuppExt = WebGLRenderingContext.prototype.getSupportedExtensions;

      // 仅伪装 GPU 身份参数 (vendor/renderer/version)，不碰容量限制值
      // 容量虚报会导致 WASM 按错误上限分配内存 → RuntimeError: memory access out of bounds
      var spoofed = new Map([
        [37445, _vendor],   // UNMASKED_VENDOR_WEBGL
        [37446, _renderer], // UNMASKED_RENDERER_WEBGL
        [7936, _vendor],    // VENDOR
        [7937, _renderer],  // RENDERER
        [7938, _version],   // VERSION
        [35724, _slv]       // SHADING_LANGUAGE_VERSION
      ]);

      WebGLRenderingContext.prototype.getExtension = makeNative(function(name) {
        return origGetExt.call(this, name);
      }, 'getExtension');
      WebGLRenderingContext.prototype.getSupportedExtensions = makeNative(function() {
        return origGetSuppExt.call(this);
      }, 'getSupportedExtensions');
      WebGLRenderingContext.prototype.getParameter = makeNative(function(p) {
        if (spoofed.has(p)) return spoofed.get(p);
        return origGetParam.call(this, p);
      }, 'getParameter');

      // readPixels 不碰 — 传入的 TypedArray 由 WASM 分配，越界修改会触发 memory access out of bounds
      // 仅 getParameter 做身份伪装，不做像素修改

      if (typeof WebGL2RenderingContext !== 'undefined') {
        var origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = makeNative(function(p) {
          if (spoofed.has(p)) return spoofed.get(p);
          return origGetParam2.call(this, p);
        }, 'getParameter');

        var origGetExt2 = WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension = makeNative(function(name) {
          return origGetExt2.call(this, name);
        }, 'getExtension');

        var origGetSuppExt2 = WebGL2RenderingContext.prototype.getSupportedExtensions;
        WebGL2RenderingContext.prototype.getSupportedExtensions = makeNative(function() {
          return origGetSuppExt2.call(this);
        }, 'getSupportedExtensions');
      }
    } catch(e) {}

    // ---- Canvas 2D 指纹噪声 (toBlob / toDataURL / getImageData 全覆盖) ----
    // 小红书 WAF 依赖 Canvas 哈希识别 GPU 渲染特征。对像素末尾字节加 ±1 噪声，
    // 肉眼不可见但完全改变哈希值，打破基于 Canvas 指纹的设备追踪。
    try {
    (function() {
      var ctxProto = CanvasRenderingContext2D.prototype;

      // getImageData — 核心读取路径，toDataURL/toBlob 底层都走这里
      var origGetImageData = ctxProto.getImageData;
      ctxProto.getImageData = makeNative(function(x, y, w, h) {
        var imageData = origGetImageData.call(this, x, y, w, h);
        var data = imageData.data;
        // 只改 alpha 通道最后一个 bit（±0 或 ±1），哈希彻底改变，视觉零影响
        for (var i = 3; i < data.length; i += 4) {
          var delta = (detRandom() > 0.5 ? 1 : -1);
          var newVal = data[i] + delta;
          data[i] = newVal < 0 ? 0 : (newVal > 255 ? 255 : newVal);
        }
        return imageData;
      }, 'getImageData');

      // toBlob — 走全流程重绘：创建临时 canvas + 噪声 putImageData → 原始 toBlob
      if (ctxProto.toBlob) {
        var origToBlob = ctxProto.toBlob;
        ctxProto.toBlob = makeNative(function(type, quality) {
          try {
            var w = this.canvas.width;
            var h = this.canvas.height;
            if (w > 0 && h > 0) {
              var rawData = origGetImageData.call(this, 0, 0, w, h);
              var data = rawData.data;
              for (var i = 3; i < data.length; i += 4) {
                var delta = (detRandom() > 0.5 ? 1 : -1);
                var newVal = data[i] + delta;
                data[i] = newVal < 0 ? 0 : (newVal > 255 ? 255 : newVal);
              }
              this.putImageData(rawData, 0, 0);
            }
          } catch(e) {}
          return origToBlob.call(this, type, quality);
        }, 'toBlob');
      }

      // toDataURL — 确保噪声覆盖
      if (ctxProto.toDataURL) {
        var origToDataURL = ctxProto.toDataURL;
        ctxProto.toDataURL = makeNative(function(type, quality) {
          try {
            var w = this.canvas.width;
            var h = this.canvas.height;
            if (w > 0 && h > 0) {
              var rawData = origGetImageData.call(this, 0, 0, w, h);
              var data = rawData.data;
              for (var i = 3; i < data.length; i += 4) {
                var delta = (detRandom() > 0.5 ? 1 : -1);
                var newVal = data[i] + delta;
                data[i] = newVal < 0 ? 0 : (newVal > 255 ? 255 : newVal);
              }
              this.putImageData(rawData, 0, 0);
            }
          } catch(e) {}
          return origToDataURL.call(this, type, quality);
        }, 'toDataURL');
      }
    })();
    } catch(e) {}

    // ---- AudioContext 指纹噪声 ----
    try {
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      var AC = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
      var origCreateOscillator = AC.prototype.createOscillator;
      AC.prototype.createOscillator = makeNative(function() {
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
      }, 'createOscillator');
      if (AC.prototype.createDynamicsCompressor) {
        var origCreateDynComp = AC.prototype.createDynamicsCompressor;
        AC.prototype.createDynamicsCompressor = makeNative(function() {
          return origCreateDynComp.call(this);
        }, 'createDynamicsCompressor');
      }
    }
    } catch(e) {}

    // ---- WebRTC IP 泄漏防护 (柔性盾 JS 层兜底) ----
    try {
    (function() {
      if (typeof RTCPeerConnection === 'undefined') return;
      var _RealRTC = RTCPeerConnection;
      function maskIPs(str) {
        return str.replace(/(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})/g, function(m, a, b, c, d) {
          if (m === '0.0.0.0' || a === '127') return m;
          var h = 0;
          for (var i = 0; i < m.length; i++) h = ((h << 5) - h) + m.charCodeAt(i) | 0;
          return '10.' + (((h & 0xFE00) >> 8) | 1) + '.' + ((h & 0xFE) | 1) + '.' + (((h & 0xFE0000) >> 16) | 1);
        });
      }

      function RTCShield(config) {
        var pc = new _RealRTC(config);
        var _origCreateOffer = pc.createOffer.bind(pc);
        pc.createOffer = function() {
          var args = arguments;
          return _origCreateOffer.apply(this, args).then(function(offer) {
            if (offer && offer.sdp) { try { return { type: offer.type, sdp: maskIPs(offer.sdp) }; } catch(e) {} }
            return offer;
          });
        };
        var _origCreateAnswer = pc.createAnswer.bind(pc);
        pc.createAnswer = function() {
          var args = arguments;
          return _origCreateAnswer.apply(this, args).then(function(answer) {
            if (answer && answer.sdp) { try { return { type: answer.type, sdp: maskIPs(answer.sdp) }; } catch(e) {} }
            return answer;
          });
        };
        var _origSetLocal = pc.setLocalDescription.bind(pc);
        pc.setLocalDescription = function(desc) {
          if (desc && desc.sdp) { try { desc = { type: desc.type, sdp: maskIPs(desc.sdp) }; } catch(e) {} }
          return _origSetLocal(desc);
        };
        var _origAddIce = pc.addIceCandidate.bind(pc);
        pc.addIceCandidate = function(cand) {
          if (cand && cand.candidate) {
            try { cand = { candidate: maskIPs(cand.candidate), sdpMid: cand.sdpMid, sdpMLineIndex: cand.sdpMLineIndex }; } catch(e) {}
          }
          return _origAddIce(cand);
        };
        var _origAddEventListener = pc.addEventListener.bind(pc);
        pc.addEventListener = function(type, listener, options) {
          if (type === 'icecandidate') {
            var wrappedListener = function(e) {
              if (e && e.candidate && e.candidate.candidate) {
                try {
                  var fakeEvent = Object.create(e);
                  fakeEvent.candidate = {
                    candidate: maskIPs(e.candidate.candidate),
                    sdpMid: e.candidate.sdpMid,
                    sdpMLineIndex: e.candidate.sdpMLineIndex,
                    address: e.candidate.address,
                    port: e.candidate.port,
                    protocol: e.candidate.protocol,
                    type: e.candidate.type,
                    tcpType: e.candidate.tcpType,
                    relatedAddress: e.candidate.relatedAddress,
                    relatedPort: e.candidate.relatedPort,
                    usernameFragment: e.candidate.usernameFragment
                  };
                  return listener(fakeEvent);
                } catch(ex) { return listener(e); }
              }
              return listener(e);
            };
            return _origAddEventListener(type, wrappedListener, options);
          }
          return _origAddEventListener(type, listener, options);
        };
        var _origCreateDC = pc.createDataChannel.bind(pc);
        pc.createDataChannel = function(label, opts) { return _origCreateDC(label, opts); };

        // onicecandidate: 先走原生 setter 注册 wrapper 到 C++ 事件 map, 再 shadow 属性
        var _userIceHandler = null;
        pc.onicecandidate = function(e) {
          if (_userIceHandler) {
            if (e && e.candidate && e.candidate.candidate) {
              try {
                var fakeEvent = Object.create(e);
                fakeEvent.candidate = {
                  candidate: maskIPs(e.candidate.candidate),
                  sdpMid: e.candidate.sdpMid,
                  sdpMLineIndex: e.candidate.sdpMLineIndex,
                  address: e.candidate.address,
                  port: e.candidate.port,
                  protocol: e.candidate.protocol,
                  type: e.candidate.type,
                  tcpType: e.candidate.tcpType,
                  relatedAddress: e.candidate.relatedAddress,
                  relatedPort: e.candidate.relatedPort,
                  usernameFragment: e.candidate.usernameFragment
                };
                return _userIceHandler(fakeEvent);
              } catch(ex) {}
            }
            return _userIceHandler(e);
          }
        };
        Object.defineProperty(pc, 'onicecandidate', {
          get: function() { return _userIceHandler; },
          set: function(fn) { _userIceHandler = fn; },
          configurable: true, enumerable: true
        });

        return pc;
      }
      RTCShield.prototype = _RealRTC.prototype;
      RTCShield.prototype.constructor = RTCShield;

      try { Object.defineProperty(window, 'RTCPeerConnection', { value: RTCShield, writable: true, configurable: true }); } catch(e) {}
      if (typeof webkitRTCPeerConnection !== 'undefined') { try { Object.defineProperty(window, 'webkitRTCPeerConnection', { value: RTCShield, writable: true, configurable: true }); } catch(e) {} }
      if (typeof mozRTCPeerConnection !== 'undefined') { try { Object.defineProperty(window, 'mozRTCPeerConnection', { value: RTCShield, writable: true, configurable: true }); } catch(e) {} }
      console.log('[Matrix Shield] WebRTC 网络策略已部署 (SDP/IP 掩码 + onicecandidate 原生setter + addEventListener + CDP STUN/TURN 屏蔽)');
    })();
    } catch(e) {}

    // ---- Network Information API 伪装 (navigator.connection) ----
    try {
    if ('connection' in navigator) {
      var _conn = navigator.connection;
      if (_conn) {
        var _spoofRtt = 50;
        Object.defineProperty(_conn, 'rtt', { get: function() { return _spoofRtt + Math.round((detRandom() - 0.5) * 10); }, configurable: true });
        Object.defineProperty(_conn, 'downlink', { get: function() { return 10; }, configurable: true });
        Object.defineProperty(_conn, 'effectiveType', { get: function() { return '4g'; }, configurable: true });
        Object.defineProperty(_conn, 'saveData', { get: function() { return false; }, configurable: true });
      }
    } else {
      try {
        Object.defineProperty(navigator, 'connection', {
          get: function() { return { rtt: 50, downlink: 10, effectiveType: '4g', saveData: false, type: 'cellular' }; },
          configurable: true
        });
      } catch(e) {}
    }
    } catch(e) {}

    // ---- Battery API 抹除 (高熵指纹向量) ----
    try {
    if (navigator.getBattery) {
      navigator.getBattery = makeNative(function() {
        return Promise.resolve({
          charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1,
          onchargingchange: null, onchargingtimechange: null, ondischargingtimechange: null, onlevelchange: null,
          addEventListener: function() {}, removeEventListener: function() {}
        });
      }, 'getBattery');
    }
    } catch(e) {}

    // ---- chrome.runtime 抹除 (真实结构而非空壳) ----
    try {
    (function() {
      if (typeof chrome === 'undefined') {
        var _chrome = { runtime: {} };
        Object.defineProperty(window, 'chrome', { value: _chrome, writable: true, configurable: true });
      } else if (!chrome.runtime) {
        chrome.runtime = {};
      }
      // 填充标准 API 桩 — 存在但返回合理值，防止特征检测判定为篡改
      var rt = chrome.runtime;
      var noop = function() {};
      var methods = {
        connect: function() {
          var port = { name: '', onMessage: { addListener: noop, removeListener: noop }, onDisconnect: { addListener: noop, removeListener: noop }, postMessage: noop, disconnect: noop };
          return port;
        },
        sendMessage: function(extId, msg, opts, cb) {
          var callback = typeof opts === 'function' ? opts : (typeof cb === 'function' ? cb : noop);
          if (typeof callback === 'function') setTimeout(function() { callback(); }, 0);
        },
        getManifest: function() { return { version: '1.0', name: '' }; },
        getURL: function(p) { return 'chrome-extension://' + (p || ''); },
        getPlatformInfo: function(cb) { setTimeout(function() { cb({ os: 'win', arch: 'x86-64', nacl_arch: 'x86-64' }); }, 0); },
        onMessage: { addListener: noop, removeListener: noop },
        onConnect: { addListener: noop, removeListener: noop },
        onInstalled: { addListener: noop, removeListener: noop },
        id: undefined,
        lastError: undefined
      };
      for (var k in methods) {
        if (!(k in rt)) {
          Object.defineProperty(rt, k, { value: methods[k], writable: true, configurable: true, enumerable: typeof methods[k] !== 'function' });
        }
      }
    })();
    } catch(e) {}

    // ---- 权限查询伪装 (全覆盖) ----
    try {
    var origQuery = window.navigator.permissions.query;
    if (origQuery) {
      // 补全 PermissionStatus 原型链 — 小红书 WAF 会检查原型是否为真实的 PermissionStatus，
      // 返回纯对象 { state: 'prompt' } 会因缺少 onchange addEventListener 等方法被判定为自动化环境
      var _psProto = null;
      try {
        // 先从真实 query 偷一个 PermissionStatus 做原型（导航到任何正常页面后都有）
        origQuery.call(navigator.permissions, { name: 'notifications' }).then(function(real) {
          if (real && real.constructor && real.constructor.prototype) {
            _psProto = real.constructor.prototype;
          }
        }).catch(function(){});
      } catch(e) {}

      window.navigator.permissions.query = makeNative(function(args) {
        var name = args && args.name;
        // 所有可能被指纹采集的权限 → 返回 prompt (正常浏览器默认态)
        if (name === 'notifications' || name === 'midi' || name === 'camera' ||
            name === 'microphone' || name === 'geolocation' || name === 'clipboard-read' ||
            name === 'clipboard-write' || name === 'payment-handler' || name === 'background-sync' ||
            name === 'persistent-storage' || name === 'ambient-light-sensor' ||
            name === 'accelerometer' || name === 'gyroscope' || name === 'magnetometer') {
          return Promise.resolve().then(function() {
            var fake = Object.create(_psProto || {});
            Object.defineProperties(fake, {
              state: { value: 'prompt', enumerable: true, configurable: true },
              onchange: { value: null, enumerable: true, configurable: true, writable: true }
            });
            // addEventListener / removeEventListener 标准 EventTarget 方法
            fake.addEventListener = function(type, listener) {};
            fake.removeEventListener = function(type, listener) {};
            return fake;
          });
        }
        return origQuery.call(this, args);
      }, 'query');
    }
    } catch(e) {}

    // ---- Notification API 伪装 ----
    try {
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', {
        get: function() { return 'default'; },
        configurable: true
      });
    }
    } catch(e) {}

    // ---- chrome.loadTimes / chrome.csi 抹除 (Chrome 专有API，Electron 不暴露) ----
    try {
    if (typeof chrome !== 'undefined') {
      if (!chrome.loadTimes) {
        chrome.loadTimes = makeNative(function() {
          return {
            requestTime: Date.now() / 1000,
            startLoadTime: Date.now() / 1000 - 0.5,
            commitLoadTime: Date.now() / 1000 - 0.3,
            finishDocumentLoadTime: Date.now() / 1000 - 0.1,
            finishLoadTime: Date.now() / 1000,
            firstPaintTime: Date.now() / 1000 - 0.2,
            firstPaintAfterLoadTime: Date.now() / 1000 - 0.05,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: false,
            npnNegotiatedProtocol: 'unknown',
            connectionInfo: 'http/1.1',
            wasAlternateProtocolAvailable: false
          };
        }, 'loadTimes');
      }
      if (!chrome.csi) {
        chrome.csi = makeNative(function() {
          return { startE: Date.now() - 2000, onloadT: Date.now() - 1500, pageT: Math.random() * 500 + 500, tran: 15 };
        }, 'csi');
      }
      if (!chrome.app) {
        Object.defineProperty(chrome, 'app', {
          value: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
          writable: true, configurable: true
        });
      }
    }
    } catch(e) {}

    // ---- MediaDevices 硬件型号伪装 (防物理隔离泄漏) ----
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        var origEnumerate = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = makeNative(function() {
          return origEnumerate.call(this).then(function(devices) {
            return devices.map(function(device) {
              var spoofed = {
                kind: device.kind,
                deviceId: device.deviceId,
                groupId: device.groupId,
                label: device.label
              };
              if (device.kind === 'audioinput') {
                spoofed.label = 'Default - Microphone (High Definition Audio Device)';
                var fakeId = Math.floor(detRandom() * 1000000000).toString(16);
                spoofed.deviceId = 'audio-in-' + fakeId;
                spoofed.groupId = 'group-' + fakeId;
              } else if (device.kind === 'videoinput') {
                spoofed.label = 'HD Webcam (' + Math.floor(detRandom() * 1000).toString(16).toUpperCase() + ')';
                var fakeVid = Math.floor(detRandom() * 1000000000).toString(16);
                spoofed.deviceId = 'video-in-' + fakeVid;
                spoofed.groupId = 'group-' + fakeVid;
              }
              return spoofed;
            });
          });
        }, 'enumerateDevices');
      }
    } catch(e) {}

    // ---- 字体枚举伪装 (queryLocalFonts 拦截) ----
    if (typeof window.queryLocalFonts === 'function') {
      var _spoofedFonts = [
        { family: 'Arial', fullName: 'Arial', postscriptName: 'ArialMT', style: 'Regular' },
        { family: 'Arial', fullName: 'Arial Bold', postscriptName: 'Arial-BoldMT', style: 'Bold' },
        { family: 'Times New Roman', fullName: 'Times New Roman', postscriptName: 'TimesNewRomanPSMT', style: 'Regular' },
        { family: 'Verdana', fullName: 'Verdana', postscriptName: 'Verdana', style: 'Regular' },
        { family: 'Microsoft YaHei', fullName: 'Microsoft YaHei', postscriptName: 'MicrosoftYaHei', style: 'Regular' }
      ];
      window.queryLocalFonts = makeNative(function() {
        return Promise.resolve(_spoofedFonts);
      }, 'queryLocalFonts');
    }

    // ---- 锁定页面可见性 — 防止 BrowserView 隐藏/显示导致页面重载 ----
    try {
    (function() {
      Object.defineProperty(document, 'hidden', {
        get: function() { return false; },
        configurable: true
      });
      Object.defineProperty(document, 'visibilityState', {
        get: function() { return 'visible'; },
        configurable: true
      });
      document.addEventListener('visibilitychange', function(e) {
        e.stopImmediatePropagation();
      }, true);
      window.addEventListener('pagehide', function(e) {
        e.stopImmediatePropagation();
      }, true);
      console.log('[Matrix Shield] page visibility locked');
    })();
    } catch(e) {}

    console.log('[Matrix Shield] 原生会话环境配置已部署 (BrowserView/CDP)');
  } catch (e) {
    console.warn('[Matrix Shield] 环境配置注入部分失败:', e.message);
  }
})();
`;
}

// ======================================
// 4. 代理解析工具 — 由 utils/proxy.js 提供（toSocks5）
// ======================================

// ======================================
// 5. 核心：原生嵌入式会话容器启动
// ======================================

export async function launchEmbeddedAccountBrowser(accountId, options = {}) {
  const key = String(accountId);

  const existingSession = getSession(key);
  if (existingSession) {
    console.log(`[Session Manager] 账号 ${key} 已有活跃会话，直接复用。`);
    const { view, webContents, mainWindow } = existingSession;

    if (options.targetUrl && webContents.getURL() !== options.targetUrl) {
      console.log(`[Session Manager] 导航到新目标: ${options.targetUrl}`);
      webContents.loadURL(options.targetUrl);
    }

    // 确保 BrowserView 在顶层
    if (mainWindow && !mainWindow.isDestroyed() && view) {
      // bring-to-front
      mainWindow.setTopBrowserView(view);
    }

    return { success: true, webContents, view, reused: true };
  }

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) throw new Error('主窗口未找到');
  const mainWindow = windows[0];

  const fingerprintData = getOrCreateSessionProfile(key);
  const fp = fingerprintData.fingerprint;
  const headers = fingerprintData.headers || {};
  const sessionEnvironmentScript = buildSessionEnvironmentScript(fp, key);

  // SSL / 缓存清理（异步，不阻塞）
  const partitionDir = path.join(app.getPath('userData'), 'Partitions', `chrome_data_${key}`);
  if (fs.existsSync(partitionDir)) {
    const sslFiles = ['TransportSecurity', 'CertificateRevocation', 'CertificateTransparency'];
    for (const file of sslFiles) {
      const filePath = path.join(partitionDir, file);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
  }

  const view = new BrowserView({
    webPreferences: {
      partition: `persist:chrome_data_${key}`,
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: true
    }
  });

  mainWindow.addBrowserView(view);
  // 初始离屏视口与 JS 层伪造分辨率 (1920x1080) 对齐，消除物理/逻辑分辨率指纹差异
  view.setBounds({ x: -10000, y: -10000, width: 1920, height: 1080 });
  const wc = view.webContents;

  // 🌟 核心防御：Session 级 WebRTC 物理隔离 (国内直连模式) 🌟
  try {
    if (typeof wc.session.setWebRTCIPHandlingPolicy === 'function') {
      wc.session.setWebRTCIPHandlingPolicy('default_public_interface_only');
    }
  } catch (e) {
    console.warn('[Session Manager] WebRTC 分区策略设置失败:', e.message);
  }

  wc.on('console-message', (event, level, message) => {
    const prefix = level === 3 ? '[BV:ERROR]' : '[BV:LOG]';
    if (message && message.includes('[Matrix Shield]')) {
      console.log(`[原生会话容器-诊断] ${prefix} ${message}`);
    }
    if (level === 3) {
      console.log(`[BV:JS_ERR] ${message}`);
    }
  });

  wc.on('page-error', (_event, message, source, lineno) => {
    console.log(`[BV:PAGE_ERR] ${source}:${lineno} ${message}`);
  });

  wc.setWindowOpenHandler(({ url }) => {
    wc.loadURL(url);
    return { action: 'deny' };
  });

  wc.on('certificate-error', (event, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  // ─── 静默身份提取防抖 (避免重复导航时频发提取) ───
  const identityExtractDebounce = new Map();

  wc.on('did-finish-load', () => {
    try {
      const url = wc.getURL();
      if (sessionData) sessionData.currentUrl = url;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('account-browser-url-changed', { accountId: key, url });
      }
      if (url && !url.startsWith('about:') && !url.startsWith('devtools://')) {
        wc.executeJavaScript(sessionEnvironmentScript).catch(() => {});
      }

      // 🔑 v6 静默身份提取: B站会员中心页面加载完成 → 自动提取 Cookie/UA/bili_jct
      if (url && url.includes('member.bilibili.com')) {
        const lastExtract = identityExtractDebounce.get(key) || 0;
        const now = Date.now();
        if (now - lastExtract > 15_000) { // 15秒防抖
          identityExtractDebounce.set(key, now);
          // 延迟 3s 等登录态 Cookie 完全写入
          setTimeout(async () => {
            try {
              if (!sessionData || !sessionData.webContents || sessionData.webContents.isDestroyed()) return;
              let ua = 'unknown';
              try { ua = sessionData.webContents.getUserAgent() } catch (_) {}
              const identity = await extractSessionIdentity(sessionData.webContents.session, key, ua);
              sessionData.identity = identity;
              sessionData.identityExtractedAt = Date.now();
              console.log('[Identity] 静默提取完成:', {
                accountId: key,
                cookies: identity.cookies.slice(0, 60) + '...',
                hasBiliJct: !!identity.biliJct,
                uaPreview: identity.ua.slice(0, 60) + '...',
              });
            } catch (e) {
              console.warn('[Identity] 静默提取失败:', e.message);
            }
          }, 3000);
        }
      }
    } catch (e) {}
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
      const isSSLError = errorCode === -107 || errorCode === -105 || errorCode === -106 || errorCode === -200;
      const retries = sslRetryCount.get(key) || 0;
      if (isSSLError && retries < 2 && validatedURL && !validatedURL.startsWith('about:')) {
        sslRetryCount.set(key, retries + 1);
        try {
          await wc.session.clearHostResolverCache();
          await wc.session.clearCache();
          await sleep(800);
          wc.loadURL(validatedURL);
        } catch (retryErr) {}
      }
    }
  });

  // 动态读取 Chromium 版本号，确保 UA 与实际浏览器引擎匹配
  const chromeVer = process.versions.chrome || '132.0.0.0';
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
  wc.setUserAgent(ua);

  // 🔐 TLS 代理 (Node.js CONNECT 隧道)
  if (isTLSProxyRunning()) {
    try {
      await wc.session.setProxy({
        proxyRules: getTLSProxyRules(),
        bypassRules: 'localhost;127.0.0.1;<local>',
      });
      console.log(`[会话容器] TLS 代理已挂载: ${getTLSProxyRules()}`);
    } catch (e) {
      console.warn('[会话容器] TLS 代理挂载失败:', e.message);
    }
  }

  if (options.proxy) {
    console.log(`[会话容器] 账户代理已跳过（TLS 代理优先）: ${options.proxy}`);
  }

  // ─── 会话引导：先 about:blank 初始化 persist: 分区存储层 ───
  //   直接加载微信等重定向站点会因存储层未就绪而 ERR_ABORTED(-3)

  // CDP 调试器在 first paint 前挂载
  try { if (!wc.debugger.isAttached()) wc.debugger.attach('1.3'); } catch (e) {}

  await new Promise((resolve) => {
    const done = () => { wc.removeListener('did-finish-load', done); resolve(); };
    wc.on('did-finish-load', done);
    wc.loadURL('about:blank');
  });

  // --- CDP 注入（分区存储层已就绪，可安全注册脚本）---
  try {
    if (wc.debugger.isAttached()) {
      await wc.debugger.sendCommand('Page.enable');
      await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: sessionEnvironmentScript
      });
      await wc.debugger.sendCommand('Network.setBlockedURLs', {
        urls: ['*://*.stun.*/*', '*://*.turn.*/*', 'stun:*', 'turn:*', '*://*stun*:*/*', '*://*turn*:*/*']
      });
      console.log('[Session Manager] CDP 会话环境脚本已注入');
    } else {
      await wc.executeJavaScript(sessionEnvironmentScript);
    }
  } catch (e) {
    try { await wc.executeJavaScript(sessionEnvironmentScript); } catch (e2) {}
  }

  const [winW, winH] = mainWindow.getSize();
  view.setBounds({ x: -10000, y: -10000, width: Math.round(winW * 0.5), height: Math.round(winH * 0.7) });

  if (headers['accept-language']) {
    try {
      const ses = wc.session;
      ses.webRequest.onBeforeSendHeaders((details, callback) => {
        // 跳过文件上传请求 — multipart/form-data 的 boundary 和 Cookie 由 Chromium 托管
        const ct = (details.requestHeaders || {})['Content-Type'] || '';
        if (ct.includes('multipart/form-data')) {
          callback({ cancel: false });
          return;
        }
        // 原地修改，不 pass back requestHeaders — Cookie 在 Chromium 网络栈中晚于
        // onBeforeSendHeaders 注入，显式传回会清掉尚未附加的 Cookie 导致 401/跳登录
        details.requestHeaders['Accept-Language'] = headers['accept-language'];
        callback({ cancel: false });
      });
    } catch (e) {}
  }

  let sessionData = {
    view,
    webContents: wc,
    mainWindow,
    accountId,
    fingerprintData,
    currentUrl: options.targetUrl || 'about:blank'
  };
  setSession(key, sessionData);

  // ─── 加载目标 URL ───
  if (options.targetUrl) {
    wc.loadURL(options.targetUrl);
  }

  // ─── 入网嗅探：启动 API 拦截 + DOM 兜底 ───
  const { platform } = options;
  if (platform) {
    attachOnboardingSniffer(wc, accountId, platform);
  }

  return { success: true, webContents: wc, view };
}

// ======================================
// 6. BrowserView 吸附/隐藏
// ======================================

export function attachAccountBrowser(accountId, bounds) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.view) return;
  try {
    if (session.mainWindow && !session.mainWindow.isDestroyed()) {
      session.mainWindow.setTopBrowserView(session.view);
    }
  } catch (e) {}
  try {
    // 保存原始 bounds，用于调试面板开关时恢复
    session._lastBounds = { ...bounds }
    const adjusted = debugPanelMargin > 0
      ? { ...bounds, width: Math.max(200, bounds.width - debugPanelMargin) }
      : bounds
    session.view.setBounds(adjusted);
    const targetWidth = 1280;
    const zoom = Math.min(1, Math.max(0.25, adjusted.width / targetWidth));
    session.webContents.setZoomFactor(zoom);
  } catch (e) {}
}

export function setDebugPanelMargin(margin) {
  debugPanelMargin = margin
  for (const [key, session] of getAllSessions()) {
    if (!session.view || !session._lastBounds) continue
    try {
      const base = session._lastBounds
      const adjusted = margin > 0
        ? { ...base, width: Math.max(200, base.width - margin) }
        : { ...base }
      session.view.setBounds(adjusted)
      const targetWidth = 1280;
      const zoom = Math.min(1, Math.max(0.25, adjusted.width / targetWidth));
      session.webContents.setZoomFactor(zoom);
    } catch (e) { /* ignore */ }
  }
}

export function detachAccountBrowser(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.view) return;
  try {
    session.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });
  } catch (e) {}
}

// ======================================
// 7. 关闭与销毁
// ======================================

export async function closeEmbeddedAccountBrowser(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session) return;

  // 清理入网嗅探
  teardownOnboardingSniffer(key);

  try {
    if (session.view) {
      const wc = session.view.webContents;
      try { wc.stop(); } catch (e) {}
      try { wc.close(); } catch (e) {}
      try { wc.debugger.detach(); } catch (e) {}
      try { session.mainWindow.removeBrowserView(session.view); } catch (e) {}
    }
  } catch (e) {}

  removeSession(key);
  sslRetryCount.delete(key);
}

// ======================================
// 7.5 地址栏导航 & 操作
// ======================================

export function navigateAccountBrowser(accountId, url) {
  const key = String(accountId);
  const session = getSession(key);
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
  const session = getSession(key);
  if (!session) return null;
  if (session.currentUrl) return session.currentUrl;
  try {
    if (session.webContents && !session.webContents.isDestroyed()) return session.webContents.getURL();
  } catch (e) {}
  return 'about:blank';
}

export function goBackAccountBrowser(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  if (session.webContents.canGoBack()) session.webContents.goBack();
}

export function goForwardAccountBrowser(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  if (session.webContents.canGoForward()) session.webContents.goForward();
}

export function reloadAccountBrowser(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  session.webContents.reload();
}

export function stopAccountBrowser(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return;
  session.webContents.stop();
}

export function openAccountBrowserDevTools(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session || !session.webContents || session.webContents.isDestroyed()) return false;
  session.webContents.openDevTools({ mode: 'detach' });
  return true;
}

export function isNativeSandboxActive(accountId) {
  return hasSession(String(accountId));
}

export function getSessionByAccountId(accountId) {
  return getSession(String(accountId)) || null;
}

// Re-export from session-store for external callers (index.js, data-engine.js)
export { getActiveSessions } from './session-store.js';

// ======================================
// 9. Cookie 导出/导入
// ======================================

export async function exportCookiesForPlaywright(accountId) {
  const key = String(accountId);
  const session = getSession(key);
  if (!session) return null;

  try {
    const cookies = await session.webContents.session.cookies.get({});
    const origins = {};
    for (const cookie of cookies) {
      const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
      if (!origins[domain]) origins[domain] = { localStorage: [] };
    }
    const state = { cookies, origins };
    const stateFilePath = path.join(STATES_DIR, `${key}.json.enc`);
    secureAtomicWriteFileSync(stateFilePath, state, key);
    return state;
  } catch (e) { return null; }
}

export async function importCookiesFromPlaywright(accountId) {
  const key = String(accountId);
  const stateFilePath = path.join(STATES_DIR, `${key}.json.enc`);
  if (!fs.existsSync(stateFilePath)) return false;

  try {
    const state = secureReadFileSync(stateFilePath, key);
    if (!state.cookies) return false;
    const session = getSession(key);
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
      if (cookie.expires && cookie.expires !== -1) electronCookie.expirationDate = cookie.expires;
      try { await session.webContents.session.cookies.set(electronCookie); } catch (e) {}
    }
    return true;
  } catch (e) { return false; }
}