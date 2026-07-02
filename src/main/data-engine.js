/**
 * @file data-engine.js
 * @description 全域数据罗盘引擎 (干净、高内聚，完全信任底层会话管理与动态代理)
 */

import { launchSandbox, closeSandbox, importCookieAndInitialize, isSandboxActive } from './browser-manager.js';
import { launchEmbeddedAccountBrowser, detachAccountBrowser, closeEmbeddedAccountBrowser, getActiveSessions as getActiveNativeSessions } from './account-browser-manager.js';
import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { safeDeletePartition, teardownPartition } from './safe-delete.js';
import { getDB } from './database.js';
import * as cheerio from 'cheerio';
import { PLATFORM_PROFILES } from './platform-profiles.js';
import { upsertAccountProfile } from './account-store.js';

// ==========================================================
// 1. 万能数据清洗引擎与解析器
// ==========================================================
const Utils = {
  parseCount(text) {
    if (!text || text === '--' || text === '暂无') return 0;
    const clean = text.replace(/,/g, '').replace(/\s+/g, '');
    const match = clean.match(/([\d.]+)([万wW亿kK]?)/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    if (isNaN(value)) return 0;
    const unit = match[2].toLowerCase();
    if (unit === '万' || unit === 'w') return Math.round(value * 10000);
    if (unit === 'k') return Math.round(value * 1000);
    if (unit === '亿') return Math.round(value * 100000000);
    return Math.round(value);
  },
  extractFollowers(text, platform) {
    if (!text) return 0;
    const cleanText = text.replace(/\s+/g, '');
    // 通用匹配模式
    let m = cleanText.match(/(?:粉丝|粉丝数|总粉丝|关注者)[:：]?([\d,.]+[万wW亿kK]?)/);
    if (m) return this.parseCount(m[1]);
    m = cleanText.match(/([\d,.]+[万wW亿kK]?)(?:粉丝|粉丝数|总粉丝)/);
    if (m) return this.parseCount(m[1]);
    return 0;
  }
};

// ==========================================================
// 2. B站开源情报雷达（抗风控版）
// ==========================================================
class StableBilibiliRadar {
  constructor() {
    this.endpoints = { 'user_space': 'https://space.bilibili.com/{mid}', 'video_list': 'https://space.bilibili.com/{mid}/video' };
    this.requestTimes = [];
    this.maxRequestsPerMinute = 30;
  }
  async acquire() {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
    if (this.requestTimes.length >= this.maxRequestsPerMinute) {
      const oldest = Math.min(...this.requestTimes);
      const waitTime = 60000 - (now - oldest) + 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.requestTimes.push(now);
  }
  async fetchWithTimeout(url, timeout = 10000) {
    await this.acquire();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      });
      clearTimeout(timeoutId);
      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  async getStableAccountData(mid) {
    try {
      const [spaceData, videoData] = await Promise.all([ this.getSpaceData(mid).catch(() => null), this.getVideoData(mid).catch(() => null) ]);
      return this.mergeAndValidate(spaceData, videoData);
    } catch (error) { return null; }
  }
  async getSpaceData(mid) {
    const html = await this.fetchWithTimeout(this.endpoints.user_space.replace('{mid}', mid));
    const $ = cheerio.load(html);
    return {
      realName: this.extractUserName($), followers: this.extractFollowers($),
      totalViews: this.extractTotalViews($), avatar: this.extractAvatar($), confidence: 0.8
    };
  }
  async getVideoData(mid) {
    const html = await this.fetchWithTimeout(this.endpoints.video_list.replace('{mid}', mid));
    const $ = cheerio.load(html);
    const recentVideos = $('.video-item').slice(0, 20);
    let thirtyDayViews = 0;
    recentVideos.each((i, el) => { thirtyDayViews += this.parseCount($(el).find('.view-count').text() || '0'); });
    return { totalViews: thirtyDayViews, videoCount: recentVideos.length, confidence: 0.7 };
  }
  mergeAndValidate(...sources) {
    const validSources = sources.filter(s => s && s.confidence > 0.5);
    if (validSources.length === 0) return { success: false, message: '无法获取有效数据' };
    const weights = validSources.map(s => s.confidence);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const result = {
      realName: validSources[0].realName,
      followers: Math.round(validSources.reduce((sum, s) => sum + (s.followers || 0) * s.confidence, 0) / totalWeight),
      totalViews: Math.round(validSources.reduce((sum, s) => sum + (s.totalViews || 0) * s.confidence, 0) / totalWeight),
      avatar: validSources[0].avatar, confidence: Math.min(1, totalWeight / validSources.length)
    };
    return { success: true, data: result };
  }
  extractUserName($) {
    const selectors = ['.user-name', '.user-info-name', '.nickname', '[class*="user-name"]', '.creator-name', '.author-name', 'h1.name'];
    for (const sel of selectors) { const el = $(sel); if (el.length > 0) { const text = el.first().text().trim(); if (text && text.length > 1 && text.length < 30) return text; } }
    return $('meta[name="author"]').attr('content') || '';
  }
  extractFollowers($) {
    const safeZoneHTML = $('[class*="user-info"], [class*="author-info"], [class*="profile"], [class*="user-card"], aside, header').html() || $('body').html();
    if (!safeZoneHTML) return 0;
    return Utils.extractFollowers(cheerio.load(safeZoneHTML).text(), 'B站');
  }
  extractTotalViews($) {
    const viewSelectors = ['[class*="view-count"]', '[class*="play-count"]', '.total-views', '.video-views'];
    for (const sel of viewSelectors) { const el = $(sel); if (el.length > 0) { const views = Utils.parseCount(el.first().text().trim()); if (views > 0) return views; } }
    let views = 0;
    $('meta').each((i, meta) => {
      const metaContent = $(meta).attr('content') || '';
      if (metaContent.includes('播放') || metaContent.includes('观看')) { const match = metaContent.match(/(\d+)[\s]*播放/); if (match) views = parseInt(match[1]); }
    });
    return views;
  }
}

// ==========================================================
// 💥 3. 主动 API 提权提取 (轻量兜底引擎)
// ==========================================================
async function getProfileViaOpenSourceAPI(page, platform) {
  return await page.evaluate(async (plat) => {
    try {
      if (plat === 'B站') {
        try {
          const navRes = await fetch("https://api.bilibili.com/x/web-interface/nav", { credentials: 'include' }).then(r => r.json());
          if (navRes.code === 0 && navRes.data && navRes.data.isLogin) {
            let followers = 0; let views = 0;
            try {
              const statRes = await fetch("https://member.bilibili.com/x/web/index/stat", { credentials: 'include' }).then(r => r.json());
              if (statRes.code === 0 && statRes.data) { followers = statRes.data.total_fans || 0; views = statRes.data.total_click || 0; }
            } catch(e) {}
            return { userId: navRes.data.mid.toString(), realName: navRes.data.uname, avatar: navRes.data.face, followers: followers, views: views };
          }
        } catch (e) {}
        return null;
      }
      return null;
    } catch (e) { return null; }
  }, platform);
}

// 4. DOM 降级兜底解析引擎
function parseOfflineSnapshot(htmlContent, platform) {
  const $ = cheerio.load(htmlContent);
  $('br, div, p, li, section, span').append(' ');
  const result = { followers: 0, views: 0, realName: '', avatar: '', userId: '' };
  try {
    if (platform === '小红书') {
      const avatarEl = $('.user-info img, .avatar img');
      if (avatarEl.length > 0) result.avatar = avatarEl.first().attr('src');
      const nameEl = $('.user-name, .name, .creator-name');
      if (nameEl.length > 0) result.realName = nameEl.first().text().trim();
    }
    const safeZoneHTML = $('[class*="user-info"], [class*="author-info"], [class*="profile"], [class*="user-card"], aside, header, #app, #root').html() || $('body').html();
    if (safeZoneHTML) {
        const safeText = cheerio.load(safeZoneHTML).text();
        const parsedFollowers = Utils.extractFollowers(safeText, platform);
        if (parsedFollowers > 0) result.followers = parsedFollowers;
    }
    return result;
  } catch (err) { return result; }
}

// ==========================================================
// 🌟 核心防风控：物理隔离平台入口 — 由 platform-profiles.js 提供
// ==========================================================
const PLATFORM_URLS = Object.fromEntries(
  Object.entries(PLATFORM_PROFILES).map(([p, cfg]) => [p, cfg.creatorDashboardUrl])
);

// ==========================================================
// 💥 战役一核心：自动化入网探针 (大道至简版本)
// ==========================================================
export async function autoBindAccount(platform, proxyStr = '') {
  const db = getDB();
  const info = db.prepare(`INSERT INTO accounts (alias, platform, status, proxy) VALUES (?, ?, ?, ?)`).run(`待绑定_${platform}`, platform, '等待扫码', proxyStr);
  const accountId = info.lastInsertRowid;

  let browserSession = null;
  let cEndData = null;
  let bEndData = null;

  try {
    console.log(`[探针系统] 正在为 ${platform} 分配独立会话容器${proxyStr ? ' [使用代理]' : ''}...`);
    browserSession = await launchSandbox(accountId, { headless: false, proxy: proxyStr }); 
    const { page, context } = browserSession;

    // 网络响应拦截：监听标签页 API 请求
    context.on('response', async (response) => {
        if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
            try {
                const url = response.url();

                if (platform === '小红书') {
                    // 1. 采集 B 端数据 (新弹出的网页里产生)
                    if (url.includes('/api/creator/user/info')) {
                        const text = await response.text();
                        const json = JSON.parse(text);
                        if (json?.data) {
                            bEndData = bEndData || {};
                            bEndData.realName = json.data.nickname || '';
                            bEndData.avatar = json.data.image || '';
                            bEndData.userId = json.data.red_id || '';
                            bEndData.followers = json.data.fans || json.data.fans_count || 0;
                            console.log(`[探针系统] 🎯 B端数据采集成功: ID[${bEndData.userId}] 粉丝[${bEndData.followers}]`);
                        }
                    }
                    // 2. 采集 C 端数据 (点击”我”之后产生)
                    else if (url.includes('/api/sns/web/v1/user/selfinfo')) {
                        const text = await response.text();
                        const json = JSON.parse(text);
                        if (json?.data?.basic_info) {
                            cEndData = cEndData || {};
                            const basic = json.data.basic_info;
                            cEndData.realName = basic.nickname || '';
                            cEndData.avatar = basic.images || basic.imageb || '';
                            cEndData.userId = basic.red_id || '';

                            if (json.data.interactions && Array.isArray(json.data.interactions)) {
                                const fansObj = json.data.interactions.find(item => item.type === 'fans');
                                if (fansObj) cEndData.followers = parseInt(fansObj.count) || 0;
                                const likesObj = json.data.interactions.find(item => item.type === 'interaction');
                                if (likesObj) cEndData.views = parseInt(likesObj.count) || 0;
                            }
                            console.log(`[探针系统] 🎯 C端数据采集成功: ID[${cEndData.userId}] 粉丝[${cEndData.followers}]`);
                        }
                    }
                }
            } catch(e) {}
        }
    });

    const targetUrl = PLATFORM_URLS[platform] || 'https://www.baidu.com';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log(`[探针系统] ${platform} 登录页已就绪，等待用户扫码...`);
    
    let isLogged = false;
    for (let i = 0; i < 60; i++) { 
        await page.waitForTimeout(3000);
        try {
            const isLoginPage = await page.evaluate(() => {
                const text = document.body.innerText || '';
                const url = location.href;
                if (url.includes('www.xiaohongshu.com') || url.includes('creator.xiaohongshu.com')) {
                    return url.includes('/login') || text.includes('扫码登录') || document.querySelector('.login-box, .login-container') !== null;
                }
                if (url.includes('passport') || url.includes('login') || url.includes('signin')) return true;
                if (text.includes('扫码登录') || text.includes('密码登录') || text.includes('未登录')) return true;
                return false;
            });
            
            if (!isLoginPage) {
                console.log(`[探针系统] ✅ 检测到扫码成功！进入数据采集阶段...`);
                isLogged = true;
                break;
            }
        } catch (e) { continue; }
    }

    if (!isLogged) {
        await closeSandbox(accountId);
        db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
        return { success: false, message: '扫码超时，已取消绑定。' };
    }

    // 🌟🌟🌟 小红书极简 4 步走操作法（按你说的办，像人一样点击）
    if (platform === '小红书') {
        try {
            console.log(`[操作1/4] 直接点击“我”进入主页...`);
            // 用纯文本定位左侧边栏的“我”，直接点击
            await page.getByText('我', { exact: true }).first().click();
            await page.waitForTimeout(4000); // 拿走C端发布数据和个人信息

            console.log(`[操作2/4] 像个人一样去悬停“创作中心”...`);
            // 用纯文本定位右上角的“创作中心”，直接悬停
            await page.getByText('创作中心', { exact: true }).first().hover();
            await page.waitForTimeout(1500); // 弹出小卡片

            console.log(`[操作3/4] 弹出小卡片，直接点击“创作服务”，等待浏览器新建网页...`);
            // 监听新页面的同时，点击创作服务
            const [newPage] = await Promise.all([
                context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
                page.getByText('创作服务', { exact: true }).first().click()
            ]);

            console.log(`[操作4/4] 检查新网页是否出现...`);
            if (newPage) {
                console.log(`[探针系统] ✅ 发现新网页！正在等待 B 端数据生成...`);
                await newPage.waitForLoadState('domcontentloaded');
                await newPage.waitForTimeout(5000); // 让B端数据比对入库
            } else {
                console.log(`⚠️ 浏览器未弹出新网页，降级使用已有数据。`);
            }

        } catch(e) {
            console.log(`⚠️ 操作中断，页面可能加载过慢: ${e.message}`);
        }
    } else {
        await page.waitForTimeout(4000); 
    }

    // 数据入库与比对阶段
    let extractionSuccess = false;
    let fallbackData = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        let apiData = await getProfileViaOpenSourceAPI(page, platform) || {};
        const pageHtml = await page.content();
        const domData = parseOfflineSnapshot(pageHtml, platform);

        // B端数据比对入库：如果 C 端数据采集失败或不一致，强制使用 B 端
        let targetData = cEndData || {};
        
        if (bEndData && Object.keys(bEndData).length > 0) {
            if (targetData.userId !== bEndData.userId || targetData.followers !== bEndData.followers) {
                console.log(`[探针系统] 🔄 B端数据与C端不一致，直接拿走B端数据入库！`);
                targetData = { ...targetData, ...bEndData };
            }
        }

        const finalData = {
          realName: targetData.realName || apiData.realName || domData.realName,
          avatar: targetData.avatar || apiData.avatar || domData.avatar,
          userId: targetData.userId || apiData.userId || domData.userId,
          followers: targetData.followers || apiData.followers || domData.followers || 0,
          views: targetData.views || apiData.views || domData.views || 0 
        };

        if (finalData.followers > 0) fallbackData = finalData;

        if (finalData.realName || finalData.userId) {
            console.log(`[探针系统] 🎯 精准执行完毕！最终入库数据：${finalData.realName} (粉丝: ${finalData.followers})`);

            upsertAccountProfile(accountId, {
              real_name: finalData.realName,
              avatar: finalData.avatar,
              user_id: finalData.userId,
              followers: finalData.followers,
              total_views: finalData.views,
            }, { setStatus: true, fixAlias: true });

            extractionSuccess = true;
            break;
        } else {
            await page.waitForTimeout(2000);
        }
    }

    if (!extractionSuccess) {
        const fallbackName = `${platform}账号_${Math.floor(Math.random() * 10000)}`;
        db.prepare(`UPDATE accounts SET alias = ?, real_name = ?, followers = ?, total_views = ?, status = ? WHERE id = ?`)
          .run(fallbackName, fallbackName, fallbackData?.followers || 0, fallbackData?.views || 0, '在线', accountId);
    }

    // 🌟 彻底拔管：直接关闭整个浏览器！
    console.log(`[探针系统] 🛑 数据采集完毕，关闭整个浏览器以释放资源...`);
    await closeSandbox(accountId);

    return { success: true, message: '账号入网登记成功！' };

  } catch (error) {
    if (browserSession) await closeSandbox(accountId);
    try { db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId); } catch(e){}
    return { success: false, message: '入网登记被中断。' };
  }
}

