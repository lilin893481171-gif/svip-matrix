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
  constructor(webContents) {
    this.wc = webContents;
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
    const modifiers = [modifier.toLowerCase()];

    // 按下修饰键
    this.wc.sendInputEvent({
      type: 'keyDown', keyCode: modDef.keyCode,
      windowsVirtualKeyCode: modDef.windowsVirtualKeyCode, modifiers
    });
    await sleep(10);

    if (key) {
      const keyDef = KEY_CODES[key] || { keyCode: key };
      this.wc.sendInputEvent({
        type: 'keyDown', keyCode: keyDef.keyCode,
        windowsVirtualKeyCode: keyDef.windowsVirtualKeyCode, modifiers
      });
      await sleep(20 + Math.random() * 20);
      this.wc.sendInputEvent({
        type: 'keyUp', keyCode: keyDef.keyCode,
        windowsVirtualKeyCode: keyDef.windowsVirtualKeyCode, modifiers
      });
    }

    // 释放修饰键
    this.wc.sendInputEvent({
      type: 'keyUp', keyCode: modDef.keyCode,
      windowsVirtualKeyCode: modDef.windowsVirtualKeyCode
    });
  }

  /**
   * 逐字符输入文本（高斯延时 + 随机错误 + 回删 + 思考停顿）
   * 为每个矩阵账号生成独立的打字节奏（WPM），不同账号不同"手感"
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
        this.wc.sendInputEvent({ type: 'keyDown', keyCode: char });
        this.wc.sendInputEvent({ type: 'char', keyChar: char });
        this.wc.sendInputEvent({ type: 'keyUp', keyCode: char });
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
          const r = el.getBoundingClientRect();
          return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height, tag: el.tagName, text: (el.textContent||'').trim().substring(0, 50) };
        })()
      `);
    } catch (e) {
      return null;
    }
  }

  /**
   * 执行任意 JavaScript 并返回结果
   */
  async evaluate(jsCode) {
    this.#checkAlive();
    return this.wc.executeJavaScript(jsCode);
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
    await this.clickElement(cssSelector); // 先点击聚焦
    await sleep(200);

    // Ctrl+A 全选 + Backspace 清空
    await this.pressCombo('Control+A');
    await this.pressKey('Backspace');
    await sleep(300);

    await this.typeText(text);
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
   * 设置文件输入（使用 debugger CDP 命令）
   */
  async setFileInput(filePath) {
    this.#checkAlive();
    // 确保 debugger 已附加
    if (!this.wc.debugger.isAttached()) {
      this.wc.debugger.attach('1.3');
    }

    try {
      // 获取文档根节点
      const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });

      // 递归查找 input[type="file"] 节点
      const findFileInput = (node) => {
        if (!node) return null;
        if (node.nodeName === 'INPUT' && node.attributes) {
          const type = node.attributes.find(a => a === 'type');
          const typeVal = node.attributes[node.attributes.indexOf('type') + 1];
          if (typeVal === 'file') return node;
        }
        if (node.children) {
          for (const child of node.children) {
            const found = findFileInput(child);
            if (found) return found;
          }
        }
        return null;
      };

      const fileInputNode = findFileInput(doc.root);
      if (!fileInputNode) return false;

      await this.wc.debugger.sendCommand('DOM.setFileInputFiles', {
        nodeId: fileInputNode.nodeId,
        files: [filePath]
      });
      await sleep(2000);
      return true;
    } catch (e) {
      console.warn('[NativeInteractions] setFileInput failed:', e.message);
      return false;
    }
  }

  /**
   * 安全上传：先尝试直接设置文件输入，失败则通过点击上传按钮 + debugger 注入
   */
  async safeUpload(videoPath, backupLocatorTexts = ['上传视频', '点击上传', '上传', '选择文件']) {
    this.#checkAlive();

    // 策略 A：直接用 debugger 设置 input[type="file"]
    const directResult = await this.setFileInput(videoPath);
    if (directResult) return true;

    // 策略 B：找到上传按钮点击 → 等待文件选择器
    // Electron 没有 filechooser 事件，所以改用 dialog + 注入的方式
    for (const text of backupLocatorTexts) {
      try {
        const box = await this.getElementByText([text]);
        if (box) {
          const cx = box.x + box.width * 0.5;
          const cy = box.y + box.height * 0.5;

          // 先将一个隐藏的文件输入插入到 DOM
          await this.wc.executeJavaScript(`
            (() => {
              if (window.__matrix_upload_input__) return;
              const input = document.createElement('input');
              input.type = 'file';
              input.style.position = 'fixed';
              input.style.left = '-9999px';
              input.style.top = '-9999px';
              input.id = '__matrix_upload_input__';
              document.body.appendChild(input);
              window.__matrix_upload_input__ = input;
            })()
          `);
          await sleep(500);

          // 通过 debugger 设置文件并触发 change
          const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
          const findById = (node, id) => {
            if (!node) return null;
            if (node.attributes) {
              const idIdx = node.attributes.indexOf('id');
              if (idIdx >= 0 && node.attributes[idIdx + 1] === id) return node;
            }
            if (node.children) {
              for (const c of node.children) { const f = findById(c, id); if (f) return f; }
            }
            return null;
          };
          const inputNode = findById(doc.root, '__matrix_upload_input__');
          if (inputNode) {
            await this.wc.debugger.sendCommand('DOM.setFileInputFiles', {
              nodeId: inputNode.nodeId, files: [videoPath]
            });
            await sleep(3000);
            return true;
          }
        }
      } catch (e) { /* 继续尝试下一个 */ }
    }

    throw new Error('上传阻断：找不到上传入口。');
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
}

export { KEY_CODES, sleep };
