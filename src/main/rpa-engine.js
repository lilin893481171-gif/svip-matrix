/**
 * @file rpa-engine.js
 * @author Matrix Enterprise CTO (幽灵船坞 100% 内嵌接管版)
 * @version 200.0 (底层重构：BrowserView 隐形渲染 + Playwright CDP 直连)
 */

import { app, BrowserWindow, BrowserView, ipcMain } from 'electron';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import path from 'path';

// 👇 新增这一行，把刚才写的视觉 Agent 导进来
import { VisionAgent } from './vision-agent.js';

chromium.use(stealth());

// ==========================================
// 1. 核心配置与全局变量
// ==========================================
const CONFIG = {
  CONCURRENCY_LIMIT: 1,
  USER_DATA_DIR: path.join(app.getPath('userData'), 'playwright_profiles')
};

const getUrl = (b64) => Buffer.from(b64, 'base64').toString('utf-8');

export const PLATFORM_URLS = {
  '抖音': getUrl('aHR0cHM6Ly9jcmVhdG9yLmRvdXlpbi5jb20vY3JlYXRvci1taWNyby9ob21l'),
  '快手': getUrl('aHR0cHM6Ly9jcC5rdWFpc2hvdS5jb20vcHJvZmlsZQ=='),
  '微信视频号': getUrl('aHR0cHM6Ly9jaGFubmVscy53ZWl4aW4ucXEuY29tL3BsYXRmb3Jt'),
  'B站': getUrl('aHR0cHM6Ly9tZW1iZXIuYmlsaWJpbGkuY29tL3BsYXRmb3JtL3VwbG9hZC92aWRlby9mcmFtZQ=='),
  '小红书': getUrl('aHR0cHM6Ly9jcmVhdG9yLnhpYW9ob25nc2h1LmNvbS9uZXcvaG9tZQ=='),
  '百家号': getUrl('aHR0cHM6Ly9iYWlqaWFoYW8uYmFpZHUuY29tL2J1aWxkZXIvcmMvaG9tZQ==')
};

export const PLATFORM_HOME_URLS = { ...PLATFORM_URLS };

export let currentBrowserController = null;

// ==========================================
// 2. 基础工具组件
// ==========================================
const broadcastProgress = (taskId, historyId, videoId, status, details = {}) => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0 && windows[0].webContents && !windows[0].webContents.isDestroyed()) {
    windows[0].webContents.send('task-progress-update', {
      taskId, historyId, videoId, status, timestamp: Date.now(), ...details
    });
  }
};

const sleep = (ms, page = null) => {
  const jitter = ms * 0.1; 
  const finalMs = ms + (Math.random() * jitter * 2 - jitter);
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, finalMs)),
    ...(page ? [new Promise((_, reject) => page.on('close', () => reject(new Error('浏览器强制中断'))))] : [])
  ]);
};

// ==========================================
// 3. 终极仿生学引擎
// ==========================================
class PageInteractions {
  constructor(page) { this.page = page; }

