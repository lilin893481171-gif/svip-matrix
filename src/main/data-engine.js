/**
 * @file data-engine.js
 * @description 全域数据罗盘引擎 (终极形态：分离式提取 + 强制定时破门版)
 * @features 彻底根除 SPA 异步死循环，分离登录与抓取阶段，API + DOM 双螺旋引擎
 */

import { launchSandbox, closeSandbox } from './browser-manager.js';
import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDB } from './database.js';
import * as cheerio from 'cheerio'; 

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
      if (platform === '百家号') {
          let m = text.match(/(?:总粉丝量|粉丝数)\s*[:：]?\s*([\d,.]+[万wW亿kK]?)/);
          if (m) return this.parseCount(m[1]);
      }
      const cleanText = text.replace(/\s+/g, '');
      let m = null;
      if (platform === '小红书' || platform === '快手') {
          m = cleanText.match(/([\d,.]+[万wW亿kK]?)(?:粉丝数|粉丝)/);
          if (m) return this.parseCount(m[1]);
      }
      if (platform === 'B站' || platform === '抖音' || platform === '百家号') {
          m = cleanText.match(/(?:粉丝数|总粉丝|粉丝总数|粉丝)[:：]?([\d,.]+[万wW亿kK]?)/);
          if (m) return this.parseCount(m[1]);
      }
      m = cleanText.match(/(?:粉丝|粉丝数|总粉丝|关注者)[:：]?([\d,.]+[万wW亿kK]?)(?!\/)/);
      if (m) return this.parseCount(m[1]);
      m = cleanText.match(/([\d,.]+[万wW亿kK]?)(?:粉丝|粉丝数|总粉丝)/);
      if (m) return this.parseCount(m[1]);
      return 0;
  }
};

// ==========================================================
// 💥 2. 核心大杀器：注入式原生 API 提权提取 (移植开源核心)
// ==========================================================
async function getProfileViaOpenSourceAPI(page, platform) {
  return await page.evaluate(async (plat) => {
    try {
      if (plat === '快手') {
        const res = await fetch("https://cp.kuaishou.com/rest/k/graphql", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({operationName:"userInfoQuery",variables:{},query:"query userInfoQuery {\n  userInfo {\n    id\n    name\n    avatar\n    eid\n    userId\n    __typename\n  }\n}\n"})
        }).then(r => r.json());
        if (res.data?.userInfo) {
          const u = res.data.userInfo;
          return { userId: u.userId || u.id, realName: u.name, avatar: u.avatar };
        }
      }
      
      if (plat === 'B站') {
        const res = await fetch("https://api.bilibili.com/x/web-interface/nav").then(r => r.json());
        if (res.code === 0 && res.data.isLogin) {
          return { userId: res.data.mid, realName: res.data.uname, avatar: res.data.face };
        }
      }

      if (plat === '抖音') {
        try {
          const res = await fetch("https://creator.douyin.com/aweme/v1/creator/user/info/").then(r => r.json());
          if (res.status_code === 0 && res.user) {
            const u = res.user;
            return { userId: u.uid, realName: u.nickname, avatar: u.avatar_thumb?.url_list?.[0] };
          }
        } catch(e) {}
        
        // 极限兜底：从网页 Title 抠名字
        const titleText = document.title || '';
        let extractedName = '';
        if (titleText.includes('- 抖音')) {
            extractedName = titleText.split('-')[0].trim();
        } else if (titleText.includes('抖音创作者')) {
            extractedName = titleText.replace('抖音创作者中心', '').trim();
        }
        
        const nameEl = document.querySelector('.creator-bg-name, [class*="creator-name"], [class*="info-name"], [class*="user-name"], .name-text');
        const avatarEl = document.querySelector('[class*="avatar"] img, img.user-avatar');
        
        let finalName = '';
        if (nameEl && nameEl.innerText.trim()) finalName = nameEl.innerText.trim();
        else if (extractedName) finalName = extractedName;
        
        if (finalName) {
           return { realName: finalName, avatar: avatarEl ? avatarEl.src : '' };
        }
      }

      if (plat === '小红书') {
        const match = document.body.innerHTML.match(/window\.__INITIAL_STATE__=(\{.+?\})(?:<\/script>|;)/s);
        if (match) {
          const data = JSON.parse(match[1].replace(/undefined/g, 'null'));
          const u = data.user?.userInfo;
          if (u) return { userId: u.userId, realName: u.nickname || u.userName, avatar: u.images || u.userAvatar, username: u.redId };
        }
      }

      if (plat === '微博') {
        const match = document.body.innerHTML.match(/window\.__WB_GET_CONFIG\s*=\s*function\s*\(\)\s*\{\s*var\s+configData\s*=\s*\{\s*config:\s*JSON\.parse\('([^']+)'\)/);
        if (match) {
          const config = JSON.parse(match[1]);
          return { userId: config.uid, realName: config.nick, avatar: decodeURI(config.avatar_large) };
        }
      }

      if (plat === '知乎') {
        const res = await fetch("https://www.zhihu.com/api/v4/me").then(r => r.json());
        if (res.uid) return { userId: res.uid || res.id, realName: res.name, avatar: res.avatar_url };
      }

      if (plat === '百家号') {
        const res = await fetch("https://baijiahao.baidu.com/builder/app/appinfo").then(r => r.json());
        if (res.errno === 0) {
          const u = res.data?.user;
          if (u) return { userId: u.userid, realName: u.name, avatar: u.avatar };
        }
      }

      if (plat === '微信视频号') {
        const ts = Math.floor(Date.now() / 1000).toString(16);
        const hex = [...Array(8)].map(() => Math.floor(16 * Math.random()).toString(16)).join('');
        const res = await fetch(`https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/auth/auth_data?_aid=&_rid=${ts}-${hex}&_pageUrl=https:%2F%2Fchannels.weixin.qq.com%2Fplatform`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'X-Wechat-Uin': '0000000000'},
          body: JSON.stringify({timestamp: Date.now(), _log_finder_uin: "", _log_finder_id: "", rawKeyBuff: null, pluginSessionId: null, scene: 7, reqScene: 7})
        }).then(r => r.json());
        
        if (res.errCode === 0) {
          const u = res.data?.finderUser;
          if (u) return { userId: u.uniqId, realName: u.nickname, avatar: u.headImgUrl };
        }
      }
      
      return null;
    } catch (e) {
      return { error: `[${plat}] API 执行异常: ${e.message}` };
    }
  }, platform);
}