// ==========================================================
// 3. 大盘单号数据采集器
// ==========================================================
async function runSingleSync(accountId, platform) {
  let browserSession = null;
  try {
    const db = getDB();
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);

    if (platform === 'B站' && acc.user_id) {
      const bilibiliRadar = new StableBilibiliRadar();
      const radarData = await bilibiliRadar.getStableAccountData(acc.user_id);
      if (radarData && radarData.success) {
        upsertAccountProfile(accountId, {
          real_name: radarData.data.realName,
          avatar: radarData.data.avatar,
          followers: radarData.data.followers,
          total_views: radarData.data.totalViews,
        }, { setStatus: true });
        return { success: true };
      }
    }

    browserSession = await launchSandbox(accountId, { headless: true, proxy: acc.proxy });
    const { page } = browserSession;

    const targetUrl = PLATFORM_URLS[platform] || acc.custom_url || 'https://www.baidu.com';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const pageHtml = await page.content();
    const domData = parseOfflineSnapshot(pageHtml, platform);

    db.prepare('UPDATE accounts SET followers = ?, total_views = ?, status = ? WHERE id = ?')
      .run(domData.followers || acc.followers, domData.views || acc.total_views, '在线', accountId);

    await closeSandbox(accountId);
    return { success: true };
  } catch (error) {
    if (browserSession) await closeSandbox(accountId);
    try { getDB().prepare('UPDATE accounts SET status = ? WHERE id = ?').run('异常/未登录', accountId); } catch(e){}
    return { success: false, message: error.message };
  }
}