  #generateBezierPath(startX, startY, endX, endY, steps = 20) {
    const path = [];
    const controlX = startX + (endX - startX) * (0.3 + Math.random() * 0.4) + (Math.random() > 0.5 ? 50 : -50);
    const controlY = startY + (endY - startY) * (0.3 + Math.random() * 0.4) + (Math.random() > 0.5 ? 50 : -50);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX);
      const y = Math.round(Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY);
      path.push({ x, y });
    }
    return path;
  }

  async randomWander() {
    const startX = 200 + Math.random() * 500;
    const startY = 200 + Math.random() * 300;
    const endX = startX + (Math.random() > 0.5 ? 100 : -100);
    const endY = startY + (Math.random() > 0.5 ? 50 : -50);
    const path = this.#generateBezierPath(startX, startY, endX, endY, 10);
    for (let p of path) { await this.page.mouse.move(p.x, p.y); await sleep(10); }
  }

  async ghostMove(locator) {
    try {
      await locator.first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.first().waitFor({ state: 'visible', timeout: 5000 });
      const box = await locator.first().boundingBox();
      if (!box) return;
      const targetX = box.x + box.width * (0.2 + Math.random() * 0.6);
      const targetY = box.y + box.height * (0.2 + Math.random() * 0.6);
      const currentMouse = { x: targetX + (Math.random() > 0.5 ? 200 : -200), y: targetY + (Math.random() > 0.5 ? 150 : -150) };
      await this.page.mouse.move(currentMouse.x, currentMouse.y);
      await sleep(50 + Math.random() * 100);
      const path = this.#generateBezierPath(currentMouse.x, currentMouse.y, targetX, targetY, 15);
      for (let p of path) { await this.page.mouse.move(p.x, p.y); await sleep(3 + Math.random() * 5); }
      await sleep(150 + Math.random() * 200);
    } catch (e) {}
  }
    // 💥 为视觉 Agent 专属打造的：基于绝对物理坐标的仿生点击
  async humanClickAtCoordinates(targetX, targetY) {
    // 1. 获取当前鼠标的随机起始位置
    const currentMouse = { 
      x: targetX + (Math.random() > 0.5 ? 200 : -200), 
      y: targetY + (Math.random() > 0.5 ? 150 : -150) 
    };
    
    // 2. 生成丝滑的贝塞尔曲线轨迹
    const path = this.#generateBezierPath(currentMouse.x, currentMouse.y, targetX, targetY, 15);
    
    // 3. 模拟真人滑动
    for (let p of path) { 
        await this.page.mouse.move(p.x, p.y); 
        await sleep(3 + Math.random() * 5); 
    }
    
    await sleep(150 + Math.random() * 200);
    
    // 4. 重重地按下去
    await this.page.mouse.click(targetX, targetY, { delay: 60 + Math.random() * 50 });
    
    // 5. 点完后鼠标自然地滑开（防止挡住某些悬浮菜单）
    await this.page.mouse.move(targetX + 100, targetY + 50, { steps: 5 });
    }

  async humanClick(locator, timeout = 8000) {
    await this.ghostMove(locator);
    const box = await locator.first().boundingBox().catch(() => null);
    try {
      if (box) {
        await locator.first().click({ delay: 60 + Math.random() * 50, force: true, timeout });
      } else {
        await locator.first().click({ delay: 50 + Math.random() * 80, timeout });
      }
    } catch (e) {
      throw new Error(`点击阻断：找不到目标元素。请接管查看网页状态！`);
    }
    await this.page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 300, { steps: 5 });
    await sleep(500 + Math.random() * 500);
  }

  async humanType(locator, text) {
    if (!text) return;
    await this.ghostMove(locator);
    await locator.first().click({ force: true });
    await sleep(200);
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await sleep(300);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (Math.random() < 0.03 && /[a-zA-Z0-9]/.test(char)) {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        await this.page.keyboard.type(wrongChar, { delay: 50 + Math.random() * 50 });
        await sleep(200 + Math.random() * 150);
        await this.page.keyboard.press('Backspace'); 
        await sleep(150 + Math.random() * 100);
      }
      await this.page.keyboard.type(char, { delay: 60 + Math.random() * 90 });
      if (Math.random() < 0.05) await sleep(300 + Math.random() * 400); 
    }
    await sleep(400);
  }

  async flexibleClick(textArray, timeout = 2500) {
    const regex = new RegExp(textArray.join('|'));
    const locator = this.page.getByText(regex).first();
    try {
      if (await locator.isVisible({ timeout })) {
        await this.humanClick(locator);
        return true;
      }
    } catch (e) {} 
    return false;
  }

  async safeUpload(videoPath, backupLocatorTexts) {
    try {
      const fileInput = this.page.locator('input[type="file"][accept*="video"], input[type="file"]').first();
      await fileInput.setInputFiles(videoPath, { timeout: 3000 });
      await sleep(2000);
      return true;
    } catch (e) {
      try {
        const regex = new RegExp(backupLocatorTexts.join('|'));
        const btn = this.page.getByText(regex).first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        const [fc] = await Promise.all([
          this.page.waitForEvent('filechooser', { timeout: 12000 }),
          this.humanClick(btn)
        ]);
        await fc.setFiles(videoPath);
        await sleep(3000);
        return true;
      } catch (err) {
        throw new Error('上传阻断：找不到上传入口。');
      }
    }
  }

  async gentleCloseOverlays() {
    await this.flexibleClick(['我知道了', '关闭', '跳过', '下次再说'], 1500);
  }
}

// ==========================================
// 💥 4. 全新核心：幽灵船坞引擎 (BrowserView + CDP)
// ==========================================
class BrowserController {
  constructor(accountId) {
    this.accountId = accountId;
    this.view = null;
    this.browser = null;
    this.playwrightPage = null;
    this.mainWindow = null;
  }

  async launch() {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) throw new Error("主窗口未找到");
    this.mainWindow = windows[0];

