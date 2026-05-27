/**
 * @file account-browser-manager.js
 * @description 账号会话内嵌浏览器管理器 (BrowserView + Playwright CDP)
 * 取代原来的外部 Chrome 窗口，将浏览器画面嵌入到软件右侧面板中
 */

import { BrowserView, BrowserWindow } from 'electron';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { app } from 'electron';
// 👇 新增：引入数据库实例获取函数
import { getDB } from './database.js';

chromium.use(StealthPlugin());

// 全局活跃的账号浏览器映射 accountId -> { view, browser, page, mainWindow }
const activeSessions = new Map();

/**
 * 睡眠工具函数
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 👇 新增：直接在主进程中更新数据库的辅助函数
 */
function saveDataToDB(id, data) {
  if (!id || Object.keys(data).length === 0) return;
  try {
    const db = getDB();
    const updates = [];
    const params = {};
    
    // 动态拼接 SQL，只更新抓取到的字段
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
            updates.push(`${key} = @${key}`);
            params[key] = value;
        }
    }
    
    if (updates.length === 0) return;
    
    params.id = id;
    const sql = `UPDATE accounts SET ${updates.join(', ')} WHERE id = @id`;
    
    db.prepare(sql).run(params);
    console.log(`🎉 账号 ID:${id} 数据已静默同步至底层数据库！`);
  } catch (err) {
    console.error(`❌ 保存账号 ${id} 数据失败:`, err.message);
  }
}

/**
 * 启动内嵌账号浏览器
 * @param {string} accountId - 账号唯一标识
 * @param {string} targetUrl - 目标网址
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function launchEmbeddedAccountBrowser(accountId, targetUrl) {
  // 如果已有同账号的会话，先清理
  if (activeSessions.has(accountId)) {
    console.log(`[账号浏览器] 账号 ${accountId} 已有活跃会话，先销毁旧的...`);
    await closeEmbeddedAccountBrowser(accountId);
  }

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) throw new Error("主窗口未找到");
  const mainWindow = windows[0];

  // 1. 创建 BrowserView
  const view = new BrowserView({
    webPreferences: {
      partition: `persist:chrome_data_${accountId}`,
      sandbox: false,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // 2. 挂载到主窗口，扔到屏幕外（保持真实物理尺寸）
  mainWindow.addBrowserView(view);
  view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });

  // 3. 阻止弹窗外逃
  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  // 4. 反指纹 UA
  view.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );

  // 5. 注入唯一身份令牌
  const uniqueId = `account_${accountId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await view.webContents.loadURL('about:blank');
  await view.webContents.executeJavaScript(`window.__ACCOUNT_SESSION_ID__ = '${uniqueId}';`);

  // 6. 导航到目标 URL（BrowserView 原生加载，不依赖 CDP）
  console.log(`[账号浏览器] 正在导航至: ${targetUrl}`);
  await view.webContents.loadURL(targetUrl);

  // 7. 尝试 CDP 连接以获取 Playwright 自动化能力
  const cdpPort = 8315;
  let playwrightPage = null;
  let browser = null;
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    if (res.ok) {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
      // 寻址锁定 Playwright Page
      for (let i = 0; i < 10; i++) {
        const contexts = browser.contexts();
        for (const ctx of contexts) {
          const pages = ctx.pages();
          for (const p of pages) {
            try {
              const id = await p.evaluate(() => window.__ACCOUNT_SESSION_ID__);
              if (id === uniqueId) { playwrightPage = p; break; }
            } catch (e) {}
          }
          if (playwrightPage) break;
        }
        if (playwrightPage) break;
        await sleep(500);
      }
      
      // 🚀 核心注入：拦截网络数据并自动落库
      if (playwrightPage) {
        await playwrightPage.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
        
        let extractedData = {};
        
        playwrightPage.on('response', async (response) => {
          const url = response.url();
          try {
            // [API 拦截] 1. 抓取 B站 基础信息 (UID、昵称、头像)
            if (url.includes('api.bilibili.com/x/web-interface/nav')) {
              const res = await response.json();
              if (res.code === 0 && res.data && res.data.isLogin) {
                extractedData.user_id = res.data.mid.toString();
                extractedData.real_name = res.data.uname;
                extractedData.avatar = res.data.face;
                console.log(`[API雷达] 账号${accountId} 捕获B站身份: ${extractedData.real_name}`);
                saveDataToDB(accountId, extractedData); // 写入数据库
              }
            }
            
            // [API 拦截] 2. 抓取 B站 创作者看板数据 (总粉丝数、总播放量)
            if (url.includes('member.bilibili.com/x/web/index/stat') || url.includes('api.bilibili.com/x/member/web/stat')) {
              const res = await response.json();
              if (res.code === 0 && res.data) {
                // 兼容字段名可能存在的微调
                if (res.data.fan !== undefined) extractedData.followers = res.data.fan;
                if (res.data.click !== undefined) extractedData.total_views = res.data.click;
                console.log(`[API雷达] 账号${accountId} 捕获流量数据 - 粉丝: ${extractedData.followers}, 播放: ${extractedData.total_views}`);
                saveDataToDB(accountId, extractedData); // 写入数据库
              }
            }
          } catch (e) {
            // 忽略由于接口非 JSON 或请求被中断产生的报错
          }
        });
      }
    }
  } catch (e) {
    console.log('[账号浏览器] CDP 连接不可用，以纯 BrowserView 模式运行（不影响浏览）');
  }

  // 11. 注入反指纹脚本
  view.webContents.executeJavaScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete window.navigator.languages;
    window.navigator.languages = ['zh-CN', 'zh'];
  `).catch(() => {});

  // 存储会话
  activeSessions.set(accountId, {
    view,
    browser,
    page: playwrightPage,
    mainWindow,
    accountId
  });

  console.log(`[账号浏览器] 账号 ${accountId} 内嵌浏览器启动成功`);
  return { success: true, page: playwrightPage };
}

/**
 * 将浏览器画面吸附到主窗口的指定区域
 * @param {string} accountId 
 * @param {{x: number, y: number, width: number, height: number}} bounds - 目标区域坐标
 */