// ==========================================================
// 会话状态巡检：原生主页重定向探测
// ==========================================================
export async function checkAccountStatus(accountId, platform) {
    // 原生 BrowserView 会话存活 = 在线
    if (isSandboxActive(accountId)) {
        return { success: true, status: '在线' };
    }
    const nativeSessions = getActiveNativeSessions();
    if (nativeSessions.some(s => String(s.accountId) === String(accountId))) {
        return { success: true, status: '在线' };
    }

    // 无活跃会话 → 信任 DB 中最后一次记录的状态，不再启动 Playwright 巡检
    const db = getDB();
    const acc = db.prepare('SELECT status FROM accounts WHERE id = ?').get(accountId);
    const dbStatus = acc?.status || '离线';
    console.log(`[巡检] 账号 #${accountId} 无活跃会话，信任 DB 状态: ${dbStatus}`);
    return { success: true, status: dbStatus };
}

// ==========================================================
// 4. 全局 IPC 总线注册
// ==========================================================

let isIpcRegistered = false;

export function registerDataEngineIPC() {
  if (isIpcRegistered) return;
  isIpcRegistered = true;
  
  try { getDB().prepare("ALTER TABLE accounts ADD COLUMN proxy TEXT").run(); } catch(e){}

  ipcMain.removeHandler('open-account-session');
  ipcMain.handle('open-account-session', async (event, { platform, accountId, customUrl }) => {
      try {
          const db = getDB();
          const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);

          // 多标签共存：不再关闭其他会话容器，只 detach（移到屏幕外）
          for (const session of getActiveNativeSessions()) {
            if (session.accountId !== String(accountId)) {
              detachAccountBrowser(session.accountId);
            }
          }

          let targetUrl = PLATFORM_URLS[platform] || 'https://www.baidu.com';
          if (platform === '小红书') {
              targetUrl = 'https://creator.xiaohongshu.com/new/home';
          }
          if (customUrl) targetUrl = customUrl;

          const result = await launchEmbeddedAccountBrowser(accountId, {
            headless: false,
            proxy: acc?.proxy,
            platform,
            targetUrl
          });

          return { success: true };
      } catch (error) {
          return { success: false, message: error.message };
      }
  });

  // 关闭原生账户浏览器
  ipcMain.removeHandler('close-account-session');
  ipcMain.handle('close-account-session', async (event, { accountId }) => {
    try {
      detachAccountBrowser(accountId);
      await closeEmbeddedAccountBrowser(accountId);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 清除账户会话数据（清空 Cookie/缓存分区）
  ipcMain.removeHandler('clear-account-session-data');
  ipcMain.handle('clear-account-session-data', async (_event, { accountId }) => {
    try {
      const partitionName = `chrome_data_${accountId}`;
      const partitionDir = path.join(app.getPath('userData'), 'Partitions', partitionName);
      await teardownPartition(partitionDir, partitionName);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.removeHandler('import-account-cookie');
  ipcMain.handle('import-account-cookie', async (event, payload) => {
      const { platform, cookieStr, proxyStr } = payload;
      const db = getDB();
      const info = db.prepare(`INSERT INTO accounts (alias, platform, status, proxy) VALUES (?, ?, ?, ?)`).run(`导入_${platform}`, platform, '初始化中...', proxyStr || '');
      const accountId = info.lastInsertRowid;

      try {
          await importCookieAndInitialize(accountId, cookieStr, platform, { proxy: proxyStr });
          await runSingleSync(accountId, platform);
          return { success: true, message: 'Cookie 导入并初始化成功！' };
      } catch (error) {
          db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
          return { success: false, message: error.message };
      }
  });
  
  ipcMain.removeHandler('auto-bind-account');
  ipcMain.handle('auto-bind-account', async (event, payload) => {
      let platform = '', proxyStr = '';
      if (typeof payload === 'string') {
          platform = payload;
      } else {
          platform = payload.platform;
          proxyStr = payload.proxyStr || '';
      }
      try {
          return await autoBindAccount(platform, proxyStr);
      } catch (err) {
          return { success: false, message: err.message };
      }
  });

  ipcMain.removeHandler('get-account-list');
  ipcMain.handle('get-account-list', async () => { 
      try {
          const db = getDB();
          const data = db.prepare('SELECT * FROM accounts ORDER BY id DESC').all();
          return { success: true, data }; 
      } catch (error) { return { success: false, data: [] }; }
  });

  ipcMain.removeHandler('check-account-status');
  ipcMain.handle('check-account-status', async (event, { accountId, platform }) => {
      return await checkAccountStatus(accountId, platform);
  });

  ipcMain.removeHandler('get-dashboard-stats');
  ipcMain.handle('get-dashboard-stats', async () => {
    try {
      const db = getDB();
      const stats = db.prepare(`SELECT SUM(IFNULL(followers, 0)) as total_followers, SUM(IFNULL(total_views, 0)) as total_views FROM accounts`).get();
      const platformStats = db.prepare(`SELECT platform, COUNT(*) as count, SUM(IFNULL(followers, 0)) as platform_followers, SUM(IFNULL(total_views, 0)) as platform_views FROM accounts GROUP BY platform`).all();
      return {
        success: true,
        data: {
          totalViews: stats.total_views || 0,
          totalFollowers: stats.total_followers || 0,
          platforms: platformStats.map(p => ({ name: p.platform, count: p.count, followers: p.platform_followers }))
        }
      };
    } catch (error) { return { success: false, message: error.message }; }
  });

  ipcMain.removeHandler('get-global-stats');
  ipcMain.handle('get-global-stats', async () => {
    try {
      const db = getDB();
      const stats = db.prepare(`SELECT SUM(IFNULL(followers, 0)) as total_followers, SUM(IFNULL(total_views, 0)) as total_views FROM accounts`).get();
      const platformStats = db.prepare(`SELECT platform, COUNT(*) as count, SUM(IFNULL(followers, 0)) as platform_followers, SUM(IFNULL(total_views, 0)) as platform_views FROM accounts GROUP BY platform`).all();
      return {
        totalPlays: (stats.total_views || 0).toLocaleString() + ' W', 
        totalFans: (stats.total_followers || 0).toLocaleString(), 
        interactions: '0 W', 
        revenue: '¥0',
        trends: { plays: '+0%', fans: '+0%', interactions: '+0%', revenue: '+0%' },
        platformBreakdown: platformStats.map(p => ({ name: p.platform, count: p.count, followers: p.platform_followers, views: p.platform_views }))
      };
    } catch (error) { return { success: false, message: error.message }; }
  });
  
  ipcMain.removeHandler('get-risk-stats');
  ipcMain.handle('get-risk-stats', async () => {
    try {
      const db = getDB();
      const accounts = db.prepare('SELECT id, alias, platform, status FROM accounts').all();
      let warningCount = 0;
      const mappedAccounts = accounts.map(acc => {
        const isAbnormal = (acc.status === '异常' || acc.status === '封禁' || acc.status === '离线' || (acc.status && acc.status.includes('异常')));
        if (isAbnormal) warningCount++;
        return {
          id: acc.id, alias: acc.alias, platform: acc.platform, level: isAbnormal ? 'high' : 'low',
          reason: isAbnormal ? '未登录或平台拦截' : '环境指纹稳定', lastAction: '实时监控中', status: isAbnormal ? '已熔断' : '正常运行'
        };
      });
      return { success: true, data: { systemStatus: warningCount === 0 ? 'safe' : 'warning', warningCount: warningCount, activeNodes: accounts.length, globalVelocity: 12.5, accounts: mappedAccounts } };
    } catch (error) { return { success: false, message: error.message }; }
  }); 

  ipcMain.removeHandler('sync-account-stats');
  ipcMain.handle('sync-account-stats', async (event, { accountId, platform }) => { 
      return await runSingleSync(accountId, platform); 
  });
  
  ipcMain.removeHandler('sync-account-stats-all');
  ipcMain.handle('sync-account-stats-all', async () => {
    try {
      const db = getDB();
      const accounts = db.prepare('SELECT id, alias, platform FROM accounts').all();
      let results = [];
      for (const acc of accounts) {
        const res = await runSingleSync(acc.id, acc.platform);
        results.push({ alias: acc.alias, ...res });
      }
      return { success: true, results };
    } catch (error) { return { success: false, message: error.message }; }
  });
}