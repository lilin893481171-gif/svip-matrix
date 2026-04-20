import { ipcMain, app, clipboard } from 'electron'; // 🔥 新增了 clipboard
import { chromium } from 'playwright';
import path from 'path';
import { getDB } from './database.js';
import { launchSandbox } from './browser-manager.js'

// 🛡️ 拟人化延迟工具 (风控核心)
const randomSleep = async (page, min = 1000, max = 2500) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
};

export function registerInteractionEngineIPC() {
  
  // ==========================================================
  // 📥 接口 1：读取本地数据库 (不变)
  // ==========================================================
  ipcMain.handle('get-messages', async () => {
    try {
      const db = getDB();
      return db.prepare(`
        SELECT id, platform, account_alias as account, username as user, content, time, status, type
        FROM messages ORDER BY id DESC
      `).all();
    } catch (e) {
      console.error('获取消息失败:', e);
      return [];
    }
  });

  // ==========================================================
  // 🔄 接口 2：同步抓取器 (Sync) - 保持纯读操作，零风险
  // ==========================================================
  ipcMain.handle('sync-platform-interactions', async (event, { accountId, platform }) => {
    try {
      const db = getDB();
      const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
      const { browserContext, page } = await launchSandbox(accountId, { headless: true });
      
      let newCount = 0;
      const insertStmt = db.prepare(`
        INSERT INTO messages (platform, account_alias, username, content, time, type, status) 
        VALUES (?, ?, ?, ?, ?, ?, '未回复')
      `);

      // 👇 这里保留了你之前所有的抓取逻辑 (已修复 pierce 问题) 👇
      if (platform === '抖音') {
        // 抓取抖音私信
        await page.goto('https://creator.douyin.com/creator-micro/interactive/message', { waitUntil: 'domcontentloaded' });
        await randomSleep(page, 3000, 5000);
        const dmList = await page.$$eval('ul > div > div > div', (items) => {
          return items.map(item => {
            const user = item.querySelector('.name, [class*="name"]')?.innerText || '';
            const content = item.querySelector('.content, [class*="content"]')?.innerText || '';
            return { user, content, time: '刚刚', type: '私信' };
          }).filter(i => i.user && i.content);
        });
        for (const msg of dmList) {
          const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, msg.user, msg.content);
          if (!exists) { insertStmt.run(platform, acc.alias, msg.user, msg.content, msg.time, msg.type); newCount++; }
        }

        // 抓取抖音评论
        await page.goto('https://creator.douyin.com/creator-micro/interactive/comment', { waitUntil: 'domcontentloaded' });
        await randomSleep(page, 3000, 5000);
        const commentList = await page.$$eval('div.container-sXKyMs', (cards) => {
          return cards.map(card => {
            const user = card.querySelector('span[class*="name"]')?.innerText || '';
            const content = card.querySelector('div[class*="content"]')?.innerText || '';
            return { user, content, time: '刚刚', type: '评论' };
          }).filter(i => i.user && i.content);
        });
        for (const msg of commentList) {
          const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, msg.user, msg.content);
          if (!exists) { insertStmt.run(platform, acc.alias, msg.user, msg.content, msg.time, msg.type); newCount++; }
        }
      } 
      else if (platform === 'B站') {
        // 抓取 B站 私信
        await page.goto('https://message.bilibili.com/', { waitUntil: 'domcontentloaded' });
        await randomSleep(page, 3000, 5000);
        const dmList = await page.$$eval('div[class*="list-item"], div[class*="SessionItem"]', (items) => {
          return items.map(item => {
            const user = item.querySelector('[class*="name"]')?.innerText || '';
            const content = item.querySelector('[class*="Info"] > div, [class*="last-msg"]')?.innerText || '';
            return { user, content, time: '刚刚', type: '私信' };
          }).filter(i => i.user && i.content);
        });
        for (const msg of dmList) {
          const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, msg.user, msg.content);
          if (!exists) { insertStmt.run(platform, acc.alias, msg.user, msg.content, msg.time, msg.type); newCount++; }
        }

        // 抓取 B站 评论
        await page.goto('https://member.bilibili.com/platform/interaction-manage/reply', { waitUntil: 'domcontentloaded' });
        await randomSleep(page, 3000, 5000);
        const commentList = await page.$$eval('div[class*="reply-item"], div[class*="card"]', (cards) => {
          return cards.map(card => {
            const user = card.querySelector('[class*="name"], [class*="user"]')?.innerText || '';
            const content = card.querySelector('[class*="content"], [class*="text"]')?.innerText || '';
            return { user, content, time: '刚刚', type: '评论' };
          }).filter(i => i.user && i.content);
        });
        for (const msg of commentList) {
          const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, msg.user, msg.content);
          if (!exists) { insertStmt.run(platform, acc.alias, msg.user, msg.content, msg.time, msg.type); newCount++; }
        }
      }
      else if (platform === '百家号') {
        await page.goto('https://baijiahao.baidu.com/', { waitUntil: 'networkidle', timeout: 30000 });
        await randomSleep(page, 3000, 5000);

        // 抓取百家号评论
        const commentMenuLocator = page.locator('div:nth-of-type(1) > a > span, //a[contains(@href, "comment") or contains(., "评论")]', { hasText: /评论/ }).first();
        await commentMenuLocator.waitFor({ timeout: 8000, state: 'visible' });
        await commentMenuLocator.click();
        await randomSleep(page, 2000, 3000);

        await page.evaluate(async () => {
          const loadMoreBtn = document.querySelector('div.client_pages_newComment_components_loadMore > span');
          const scrollContainer = document.querySelector('div.list-container');
          for (let i = 0; i < 3; i++) {
            if (loadMoreBtn && !loadMoreBtn.textContent.includes('没有更多')) {
              loadMoreBtn.click();
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
            if (scrollContainer) {
              scrollContainer.scrollTop += 1000;
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          }
        });
        await randomSleep(page, 1000, 2000);

        const commentList = await page.$$eval('div.list-container > div', (items) => {
          return items.map(item => {
            const user = item.querySelector('div.title-wrapper')?.textContent?.trim() || '';
            const content = item.querySelector('div.content')?.textContent?.trim() || '';
            return { user, content, time: '刚刚', type: '评论' };
          }).filter(i => i.user && i.content && !i.content.includes('系统通知'));
        });
        for (const msg of commentList) {
          const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, msg.user, msg.content);
          if (!exists) { insertStmt.run(platform, acc.alias, msg.user, msg.content, msg.time, msg.type); newCount++; }
        }

        // 抓取百家号私信
        const msgMenuLocator = page.locator('#asideMenuItem-私信管理 span, //span[contains(., "私信管理")]', { hasText: /私信管理/ }).first();
        await msgMenuLocator.waitFor({ timeout: 8000, state: 'visible' });
        await msgMenuLocator.click();
        await randomSleep(page, 2000, 3000);

        const dmList = await page.$$eval('li div.msg-content-main', (items) => {
          return items.map(item => {
            const user = item.closest('li')?.querySelector('[class*="name"]')?.textContent?.trim() || '';
            const content = item.textContent?.trim() || '';
            return { user, content, time: '刚刚', type: '私信' };
          }).filter(i => i.user && i.content);
        });
        for (const msg of dmList) {
          const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, msg.user, msg.content);
          if (!exists) { insertStmt.run(platform, acc.alias, msg.user, msg.content, msg.time, msg.type); newCount++; }
        }
      }

      await browserContext.close();
      return { success: true, count: newCount };
    } catch (e) {
      console.error('抓取异常:', e);
      return { success: false, message: e.message };
    }
  });

  // ==========================================================
  // 🚀 接口 3：半自动降临模式 (唤起沙盒，定位聊天框，交由真人处理)
  // ==========================================================
  ipcMain.handle('open-reply-sandbox', async (event, { messageId, replyText }) => {
    try {
      const db = getDB();
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      const acc = db.prepare('SELECT id FROM accounts WHERE alias = ? AND platform = ?').get(msg.account_alias, msg.platform);
      
      // 🔥 绝杀：如果前端写了话术，自动写入剪贴板
      if (replyText) {
        clipboard.writeText(replyText);
        console.log('✅ 已将回复话术写入剪贴板，请在沙盒中使用 Ctrl+V 粘贴');
      }

      const userDataPath = path.join(app.getPath('userData'), 'playwright_profiles', `chrome_data_${acc.id}`);
      
      // 捕获“锁定异常”（如果该账号的浏览器已经打开，引导用户关掉或直接去那个窗口里操作）
      let browserContext;
      try {
        browserContext = await chromium.launchPersistentContext(userDataPath, {
          headless: false,  // 必须开启，让人类接管
          channel: 'chrome',
          viewport: { width: 1280, height: 800 },
          ignoreDefaultArgs: ['--enable-automation', '--disable-blink-features=AutomationControlled']
        });
      } catch (lockError) {
        throw new Error('该账号的沙盒环境已在运行中，请检查是否已打开对应窗口。');
      }

      const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
      await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }) });

      // ================= 根据平台自动寻路，停在聊天框前 =================
      if (msg.platform === '抖音') {
        if (msg.type === '私信') {
          await page.goto('https://creator.douyin.com/creator-micro/interactive/message', { waitUntil: 'domcontentloaded' });
          const fanItem = page.locator(`ul li:has-text("${msg.username}")`).first();
          if (await fanItem.isVisible()) await fanItem.click();
        } 
        else if (msg.type === '评论') {
          await page.goto('https://creator.douyin.com/creator-micro/interactive/comment', { waitUntil: 'domcontentloaded' });
          const commentCard = page.locator(`div.container-sXKyMs:has-text("${msg.username}")`).first();
          if (await commentCard.isVisible()) {
             const replyBtn = commentCard.locator('div:has-text("回复")').last();
             await replyBtn.click();
          }
        }
      }
      else if (msg.platform === 'B站') {
        if (msg.type === '私信') {
          await page.goto('https://message.bilibili.com/', { waitUntil: 'domcontentloaded' });
          const fanItem = page.locator(`div[class*="SessionItem"]:has-text("${msg.username}"), div[class*="list-item"]:has-text("${msg.username}")`).first();
          if (await fanItem.isVisible()) await fanItem.click();
        } 
        else if (msg.type === '评论') {
          await page.goto('https://member.bilibili.com/platform/interaction-manage/reply', { waitUntil: 'domcontentloaded' });
          const replyBtn = page.locator(`div:has-text("${msg.username}") span.reply > a, div:has-text("${msg.username}") span:has-text("回复")`).first();
          if (await replyBtn.isVisible()) await replyBtn.click();
        }
      }
      else if (msg.platform === '百家号') {
        await page.goto('https://baijiahao.baidu.com/', { waitUntil: 'networkidle' });
        if (msg.type === '私信') {
          const msgMenuLocator = page.locator('#asideMenuItem-私信管理 span, //span[contains(., "私信管理")]', { hasText: /私信管理/ }).first();
          if (await msgMenuLocator.isVisible()) await msgMenuLocator.click();
          await randomSleep(page, 1500, 2000);
          const targetMsgLocator = page.locator(`li:has-text("${msg.username}")`).first();
          if (await targetMsgLocator.isVisible()) await targetMsgLocator.click();
        } else if (msg.type === '评论') {
          const commentMenuLocator = page.locator('div:nth-of-type(1) > a > span, //a[contains(@href, "comment") or contains(., "评论")]', { hasText: /评论/ }).first();
          if (await commentMenuLocator.isVisible()) await commentMenuLocator.click();
        }
      }

      // ⚠️ 极其关键：不再执行 close()。把浏览器控制权移交给老板！
      // 此时界面会自动置顶并停留在输入框前，用户只要 Ctrl+V -> 回车 即可完成回复。

      // 更新数据库状态：立刻将该条消息标记为已处理
      db.prepare('UPDATE messages SET status = ?, reply_content = ? WHERE id = ?')
        .run('已回复', replyText ? '[沙盒人工处理] ' + replyText : '[沙盒人工处理]', messageId);

      return { success: true, message: '环境已唤起，请在弹出窗口中手动回复。' };
    } catch (error) {
      console.error('唤起沙盒失败:', error);
      return { success: false, message: error.message };
    }
  });
}