    // 1. 创建原生的 BrowserView 隐藏视图
    this.view = new BrowserView({
      webPreferences: {
        partition: `persist:chrome_data_${this.accountId}`,
        sandbox: false,
        contextIsolation: false, 
        webSecurity: false 
      }
    });

    // 🚨 核心修复：强制挂载并扔到屏幕外！赋予真实物理尺寸，防止截图 0 宽！
    this.mainWindow.addBrowserView(this.view);
    this.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });

    // 阻止弹窗外逃，强制在船坞内加载
    this.view.webContents.setWindowOpenHandler(({ url }) => {
      this.view.webContents.loadURL(url);
      return { action: 'deny' };
    });

    // 防风控 UA
    this.view.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

    // 2. 注入唯一身份令牌
    const uniqueId = `rpa_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    await this.view.webContents.loadURL('about:blank');
    await this.view.webContents.executeJavaScript(`window.__RPA_ID__ = '${uniqueId}';`);

    // 3. Playwright 连接 CDP
    const cdpPort = 8315; 
    let isReady = false;
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) isReady = true;
    } catch (e) {
      throw new Error("🚨 核心架构升级要求：未检测到 8315 端口！");
    }

    // 4. Playwright 直连
    this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    
    // 5. 寻址锁定对应的 Playwright Page
    for (let i = 0; i < 20; i++) {
      const pages = this.browser.contexts()[0].pages();
      for (const p of pages) {
        try {
          const id = await p.evaluate(() => window.__RPA_ID__);
          if (id === uniqueId) {
            this.playwrightPage = p;
            break;
          }
        } catch(e) {}
      }
      if (this.playwrightPage) break;
      await sleep(500); 
    }

    if (!this.playwrightPage) {
       throw new Error("内部寻址失败：无法将底层脚本挂载到隐形视图！");
    }
    // 🚨 终极防线：强行把 Playwright 的内部视口撑开，彻底解决 0 width 截图崩溃！
    await this.playwrightPage.setViewportSize({ width: 1280, height: 800 });
    return this.playwrightPage;
  }

  // 💥 触发接管：从深渊拉回到前端的坐标上！
  attachToWindow(bounds) {
    if (this.mainWindow && this.view) {
       try { this.mainWindow.setTopBrowserView(this.view); } catch(e){}
       this.view.setBounds(bounds);
    }
  }

  // 💥 退出接管：不要销毁它，而是重新扔回深渊！保持渲染！
  detachFromWindow() {
    if (this.mainWindow && this.view) {
       // 退回屏幕外，保持 1280x800 的真实宽度，让它继续在后台被视觉特工截图！
       this.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });
    }
  }

  async close() {
    if (this.mainWindow && this.view) {
        try { this.mainWindow.removeBrowserView(this.view); } catch(e){}
    }
    if (this.browser) {
        await this.browser.disconnect().catch(()=>{});
    }
    if (this.view) {
        try { this.view.webContents.close(); } catch(e){}
        this.view = null;
    }
  }
}

// ==========================================
// 5. 六大平台适配器 (1:1 继承原生逻辑)
// ==========================================

// --- 1. 小红书 (混合双擎版) ---
class XiaohongshuAdapter {
  constructor(page, task, interactions) {
    this.page = page; this.task = task; this.i = interactions; this.taskId = task.taskId;
  }
  broadcast(s) { broadcastProgress(this.taskId, this.task.historyId, this.task.videoId, s); }

  async execute() {
    this.broadcast('空降小红书...');
    await this.i.gentleCloseOverlays();

    this.broadcast('强行突破，直达发布台...');
    await this.page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'load', timeout: 30000 }).catch(()=>{});
    await sleep(3000); 

    try {
        const videoTab = this.page.locator('.publish-tab span, .tab-wrap span, div[class*="tab"]').getByText(/视频/).first();
        if (await videoTab.isVisible({timeout: 2000})) {
            await this.i.humanClick(videoTab);
        }
    } catch(e) {}
    await sleep(1500);

    this.broadcast('准备注入媒体文件...');
    
// =========================================================
    // 💥 混合双擎作战区：DOM 优先，视觉兜底！
    // =========================================================
    let uploadSuccess = false;
    try {
      // 1. 先用传统的 DOM 注入和点击尝试
      await this.i.safeUpload(this.task.videoPath, ['点击上传', '拖拽', '拖拽视频', '上传文件']);
      uploadSuccess = true;
    } catch (e) {
      this.broadcast('⚠️ DOM 节点失效！启动 VLM 视觉大模型接管...');
      
      // 2. 召唤视觉特工！
      const visionAgent = new VisionAgent(this.page, this.i);
      
      // 🚨 核心修复：必须在模型点击【之前】就挂载好文件框监听器，防止事件丢失！
      const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
      
      // 告诉大模型去找上传按钮
      const visionRes = await visionAgent.executeIntent("寻找并点击画面中央的‘上传视频’或‘点击上传’的虚线框区域");
      
      if (visionRes) {
         this.broadcast('⏳ 模型点击完毕，等待浏览器弹出文件框...');
         const fc = await fileChooserPromise;
         
         if (fc) {
             await fc.setFiles(this.task.videoPath);
             await sleep(3000);
             uploadSuccess = true;
             this.broadcast('🎯 视觉接管成功！视频已塞入容器...');
         } else {
             // 没弹出文件框，说明模型点错了（比如遇到了登录页）
             throw new Error("模型进行了点击，但未触发上传框。可能遭遇风控或未登录！");
         }
      }
    }

    if (!uploadSuccess) {
      throw new Error("视觉入口破拆失败，请点击【内嵌接管】手工处理！");
    }
    // =========================================================

    this.broadcast('等待小红书解析...');
    const titleInput = this.page.locator('div.publish-page-content-base input, input[placeholder*="标题"], input.title-input').first();
    
    try {
        await titleInput.waitFor({ state: 'visible', timeout: 45000 });
    } catch(e) {
        throw new Error("等待标题输入框超时。可能遇到滑块验证码或页面异动，请手工接管！");
    }
    
    await this.i.humanType(titleInput, this.task.title);
    const desc = this.page.locator('div.editor-content > div > div, .ql-editor, [contenteditable="true"]').first();
    await this.i.humanType(desc, this.task.desc || '');
    
    if (this.task.tags) {
      await this.i.humanClick(desc);
      await this.page.keyboard.press('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.page.keyboard.type(`#${tag}`, { delay: 90 });
        await sleep(1500);
        const capsule = this.page.locator(`div.is-selected > span.name, text="${tag}", .tag-item`).first();
        if (await capsule.isVisible({timeout: 1500})) {
            await this.i.humanClick(capsule);
        } else {
            await this.page.keyboard.press('Enter');
        }
        await sleep(500);
      }
    }

    if (this.task.coverPath) {
      try {
        if (await this.i.flexibleClick(['修改封面', '设置封面'])) {
          await sleep(1000);
          await this.i.humanClick(this.page.locator('div.upload-btn, text=上传封面').first());
          await this.page.locator('input[type="file"]').first().setInputFiles(this.task.coverPath).catch(()=>{});
          await sleep(2500);
          await this.i.flexibleClick(['确定', '完成', '确认']);
        }
      } catch (e) {}
    }

    if (this.task.poi) {
      try {
        if (await this.i.flexibleClick(['添加地点', '添加位置'])) {
          await sleep(1000);
          await this.i.humanType(this.page.locator('input[placeholder*="地点"], input[placeholder*="位置"]').first(), this.task.poi);
          await sleep(2000);
          await this.i.humanClick(this.page.locator('.poi-suggest li, .dropdown-item, .poi-item').first());
        }
      } catch (e) {}
    }

    if (this.task.isOriginal) {
      try {
        if (await this.i.flexibleClick(['声明原创'])) {
           await sleep(1000);
           await this.i.flexibleClick(['确定', '确认', '知道了']);
        }
      } catch (e) {}
    }

    if (this.task.dryRun) { this.broadcast('🛑 演习完成'); return; }
    
    this.broadcast('执行最终发布...');
    await this.i.humanClick(this.page.locator('button.bg-red span, button.bg-red:has-text("发布"), button:has-text("发布")').last());
    await sleep(8000);
  }
}

