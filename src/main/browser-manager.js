import { app } from 'electron';
import { chromium } from 'playwright';
import path from 'path';

// 🌟 全局单例字典：记录当前正在运行的沙盒
const activeBrowsers = new Map();

/**
 * 全局通用的沙盒启动器
 */
export async function launchSandbox(accountId, options = {}) {
  if (activeBrowsers.has(accountId)) {
    console.log(`[沙盒管理] 账号 ${accountId} 的沙盒已存在，直接复用。`);
    return activeBrowsers.get(accountId);
  }

  const { headless = false } = options;
  const userDataPath = path.join(app.getPath('userData'), 'playwright_profiles', `chrome_data_${accountId}`);

  try {
    console.log(`[沙盒管理] 正在为您唤起账号 ${accountId} 的真实隔离环境...`);
    
    const browserContext = await chromium.launchPersistentContext(userDataPath, {
      headless,
      channel: 'chrome', // 💥 核心修复1：强制对齐原生 Chrome 内核！杜绝白屏崩溃！
      viewport: { width: 1400, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      args: [
        '--window-position=100,100',
        '--hide-scrollbars',
        '--disable-infobars'
      ],
      ignoreDefaultArgs: ['--enable-automation', '--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    // 💥 核心修复2：击杀 Playwright 幽灵标签页，确保跳转肉眼可见
    const pages = browserContext.pages();
    // 永远获取最后一个标签页，或者新建一个
    const page = pages.length > 0 ? pages[pages.length - 1] : await browserContext.newPage();
    await page.bringToFront(); // 强行拉到前台

    // 把多余的空白页关掉，保证窗口干干净净
    if (pages.length > 1) {
      for (let i = 0; i < pages.length - 1; i++) {
        await pages[i].close().catch(() => {});
      }
    }
    
    // 注入底层反爬伪装
    await page.addInitScript(() => { 
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      delete window.navigator.languages;
      window.navigator.languages = ['zh-CN', 'zh'];
    });

    browserContext.on('close', () => {
      console.log(`[沙盒管理] 账号 ${accountId} 的沙盒已销毁。`);
      activeBrowsers.delete(accountId);
    });

    const session = { browserContext, page };
    activeBrowsers.set(accountId, session);

    return session;

  } catch (error) {
    console.error(`[沙盒管理] 账号 ${accountId} 启动致命失败:`, error);
    throw error; 
  }
}

/**
 * 优雅关闭沙盒的工具函数
 */
export async function closeSandbox(accountId) {
  if (activeBrowsers.has(accountId)) {
    const { browserContext } = activeBrowsers.get(accountId);
    await browserContext.close();
    activeBrowsers.delete(accountId);
  }
}