export function attachAccountBrowser(accountId, bounds) {
  const session = activeSessions.get(accountId);
  if (!session) {
    console.warn(`[账号浏览器] 账号 ${accountId} 没有活跃会话，无法吸附`);
    return;
  }

  try {
    session.mainWindow.setTopBrowserView(session.view);
  } catch (e) { /* 忽略 */ }
  session.view.setBounds(bounds);
  console.log(`[账号浏览器] 已将账号 ${accountId} 吸附到主窗口:`, bounds);
}

/**
 * 将浏览器画面从台面上隐藏（扔回屏幕外，不销毁）
 * @param {string} accountId 
 */
export function detachAccountBrowser(accountId) {
  const session = activeSessions.get(accountId);
  if (!session) return;

  session.view.setBounds({ x: -10000, y: -10000, width: 1280, height: 800 });
  console.log(`[账号浏览器] 账号 ${accountId} 已隐藏到后台`);
}

/**
 * 关闭并销毁内嵌浏览器
 * @param {string} accountId 
 */
export async function closeEmbeddedAccountBrowser(accountId) {
  const session = activeSessions.get(accountId);
  if (!session) return;

  try {
    // 先从主窗口移除 BrowserView
    if (session.mainWindow && session.view) {
      try { session.mainWindow.removeBrowserView(session.view); } catch (e) { /* 忽略 */ }
    }
    // 断开 Playwright 连接
    if (session.browser) {
      await session.browser.disconnect().catch(() => {});
    }
    // 关闭 webContents
    if (session.view) {
      try { session.view.webContents.close(); } catch (e) { /* 忽略 */ }
    }
  } catch (e) {
    console.error('[账号浏览器] 关闭会话时出错:', e.message);
  }

  activeSessions.delete(accountId);
  console.log(`[账号浏览器] 账号 ${accountId} 会话已完全销毁`);
}

/**
 * 获取当前活跃的会话信息
 */
export function getActiveSessions() {
  const sessions = [];
  for (const [id, session] of activeSessions) {
    sessions.push({ accountId: id });
  }
  return sessions;
}