// --- 2. 快手 ---
class KuaishouAdapter {
  constructor(page, task, interactions) {
    this.page = page; this.task = task; this.i = interactions; this.taskId = task.taskId;
  }
  broadcast(s) { broadcastProgress(this.taskId, this.task.historyId, this.task.videoId, s); }

  async execute() {
    this.broadcast('空降快手...');
    await this.i.gentleCloseOverlays();
    await this.i.humanClick(this.page.locator('div.publish-button span').first());
    await sleep(1000);
    await this.i.humanClick(this.page.locator('div.publish-button__menu > div:nth-of-type(1)').first());

    await this.i.safeUpload(this.task.videoPath, ['上传视频']);

    this.broadcast('探测新手引导...');
    for(let i=0; i<5; i++) {
        const guideBtn = this.page.locator('[id^="react-joyride-step-"] button, text=下一步, text=立刻体验').first();
        if (await guideBtn.isVisible({timeout: 2000})) {
            await this.i.humanClick(guideBtn);
            await sleep(500);
        } else { break; }
    }

    const desc = this.page.locator('#work-description-edit').first();
    await desc.waitFor({ state: 'visible', timeout: 45000 });
    
    const fullText = (this.task.title ? `【${this.task.title}】\n` : '') + (this.task.desc || '');
    await this.i.humanType(desc, fullText);

    if (this.task.tags) {
      await this.i.humanClick(desc);
      await this.page.keyboard.press('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.page.keyboard.type(`#${tag}`, { delay: 90 });
        await sleep(1200); 
        await this.page.keyboard.press('Enter');
      }
    }

    if (this.task.coverPath) {
      try {
        await this.i.humanClick(this.page.locator('div._cropper_1i0wh_12 button, text=编辑封面').first());
        await sleep(1000);
        await this.i.flexibleClick(['上传封面', '本地上传']);
        await this.page.locator('input[type="file"]').first().setInputFiles(this.task.coverPath).catch(()=>{});
        await sleep(2500);
        await this.i.flexibleClick(['确认', '确定']);
      } catch (e) {}
    }

    if (this.task.poi || this.task.productLink) {
      try {
         const payload = this.task.poi || this.task.productLink;
         await this.i.humanClick(this.page.locator('#rc_select_5, text=关联').first());
         await sleep(1000);
         await this.page.keyboard.type(payload);
         await sleep(1500);
         await this.page.keyboard.press('Enter');
      } catch(e) {}
    }

    if (this.task.dryRun) { this.broadcast('🛑 演习完成'); return; }
    
    this.broadcast('发布...');
    await this.i.humanClick(this.page.locator('div._button-primary_3a3lq_60 > div, button:has-text("发布")').last());
    await sleep(8000);
  }
}

