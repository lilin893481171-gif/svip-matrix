/**
 * @file native-interactions.js
 * @title 原生交互引擎 — 替代 Playwright CDP 的 Electron 原生实现
 * @desc 所有鼠标/键盘/元素查询/截图/文件上传操作全部使用 Electron webContents 原生 API，
 *       彻底消除 navigator.webdriver 痕迹，实现 isTrusted: true 原生事件。
 */

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

// ==========================================
// 1. Windows 虚拟键码映射表
// ==========================================
const KEY_CODES = {
  'Enter':     { keyCode: 'Enter',     windowsVirtualKeyCode: 13 },
  'Backspace': { keyCode: 'Backspace', windowsVirtualKeyCode: 8 },
  'Space':     { keyCode: 'Space',     windowsVirtualKeyCode: 32 },
  'End':       { keyCode: 'End',       windowsVirtualKeyCode: 35 },
  'Home':      { keyCode: 'Home',      windowsVirtualKeyCode: 36 },
  'Tab':       { keyCode: 'Tab',       windowsVirtualKeyCode: 9 },
  'Escape':    { keyCode: 'Escape',    windowsVirtualKeyCode: 27 },
  'Delete':    { keyCode: 'Delete',    windowsVirtualKeyCode: 46 },
  'Control':   { keyCode: 'Control',   windowsVirtualKeyCode: 17 },
  'Shift':     { keyCode: 'Shift',     windowsVirtualKeyCode: 16 },
  'Alt':       { keyCode: 'Alt',       windowsVirtualKeyCode: 18 },
  'ArrowLeft':  { keyCode: 'ArrowLeft',  windowsVirtualKeyCode: 37 },
  'ArrowUp':    { keyCode: 'ArrowUp',    windowsVirtualKeyCode: 38 },
  'ArrowRight': { keyCode: 'ArrowRight', windowsVirtualKeyCode: 39 },
  'ArrowDown':  { keyCode: 'ArrowDown',  windowsVirtualKeyCode: 40 },
  'PageUp':     { keyCode: 'PageUp',     windowsVirtualKeyCode: 33 },
  'PageDown':   { keyCode: 'PageDown',   windowsVirtualKeyCode: 34 },
  // A-Z → 65-90
  ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return [letter, { keyCode: letter, windowsVirtualKeyCode: 65 + i }];
  })),
  // 0-9 → 48-57
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => {
    return [String(i), { keyCode: String(i), windowsVirtualKeyCode: 48 + i }];
  })),
};

// ==========================================
// 2. 原生交互引擎
// ==========================================
export class NativeInteractions {
  #_axEnabled;

  constructor(webContents, mainWindow) {
    this.wc = webContents;
    this._mainWindow = mainWindow;
    this.#_axEnabled = false;
  }

  // ---------- 基础工具 ----------