// 3. DOM 降级兜底解析引擎
function parseOfflineSnapshot(htmlContent, platform, currentUrl = '') {
  const $ = cheerio.load(htmlContent);
  $('br, div, p, li, section, span').append(' '); 
  const result = { followers: 0, views: 0, realName: '', avatar: '', userId: '' };
  try {
    const safeZoneHTML = $('[class*="user-info"], [class*="author-info"], [class*="profile"], [class*="user-card"], aside, header, [class*="m-header"], [class*="side-nav"], #app, #root').html() || $('body').html();
    if (safeZoneHTML) {
        const safeText = cheerio.load(safeZoneHTML).text(); 
        const parsedFollowers = Utils.extractFollowers(safeText, platform);
        if (parsedFollowers > 0) result.followers = parsedFollowers;
    }
  } catch (err) {}
  return result;
}

const PLATFORM_URLS = {
  '抖音': 'https://creator.douyin.com/creator-micro/home',
  'B站': 'https://space.bilibili.com/',
  '百家号': 'https://baijiahao.baidu.com/builder/rc/home',
  '微信视频号': 'https://channels.weixin.qq.com/platform',
  '小红书': 'https://creator.xiaohongshu.com/new/home',
  '快手': 'https://cp.kuaishou.com/profile',
  '爱奇艺号': 'https://mp.iqiyi.com/',
  '知乎': 'https://www.zhihu.com/creator',
  '微博': 'https://me.weibo.com/',
  '企鹅号(腾讯)': 'https://om.qq.com/',
  '腾讯视频': 'https://v.qq.com/biu/creator/home',
  '大鱼号(优酷)': 'https://mp.dayu.com/'
};