// --- 3. 百家号 ---
class BaijiahaoAdapter {
  constructor(page, task, interactions) {
    this.page = page; this.task = task; this.i = interactions; this.taskId = task.taskId;
  }
  broadcast(s) { broadcastProgress(this.taskId, this.task.historyId, this.task.videoId, s); }

  async execute() {
    this.broadcast('空降百家号...');
    await this.i.gentleCloseOverlays();
    await this.i.flexibleClick(['发布作品', '发动态']);
    await sleep(1500);
    await this.i.flexibleClick(['我知道了', '关闭']); 

    const videoTab = this.page.locator('div.header-list-content > div:nth-of-type(2), text=上传视频').first();
    if(await videoTab.isVisible({timeout:2000})) await this.i.humanClick(videoTab);

    await this.i.safeUpload(this.task.videoPath, ['点击上传', '上传视频']);

    const editor = this.page.locator('div._872ce91b1b159b92-editorArea, .editorArea').first();
    await editor.waitFor({ state: 'visible', timeout: 45000 });

    const titleInput = this.page.locator('input.ant-input, input[placeholder*="标题"]').first();
    if(await titleInput.isVisible({timeout:1000})) {
        await this.i.humanType(titleInput, this.task.title);
        await this.i.humanType(editor, this.task.desc || '');
    } else {
        const full = (this.task.title ? `【${this.task.title}】\n` : '') + (this.task.desc || '');
        await this.i.humanType(editor, full);
    }

    if (this.task.tags) {
      await this.i.humanClick(editor);
      await this.page.keyboard.press('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.page.keyboard.type(`#${tag}`, { delay: 90 });
        await sleep(1500);
        const cap = this.page.locator(`div._7f4b1b4997b77e51-topicName, text="${tag}"`).first();
        if(await cap.isVisible({timeout:1500})) await this.i.humanClick(cap);
        else await this.page.keyboard.press('Enter');
      }
    }

    if (this.task.coverPath) {
      try {
        await this.i.humanClick(this.page.locator('[data-testid="cover-preview"], text=设置封面').first());
        await sleep(1000);
        await this.i.flexibleClick(['本地上传']);
        await this.page.locator('input[type="file"]').first().setInputFiles(this.task.coverPath).catch(()=>{});
        await sleep(2500);
        await this.i.flexibleClick(['确定', '裁剪确认', '完成']);
      } catch(e) {}
    }

    try {
        await this.i.flexibleClick(['展开更多高级设置', '高级设置']);
        await sleep(500);
        if (this.task.isOriginal) await this.i.flexibleClick(['声明原创', '原创声明']);
        if (this.task.syncToutiao) await this.i.flexibleClick(['同步', '分发']); 
    } catch(e) {}

    if (this.task.dryRun) { this.broadcast('🛑 演习完成'); return; }
    
    await this.i.humanClick(this.page.locator('[data-testid="publish-btn"], text=发布').last());
    await sleep(8000);
  }
}

