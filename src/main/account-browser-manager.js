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
// 1. 安全读写工具
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
      var navDefs = [
        ['webdriver', undefined],
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
            var len = 5;
            var arr = new Array(len);
            for (var j = 0; j < len; j++) {
              arr[j] = {
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

    // ---- Canvas 指纹无状态空间噪声 ----
    try {
    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = makeNative(function(type, quality) {
      try {
        if (this.width > 0 && this.height > 0) {
          var offscreen = document.createElement('canvas');
          offscreen.width = this.width;
          offscreen.height = this.height;
          var ctx2d = offscreen.getContext('2d', { willReadFrequently: true });
          if (ctx2d) {
            ctx2d.drawImage(this, 0, 0);
            var imgData = ctx2d.getImageData(0, 0, offscreen.width, offscreen.height);
            var d = imgData.data;
            var numPixels = Math.min(10, Math.floor(d.length / 4));
            for (var i = 0; i < numPixels; i++) {
              var pixelIndex = (getStatelessNoise(__seed__, i * 999) >>> 0) % (offscreen.width * offscreen.height);
              var dataIndex = pixelIndex * 4;
              if (dataIndex < d.length) {
                d[dataIndex] = d[dataIndex] ^ 1;
              }
            }
            ctx2d.putImageData(imgData, 0, 0);
            return origToDataURL.call(offscreen, type, quality);
          }
        }
      } catch(e) {}
      return origToDataURL.apply(this, arguments);
    }, 'toDataURL');
    } catch(e) {}

    // ---- WebGL 1.0 & 2.0 指纹伪装 ----
    try {
      var _vendor = wgl.vendor || 'Intel Inc.';
      var _renderer = wgl.renderer || 'Intel Iris OpenGL Engine';
      var _version = wgl.version || 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
      var _slv = wgl.shadingLanguageVersion || 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
      
      var origGetParam = WebGLRenderingContext.prototype.getParameter;
      var origGetExt = WebGLRenderingContext.prototype.getExtension;
      var origGetSuppExt = WebGLRenderingContext.prototype.getSupportedExtensions;

      var spoofed = new Map([
        [37445, _vendor],
        [37446, _renderer],
        [7936, _vendor],
        [7937, _renderer],
        [7938, _version],
        [35724, _slv],
        [3379, 16384],
        [3386, new Int32Array([16384, 16384])],
        [34024, 16384],
        [34076, 16384],
        [34047, 16],
        [34921, 16],
        [36347, 4096],
        [36348, 32],
        [36349, 1024],
        [35661, 80],
        [35660, 16],
        [34930, 16],
        [33902, new Float32Array([1, 1])],
        [33901, new Float32Array([1, 1024])],
        [34964, 8],
        [35658, 8],
        [35659, 8],
        [35663, 8],
        [35662, 8],
        [35664, 24],
        [35665, 8],
        [34467, new Uint32Array([0x83F0, 0x83F1, 0x83F2, 0x83F3, 0x9274])],
        [34852, 8],
        [36063, 8],
        [36183, 16],
        [35371, 14],
        [35373, 14],
        [35374, 28],
        [35375, 72],
        [35376, 65536],
        [35377, 233472],
        [35379, 233472],
        [35981, 4294967295],
        [35368, 128],
        [35369, 4],
        [35370, 4]
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

      var origReadPixels = WebGLRenderingContext.prototype.readPixels;
      WebGLRenderingContext.prototype.readPixels = makeNative(function(x, y, width, height, format, type, pixels) {
        origReadPixels.apply(this, arguments);
        if (pixels && pixels.length > 0) {
          for (var i = 0; i < pixels.length; i += 4) {
            var noise = getStatelessNoise(__seed__, i) % 3;
            pixels[i] = (pixels[i] + noise) % 256;
          }
        }
      }, 'readPixels');

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

        var origReadPixels2 = WebGL2RenderingContext.prototype.readPixels;
        WebGL2RenderingContext.prototype.readPixels = makeNative(function(x, y, width, height, format, type, pixels) {
          origReadPixels2.apply(this, arguments);
          if (pixels && pixels.length > 0) {
            for (var i = 0; i < pixels.length; i += 4) {
              var noise = getStatelessNoise(__seed__, i) % 3;
              pixels[i] = (pixels[i] + noise) % 256;
            }
          }
        }, 'readPixels');
      }
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

    console.log('[Matrix Shield] 原生会话环境配置已部署 (BrowserView/CDP)');
  } catch (e) {
    console.warn('[Matrix Shield] 环境配置注入部分失败:', e.message);
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
    const protocol = 'socks5://'; 
    if (parts.length === 4) {
      return `${protocol}${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
    } else if (parts.length === 2) {
      return `${protocol}${parts[0]}:${parts[1]}`;
    }
    return proxyStr;
  } catch (e) {
    return undefined;
  }
}

// ======================================
// 5. 核心：原生嵌入式会话容器启动
// ======================================

export async function launchEmbeddedAccountBrowser(accountId, options = {}) {
  const key = String(accountId);

  if (activeSessions.has(key)) {
    console.log(`[Session Manager] 账号 ${key} 已有活跃会话，先销毁...`);
    await closeEmbeddedAccountBrowser(key);
  }

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) throw new Error('主窗口未找到');
  const mainWindow = windows[0];

  const fingerprintData = getOrCreateSessionProfile(key);
  const fp = fingerprintData.fingerprint;
  const headers = fingerprintData.headers || {};
  const sessionEnvironmentScript = buildSessionEnvironmentScript(fp, key);

  try {
    const partitionDir = path.join(app.getPath('userData'), 'Partitions', `chrome_data_${key}`);
    if (fs.existsSync(partitionDir)) {
      const sslFiles = ['TransportSecurity', 'CertificateRevocation', 'CertificateTransparency', 'Cookies-journal'];
      for (const file of sslFiles) {
        const filePath = path.join(partitionDir, file);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
      const cacheDir = path.join(partitionDir, 'Cache');
      if (fs.existsSync(cacheDir)) {
        try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch (e) {}
      }
    }
  } catch (e) {}

  const view = new BrowserView({
    webPreferences: {
      partition: `persist:chrome_data_${key}`,
      sandbox: true,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  mainWindow.addBrowserView(view);
  // 初始离屏渲染尺寸 — 避免页面以 0x0 视口加载导致布局错乱
  view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });
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
  });

  let sessionData = null;

  try {
    await wc.session.clearHostResolverCache();
    await wc.session.clearCache();
  } catch (e) {}

  wc.setWindowOpenHandler(({ url }) => {
    wc.loadURL(url);
    return { action: 'deny' };
  });

  wc.on('certificate-error', (event, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

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

  const ua = fp.navigator?.userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  wc.setUserAgent(ua);

  if (options.proxy) {
    const proxyRules = parseProxyString(options.proxy);
    if (proxyRules) {
      try {
        await wc.session.setProxy({ proxyRules });
      } catch (e) {}
    }
  }

  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
    }
  } catch (e) {}

  await wc.loadURL('about:blank');
  await sleep(500);

  // --- CDP 注入与底层管控 ---
  try {
    if (wc.debugger.isAttached()) {
      await wc.debugger.sendCommand('Page.enable');

      await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: sessionEnvironmentScript
      });
      console.log('[Session Manager] CDP CDP 会话环境脚本已注入');
    } else {
      await wc.executeJavaScript(sessionEnvironmentScript);
    }
  } catch (e) {
    try { await wc.executeJavaScript(sessionEnvironmentScript); } catch (e2) {}
  }

  try {
    if (wc.debugger.isAttached()) {
      await wc.debugger.sendCommand('Network.setBlockedURLs', {
        urls: ['*://*.stun.*/*', '*://*.turn.*/*', 'stun:*', 'turn:*', '*://*stun*:*/*', '*://*turn*:*/*']
      });
    }
  } catch (e) {}

  const [winW, winH] = mainWindow.getSize();
  view.setBounds({ x: -10000, y: -10000, width: Math.round(winW * 0.5), height: Math.round(winH * 0.7) });

  if (headers['accept-language']) {
    try {
      const ses = wc.session;
      ses.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Accept-Language'] = headers['accept-language'];
        callback({ requestHeaders: details.requestHeaders });
      });
    } catch (e) {}
  }

  sessionData = {
    view,
    webContents: wc,
    mainWindow,
    accountId,
    fingerprintData,
    currentUrl: 'about:blank'
  };
  activeSessions.set(key, sessionData);

  return { success: true, webContents: wc, view };
}

// ======================================
// 6. BrowserView 吸附/隐藏
// ======================================

export function attachAccountBrowser(accountId, bounds) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session || !session.view) return;
  try {
    if (session.mainWindow && !session.mainWindow.isDestroyed()) {
      session.mainWindow.setTopBrowserView(session.view);
    }
  } catch (e) {}
  try {
    session.view.setBounds(bounds);
    // 自适应缩放：以 1280px 为基准，容器变窄时等比缩小内容
    const targetWidth = 1280;
    const zoom = Math.min(1, Math.max(0.25, bounds.width / targetWidth));
    session.webContents.setZoomFactor(zoom);
  } catch (e) {}
}

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

export async function closeEmbeddedAccountBrowser(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
  if (!session) return;

  try {
    if (session.view) {
      const wc = session.view.webContents;
      try { wc.stop(); } catch (e) {}
      try { wc.close(); } catch (e) {}
      try { wc.debugger.detach(); } catch (e) {}
      try { session.mainWindow.removeBrowserView(session.view); } catch (e) {}
    }
  } catch (e) {}

  activeSessions.delete(key);
  sslRetryCount.delete(key);
}

// ======================================
// 7.5 地址栏导航 & 操作
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
    if (session.webContents && !session.webContents.isDestroyed()) return session.webContents.getURL();
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

export function getActiveSessions() {
  const sessions = [];
  for (const [id, session] of activeSessions) {
    try {
      let url = 'about:blank';
      if (session.currentUrl) url = session.currentUrl;
      else if (session.webContents && !session.webContents.isDestroyed()) url = session.webContents.getURL();
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
// 9. Cookie 导出/导入
// ======================================

export async function exportCookiesForPlaywright(accountId) {
  const key = String(accountId);
  const session = activeSessions.get(key);
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
      if (cookie.expires && cookie.expires !== -1) electronCookie.expirationDate = cookie.expires;
      try { await session.webContents.session.cookies.set(electronCookie); } catch (e) {}
    }
    return true;
  } catch (e) { return false; }
}