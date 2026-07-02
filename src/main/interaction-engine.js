// src/main/interaction-engine.js
import { ipcMain, app, clipboard } from 'electron';
import path from 'path';
import { getDB } from './database.js'; 

import { launchSandbox, closeSandbox } from './browser-manager.js';

// ==========================================================
// 🌟 平台引擎动态路由 - 已迁移至 PlatformRegistry
// ==========================================================
// 旧的平台引擎已移除，需要重构为使用 PlatformRegistry
// const ENGINE_LOADERS = { ... }
// async function loadEngine(platform) { ... }

// 临时占位函数 - 需要重构
async function loadEngine(platform) {
    throw new Error(`[InteractionEngine] 平台 "${platform}" 引擎尚未迁移至新架构，请重构此模块`);
}
// 通用休眠与会话管理
const randomSleep = async (page, min = 1000, max = 2500) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
};

// ==========================================================
// 🛡️ 终极防封控：话术裂变与隐形加盐引擎
// ==========================================================
function antiSpamFilter(baseText) {
    if (!baseText) return '';
    let spinnedText = baseText.replace(/\{([^{}]+)\}/g, function(match, contents) {
        const choices = contents.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
    });
    const kaomojis = ['', ' ~', ' (￣▽￣)', ' (･∀･)', ' (｀・ω・´)', ' ヾ(≧▽≦*)o', ' (oﾟvﾟ)ノ', ' !!', ' 🤔', ' 💡'];
    spinnedText += kaomojis[Math.floor(Math.random() * kaomojis.length)];
    const zeroWidthChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    let salt = '';
    for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
        salt += zeroWidthChars[Math.floor(Math.random() * zeroWidthChars.length)];
    }
    return spinnedText + salt;
}

export function registerInteractionEngineIPC() {

  // 接口 1: 获取消息 
  ipcMain.handle('get-messages', async () => {
    try {
      const db = getDB();
      return db.prepare(`SELECT id, platform, account_alias as account, username as user, avatar, video_cover, content, time, status, type, reply_content FROM messages ORDER BY id DESC`).all();
    } catch (e) { return []; }
  });

// 接口 2: 雷达扫描引擎 (智能路由分发)
  ipcMain.handle('sync-platform-interactions', async (event, { accountId, platform, radarType }) => {
    let accIdForClose = accountId;
    let browserOpened = false;
    
    try {
        const engine = await loadEngine(platform);
        
        const db = getDB();
        const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
        
        const browserSession = await launchSandbox(acc.id, { headless: false });
        browserOpened = true;
        const { page } = browserSession;

        // 🌟 修复：先用一个变量存住雷达的结果
        let radarResult;
        
        if (platform === '抖音') {
            radarResult = await engine.runRadar(page, db, acc, randomSleep);
        } else {
            if (radarType === 'video') {
                radarResult = await engine.runVideoRadar(page, acc, randomSleep);
            } else {
                radarResult = await engine.runCommentRadar(page, db, acc, randomSleep);
            }
        }
        
        // 🌟 核心修复：执行完雷达扫描后，必须关闭会话容器！
        await closeSandbox(acc.id);
        
        // 最后把结果返回给前端
        return radarResult;
        
    } catch (error) {
        if (browserOpened) await closeSandbox(accIdForClose);
        return { success: false, message: error.message };
    }
  });

  // 接口 3: 回复引擎 (智能路由分发)
  ipcMain.handle('open-reply-session', async (event, payload) => {
    let accIdForClose = null;
    let browserOpened = false;

    try {
      const db = getDB();
      const messageId = payload.messageId || payload;
      let replyText = payload.replyText || ''; 
      const targetVideos = payload.targetVideos || [];

      replyText = antiSpamFilter(replyText);
      if (replyText) clipboard.writeText(replyText);

      // 🌟 模式 A：批量首发置顶
      if (messageId === 'batch_pin') {
          if (!targetVideos || targetVideos.length === 0) return { success: false, message: '未接收到数据' };
          
          const accAlias = targetVideos[0].account;
          const platform = targetVideos[0].platform;
          const acc = db.prepare('SELECT id FROM accounts WHERE alias = ? AND platform = ?').get(accAlias, platform);
          accIdForClose = acc.id;
          
          // 1. 动态加载引擎
          const engine = await loadEngine(platform);

          // 2. 启动隔离会话
          const browserSession = await launchSandbox(acc.id, { headless: false });
          browserOpened = true;

          // 3. 执行
          const result = await engine.runBatchPin(browserSession.page, targetVideos, replyText, randomSleep);
          await closeSandbox(acc.id);
          return result;
      }

      // 🌟 模式 B：普通精准评论回复
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
      const acc = db.prepare('SELECT id FROM accounts WHERE alias = ? AND platform = ?').get(msg.account_alias, msg.platform);
      accIdForClose = acc.id;
      
      // 1. 动态加载引擎
      const engine = await loadEngine(msg.platform);

      // 2. 启动隔离会话
      const browserSession = await launchSandbox(acc.id, { headless: false });
      browserOpened = true;

      // 3. 执行
      await engine.runReply(browserSession.page, msg, replyText, randomSleep);

      db.prepare('UPDATE messages SET status = ?, reply_content = ? WHERE id = ?')
        .run('已回复', replyText ? '[自动] ' + replyText : '[手动]', messageId);

      await closeSandbox(acc.id);
      return { success: true, message: '会话执行完毕！' };

    } catch (error) {
      if (browserOpened && accIdForClose) await closeSandbox(accIdForClose);
      return { success: false, message: error.message };
    }
  });

}