// --- 4. B站 ---
class BilibiliAdapter {
  constructor(page, task, interactions) {
    this.page = page; this.task = task; this.i = interactions; this.taskId = task.taskId;
  }
  broadcast(s) { broadcastProgress(this.taskId, this.task.historyId, this.task.videoId, s); }

  async execute() {
    this.broadcast('空降B站...');
    await this.i.gentleCloseOverlays();
    await this.i.humanClick(this.page.locator('#nav_upload_btn, text=投稿').first());
    await sleep(1000);
    const videoPost = this.page.locator('aria/ 视频投稿, text=视频投稿').first();
    if(await videoPost.isVisible({timeout: 2000})) await this.i.humanClick(videoPost);

    await this.i.safeUpload(this.task.videoPath, ['点击上传或将视频拖拽到此区域']);
    await this.i.flexibleClick(['知道了', '关闭']); 

    const titleInput = this.page.locator('input[placeholder*="请输入稿件标题"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 45000 });
    
    await this.i.humanType(titleInput, this.task.title);
    await this.i.humanType(this.page.locator('.ql-editor').first(), this.task.desc || '');

    if (this.task.coverPath) {
        try {
            await this.i.flexibleClick(['封面设置']);
            await sleep(500);
            await this.i.flexibleClick(['上传封面']);
            await this.page.locator('input[type="file"][accept*="image"]').first().setInputFiles(this.task.coverPath).catch(()=>{});
            await sleep(2000);
            await this.i.flexibleClick(['完成', '确认']);
        } catch(e) {}
    }

    if (this.task.tags) {
      try {
        const tagInput = this.page.locator('input[placeholder*="按回车键"], .tag-input').first();
        await this.i.humanClick(tagInput);
        for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 8)) {
            await this.i.humanType(tagInput, tag);
            await this.page.keyboard.press('Enter');
            await sleep(500);
        }
      } catch(e) {}
    }

    if (this.task.isOriginal) {
        try {
            await this.i.flexibleClick(['更多设置', '展开更多']);
            await sleep(500);
            await this.i.flexibleClick(['自制', '声明原创']);
        } catch(e) {}
    }

    if (this.task.dryRun) { this.broadcast('🛑 演习完成'); return; }
    
    await this.i.humanClick(this.page.locator('text=立即投稿, button:has-text("发布")').first());
    await sleep(8000);
  }
}

// --- 5. 抖音 ---
class DouyinAdapter {
  constructor(page, task, interactions) {
    this.page = page; this.task = task; this.i = interactions; this.taskId = task.taskId;
  }
  broadcast(s) { broadcastProgress(this.taskId, this.task.historyId, this.task.videoId, s); }

  async execute() {
    if (this.isCancelled) return;
    this.broadcast('空降抖音，开始模拟真人发布...');
    await this.i.gentleCloseOverlays();

    this.broadcast('正在寻找发布入口...');
    const btnClicked = await this.i.flexibleClick(['发布视频', '上传视频', '发图文', '发日常', '发布'], 15000);
    if (!btnClicked) throw new Error("主页找不到发布入口。若卡在验证码，请点击【接管】！");
    await sleep(1500);

    await this.i.safeUpload(this.task.videoPath, ['上传视频', '点击上传']);

    this.broadcast('等待抖音解析...');
    const titleInput = this.page.locator('input[placeholder*="标题"], input.semi-input').first();
    let isReady = false;
    for(let i=0; i<15; i++) {
        if(await titleInput.isVisible({timeout:3000})) { isReady = true; break; }
        await this.i.randomWander();
    }
    if(!isReady) throw new Error("抖音编辑器未加载。请点击接管查看！");

    await this.i.humanType(titleInput, this.task.title);
    const desc = this.page.locator('.content-left-F3wKrk, .zone-container, [contenteditable="true"]').first();
    await this.i.humanType(desc, this.task.desc || '');
    
    if (this.task.tags) {
      await this.i.humanClick(desc); 
      await this.page.keyboard.press('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.page.keyboard.type(`#${tag}`, { delay: 90 });
        await sleep(1200); 
        await this.page.keyboard.press('Space');
        await sleep(500);
      }
    }

    if (this.task.coverPath) {
      try {
        if (await this.i.flexibleClick(['设置封面'])) {
          await sleep(1000);
          await this.i.flexibleClick(['上传封面', '本地上传']);
          await this.page.locator('input[type="file"][accept*="image"]').first().setInputFiles(this.task.coverPath).catch(()=>{});
          await sleep(3000);
          await this.i.flexibleClick(['确定', '完成', '保存']);
        }
      } catch(e) {}
    }

    if (this.task.poi) {
      try {
        if (await this.i.flexibleClick(['添加地点', '位置'])) {
          await this.i.humanType(this.page.locator('input[placeholder*="地点"], .search-input').first(), this.task.poi);
          await sleep(1500);
          await this.i.humanClick(this.page.locator('.suggest-list li, .dropdown-item').first());
        }
      } catch(e) {}
    }

    if (this.task.syncToutiao) await this.i.flexibleClick(['同步至今日头条']);
    if (this.task.isOriginal) await this.i.flexibleClick(['声明原创']);

    if (this.task.dryRun) { this.broadcast('🛑 演习模式完成！'); return; }
    
    this.broadcast('点火发布...');
    await this.i.humanClick(this.page.locator('button:has-text("发布")').last());
    await Promise.race([
      this.page.waitForURL(/creator-micro\/manage/, { timeout: 30000 }),
      this.page.waitForSelector('text="发布成功"', { timeout: 30000 })
    ]).catch(()=>{});
  }
}