  /**
   * Catmull-Rom 样条插值 — 生成 C1 连续曲线，比 Bezier 更接近人类手腕运动特征
   */
  #catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  /**
   * Sigmoid 速度剖面: 加速 → 巡航 → 减速
   * 返回 [0, 1] 归一化时间 → [0, 1] 归一化距离 的映射值
   */
  #speedProfile(t, steepness = 6) {
    // 双 Sigmoid 拼接: 前半段加速 + 后半段减速
    if (t < 0.5) {
      return 0.5 * (1 / (1 + Math.exp(-steepness * (t * 2 - 0.5))));
    } else {
      return 0.5 + 0.5 * (1 / (1 + Math.exp(-steepness * ((t - 0.5) * 2 - 0.5))));
    }
  }

  /**
   * 简易 Perlin 风格噪声 (2D 确定性, 用于微震颤)
   */
  #tremorNoise(x, y, freq = 0.3) {
    const n = Math.sin(x * freq * 12.9898 + y * freq * 78.233 + 437.58) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  /**
   * 生成仿生路径 (Catmull-Rom 样条 + 速度剖面 + 微震颤 + 可选 overshoot)
   * @returns {{ x: number, y: number, delay: number }[]}
   */
  #generateHumanPath(startX, startY, endX, endY, opts = {}) {
    const {
      steps = null,         // null = 按距离自动计算
      overshoot = false,    // 是否冲过头再回弹
      tremorAmp = 0.4,      // 微震颤幅度 (px)
      speed = 'casual'      // 'precise' | 'casual' | 'lazy'
    } = opts;

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const numSteps = steps ?? Math.max(15, Math.round(dist / 3));  // ~3px 一个采样点

    // 速度参数映射
    const speedMap = { precise: { steepness: 8, baseDelay: 2 }, casual: { steepness: 6, baseDelay: 4 }, lazy: { steepness: 4, baseDelay: 7 } };
    const { steepness, baseDelay } = speedMap[speed] || speedMap.casual;

    // 生成控制点 (2-3 个随机偏移的航点)
    const waypoints = [{ x: startX, y: startY }];
    const numWaypoints = 2 + Math.floor(Math.random() * 2); // 2-3 个中间航点
    for (let i = 1; i <= numWaypoints; i++) {
      const frac = i / (numWaypoints + 1);
      const wx = startX + dx * frac + (Math.random() - 0.5) * dist * 0.3;
      const wy = startY + dy * frac + (Math.random() - 0.5) * dist * 0.25;
      waypoints.push({ x: wx, y: wy });
    }
    waypoints.push({ x: endX, y: endY });

    // 构建 Catmull-Rom 控制点序列 (首尾镜像延拓)
    const ctrl = [
      waypoints[0],
      ...waypoints,
      waypoints[waypoints.length - 1]
    ];

    // 生成路径点 (带速度剖面 + 震颤)
    const path = [];
    for (let seg = 0; seg < ctrl.length - 3; seg++) {
      const segSteps = Math.round(numSteps / (ctrl.length - 3));
      for (let i = 0; i <= segSteps; i++) {
        const rawT = i / segSteps;
        const t = this.#speedProfile(rawT, steepness);
        const pt = this.#catmullRom(ctrl[seg], ctrl[seg + 1], ctrl[seg + 2], ctrl[seg + 3], t);

        // 微震颤
        const tremorX = this.#tremorNoise(pt.x, pt.y, 0.3) * tremorAmp;
        const tremorY = this.#tremorNoise(pt.x + 100, pt.y + 100, 0.27) * tremorAmp;

        // 速度剖面 → 步进延时: 密集采样区 = 加速/减速区 = 短延时
        const speedFactor = Math.abs(this.#speedProfile(rawT + 0.01, steepness) - this.#speedProfile(rawT, steepness));
        const delay = baseDelay + (1 - Math.min(speedFactor * 200, 1)) * baseDelay * 2 + Math.random() * 2;

        path.push({
          x: Math.round(pt.x + tremorX),
          y: Math.round(pt.y + tremorY),
          delay
        });
      }
    }

    // Overshoot: 12% 概率冲过头再回弹 (仅在距离 > 80px 时)
    if (overshoot && dist > 80 && Math.random() < 0.12) {
      const overshootDist = 4 + Math.random() * 8;
      const angle = Math.atan2(dy, dx);
      const osX = endX + Math.cos(angle) * overshootDist;
      const osY = endY + Math.sin(angle) * overshootDist;
      path.push({ x: Math.round(osX), y: Math.round(osY), delay: 15 + Math.random() * 10 });

      // 回弹修正 (2-3 步)
      const corrections = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < corrections; i++) {
        const frac = (i + 1) / corrections;
        const cx = osX + (endX - osX) * frac + (Math.random() - 0.5) * 3;
        const cy = osY + (endY - osY) * frac + (Math.random() - 0.5) * 3;
        path.push({ x: Math.round(cx), y: Math.round(cy), delay: 20 + Math.random() * 15 });
      }
    }

    // 确保终点精确
    path.push({ x: Math.round(endX), y: Math.round(endY), delay: baseDelay + Math.random() * 2 });

    return path;
  }

  /**
   * 保留旧签名兼容性: 内部升级为 Catmull-Rom
   */
  #generateBezierPath(startX, startY, endX, endY, steps = 20) {
    return this.#generateHumanPath(startX, startY, endX, endY, { steps, speed: 'casual', tremorAmp: 0.3 });
  }

  /**
   * 高斯分布采样 (Box-Muller 变换)
   */
  #gaussianRandom(mean, stddev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + stddev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * 检查 webContents 是否已销毁
   */
  #checkAlive() {
    if (!this.wc || this.wc.isDestroyed()) {
      throw new Error('浏览器视图已被销毁');
    }
  }

  // ---------- 鼠标操作 ----------

  /**
   * 移动鼠标到指定坐标
   */
  async mouseMove(x, y) {
    this.#checkAlive();
    this.wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
  }

  /**
   * 在指定坐标执行人类化点击（含贝塞尔曲线 + 按压力 + 点击后滑开）
   */
  async mouseClick(x, y, delayMs = null) {
    this.#checkAlive();
    const delay = delayMs ?? (60 + Math.random() * 50);
    this.wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await sleep(delay);
    this.wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  }

  /**
   * 随机漫游：鼠标在页面随机移动一段距离
   */
  async randomWander() {
    const startX = 200 + Math.random() * 500;
    const startY = 200 + Math.random() * 300;
    const endX = startX + (Math.random() > 0.5 ? 100 : -100);
    const endY = startY + (Math.random() > 0.5 ? 50 : -50);
    const path = this.#generateBezierPath(startX, startY, endX, endY, 10);
    for (let p of path) { await this.mouseMove(p.x, p.y); await sleep(10); }
  }

  // ---------- 键盘操作 ----------

  /**
   * 按下按键（keyDown + 短暂延时 + keyUp）
   */
  async pressKey(keyName) {
    this.#checkAlive();
    const def = KEY_CODES[keyName];
    if (!def) {
      // 未知按键：尝试直接作为 keyCode 发送
      this.wc.sendInputEvent({ type: 'keyDown', keyCode: keyName });
      await sleep(20);
      this.wc.sendInputEvent({ type: 'keyUp', keyCode: keyName });
      return;
    }
    this.wc.sendInputEvent({ type: 'keyDown', keyCode: def.keyCode, windowsVirtualKeyCode: def.windowsVirtualKeyCode });
    await sleep(20 + Math.random() * 20);
    this.wc.sendInputEvent({ type: 'keyUp', keyCode: def.keyCode, windowsVirtualKeyCode: def.windowsVirtualKeyCode });
  }

  /**
   * 按下组合键（如 Ctrl+A）
   * combo 格式：'Control+A' 或 'Control'
   */
  async pressCombo(combo) {
    this.#checkAlive();
    const parts = combo.split('+');
    const modifier = parts[0]; // e.g. 'Control'
    const key = parts[1];      // e.g. 'A'

    const modDef = KEY_CODES[modifier] || { keyCode: modifier };
    const modifierLower = modifier.toLowerCase();
    const modifiers = [modifierLower];

    // 按下修饰键
    const downEvent = {
      type: 'keyDown',
      keyCode: modDef.keyCode,
      modifiers
    };
    if (modDef.windowsVirtualKeyCode) {
      downEvent.windowsVirtualKeyCode = modDef.windowsVirtualKeyCode;
    }
    this.wc.sendInputEvent(downEvent);
    await sleep(10);

    if (key) {
      const keyDef = KEY_CODES[key] || { keyCode: key };
      const keyDownEvent = {
        type: 'keyDown',
        keyCode: keyDef.keyCode,
        modifiers
      };
      if (keyDef.windowsVirtualKeyCode) {
        keyDownEvent.windowsVirtualKeyCode = keyDef.windowsVirtualKeyCode;
      }
      this.wc.sendInputEvent(keyDownEvent);
      await sleep(20 + Math.random() * 20);

      const keyUpEvent = {
        type: 'keyUp',
        keyCode: keyDef.keyCode,
        modifiers
      };
      if (keyDef.windowsVirtualKeyCode) {
        keyUpEvent.windowsVirtualKeyCode = keyDef.windowsVirtualKeyCode;
      }
      this.wc.sendInputEvent(keyUpEvent);
    }

    // 释放修饰键
    const upEvent = { type: 'keyUp', keyCode: modDef.keyCode, modifiers };
    if (modDef.windowsVirtualKeyCode) {
      upEvent.windowsVirtualKeyCode = modDef.windowsVirtualKeyCode;
    }
    this.wc.sendInputEvent(upEvent);
  }

  // ---------- 文本输入 ----------

  /**
   * 逐字符输入文本（高斯延时 + 随机错误 + 回删 + 思考停顿）
   * 为每个矩阵账号生成独立的打字节奏（WPM），不同账号不同"手感"
   * ASCII 用 sendInputEvent + keyChar，CJK 用 CDP Input.insertText
   * （sendInputEvent 的 keyChar 不支持多字节 CJK 字符，Electron 会抛 Invalid event object）
   * @param {string} text - 要输入的文本
   * @param {object} opts - { delay: 基础延时, wpm: 打字速度(字/分钟, 默认40-70随机), typoRate: 错误率 }
   */
  async typeText(text, opts = {}) {
    if (!text) return;
    this.#checkAlive();
    const wpm = opts.wpm ?? (38 + Math.floor(Math.random() * 35));  // 38-72 WPM
    const meanDelay = 60000 / wpm;  // 平均每字延时 (ms)
    const stddev = meanDelay * 0.35; // 30-40% 标准差 → 自然节奏变化
    const typoRate = opts.typoRate ?? (0.02 + Math.random() * 0.03); // 2-5%

    let inputEnabled = false;
    const ensureInput = async () => {
      if (inputEnabled) return;
      if (this.wc.debugger.isAttached()) {
        try {
          await this.wc.debugger.sendCommand('Input.enable');
          inputEnabled = true;
        } catch (_) {}
      }
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const isCJK = /[一-鿿㐀-䶿豈-﫿　-〿＀-￯]/.test(char);

      // 高斯分布打错 (仅 ASCII 字母数字)
      if (Math.random() < typoRate && /[a-zA-Z0-9]/.test(char)) {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        this.wc.sendInputEvent({ type: 'char', keyChar: wrongChar });
        await sleep(this.#gaussianRandom(meanDelay * 0.6, stddev * 0.5));
        await sleep(180 + Math.random() * 200);  // 意识到打错了
        await this.pressKey('Backspace');
        await sleep(120 + Math.random() * 120);  // 回删后的短暂停顿
      }

      if (isCJK) {
        await ensureInput();
        if (inputEnabled) {
          await this.wc.debugger.sendCommand('Input.insertText', { text: char });
        } else {
          // 最终回退：execCommand (deprecated but widely supported)
          await this.wc.executeJavaScript(`
            (() => {
              const el = document.activeElement;
              if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                document.execCommand('insertText', false, ${JSON.stringify(char)});
              }
            })()
          `);
        }
      } else {
        this.wc.sendInputEvent({ type: 'char', keyChar: char });
      }

      // 高斯延时 (钳制到合理范围)
      const delay = Math.max(25, Math.min(400, this.#gaussianRandom(meanDelay, stddev)));
      await sleep(delay);

      // 突触式思考停顿: 在空格/标点/段落后 10-18% 概率停顿
      if (/[,.!?;:，。！？；：、\s]/.test(char) && Math.random() < 0.12) {
        await sleep(250 + Math.random() * 500);
      }
    }
    await sleep(300 + Math.random() * 200);
  }

  // ---------- 元素查询（通过 executeJavaScript）----------

  /**
   * 获取元素的边界框（绝对坐标，含滚动偏移）
   */
  async getBoundingBox(cssSelector) {
    this.#checkAlive();
    try {
      return await this.wc.executeJavaScript(`
        (() => {
          const el = document.querySelector('${cssSelector.replace(/'/g, "\\'")}');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
        })()
      `);
    } catch (e) {
      return null;
    }
  }

  /**
   * 检查元素是否可见
   */
  async isElementVisible(cssSelector) {
    this.#checkAlive();
    try {
      return await this.wc.executeJavaScript(`
        (() => {
          const el = document.querySelector('${cssSelector.replace(/'/g, "\\'")}');
          return !!(el && el.offsetParent !== null);
        })()
      `);
    } catch (e) {
      return false;
    }
  }

  /**
   * 轮询等待元素可见
   */
  async waitForVisible(cssSelector, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const visible = await this.isElementVisible(cssSelector);
      if (visible) return true;
      await sleep(200);
    }
    return false;
  }

  /**
   * 轮询等待选择器出现在 DOM 中
   */
  async waitForSelector(cssSelector, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      this.#checkAlive();
      try {
        const found = await this.wc.executeJavaScript(`
          !!(document.querySelector('${cssSelector.replace(/'/g, "\\'")}'))
        `);
        if (found) return true;
      } catch (e) { /* ignore */ }
      await sleep(200);
    }
    return false;
  }

  /**
   * 将元素滚动到可视区域
   */
  async scrollElementIntoView(cssSelector) {
    this.#checkAlive();
    try {
      await this.wc.executeJavaScript(`
        (() => {
          const el = document.querySelector('${cssSelector.replace(/'/g, "\\'")}');
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        })()
      `);
    } catch (e) { /* ignore */ }
  }

  /**
   * 按文本内容查找元素，返回其边界框
   */
  async getElementByText(texts) {
    this.#checkAlive();
    try {
      return await this.wc.executeJavaScript(`
        (() => {
          const pattern = /${texts.join('|').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i;
          const all = [...document.querySelectorAll('*')];
          const el = all.find(e => {
            if (!e.offsetParent) return false;
            const txt = (e.textContent || '').trim();
            return txt.length < 200 && pattern.test(txt);
          });
          if (!el) return null;
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          const r = el.getBoundingClientRect();
          return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height, tag: el.tagName, text: (el.textContent||'').trim().substring(0, 50) };
        })()
      `);
    } catch (e) {
      return null;
    }
  }

  /**
   * 执行任意 JavaScript 并返回结果 (带 CDP 降级护盾)
   */
  async evaluate(jsCode) {
    this.#checkAlive();
    try {
      return await this.wc.executeJavaScript(jsCode);
    } catch (e) {
      console.warn('🛡️ [NativeInteractions] IPC 拦截到异常:', e.message);

      // 👑 终极降级：尝试绕过 IPC，使用 CDP 协议直接在 V8 引擎中执行代码
      if (this.wc.debugger && this.wc.debugger.isAttached()) {
        try {
          const res = await this.wc.debugger.sendCommand('Runtime.evaluate', {
            expression: jsCode,
            returnByValue: true,    // 强制返回 JSON 序列化的值
            awaitPromise: true      // 支持异步代码
          });
          if (res && res.result && res.result.value !== undefined) {
            console.log('🛡️ [NativeInteractions] CDP 降级执行成功！救回一条命。');
            return res.result.value;
          }
        } catch (cdpErr) {
          console.warn('🛡️ [NativeInteractions] CDP 降级亦失败 (页面可能已死锁):', cdpErr.message);
        }
      }
      return null;
    }
  }

  // ---------- 高级交互 ----------

  /**
   * 执行仿生路径: 遍历路径点并逐点发送 mouseMove
   */
  async #executeHumanPath(path) {
    for (const pt of path) {
      await this.mouseMove(pt.x, pt.y);
      await sleep(pt.delay || 4);
    }
  }

  /**
   * 仿生鼠标移动：Catmull-Rom 样条 + overshoot + 震颤 移动到元素位置
   * @param {string} cssSelector - CSS 选择器
   * @param {object} opts - { speed: 'precise'|'casual'|'lazy' }
   */
  async humanMouseMove(cssSelector, opts = {}) {
    try {
      await this.scrollElementIntoView(cssSelector);
      await this.waitForVisible(cssSelector, 5000);
      const box = await this.getBoundingBox(cssSelector);
      if (!box) return false;

      const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
      const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);
      const startX = targetX + (Math.random() > 0.5 ? 150 + Math.random() * 150 : -(150 + Math.random() * 150));
      const startY = targetY + (Math.random() > 0.5 ? 100 + Math.random() * 100 : -(100 + Math.random() * 100));

      await this.mouseMove(startX, startY);
      await sleep(40 + Math.random() * 80);

      const path = this.#generateHumanPath(startX, startY, targetX, targetY, {
        speed: opts.speed || 'casual',
        overshoot: true,
        tremorAmp: 0.4
      });
      await this.#executeHumanPath(path);
      await sleep(120 + Math.random() * 150);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 绝对坐标仿生点击（给 VisionAgent 用）
   */
  async humanClickAtCoordinates(targetX, targetY, opts = {}) {
    const startX = targetX + (Math.random() > 0.5 ? 150 + Math.random() * 150 : -(150 + Math.random() * 150));
    const startY = targetY + (Math.random() > 0.5 ? 100 + Math.random() * 100 : -(100 + Math.random() * 100));

    const path = this.#generateHumanPath(startX, startY, targetX, targetY, {
      speed: opts.speed || 'casual',
      overshoot: true,
      tremorAmp: 0.35
    });
    await this.#executeHumanPath(path);

    await sleep(120 + Math.random() * 150);
    await this.mouseClick(targetX, targetY);
    // 点击后自然滑开 (随机方向 50-120px)
    const driftAngle = Math.random() * Math.PI * 2;
    const driftDist = 50 + Math.random() * 70;
    await this.mouseMove(
      Math.round(targetX + Math.cos(driftAngle) * driftDist),
      Math.round(targetY + Math.sin(driftAngle) * driftDist)
    );
  }

  /**
   * 仿生点击元素（Catmull-Rom 移动 + 点击 + 随机滑开）
   * @param {string} cssSelector - CSS 选择器
   */
  async clickElement(cssSelector) {
    await this.humanMouseMove(cssSelector);
    const box = await this.getBoundingBox(cssSelector);
    if (!box) throw new Error(`点击阻断：找不到目标元素 "${cssSelector}"`);

    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.5;
    try {
      await this.wc.executeJavaScript(`
        document.querySelector('${cssSelector.replace(/'/g, "\\'")}')?.focus()
      `);
    } catch (e) { /* ignore */ }

    await this.mouseClick(cx, cy, 60 + Math.random() * 50);
    // 点击后随机方向滑开
    const driftAngle = Math.random() * Math.PI * 2;
    const driftDist = 80 + Math.random() * 300;
    await this.mouseMove(
      Math.round(cx + Math.cos(driftAngle) * driftDist),
      Math.round(cy + Math.sin(driftAngle) * driftDist)
    );
    await sleep(400 + Math.random() * 400);
  }

  /**
   * 仿生输入：先清空，再逐字输入
   * @param {string} cssSelector - 输入框选择器
   * @param {string} text - 文本
   */
  async humanType(cssSelector, text) {
    if (!text) return;
    await this.humanMouseMove(cssSelector);
    await this.clickElement(cssSelector);
    await sleep(300);
    await this.pressCombo('Control+A');
    await this.pressKey('Backspace');
    await sleep(300);
    // 统一用 CDP insertText（兼容 contenteditable/ProseMirror，sendInputEvent char 在 SPA 上不稳定）
    await this.insertTextViaCDP(text);
  }

  /**
   * 灵活点击：按文本匹配并点击（用于弹窗按钮等）
   */
  async flexibleClick(textArray, timeout = 2500) {
    const box = await this.getElementByText(textArray);
    if (!box) return false;

    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.5;

    await this.humanMouseMoveByBox(box);
    await this.mouseClick(cx, cy, 60 + Math.random() * 50);
    await this.mouseMove(100 + Math.random() * 500, 100 + Math.random() * 300);
    await sleep(500 + Math.random() * 500);
    return true;
  }

  /**
   * 根据边界框执行仿生鼠标移动（内部辅助，升级为 Catmull-Rom）
   */
  async humanMouseMoveByBox(box) {
    const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);
    const startX = targetX + (Math.random() > 0.5 ? 150 + Math.random() * 150 : -(150 + Math.random() * 150));
    const startY = targetY + (Math.random() > 0.5 ? 100 + Math.random() * 100 : -(100 + Math.random() * 100));

    await this.mouseMove(startX, startY);
    await sleep(40 + Math.random() * 80);

    const path = this.#generateHumanPath(startX, startY, targetX, targetY, {
      speed: 'casual',
      overshoot: true,
      tremorAmp: 0.35
    });
    await this.#executeHumanPath(path);
    await sleep(120 + Math.random() * 150);
  }

  /**
   * 仿生滚动: 分段变速滚动，模拟"边看边滑"的阅读行为
   * @param {number} totalDistance - 总滚动距离 (px, 正=向下)
   * @param {object} opts - { segments: 分段数, pauseProb: 段落停顿概率 }
   */
  async humanScroll(totalDistance = 400, opts = {}) {
    this.#checkAlive();
    const segments = opts.segments ?? (3 + Math.floor(Math.random() * 4)); // 3-6 段
    const pauseProb = opts.pauseProb ?? 0.3;
    const segDist = Math.round(totalDistance / segments);

    for (let i = 0; i < segments; i++) {
      // 每段变速: 加速滚动 → 滑行 → 减速
      const subSteps = 8 + Math.floor(Math.random() * 8);
      const baseStep = Math.round(segDist / subSteps);

      for (let s = 0; s < subSteps; s++) {
        // Sigmoid 加速 → 减速
        const t = s / subSteps;
        const speedFactor = 1 / (1 + Math.exp(-8 * (t - 0.5)));
        const stepSize = Math.round(baseStep * (0.3 + speedFactor * 0.7));
        await this.wc.executeJavaScript(`window.scrollBy(0, ${stepSize})`);
        await sleep(12 + Math.random() * 18);
      }

      // 段落停顿 (模拟阅读/扫视)
      if (Math.random() < pauseProb) {
        await sleep(400 + Math.random() * 800);
        // 5% 概率回滚一小段 ("刚才没看清")
        if (Math.random() < 0.05) {
          const backScroll = 30 + Math.round(Math.random() * 80);
          await this.wc.executeJavaScript(`window.scrollBy(0, ${-backScroll})`);
          await sleep(200 + Math.random() * 300);
          // 再滚回去
          await this.wc.executeJavaScript(`window.scrollBy(0, ${backScroll})`);
          await sleep(100 + Math.random() * 200);
        }
      }
    }
    await sleep(300 + Math.random() * 300);
  }

  /**
   * 关闭弹窗/浮层
   */
  async gentleCloseOverlays() {
    await this.flexibleClick(['我知道了', '关闭', '跳过', '下次再说', '×', '✕'], 1500);
  }

  // ---------- 文件上传 ----------

  /**
   * 检查页面是否已有 file input（上传区通常挂着一个隐藏的）
   */
  async #findFileInputNode() {
    const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
    const find = (node) => {
      if (!node) return null;
      if (node.nodeName === 'INPUT' && node.attributes) {
        const typeIdx = node.attributes.indexOf('type');
        if (typeIdx >= 0 && node.attributes[typeIdx + 1] === 'file') return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const found = find(child);
          if (found) return found;
        }
      }
      return null;
    };
    return find(doc.root) || null;
  }

  /**
   * CDP 直注 — 页面已有 input[type="file"] 时直接用。
   * AI_MEMORY_BANK #10: blur → 0.9-2.7s 延时 → setFileInputFiles → focus 恢复
   */
  async #directFileInject(filePath, fileInputNode) {
    await this.wc.executeJavaScript(`
      window.dispatchEvent(new Event('blur'));
      document.hasFocus = () => false;
      0
    `);
    await sleep(900 + Math.random() * 1800);

    await this.wc.debugger.sendCommand('DOM.setFileInputFiles', {
      nodeId: fileInputNode.nodeId,
      files: [filePath]
    });

    await sleep(500);

    await this.wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('input[type="file"]');
        if (el) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        window.dispatchEvent(new Event('focus'));
        delete document.hasFocus;
      })()
    `);
    try { this.wc.focus(); } catch (_) {}
    console.log('[直注] ✅ 文件注入成功');
    return true;
  }

  /**
   * 统一文件上传：MutationObserver 预捕 + OS 级 ESC 连发 + CDP 注入。
   *
   * 设计理念：接受 Electron 无法在 JS 层完全阻止文件对话框的现实。
   * 点击上传按钮前就启动 ESC 连发（PowerShell 后台），对话框弹出瞬间即被关闭。
   * MutationObserver 在 file input 被创建的瞬间捕获引用，无需等待 JS 拦截生效。
   *
   * 时序：
   *   PowerShell 启动 → [200ms] → ESC×5 (间隔50ms)
   *   安装 MutationObserver + 原型补丁
   *   点击上传按钮
   *   对话框弹出 → ~200ms内被 ESC 关闭 → 对话框消失
   *   轮询 DOM 找到 file input → CDP 注入 → 触发 change
   */
  async #uploadFileViaJSIntercept(filePath, uploadBtnBox) {
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }

    const refKey = `__m_${Date.now().toString(36)}`;

    // ===== 启动 OS 级 ESC 连发（在点击之前启动，争取最短关闭时间） =====
    console.warn('⚠️ [安全警告] #uploadFileViaJSIntercept: PowerShell SendKeys 将向系统前台发送 ESC 键！仅用于关闭原生文件对话框。');
    const { exec } = await import('node:child_process');
    const isWin = process.platform === 'win32';
    const escPromise = new Promise((resolve) => {
      if (isWin) {
        exec(
          `powershell -NoProfile -Command "Start-Sleep -Milliseconds 200; $ws=New-Object -ComObject WScript.Shell; 1..5|%{Start-Sleep -Milliseconds 50;$ws.SendKeys('{ESC}')}"`,
          { timeout: 3000, windowsHide: true },
          () => resolve()
        );
      } else {
        // macOS/Linux: no reliable OS-level keystroke injection without
        // Accessibility permissions. Rely on prototype patching + CDP intercept.
        setTimeout(() => resolve(), 500);
      }
    });

    // ===== 安装 MutationObserver + 原型补丁 (在点击之前) =====
    await this.wc.executeJavaScript(`
      (() => {
        if (window.__m_upload_ready__) return;
        window.__m_upload_ready__ = true;
        window.__m_fi__ = null;

        // MutationObserver: 捕获动态创建的 file input
        window['${refKey}_mo'] = new MutationObserver(function(records) {
          for (var r = 0; r < records.length; r++) {
            var nodes = records[r].addedNodes;
            for (var i = 0; i < nodes.length; i++) {
              var n = nodes[i];
              if (n.nodeType !== 1) continue;
              if (n.tagName === 'INPUT' && n.type === 'file') {
                window.__m_fi__ = n;
                // 阻断这个元素的原生 click
                var oc = n.click;
                n.click = function(){ window.__m_fi__ = this; };
              }
              if (n.querySelectorAll) {
                var fis = n.querySelectorAll('input[type="file"]');
                for (var j = 0; j < fis.length; j++) {
                  window.__m_fi__ = fis[j];
                  var oc2 = fis[j].click;
                  fis[j].click = function(){ window.__m_fi__ = this; };
                }
              }
            }
          }
        });
        window['${refKey}_mo'].observe(document.documentElement, { childList: true, subtree: true });

        // 原型补丁 click()
        window['${refKey}_oc'] = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function() {
          if (this.type === 'file' && !window.__m_file_done__) {
            window.__m_fi__ = this; return;
          }
          return window['${refKey}_oc'].call(this);
        };

        // 原型补丁 showPicker()
        if (HTMLInputElement.prototype.showPicker) {
          window['${refKey}_osp'] = HTMLInputElement.prototype.showPicker;
          HTMLInputElement.prototype.showPicker = function() {
            if (this.type === 'file' && !window.__m_file_done__) {
              window.__m_fi__ = this; return Promise.resolve();
            }
            return window['${refKey}_osp'].call(this);
          };
        }

        // 扫描页面中已存在的 file input
        var existing = document.querySelectorAll('input[type="file"]');
        for (var k = 0; k < existing.length; k++) {
          var oc3 = existing[k].click;
          existing[k].click = function(){ window.__m_fi__ = this; };
        }
      })()
    `);
    await sleep(100);

    // ===== 点击上传按钮 =====
    const cx = uploadBtnBox.x + uploadBtnBox.width * 0.5;
    const cy = uploadBtnBox.y + uploadBtnBox.height * 0.5;
    await this.humanMouseMoveByBox(uploadBtnBox);
    await this.mouseClick(cx, cy, 60 + Math.random() * 50);
    await this.mouseMove(cx + (Math.random() - 0.5) * 200, cy + (Math.random() - 0.5) * 150);

    // ===== 等待 ESC 连发完成（对话框已被关闭） =====
    await escPromise;
    console.log('[Upload] ESC 连发完成，对话框应已关闭');

    // ===== 在 DOM 中找 file input =====
    let fileInputNode = null;

    // 先检查 MutationObserver / 拦截器是否捕获了
    const captured = await this.wc.executeJavaScript(`
      (() => {
        var el = window.__m_fi__;
        if (!el || el.type !== 'file') return null;
        return { id: el.id || '', name: el.name || '' };
      })()
    `);

    if (captured) {
      const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
      const findNode = (node) => {
        if (!node) return null;
        if (node.nodeName === 'INPUT' && node.attributes) {
          const ti = node.attributes.indexOf('type');
          const ii = node.attributes.indexOf('id');
          if (ti >= 0 && node.attributes[ti + 1] === 'file') {
            if (captured.id && ii >= 0 && node.attributes[ii + 1] === captured.id) return node;
            if (!captured.id) return node;
          }
        }
        if (node.children) {
          for (const c of node.children) { const f = findNode(c); if (f) return f; }
        }
        return null;
      };
      fileInputNode = findNode(doc.root);
    }

    // 回退：直接扫 DOM
    if (!fileInputNode) {
      for (let i = 0; i < 15; i++) {
        await sleep(200);
        fileInputNode = await this.#findFileInputNode();
        if (fileInputNode) break;
      }
    }

    // ===== 清理 =====
    await this.wc.executeJavaScript(`
      (() => {
        var ck = '${refKey}';
        if (window[ck + '_mo']) { window[ck + '_mo'].disconnect(); delete window[ck + '_mo']; }
        if (window[ck + '_oc']) { HTMLInputElement.prototype.click = window[ck + '_oc']; delete window[ck + '_oc']; }
        if (window[ck + '_osp']) { HTMLInputElement.prototype.showPicker = window[ck + '_osp']; delete window[ck + '_osp']; }
        window.__m_fi__ = null;
        window.__m_upload_ready__ = false;
      })()
    `);

    if (!fileInputNode) {
      console.error('[Upload] 未找到 file input（对话框可能已被 ESC 关闭但 input 不存在）');
      return false;
    }

    // ===== CDP 注入文件 =====
    await this.wc.executeJavaScript(`
      window.dispatchEvent(new Event('blur'));
      document.hasFocus = () => false;
      0
    `);
    await sleep(900 + Math.random() * 1800);

    await this.wc.debugger.sendCommand('DOM.setFileInputFiles', {
      nodeId: fileInputNode.nodeId,
      files: [filePath]
    });

    await sleep(500);

    await this.wc.executeJavaScript(`
      (() => {
        var el = document.querySelector('input[type="file"]');
        if (el) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        window.__m_file_done__ = true;
        window.dispatchEvent(new Event('focus'));
        delete document.hasFocus;
      })()
    `);
    try { this.wc.focus(); } catch (_) {}
    console.log('[Upload] ✅ 文件注入成功');
    return true;
  }

  /**
   * 唯一上传入口
   */
  async safeUpload(videoPath, backupLocatorTexts = ['上传视频', '点击上传', '上传', '选择文件']) {
    this.#checkAlive();
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }

    for (const text of backupLocatorTexts) {
      const box = await this.getElementByText([text]);
      if (!box) continue;
      try {
        const result = await this.#uploadFileViaJSIntercept(videoPath, box);
        if (result) return true;
      } catch (e) {
        console.warn(`[safeUpload] "${text}" 失败:`, e.message);
      }
    }

    const existingInput = await this.#findFileInputNode();
    if (existingInput) {
      try {
        const result = await this.#directFileInject(videoPath, existingInput);
        if (result) return true;
      } catch (e) {
        console.warn('[safeUpload] 直注失败:', e.message);
      }
    }

    throw new Error('上传阻断：所有策略均失败。');
  }

  /**
   * @deprecated 请使用 safeUpload
   */
  async setFileInput(filePath, opts = {}) {
    return this.safeUpload(filePath, opts.backupLocatorTexts);
  }

  /**
   * 🛡️ 智能文件注入 — 优先 OS 级原生对话框（isTrusted=true），失败则降级 CDP 直注。
   * @param {string} filePath - 文件路径
   * @param {object} opts - 同 injectFileDirect 的 opts
   * @returns {boolean} 是否成功
   */
  async smartInjectFile(filePath, opts = {}) {
    this.#checkAlive();

    // P0: 尝试 OS 级原生文件对话框（isTrusted=true，平台无法检测）
    try {
      console.log('[SmartInject] 🛡️ 尝试 OS 级文件注入...');
      const nativeOk = await this.injectFileViaNativeDialog(filePath);
      if (nativeOk) {
        console.log('[SmartInject] ✅ OS 级注入成功 (isTrusted=true)');
        return true;
      }
      console.log('[SmartInject] ⚠️ OS 级注入未成功，降级 CDP...');
    } catch (e) {
      console.warn('[SmartInject] OS 级注入异常，降级 CDP:', e.message);
    }

    // Fallback: CDP 直注（isTrusted=false，但兼容性好）
    try {
      const cdpOk = await this.injectFileDirect(filePath, opts);
      if (cdpOk) {
        console.log('[SmartInject] ✅ CDP 降级注入成功');
        return true;
      }
    } catch (e) {
      console.warn('[SmartInject] CDP 注入也失败:', e.message);
    }

    console.error('[SmartInject] ❌ 所有注入策略均失败');
    return false;
  }

  /**
   * 🆕 直注文件 — JS querySelectorAll 找 input[type="file"] → 打 marker → CDP 精准定位 nodeId → 注入
   *
   * 🔴 零点击、零弹框。JS 搜索穿透 Shadow DOM，CDP 仅用于 setFileInputFiles。
   *
   * @param {string} filePath - 文件路径（纯字符串，禁止对象/数组）
   * @param {object} opts
   * @param {boolean} opts.pickLast - true=取最后一个 input（弹窗内新建的）, false=取第一个（主页面视频区）
   * @param {string[]} opts.contextKeywords - 按容器上下文文字筛选 file input（如 ['封面', 'cover']）
   * @returns {boolean} 是否成功
   */
  async injectFileDirect(filePath, { pickLast = true, containerSelector = null, contextKeywords = null } = {}) {
    this.#checkAlive();
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }

    // 🔴 防御：filePath 必须是纯字符串
    const cleanPath = String(filePath).trim();
    const marker = 'mx' + Date.now().toString(36);

    // Step 1: JS 搜 file input，打标记
    const selectorArg = containerSelector ? JSON.stringify(containerSelector) : 'null';
    const keywordsArg = contextKeywords ? JSON.stringify(contextKeywords) : 'null';
    const count = await this.wc.executeJavaScript(`
      (() => {
        var selector = ${selectorArg};
        var inputs;
        if (selector) {
          var container = document.querySelector(selector);
          if (!container) return 0;
          inputs = container.querySelectorAll('input[type="file"]');
        } else {
          inputs = document.querySelectorAll('input[type="file"]');
        }
        if (inputs.length === 0) return 0;

        var keywords = ${keywordsArg};
        var targetIdx = -1;
        if (keywords && keywords.length > 0) {
          // 按容器上下文文字筛选：向上遍历 5 级父节点，检查 innerText 是否命中关键词
          for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            for (var depth = 0; depth < 5 && el; depth++) {
              var txt = (el.innerText || el.textContent || '').toLowerCase();
              for (var k = 0; k < keywords.length; k++) {
                if (txt.indexOf(keywords[k].toLowerCase()) >= 0) {
                  targetIdx = i;
                  break;
                }
              }
              if (targetIdx >= 0) break;
              el = el.parentElement;
            }
            if (targetIdx >= 0) break;
          }
        }
        if (targetIdx < 0) {
          targetIdx = ${pickLast} ? inputs.length - 1 : 0;
        }
        inputs[targetIdx].setAttribute('data-mx', '${marker}');
        return inputs.length;
      })()
    `);

    if (!count) {
      console.warn('[injectFileDirect] 页面无 file input');
      return false;
    }

    // Step 2: CDP DOM 搜标记 → 拿 nodeId（确保整数）
    const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
    let rawNodeId = null;
    const search = (node) => {
      if (!node || rawNodeId != null) return;
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length - 1; i += 2) {
          if (node.attributes[i] === 'data-mx' && node.attributes[i + 1] === marker) {
            rawNodeId = node.nodeId;
            return;
          }
        }
      }
      if (node.children) node.children.forEach(search);
    };
    search(doc.root);

    if (rawNodeId == null) {
      // 清理标记
      await this.wc.executeJavaScript(`document.querySelector('[data-mx="${marker}"]')?.removeAttribute('data-mx')`).catch(() => {});
      console.warn('[injectFileDirect] CDP DOM 中未找到标记元素');
      return false;
    }
    const nodeId = parseInt(rawNodeId, 10);
    console.log('[injectFileDirect] 定位到 file input, nodeId:', nodeId, 'count:', count, 'pickLast:', pickLast);

    // Step 3: blur → 延时 → CDP 注入 → 派发 change/input → 清理标记
    try {
      await this.wc.executeJavaScript(`
        window.dispatchEvent(new Event('blur'));
        document.hasFocus = () => false;
        0
      `);
      await sleep(900 + Math.random() * 800);

      console.log('[injectFileDirect] 执行 DOM.setFileInputFiles nodeId=' + nodeId + ' file=' + cleanPath);
      await this.wc.debugger.sendCommand('DOM.setFileInputFiles', {
        nodeId,
        files: [cleanPath]
      });

      await sleep(400);

      // 👑 工业级唤醒：重建完美 File 对象 + 【全局防弹窗死锁防线】
      await this.wc.executeJavaScript(`
        (() => {
          // ==========================================
          // 🛡️ 1. 绝对防线：没收系统文件对话框的弹出权限
          // 防止主线程被原生 UI 挂起，防止注入的文件被用户的"取消"操作覆盖
          // ==========================================
          const originalClick = HTMLInputElement.prototype.click;
          HTMLInputElement.prototype.click = function() {
            if (this.type === 'file') {
              console.log('🛡️ [Native] 已拦截并粉碎了一次企图弹出文件筐的系统调用！');
              return; // 直接吃掉点击事件，不弹窗！
            }
            originalClick.call(this);
          };

          // 拦截基于原生 File System Access API 的弹窗
          window.showOpenFilePicker = async () => {
            console.log('🛡️ [Native] 已拦截 showOpenFilePicker');
            return [];
          };

          // ==========================================
          // 📦 2. 提取并修复 CDP 注入的文件
          // ==========================================
          const fileInput = document.querySelector('[data-mx="${marker}"]');
          if (!fileInput || fileInput.files.length === 0) return;

          console.log('[Native] 提取原始文件句柄...');
          const originalFile = fileInput.files[0];

          let ext = originalFile.name.split('.').pop().toLowerCase();
          let mimeType = originalFile.type;
          if (!mimeType) {
            if (ext === 'mov') mimeType = 'video/quicktime';
            else if (ext === 'mp4') mimeType = 'video/mp4';
            else mimeType = 'video/mp4';
          }

          const perfectFile = new File([originalFile], originalFile.name, {
            type: mimeType,
            lastModified: originalFile.lastModified || Date.now()
          });

          const dt = new DataTransfer();
          dt.items.add(perfectFile);
          fileInput.files = dt.files;

          // ==========================================
          // 🚀 3. 唤醒 React 状态机
          // ==========================================
          // 派发 input 和 change
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));

          // 派发 Drop
          const dropZone = fileInput.closest('.upload-zone, .upload-container, .upload-wrapper') || fileInput.parentElement;
          if (dropZone) {
            const dropEvent = new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt
            });
            dropZone.dispatchEvent(dropEvent);
            console.log('[Native] 完美的 Drop 事件派发完成，上传流已安全启动！');
          }
        })();
      `);

      console.log('[injectFileDirect] 完美 File 重建 + 防弹窗锁死 + 事件派发完成, marker:', marker);

      // 最后清理 marker
      await this.wc.executeJavaScript(`document.querySelector('[data-mx="${marker}"]')?.removeAttribute('data-mx')`).catch(() => {});

      await this.wc.executeJavaScript(`
        window.dispatchEvent(new Event('focus'));
        delete document.hasFocus;
        0
      `);
      try { this.wc.focus(); } catch (_) {}
    } catch (e) {
      console.error('[injectFileDirect] 注入失败:', e.message);
      try {
        await this.wc.executeJavaScript(`
          window.dispatchEvent(new Event('focus'));
          delete document.hasFocus;
          0
        `);
      } catch (_) {}
      return false;
    }

    console.log('[injectFileDirect] ✅ 文件注入成功');
    return true;
  }

  /**
   * 🆕 clickedFileInject — 点击触发按钮 → capture-phase 拦截阻止原生对话框 → marker → CDP 直注
   *
   * 彻底消除文件对话框弹窗。在 click 事件捕获阶段 preventDefault + stopPropagation，
   * 原生文件选择器根本不会打开。同时给被点击触发的 file input 打 marker，后续精准注入。
   *
   * 用于弹窗场景（封面设置），不依赖 PowerShell / ESC / MutationObserver。
   *
   * @param {string} triggerText - 触发按钮的可见文案（如 "上传封面"）
   * @param {string} filePath
   * @returns {boolean}
   */
  async clickedFileInject(triggerText, filePath) {
    this.#checkAlive();
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }

    const cleanPath = String(filePath).trim();
    const marker = 'mx' + Date.now().toString(36);

    // Step 1: 安装 capture-phase click 拦截器
    // 在事件到达 file input / label 之前就拦截，原生对话框永不出现
    await this.wc.executeJavaScript(`
      (() => {
        window['${marker}_fn'] = function(e) {
          const t = e.target;
          // case 1: 直接点击了 <input type="file">
          if (t.tagName === 'INPUT' && t.type === 'file') {
            e.preventDefault();
            e.stopPropagation();
            t.setAttribute('data-mx', '${marker}');
            window['${marker}_ok'] = true;
            return;
          }
          // case 2: 点击了 <label for="fileInput"> — 找关联的 input
          if (t.tagName === 'LABEL') {
            const input = t.htmlFor ? document.getElementById(t.htmlFor) : t.querySelector('input[type="file"]');
            if (input && input.type === 'file') {
              e.preventDefault();
              e.stopPropagation();
              input.setAttribute('data-mx', '${marker}');
              window['${marker}_ok'] = true;
              return;
            }
          }
          // case 3: 点击了包含 file input 的容器
          const child = t.querySelector('input[type="file"]');
          if (child) {
            e.preventDefault();
            e.stopPropagation();
            child.setAttribute('data-mx', '${marker}');
            window['${marker}_ok'] = true;
            return;
          }
        };
        document.addEventListener('click', window['${marker}_fn'], true);
        window['${marker}_ok'] = false;
      })()
    `);

    // Step 2: 点击触发按钮
    await this.humanClickByText(triggerText);
    await sleep(500);

    // 如果 humanClickByText 没命中，用 flexibleClick 兜底
    const intercepted = await this.wc.executeJavaScript(`window['${marker}_ok']`);
    if (!intercepted) {
      await this.flexibleClick([triggerText], 1000);
      await sleep(300);
    }

    // Step 3: 检查是否拦截成功
    const confirmed = await this.wc.executeJavaScript(`!!window['${marker}_ok']`);

    // Step 4: 清除拦截器
    await this.wc.executeJavaScript(`
      (() => {
        document.removeEventListener('click', window['${marker}_fn'], true);
        delete window['${marker}_fn'];
        delete window['${marker}_ok'];
      })()
    `);

    if (!confirmed) {
      console.warn('[clickedFileInject] 拦截未触发，回退 safeUpload');
      return this.safeUpload(filePath, [triggerText, '上传']);
    }

    // Step 5: CDP 找 marker → nodeId → 注入
    const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
    let rawNodeId = null;
    const search = (node) => {
      if (!node || rawNodeId != null) return;
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length - 1; i += 2) {
          if (node.attributes[i] === 'data-mx' && node.attributes[i + 1] === marker) {
            rawNodeId = node.nodeId;
            return;
          }
        }
      }
      if (node.children) node.children.forEach(search);
    };
    search(doc.root);

    if (rawNodeId == null) {
      console.warn('[clickedFileInject] marker 在 CDP DOM 中未找到');
      await this.wc.executeJavaScript(`document.querySelector('[data-mx="${marker}"]')?.removeAttribute('data-mx')`).catch(() => {});
      return false;
    }
    const nodeId = parseInt(rawNodeId, 10);
    console.log('[clickedFileInject] 拦截成功, nodeId:', nodeId);

    // Step 6: blur → 注入 → change → 清理 → focus
    try {
      await this.wc.executeJavaScript(`window.dispatchEvent(new Event('blur')); document.hasFocus = () => false; 0`);
      await sleep(500);

      await this.wc.debugger.sendCommand('DOM.setFileInputFiles', { nodeId, files: [cleanPath] });
      await sleep(300);

      // 精准派发 change 到被标记的 input
      const dispatched = await this.wc.executeJavaScript(`
        (() => {
          const el = document.querySelector('[data-mx="${marker}"]');
          if (el) {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        })()
      `);

      // 清理 marker
      await this.wc.executeJavaScript(`document.querySelector('[data-mx="${marker}"]')?.removeAttribute('data-mx')`).catch(() => {});

      await this.wc.executeJavaScript(`window.dispatchEvent(new Event('focus')); delete document.hasFocus; 0`);
      try { this.wc.focus(); } catch (_) {}
    } catch (e) {
      console.error('[clickedFileInject] CDP 注入失败:', e.message);
      await this.wc.executeJavaScript(`document.querySelector('[data-mx="${marker}"]')?.removeAttribute('data-mx')`).catch(() => {});
      await this.wc.executeJavaScript(`window.dispatchEvent(new Event('focus')); delete document.hasFocus; 0`).catch(() => {});
      return false;
    }

    console.log('[clickedFileInject] ✅ 文件注入成功（零弹窗）');
    return true;
  }

  // ---------- 页面导航 ----------

  /**
   * 导航到指定 URL
   */
  async navigate(url) {
    this.#checkAlive();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('页面加载超时: ' + url)), 60000);
      const handler = () => {
        clearTimeout(timeout);
        this.wc.removeListener('did-finish-load', handler);
        resolve();
      };
      this.wc.on('did-finish-load', handler);
      this.wc.loadURL(url);
    });
  }

  /**
   * 等待 URL 匹配指定正则
   */
  async waitForUrl(pattern, timeout = 30000) {
    this.#checkAlive();
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('URL 等待超时: ' + regex)), timeout);
      const handler = (event, url) => {
        if (regex.test(url)) {
          clearTimeout(timer);
          this.wc.removeListener('did-navigate', handler);
          this.wc.removeListener('did-navigate-in-page', handler);
          resolve(url);
        }
      };
      this.wc.on('did-navigate', handler);
      this.wc.on('did-navigate-in-page', handler);
    });
  }

  // ---------- 截图 ----------

  /**
   * 截图并返回 JPEG Buffer
   */
  async captureScreenshot(quality = 85) {
    this.#checkAlive();
    const nativeImage = await this.wc.capturePage();
    return nativeImage.toJPEG(quality);
  }

  /**
   * 截图并返回 PNG Buffer
   */
  async captureScreenshotPng() {
    this.#checkAlive();
    const nativeImage = await this.wc.capturePage();
    return nativeImage.toPNG();
  }

  /**
   * 截图并返回 Base64 Data URL
   */
  async captureScreenshotBase64(quality = 85) {
    const buf = await this.captureScreenshot(quality);
    const base64 = buf.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  }

  /**
   * 获取视口大小
   */
  async getViewportSize() {
    this.#checkAlive();
    try {
      return await this.wc.executeJavaScript('({ width: window.innerWidth, height: window.innerHeight })');
    } catch (e) {
      return { width: 1280, height: 800 };
    }
  }

  // ---------- 通用 JS 执行 ----------

  /**
   * 在页面上下文中执行 JavaScript
   */
  async executeJavaScript(code) {
    this.#checkAlive();
    return this.wc.executeJavaScript(code);
  }

  // ==========================================
  // 🆕 L2: CDP Accessibility Tree 语义锚点
  // ==========================================

  /**
   * 归一化 CDP AXValue — 可能是 string 或 { value: string }，
   * 取决于 Chrome 版本和页面结构。
   */
  #axString(val) {
    if (typeof val === 'string') return val;
    if (val && typeof val.value === 'string') return val.value;
    return '';
  }

  /** 惰性启用 Accessibility 域 */
  async #ensureAccessibility() {
    if (this.#_axEnabled) return;
    if (this.wc.debugger.isAttached()) {
      try {
        await this.wc.debugger.sendCommand('Accessibility.enable');
        this.#_axEnabled = true;
      } catch (e) {
        console.warn('[AX] Accessibility.enable 失败:', e.message);
      }
    }
  }

  /** 获取完整 AX 树（自动归一化 name/description/value 为纯字符串） */
  async getAXTree() {
    this.#checkAlive();
    await this.#ensureAccessibility();
    try {
      const result = await this.wc.debugger.sendCommand('Accessibility.getFullAXTree', { depth: -1 });
      const nodes = result?.nodes || null;
      if (nodes) {
        // 归一化 AXValue → 纯字符串，避免 Chrome 版本差异导致 .toLowerCase() 报错
        for (const node of nodes) {
          node.name = this.#axString(node.name);
          node.role = this.#axString(node.role);
          if (node.description) node.description = this.#axString(node.description);
          if (node.value) node.value = this.#axString(node.value);
        }
      }
      return nodes;
    } catch (e) {
      console.warn('[AX] getFullAXTree 失败:', e.message);
      return null;
    }
  }

  /** 递归搜索 AX 节点 */
  #searchAXNode(node, predicate) {
    if (!node) return null;
    if (predicate(node)) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.#searchAXNode(child, predicate);
        if (found) return found;
      }
    }
    if (node.childIds) {
      // AX 树可能用 childIds 而非 children（取决于 CDP 返回格式）
      // 这种情况下需要从 nodes 数组中查找；这里先处理 children 数组的情况
    }
    return null;
  }

  /** 按 placeholder 文本查找输入框 AX 节点 */
  async findAXNodeByPlaceholder(text) {
    const nodes = await this.getAXTree();
    if (!nodes || !nodes.length) return null;
    return this.#searchAXNode(nodes[0], node => {
      if (node.role !== 'textField' && node.role !== 'textbox' && node.role !== 'searchBox') return false;
      const name = (node.name || '').toLowerCase();
      const desc = ((node.description || node.valueDescription) || '').toLowerCase();
      const val = ((node.value && typeof node.value === 'string') ? node.value : '').toLowerCase();
      const q = text.toLowerCase();
      return name.includes(q) || desc.includes(q) || val.includes(q);
    });
  }

  /** 按可见文本查找 AX 节点 */
  async findAXNodeByText(text) {
    const nodes = await this.getAXTree();
    if (!nodes || !nodes.length) return null;
    const q = text.toLowerCase();
    return this.#searchAXNode(nodes[0], node => {
      if (node.hidden) return false;
      const name = (node.name || '').toLowerCase().trim();
      return name === q || name.includes(q);
    });
  }

  /** 按 role 查找 AX 节点 */
  async findAXNodeByRole(role) {
    const nodes = await this.getAXTree();
    if (!nodes || !nodes.length) return null;
    return this.#searchAXNode(nodes[0], node => node.role === role && !node.hidden);
  }

  /** 批量获取所有匹配 role 的 AX 节点 */
  async findAXNodesByRole(role) {
    const nodes = await this.getAXTree();
    if (!nodes || !nodes.length) return [];
    const results = [];
    const walk = (node) => {
      if (!node) return;
      if (node.role === role && !node.hidden) results.push(node);
      if (node.children) node.children.forEach(walk);
    };
    walk(nodes[0]);
    return results;
  }

  // ---------- AX → 坐标 ----------

  /** backendNodeId → boxModel 坐标 */
  async backendNodeIdToBoxModel(backendNodeId) {
    try {
      const { object } = await this.wc.debugger.sendCommand('DOM.resolveNode', { backendNodeId });
      if (!object?.objectId) return null;
      const { nodeId } = await this.wc.debugger.sendCommand('DOM.requestNode', { objectId: object.objectId });
      if (!nodeId) return null;
      const { model } = await this.wc.debugger.sendCommand('DOM.getBoxModel', { nodeId });
      if (!model?.content || model.content.length < 8) return null;
      const [x1, y1, x2, y2, x3, y3, x4, y4] = model.content;
      const x = Math.min(x1, x2, x3, x4);
      const y = Math.min(y1, y2, y3, y4);
      const width = Math.max(x1, x2, x3, x4) - x;
      const height = Math.max(y1, y2, y3, y4) - y;
      return { x, y, width, height };
    } catch (e) {
      console.warn('[AX] backendNodeIdToBoxModel 失败:', e.message);
      return null;
    }
  }

  /** 查找自定义元素（Shadow DOM closed 穿透）— 返回 boxModel */
  async findCustomElementBox(tagName) {
    try {
      const { root } = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
      const tag = tagName.toUpperCase();
      let targetNodeId = null;

      const search = (node) => {
        if (!node) return;
        if (node.nodeName === tag) { targetNodeId = node.nodeId; return; }
        if (node.children) node.children.forEach(search);
      };
      search(root);

      if (!targetNodeId) return null;

      const { model } = await this.wc.debugger.sendCommand('DOM.getBoxModel', { nodeId: targetNodeId });
      if (!model?.content || model.content.length < 8) return null;
      const [x1, y1, x2, y2, x3, y3, x4, y4] = model.content;
      const x = Math.min(x1, x2, x3, x4);
      const y = Math.min(y1, y2, y3, y4);
      return {
        x, y,
        width: Math.max(x1, x2, x3, x4) - x,
        height: Math.max(y1, y2, y3, y4) - y
      };
    } catch (e) {
      console.warn('[ShadowDOM] findCustomElementBox 失败:', e.message);
      return null;
    }
  }

  // ==========================================
  // 🆕 L2: 组合操作（AX 搜索 → 坐标 → 动作）
  // ==========================================

  /** 通过 AX CDP 注入文本（解决 ProseMirror/sendInputEvent char 不兼容） */
  async insertTextViaCDP(text) {
    this.#checkAlive();
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }
    // 确保 Input 域已启用
    try {
      await this.wc.debugger.sendCommand('Input.enable');
    } catch (_) {}
    // 长文本分块，避免 ProseMirror 事务系统过载
    const CHUNK = 2000;
    for (let i = 0; i < text.length; i += CHUNK) {
      const chunk = text.slice(i, i + CHUNK);
      await this.wc.debugger.sendCommand('Input.insertText', { text: chunk });
      if (text.length > CHUNK) await sleep(100);
    }
  }

  /** JS 原生 setter 设值 — 绕过 React 受控组件对 CDP insertText 的无视 */
  async setNativeInputValue(cssSelector, text) {
    this.#checkAlive();
    return this.wc.executeJavaScript(`(function() {
      const el = document.querySelector(${JSON.stringify(cssSelector)});
      if (!el) return false;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
          ? HTMLInputElement.prototype : HTMLElement.prototype, 'value'
      )?.set;
      if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(text)});
      else if (el.isContentEditable) el.textContent = ${JSON.stringify(text)};
      else el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (el.isContentEditable) el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    })()`);
  }

  /** JS 原生 setter 设值到 document.activeElement — 绕过 Shadow DOM + React 受控组件 */
  async setActiveElementValue(text) {
    this.#checkAlive();
    return this.wc.executeJavaScript(`(function() {
      const el = document.activeElement;
      if (!el) return false;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
          ? HTMLInputElement.prototype : HTMLElement.prototype, 'value'
      )?.set;
      if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(text)});
      else if (el.isContentEditable) el.textContent = ${JSON.stringify(text)};
      else el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (el.isContentEditable) el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    })()`);
  }

  /** CDP DOM.focus — 强制聚焦 backend node，让 activeElement 正确更新 */
  async focusBackendNode(backendNodeId) {
    this.#checkAlive();
    try {
      const { object } = await this.wc.debugger.sendCommand('DOM.resolveNode', { backendNodeId });
      if (!object?.objectId) return false;
      const { nodeId } = await this.wc.debugger.sendCommand('DOM.requestNode', { objectId: object.objectId });
      if (!nodeId) return false;
      await this.wc.debugger.sendCommand('DOM.focus', { nodeId });
      return true;
    } catch (e) {
      console.warn('[NativeInteractions] focusBackendNode failed:', e.message);
      return false;
    }
  }

  /** 按可见文案点击（AX 优先，回退 DOM） */
  async humanClickByText(text) {
    // 先尝试 AX 树
    const axNode = await this.findAXNodeByText(text);
    if (axNode && axNode.backendDOMNodeId) {
      const box = await this.backendNodeIdToBoxModel(axNode.backendDOMNodeId);
      if (box && box.width > 0 && box.height > 0) {
        await this.humanClickAtCoordinates(
          box.x + box.width * 0.5,
          box.y + box.height * 0.5
        );
        return true;
      }
    }
    // 回退: 旧 DOM 文本扫描
    return this.flexibleClick([text]);
  }

  /** 通过 AX 定位输入框并 CDP 插入文本 */
  async humanTypeByAX(predicate, text) {
    if (!text) return;

    // 查找目标节点
    let axNode = null;
    if (predicate.placeholder) {
      axNode = await this.findAXNodeByPlaceholder(predicate.placeholder);
    }
    if (!axNode && predicate.role) {
      const nodes = await this.findAXNodesByRole(predicate.role);
      // 对 contenteditable 场景：取第一个非 hidden 且 editable 的节点
      axNode = nodes.find(n => !n.hidden) || nodes[0] || null;
    }
    if (!axNode && predicate.role) {
      axNode = await this.findAXNodeByRole(predicate.role);
    }

    // 获取坐标并点击聚焦
    if (axNode?.backendDOMNodeId) {
      const box = await this.backendNodeIdToBoxModel(axNode.backendDOMNodeId);
      if (box && box.width > 0 && box.height > 0) {
        await this.humanClickAtCoordinates(
          box.x + box.width * 0.5,
          box.y + box.height * 0.5
        );
        await sleep(predicate.role === 'textbox' ? 500 : 200); // ProseMirror 需要更长时间
        await this.insertTextViaCDP(text);
        return;
      }
    }

    // 回退: 旧 CSS 选择器方式 — 点击聚焦后用 CDP insertText（避免 sendInputEvent char 在小红书等 SPA 上失效）
    if (predicate.cssFallback) {
      await this.humanMouseMove(predicate.cssFallback);
      await this.clickElement(predicate.cssFallback);
      await sleep(300);
      await this.insertTextViaCDP(text);
    }
  }

  // ==========================================
  // 🆕 L3: 通用交互模式
  // ==========================================

  /** 开关切换 — AX 定位 label 附近的 switch */
  async toggleSwitch(label) {
    console.log(`[L3] toggleSwitch: "${label}"`);

    // 策略1: AX 树找 label 附近的 switch 角色
    const labelNode = await this.findAXNodeByText(label);
    const switches = await this.findAXNodesByRole('switch');
    if (switches.length > 0 && labelNode) {
      // 找离 label 最近的 switch
      let bestSwitch = null;
      let bestDist = Infinity;
      const lBox = labelNode.backendDOMNodeId
        ? await this.backendNodeIdToBoxModel(labelNode.backendDOMNodeId) : null;
      if (lBox) {
        for (const sw of switches) {
          if (!sw.backendDOMNodeId) continue;
          const sBox = await this.backendNodeIdToBoxModel(sw.backendDOMNodeId);
          if (!sBox) continue;
          const dist = Math.abs(sBox.y - lBox.y) + Math.abs(sBox.x - lBox.x);
          if (dist < bestDist) { bestDist = dist; bestSwitch = sw; }
        }
      }
      // 如果没找到 label 附近匹配的，不盲目点击第一个 switch
      if (bestSwitch && bestDist < 500) {
        const box = await this.backendNodeIdToBoxModel(bestSwitch.backendDOMNodeId);
        if (box && box.width > 0) {
          await this.humanClickAtCoordinates(
            box.x + box.width * 0.5,
            box.y + box.height * 0.5
          );
          return true;
        }
      }
    }

    // 策略2: 回退 — 按文案点击（通常点击 label 文字即可切换）
    const clicked = await this.flexibleClick([label]);
    if (clicked) return true;

    // 策略3: 找包含 label 的父级区域中的 toggle 元素
    if (labelNode && labelNode.backendDOMNodeId) {
      const box = await this.backendNodeIdToBoxModel(labelNode.backendDOMNodeId);
      if (box) {
        // 点击 label 右侧（toggle 通常紧挨 label）
        await this.humanClickAtCoordinates(
          box.x + box.width + 24,
          box.y + box.height * 0.5
        );
        return true;
      }
    }

    return false;
  }

  /** 下拉选择 — 点击触发 → 等展开 → 点选项 */
  async selectDropdown(label, optionText) {
    console.log(`[L3] selectDropdown: "${label}" → "${optionText}"`);
    const triggered = await this.humanClickByText(label);
    if (!triggered) {
      // 回退
      await this.flexibleClick([label]);
    }
    await sleep(600);
    const selected = await this.humanClickByText(optionText);
    if (!selected) {
      await this.flexibleClick([optionText]);
    }
    return true;
  }

  /**
   * 通用弹窗流程
   * @param {string} triggerText - 触发按钮文案
   * @param {Array<{type: 'click'|'fileInput'|'wait', text?: string|string[], path?: string, ms?: number}>} steps
   */
  async dialogFlow(triggerText, steps) {
    console.log(`[L3] dialogFlow: "${triggerText}" (${steps.length} steps)`);

    // 打开弹窗
    const triggered = await this.humanClickByText(triggerText);
    if (!triggered) {
      await this.flexibleClick([triggerText]);
    }
    await sleep(800);

    // 执行步骤
    for (const step of steps) {
      switch (step.type) {
        case 'click': {
          const texts = Array.isArray(step.text) ? step.text : [step.text];
          let clicked = false;
          for (const t of texts) {
            clicked = await this.humanClickByText(t);
            if (clicked) break;
          }
          if (!clicked) {
            await this.flexibleClick(texts);
          }
          break;
        }
        case 'fileInput': {
          const locators = Array.isArray(step.text) ? step.text : [step.text || '上传'];
          await this.safeUpload(step.path, locators);
          break;
        }
        case 'wait': {
          await sleep(step.ms || 1000);
          break;
        }
      }
      await sleep(300);
    }

    return true;
  }

  // ==========================================
  // 🛡️ 防检测加固层 (Anti-Detection Hardening)
  // ==========================================

  /**
   * 人类打字模拟 — 逐字输入 + 随机节奏 + 偶尔停顿。
   * 比 insertTextViaCDP 的一次性灌入更像真人。
   * @param {string} text
   */
  async humanTypeText(text) {
    this.#checkAlive();
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }
    try { await this.wc.debugger.sendCommand('Input.enable'); } catch (_) {}

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // 逐字符 insertText（比 dispatchKeyEvent 更兼容 ProseMirror 等编辑器）
      await this.wc.debugger.sendCommand('Input.insertText', { text: char });

      // 基础延迟：50-180ms 高斯分布（真人打字区间）
      let delay = 50 + Math.random() * 130;

      // 10% 概率出现"思考停顿" 400-1200ms
      if (Math.random() < 0.10) delay += 400 + Math.random() * 800;

      // 标点符号后稍微停顿
      if ('.!?。！？，,;；'.includes(char)) delay += 100 + Math.random() * 200;

      // 每 15-30 个字符出现一次较长停顿（像在看屏幕）
      if (i > 0 && i % (15 + Math.floor(Math.random() * 16)) === 0) {
        delay += 300 + Math.random() * 500;
      }

      await sleep(delay);
    }
  }

  /**
   * 人类鼠标移动 — 贝塞尔曲线路径 + 终点高斯偏移。
   * 使用 nut.js 生成 OS 级真实鼠标事件，同时通过 CDP 同步浏览器状态。
   * @param {number} toX - 目标 X
   * @param {number} toY - 目标 Y
   * @param {number} [steps] - 路径点数（默认 8-15）
   */
  async humanMouseMove(toX, toY, steps) {
    this.#checkAlive();
    try {
      const { mouse, Point } = await import('@nut-tree-fork/nut-js');

      // 终点加 ±3px 高斯偏移（真人不会精确到像素）
      const jitterX = toX + (Math.random() - 0.5) * 6;
      const jitterY = toY + (Math.random() - 0.5) * 6;

      // 获取当前鼠标位置作为起点
      const currentPos = await mouse.getPosition();
      const startX = currentPos.x;
      const startY = currentPos.y;

      // 生成贝塞尔控制点（模拟手腕弧线）
      const dx = jitterX - startX;
      const dy = jitterY - startY;
      const ctrlX = startX + dx * (0.3 + Math.random() * 0.4) + (Math.random() - 0.5) * 60;
      const ctrlY = startY + dy * (0.3 + Math.random() * 0.4) + (Math.random() - 0.5) * 60;

      const numSteps = steps || (8 + Math.floor(Math.random() * 8));
      for (let i = 1; i <= numSteps; i++) {
        const t = i / numSteps;
        // 二次贝塞尔：P = (1-t)²·start + 2(1-t)t·ctrl + t²·end
        const x = Math.round((1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * jitterX);
        const y = Math.round((1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * jitterY);
        await mouse.setPosition(new Point(x, y));
        await sleep(8 + Math.random() * 12); // 每步 8-20ms
      }

      // 确保最终位置准确
      await mouse.setPosition(new Point(Math.round(jitterX), Math.round(jitterY)));

      // 同步 CDP 鼠标位置
      if (!this.wc.debugger.isAttached()) {
        this.wc.debugger.attach('1.3');
      }
      await this.wc.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: Math.round(jitterX), y: Math.round(jitterY)
      });

    } catch (e) {
      // nut.js 不可用时降级到 CDP
      console.warn('[AntiDetect] nut.js mouseMove 失败，降级 CDP:', e.message);
      if (!this.wc.debugger.isAttached()) {
        this.wc.debugger.attach('1.3');
      }
      await this.wc.debugger.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: Math.round(toX), y: Math.round(toY)
      });
    }
  }

  /**
   * OS 级文件注入 — 打开原生文件对话框 + nut.js 键盘输入路径。
   * 生成 isTrusted: true 的文件选择事件，平台无法区分与真人操作。
   * @param {string} filePath - 绝对文件路径
   * @returns {boolean} 是否成功
   */
  async injectFileViaNativeDialog(filePath) {
    console.warn('⚠️ [安全警告] injectFileViaNativeDialog 使用 OS 级键盘输入 — 可能干扰用户鼠标/键盘！');
    console.warn('⚠️ 优先使用 injectFileDirect（纯 CDP，零干扰）。');
    this.#checkAlive();
    try {
      const { keyboard, Key } = await import('@nut-tree-fork/nut-js');
      const path = await import('node:path');
      const fs = await import('node:fs');

      const cleanPath = path.resolve(String(filePath).trim());
      if (!fs.existsSync(cleanPath)) {
        console.error('[AntiDetect] 文件不存在:', cleanPath);
        return false;
      }

      // 1. 临时解除防弹窗结界
      await this.wc.executeJavaScript(`
        (() => {
          if (window.__dialog_sealed) {
            window.__dialog_sealed = false;
            // 恢复原型 click
            if (HTMLInputElement.prototype.click.__orig) {
              HTMLInputElement.prototype.click = HTMLInputElement.prototype.click.__orig;
            }
            // 暂时移除 pointer-events:none
            var s = document.getElementById('mx-seal-style');
            if (s) s.disabled = true;
          }
        })()
      `).catch(() => {});

      // 2. 找到 file input 并触发 click
      const clicked = await this.wc.executeJavaScript(`
        (function() {
          var inputs = document.querySelectorAll('input[type="file"]');
          if (inputs.length === 0) return false;
          var target = inputs[inputs.length - 1];
          target.scrollIntoView({ block: 'center', behavior: 'instant' });
          target.click();
          return true;
        })()
      `);

      if (!clicked) {
        console.error('[AntiDetect] 未找到 file input');
        await this.#restoreFileDialogSeal();
        return false;
      }

      // 3. 等待系统文件对话框打开
      await sleep(1200);

      // 4. 用 nut.js 键盘输入文件路径并确认
      //    Windows 文件对话框：地址栏已有焦点，直接输入路径
      await keyboard.type(cleanPath);
      await sleep(300);
      await keyboard.pressKey(Key.Enter);
      await sleep(100);
      await keyboard.releaseKey(Key.Enter);

      // 5. 等待文件选择生效
      await sleep(800);

      // 6. 恢复防弹窗结界
      await this.#restoreFileDialogSeal();

      // 7. 验证文件已选择
      const fileCount = await this.wc.executeJavaScript(`
        (function() {
          var inputs = document.querySelectorAll('input[type="file"]');
          var total = 0;
          for (var i = 0; i < inputs.length; i++) total += (inputs[i].files ? inputs[i].files.length : 0);
          return total;
        })()
      `);

      console.log('[AntiDetect] 文件注入结果:', fileCount > 0 ? '✅ 成功' : '❌ 失败');
      return fileCount > 0;

    } catch (e) {
      console.error('[AntiDetect] OS级文件注入失败:', e.message);
      await this.#restoreFileDialogSeal();
      return false;
    }
  }

  async #restoreFileDialogSeal() {
    try {
      await this.wc.executeJavaScript(`
        (() => {
          window.__dialog_sealed = true;
          var s = document.getElementById('mx-seal-style');
          if (s) s.disabled = false;
        })()
      `);
    } catch (_) {}
  }

  /**
   * 指纹伪装 — 在页面加载前注入覆盖脚本。
   * 调用时机：BrowserWindow 创建后、导航前。
   */

  /**
   * 在指定坐标执行原生鼠标点击（封装 mouseDown + mouseUp）。
   * 抽象层方法，不暴露底层 webContents。
   * @param {number} x
   * @param {number} y
   */
  async nativeClickAt(x, y) {
    console.warn('⚠️ [安全警告] nativeClickAt 使用 OS 级鼠标移动 — 真实光标会跳动！');
    console.warn('⚠️ 优先使用 humanClickAtCoordinates（纯 sendInputEvent，零干扰）。');
    this.#checkAlive();
    await this.humanMouseMove(x, y);
    await sleep(50 + Math.random() * 30);
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }
    await this.wc.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1
    });
    await sleep(60 + Math.random() * 40);
    await this.wc.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1
    });
  }

  async applyFingerprintHardening() {
    this.#checkAlive();

    // 1. 在所有新页面加载前注入伪装脚本
    await this.wc.executeJavaScript(`
      (() => {
        if (window.__fingerprint_hardened) return;
        window.__fingerprint_hardened = true;

        // ── navigator.webdriver = false ──
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false, configurable: true
        });

        // ── 补全 window.chrome ──
        if (!window.chrome) window.chrome = {};
        if (!window.chrome.runtime) {
          window.chrome.runtime = {
            connect: function() { return { onMessage: { addListener: function(){}, removeListener: function(){} }, postMessage: function(){}, disconnect: function(){} }; },
            sendMessage: function() {},
            onMessage: { addListener: function(){}, removeListener: function(){} },
            PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
            PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
            RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
            OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }
          };
        }
        if (!window.chrome.csi) {
          window.chrome.csi = function() { return { onloadT: Date.now(), pageT: Date.now() - performance.timing.navigationStart, startE: performance.timing.navigationStart, tran: 15 }; };
        }
        if (!window.chrome.loadTimes) {
          window.chrome.loadTimes = function() {
            var pt = performance.timing;
            return {
              commitLoadTime: pt.responseStart / 1000,
              connectionInfo: 'http/1.1',
              finishDocumentLoadTime: pt.domContentLoadedEventEnd / 1000,
              finishLoadTime: pt.loadEventEnd / 1000,
              firstPaintAfterLoadTime: 0,
              firstPaintTime: pt.domContentLoadedEventEnd / 1000,
              navigationType: 'Other',
              npnNegotiatedProtocol: 'unknown',
              requestTime: pt.navigationStart / 1000,
              startLoadTime: pt.navigationStart / 1000,
              wasAlternateProtocolAvailable: false,
              wasFetchedViaSpdy: false,
              wasNpnNegotiated: false
            };
          };
        }

        // ── 伪造 plugins ──
        var fakePlugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 }
        ];
        Object.defineProperty(navigator, 'plugins', {
          get: function() {
            var list = fakePlugins;
            list.item = function(i) { return this[i] || null; };
            list.namedItem = function(n) { for (var i = 0; i < this.length; i++) if (this[i].name === n) return this[i]; return null; };
            list.refresh = function() {};
            return list;
          }, configurable: true
        });

        // ── 伪造 MimeType ──
        Object.defineProperty(navigator, 'mimeTypes', {
          get: function() {
            var types = [
              { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
              { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }
            ];
            types.item = function(i) { return this[i] || null; };
            types.namedItem = function(n) { for (var i = 0; i < this.length; i++) if (this[i].type === n) return this[i]; return null; };
            return types;
          }, configurable: true
        });

        // ── 伪造 permissions ──
        if (navigator.permissions) {
          var origQuery = navigator.permissions.query.bind(navigator.permissions);
          navigator.permissions.query = function(desc) {
            if (desc && desc.name === 'notifications') {
              return Promise.resolve({ state: Notification.permission || 'default', onchange: null });
            }
            return origQuery(desc);
          };
        }

        // ── 移除自动化痕迹 ──
        delete navigator.__proto__.webdriver;

        // ── 伪造 connection.rtt ──
        if (navigator.connection) {
          Object.defineProperty(navigator.connection, 'rtt', { get: () => 100, configurable: true });
        }

        // ── Canvas 指纹噪声 ──
        var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
          if (type === 'image/png' && this.width > 16 && this.height > 16) {
            var ctx = this.getContext('2d');
            if (ctx) {
              // 加极微小噪声（肉眼不可见，但改变指纹哈希）
              var imgData = ctx.getImageData(0, 0, Math.min(this.width, 4), Math.min(this.height, 4));
              for (var i = 0; i < imgData.data.length; i += 4) {
                imgData.data[i] = imgData.data[i] ^ (Math.random() > 0.5 ? 1 : 0);
              }
              ctx.putImageData(imgData, 0, 0);
            }
          }
          return origToDataURL.apply(this, arguments);
        };

        // ── AudioContext 指纹噪声 ──
        if (window.AudioContext || window.webkitAudioContext) {
          var OrigAC = window.AudioContext || window.webkitAudioContext;
          var WrappedAC = function() {
            var ac = new OrigAC();
            var origCreateOsc = ac.createOscillator.bind(ac);
            ac.createOscillator = function() {
              var osc = origCreateOsc();
              var origStart = osc.start.bind(osc);
              osc.start = function(when) {
                // 添加微小频率偏移
                osc.frequency.value += Math.random() * 0.0001;
                return origStart(when);
              };
              return osc;
            };
            return ac;
          };
          WrappedAC.prototype = OrigAC.prototype;
          if (window.AudioContext) window.AudioContext = WrappedAC;
          else window.webkitAudioContext = WrappedAC;
        }

        // ── 防止 toString 检测 ──
        var nativeToString = Function.prototype.toString;
        Function.prototype.toString = function() {
          if (this === navigator.permissions.query) return 'function query() { [native code] }';
          if (this === HTMLCanvasElement.prototype.toDataURL) return 'function toDataURL() { [native code] }';
          return nativeToString.call(this);
        };
      })();
    `);

    console.log('[AntiDetect] ✅ 指纹伪装已注入');
  }
}

export { KEY_CODES, sleep };