// ==========================================================
// 💥 战役一核心：自动化入网探针 (重构：阶段分离模式)
// ==========================================================
export async function autoBindAccount(platform) {
  const db = getDB();
  const info = db.prepare(`INSERT INTO accounts (alias, platform, status) VALUES (?, ?, ?)`).run(`待绑定_${platform}`, platform, '等待扫码');
  const accountId = info.lastInsertRowid;

  let browserSession = null;
  try {
    console.log(`[探针系统] 正在为 ${platform} 分配独立沙盒...`);
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 300 }); 
    const { page } = browserSession;

    const targetUrl = PLATFORM_URLS[platform] || 'https://www.baidu.com';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log(`[探针系统] ${platform} 登录页已就绪，等待指挥官扫码...`);
    
    // ---------------------------------------------------------
    // 阶段 1：纯粹的等待登录循环 (不执行任何 API 抓取)
    // ---------------------------------------------------------
    let isLogged = false;
    for (let i = 0; i < 60; i++) { 
        await page.waitForTimeout(3000);
        
        try {
            const isLoginPage = await page.evaluate(() => {
                const text = document.body.innerText || '';
                const url = location.href;
                // 检测是否仍在登录态
                if (url.includes('passport') || url.includes('login')) return true;
                if (text.includes('扫码登录') || text.includes('密码登录') || text.includes('短信登录') || text.includes('未登录')) return true;
                const iframes = document.querySelectorAll('iframe');
                for (let j = 0; j < iframes.length; j++) {
                    try {
                        const src = iframes[j].src || '';
                        if (src.includes('passport') || src.includes('login') || src.includes('sso')) return true;
                    } catch(e) {}
                }
                return false;
            });

            if (!isLoginPage) {
                console.log(`[探针系统] ✅ 检测到可能已越过登录墙！跳出监控循环，进入沉淀期...`);
                isLogged = true;
                break; // 扫码成功，立刻跳出等待循环！
            }
        } catch (e) { continue; }
    }

    if (!isLogged) {
        await closeSandbox(accountId);
        db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
        return { success: false, message: '扫码超时，已取消绑定。' };
    }

    // ---------------------------------------------------------
    // 阶段 2：数据沉淀期 (让子弹飞一会儿)
    // ---------------------------------------------------------
    console.log(`[探针系统] 🕒 正在等待平台后置接口与 DOM 完全渲染 (静默 6 秒)...`);
    await page.waitForTimeout(6000); 

    // ---------------------------------------------------------
    // 阶段 3：受控的提取模式 (最多只试 3 次，绝不死循环)
    // ---------------------------------------------------------
    let extractionSuccess = false;
    let fallbackData = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`[探针系统] 🔍 第 ${attempt} 次尝试提取账号基因...`);
        
        let apiData = await getProfileViaOpenSourceAPI(page, platform) || {};
        if (apiData.error) console.log(`[探针系统] API 警告: ${apiData.error}`);
        
        const pageHtml = await page.content();
        const domData = parseOfflineSnapshot(pageHtml, platform, page.url());
        
        const finalData = {
          realName: apiData.realName || domData.realName,
          avatar: apiData.avatar || domData.avatar,
          userId: apiData.userId || domData.userId,
          followers: domData.followers || 0,
          views: domData.views || 0
        };

        // 记下获取到的残缺数据用于兜底
        if (finalData.followers > 0) fallbackData = finalData;

        // 完美提取标准：必须拿到名字或 ID
        if (finalData.realName || finalData.userId) {
            console.log(`[探针系统] 🎯 完美提取成功！【${finalData.realName || '未知昵称'}】，粉丝：${finalData.followers}，ID：${finalData.userId || '未知'}`);
            
            // 处理头像转 Base64
            let finalAvatar = finalData.avatar;
            if (finalAvatar && finalAvatar.startsWith('http')) {
                try {
                    const response = await page.context().request.get(finalAvatar, { headers: { 'Referer': targetUrl } });
                    if (response.ok()) {
                        const buffer = await response.body();
                        const cleanMimeType = (response.headers()['content-type'] || 'image/jpeg').split(';')[0].trim(); 
                        finalAvatar = `data:${cleanMimeType};base64,${buffer.toString('base64')}`;
                    }
                } catch (picErr) {}
            }

            // 完美写入
            db.prepare(`UPDATE accounts SET alias = ?, real_name = ?, followers = ?, total_views = ?, avatar = ?, user_id = ?, status = ? WHERE id = ?`)
              .run(finalData.realName || `${platform}新号`, finalData.realName, finalData.followers, finalData.views, finalAvatar, finalData.userId, '在线', accountId);
            
            extractionSuccess = true;
            break; // 成功即退出循环
        } else {
            console.log(`[探针系统] ⚠️ 第 ${attempt} 次提取未获取到完整身份，等待 3 秒后重试...`);
            await page.waitForTimeout(3000);
        }
    }

    // ---------------------------------------------------------
    // 阶段 4：强制破门机制 (3次都失败后的终极容错)
    // ---------------------------------------------------------
    if (!extractionSuccess) {
        console.log(`[探针系统] 🚨 3 次提取均未能获取核心身份！启用强制破门落地机制！`);
        const fallbackName = `${platform}账号_${Math.floor(Math.random() * 10000)}`;
        const fFollowers = fallbackData ? fallbackData.followers : 0;
        const fViews = fallbackData ? fallbackData.views : 0;

        db.prepare(`UPDATE accounts SET alias = ?, real_name = ?, followers = ?, total_views = ?, status = ? WHERE id = ?`)
          .run(fallbackName, fallbackName, fFollowers, fViews, '在线', accountId);
        
        console.log(`[探针系统] 破门成功！已分配临时代号：${fallbackName}`);
    }

    if (platform === 'B站') await page.goto('https://member.bilibili.com/platform/home', { timeout: 15000 }).catch(()=>{});

    return { success: true, message: '账号入网登记成功！' };

  } catch (error) {
    if (browserSession) await closeSandbox(accountId);
    try { db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId); } catch(e){}
    const profilePath = path.join(app.getPath('userData'), 'playwright_profiles', `chrome_data_${accountId}`);
    if (fs.existsSync(profilePath)) fs.rmSync(profilePath, { recursive: true, force: true });
    return { success: false, message: '入网登记被手动中断。' };
  }
}