// --- 6. 微信视频号 ---
class WechatChannelsAdapter {
  constructor(page, task, interactions) {
    this.page = page; this.task = task; this.i = interactions; this.taskId = task.taskId;
  }
  broadcast(s) { broadcastProgress(this.taskId, this.task.historyId, this.task.videoId, s); }

  async execute() {
    this.broadcast('🚀 空降微信视频号...');
    await this.i.gentleCloseOverlays();
    
    await this.i.humanClick(this.page.locator('text=发表视频, [aria-label="发表视频"], wujie-app >> .post-list-header button, .post-list-header button').first());
    await sleep(1500);
    
    await this.i.safeUpload(this.task.videoPath, ['上传视频', '点击上传']);
    
    const descLocator = this.page.locator('.input-editor, wujie-app >> .input-editor, [contenteditable="true"]').first();
    await descLocator.waitFor({ state: 'visible', timeout: 45000 });

    const titleLocator = this.page.locator('input[placeholder*="标题"], wujie-app >> input[placeholder*="标题"]').first();
    if (await titleLocator.isVisible({ timeout: 2000 })) {
      await this.i.humanType(titleLocator, this.task.title);
      await this.i.humanType(descLocator, this.task.desc || '');
    } else {
      const fullText = (this.task.title ? `【${this.task.title}】\n` : '') + (this.task.desc || '');
      await this.i.humanType(descLocator, fullText);
    }

    if (this.task.tags) {
      await this.i.humanClick(descLocator); 
      await this.page.keyboard.press('End'); 
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 5)) {
        await this.page.keyboard.type(`#${tag}`, { delay: 95 });
        await sleep(1500); 
        await this.page.keyboard.press('Space'); 
        await sleep(500);
      }
    }

    if (this.task.coverPath) {
      try {
        await this.i.humanClick(this.page.locator('.vertical-cover-wrap img, text=更换封面, wujie-app >> text=更换封面').first());
        await sleep(1000);
        await this.i.humanClick(this.page.locator('div.img-wrap > div, text=上传, wujie-app >> text=上传').first());
        await this.page.locator('input[type="file"][accept*="image"]').first().setInputFiles(this.task.coverPath).catch(()=>{});
        await sleep(2500); 
        await this.i.flexibleClick(['确认', '完成']);
      } catch (e) {}
    }

    if (this.task.isOriginal) await this.i.flexibleClick(['声明原创']);

    if (this.task.dryRun) { this.broadcast('🛑 【演习模式】任务圆满结束'); return; }
    
    await this.i.humanClick(this.page.locator('button:has-text("发表"), wujie-app >> button:has-text("发表"), wujie-app >> .main-body-wrap button').last());
    
    await Promise.race([
      this.page.waitForURL(/post-list|success/, { timeout: 35000 }),
      this.page.waitForSelector('text="发表成功", text="作品已提交审核"', { timeout: 35000 })
    ]).catch(()=>{});
  }
}

// ==========================================
// 6. 生命周期执行器 (TaskExecutor)
// ==========================================
class TaskExecutor {
  constructor(task) { 
      this.task = task; 
      this.browserController = new BrowserController(task.accountId);
  }