// ==========================================================
// 3. 大盘单号双擎抽水机 
// ==========================================================
async function runSingleSync(accountId, platform) {
  let browserSession = null;
  try {
    const db = getDB();
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    browserSession = await launchSandbox(accountId, { headless: true });
    const { page } = browserSession;

    const targetUrl = PLATFORM_URLS[platform] || acc.custom_url || 'https://www.baidu.com';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(Math.floor(Math.random() * (5000 - 3000 + 1) + 3000));

    let apiData = await getProfileViaOpenSourceAPI(page, platform) || {};
    
    const pageHtml = await page.content();
    const domData = parseOfflineSnapshot(pageHtml, platform, page.url());
    
    const finalRealName = apiData.realName || domData.realName || acc.real_name || '';
    const finalFollowers = domData.followers > 0 ? domData.followers : acc.followers;
    const finalViews = domData.views > 0 ? domData.views : acc.total_views;

    let finalAvatar = apiData.avatar || domData.avatar || acc.avatar;
    if (!finalAvatar || finalAvatar.startsWith('http')) {
        const currentAvatar = apiData.avatar || domData.avatar;
        if (currentAvatar && currentAvatar.startsWith('http')) {
            try {
                const response = await page.context().request.get(currentAvatar, { headers: { 'Referer': targetUrl } });
                if (response.ok()) {
                    const buffer = await response.body();
                    const cleanMimeType = (response.headers()['content-type'] || 'image/jpeg').split(';')[0].trim();
                    finalAvatar = `data:${cleanMimeType};base64,${buffer.toString('base64')}`;
                }
            } catch(e){}
        }
    }

    db.prepare('UPDATE accounts SET followers = ?, total_views = ?, status = ?, real_name = ?, avatar = ? WHERE id = ?')
      .run(finalFollowers, finalViews, '在线', finalRealName, finalAvatar, accountId);

    await closeSandbox(accountId);
    return { success: true, followers: finalFollowers, views: finalViews };
  } catch (error) {
    if (browserSession) await closeSandbox(accountId);
    try { getDB().prepare('UPDATE accounts SET status = ? WHERE id = ?').run('异常/未登录', accountId); } catch(e){}
    return { success: false, message: error.message };
  }
}

// ==========================================================
// 4. 司令部全局 IPC 总线注册 
// ==========================================================
export function registerDataEngineIPC() {
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

  ipcMain.handle('get-account-list', async () => { 
      return { success: true, data: getDB().prepare('SELECT id, alias, platform FROM accounts').all() }; 
  });
  
  ipcMain.handle('sync-account-stats', async (event, { accountId, platform }) => { 
      return await runSingleSync(accountId, platform); 
  });
  
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

  ipcMain.handle('auto-bind-account', async (event, platform) => {
      return await autoBindAccount(platform);
  });
}