  async run() {
    const { taskId, historyId, videoId, platform } = this.task;

    let page = null;
    try {
      broadcastProgress(taskId, historyId, videoId, '预热幽灵船坞舱...');
      // 这里的 page 已经是通过底层的 CDP 连接拿到的隐藏在 Electron BrowserView 里的原生对象了！
      page = await this.browserController.launch();

      const targetUrl = PLATFORM_URLS[platform];
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(3000); 

      const interactions = new PageInteractions(page);

      let adapter;
      switch (platform) {
        case '抖音': adapter = new DouyinAdapter(page, this.task, interactions); break;
        case '小红书': adapter = new XiaohongshuAdapter(page, this.task, interactions); break;
        case '微信视频号': adapter = new WechatChannelsAdapter(page, this.task, interactions); break;
        case 'B站': adapter = new BilibiliAdapter(page, this.task, interactions); break;
        case '快手': adapter = new KuaishouAdapter(page, this.task, interactions); break;
        case '百家号': adapter = new BaijiahaoAdapter(page, this.task, interactions); break;
        default: throw new Error('未知的发布平台：' + platform);
      }

      await adapter.execute();
      
      if(this.task.dryRun) {
        broadcastProgress(taskId, historyId, videoId, '演习暂停，请手工接管查看网页...');
        await sleep(600000, page).catch(()=>{}); 
      }
      
      broadcastProgress(taskId, historyId, videoId, '任务圆满成功');
    } catch (error) {
      console.error("\n🔴 [底层报错 - TaskExecutor]:", error, "\n");
      broadcastProgress(taskId, historyId, videoId, '流程受阻: ' + error.message);
      if (page) await sleep(600000, page).catch(()=>{}); // 卡住不杀进程，留出时间让用户接管！
    } finally {
      await this.browserController.close();
    }
  }
}

// ==========================================
// 7. 任务管理器与 IPC (幽灵管控中心)
// ==========================================
class TaskManager {
  constructor() {
    this.queue = [];
    this.running = 0;
    this.cancelled = new Set();
    this.executors = new Map(); // 专门记录运行中的机器对象，方便随时接管！
  }

  addTask(task) {
    this.queue.push(task);
    this.processNext();
  }

  async processNext() {
    if (this.running >= CONFIG.CONCURRENCY_LIMIT || this.queue.length === 0) return;
    const task = this.queue.shift();
    if (this.cancelled.has(task.taskId)) return this.processNext();

    this.running++;
    const executor = new TaskExecutor(task);
    this.executors.set(task.historyId, executor); // 注册正在服役的机器人

    try {
      await executor.run();
    } catch (e) {
      broadcastProgress(task.taskId, task.historyId, task.videoId, '致命崩溃', { error: e.message });
    } finally {
      this.executors.delete(task.historyId);
      this.running--;
      setTimeout(() => this.processNext(), 3000);
    }
  }

  getRunningExecutor(historyId) {
    return this.executors.get(historyId);
  }

  getStats() { return { queued: this.queue.length, running: this.running }; }
  clearQueue() { this.queue = []; }
  cancelTask(taskId) { this.cancelled.add(taskId); return { success: true }; }
}

const taskManager = new TaskManager();

export const registerRPAEngineIPC = () => {
  ipcMain.handle('execute-auto-publish', async (event, taskData) => {
    const taskId = taskData.taskId || `task_${Date.now()}`;
    const task = { ...taskData, taskId };
    taskManager.addTask(task);
    return { success: true, taskId, message: '活体狙击手机甲已入库' };
  });

  ipcMain.handle('get-task-stats', () => taskManager.getStats());
  ipcMain.handle('clear-task-queue', () => { 
    taskManager.clearQueue(); 
    return { success: true }; 
  });
  ipcMain.handle('cancel-task', (event, taskId) => taskManager.cancelTask(taskId));
  
  // 💥 终极神技：前端发来指令，主进程直接把隐形 BrowserView 拉到台面上！
  ipcMain.on('attach-robot-view', (event, { taskId, bounds }) => {
    const executor = taskManager.getRunningExecutor(taskId);
    if (executor && executor.browserController) {
        executor.browserController.attachToWindow(bounds);
        currentBrowserController = executor.browserController; // 记录当前在台面上的机器
    }
  });

  // 💥 退出接管：前端关掉面板，主进程把 BrowserView 扔回后台！
  ipcMain.on('detach-robot-view', (event) => {
    if (currentBrowserController) {
        currentBrowserController.detachFromWindow();
        currentBrowserController = null;
    }
  });
};