import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { initDatabase, registerDatabaseIPC, getDB } from './database.js'
import { registerRPAEngineIPC, PLATFORM_URLS, PLATFORM_HOME_URLS } from './rpa-engine.js'
import { registerDataEngineIPC } from './data-engine.js';
import { registerInteractionEngineIPC } from './interaction-engine.js';
import { registerDataSyncIPC } from './data-sync.js';
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440, height: 900, show: false, autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true // 💥 核心开启：允许内嵌多标签隔离浏览器！
    },
    // 主 UI 窗口的参数，不影响 Playwright，保持原样即可
    additionalArguments: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  )

  // 🚨 核心修复点：删除了 .replace('localhost', '127.0.0.1') 解决白屏连不上的问题！
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
// 🚨 开启幽灵船坞的底层 CDP 调试通道 (必须加！)
app.commandLine.appendSwitch('remote-debugging-port', '8315');
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.matrix.engine')

  initDatabase()
  registerDatabaseIPC()
  registerRPAEngineIPC()
  registerInteractionEngineIPC();
  registerDataEngineIPC()
  registerDataSyncIPC();

  // 👇👇👇 🌟 终极修复：AI 请求后端代理，彻底绕过前端浏览器的所有 WAF / CORS 拦截！ 👇👇👇
  ipcMain.handle('llm-request', async (event, { url, options }) => {
    try {
      // Node 18+ 原生 fetch，无视跨域，无视 WAF OPTIONS 拦截
      const response = await fetch(url, options);
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `HTTP状态码: ${response.status}`;
        try {
           const errJson = JSON.parse(errText);
           if (errJson.error?.message) errMsg = errJson.error.message;
        } catch(e) {}
        // 精准捕获 402 欠费状态
        if (response.status === 402) {
           errMsg = "🚨 账户余额不足 (HTTP 402 Payment Required)！请前往 DeepSeek 官网充值。";
        }
        return { success: false, status: response.status, message: errMsg };
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
  // 👆👆👆 终极修复结束 👆👆👆

  // 👇👇👇 补回丢失的前端辅助接口：选视频、存封面 👇👇👇
  ipcMain.handle('select-local-videos', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '请批量选择要列队的本地视频',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }]
    });
    if (canceled || filePaths.length === 0) return { success: false };
    return { success: true, paths: filePaths };
  });

  ipcMain.handle('save-temp-cover', async (event, base64Data) => {
    try {
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const tempDir = path.join(app.getPath('userData'), 'temp_covers');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const tempPath = path.join(tempDir, `cover_${Date.now()}.jpg`);
      fs.writeFileSync(tempPath, base64Image, {encoding: 'base64'});
      return { success: true, path: tempPath };
    } catch(err) {
      return { success: false, message: err.message };
    }
  });

  // 👇👇👇 🌟 核心：触发开机静默巡逻兵 (全域数据罗盘) 🌟 👇👇👇
  try {
    console.log('====================================');
    console.log('🚀 准备唤醒全域数据罗盘巡逻兵...');
    
    const db = getDB(); 
    const dbAccounts = db.prepare('SELECT id, platform FROM accounts').all();
    console.log(`📦 从数据库中查找到 ${dbAccounts.length} 个账号`);

    const myAccounts = dbAccounts.map(row => ({
       accountId: row.id.toString(), 
       platform: row.platform
    }));

    if (myAccounts && myAccounts.length > 0) {
      console.log('✅ 账号列表已就绪，正在将任务移交巡逻兵...');
    } else {
      console.log('⚠️ 账号列表为空，巡逻兵取消出动！');
    }
    console.log('====================================');

  } catch (err) {
    console.error('❌ 启动静默巡逻兵前发生致命错误 (大概率是数据库查询写错了):', err);
  }

  // ==================== 改进后的 open-account-session ====================
  ipcMain.handle('open-account-session', async (event, { platform, accountKey, customUrl, accountId }) => {
    
    // 🚨 核心修改：优先使用 PLATFORM_HOME_URLS（创作者首页）
    const targetUrl = customUrl || PLATFORM_HOME_URLS[platform] || PLATFORM_URLS[platform] || 'https://www.baidu.com'

    try {
      const userDataPath = path.join(app.getPath('userData'), 'playwright_profiles', `chrome_data_${accountId || Date.now()}`)
      const browserContext = await chromium.launchPersistentContext(userDataPath, {
        headless: false,
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        locale: 'zh-CN',
        args: [
          `--app=${targetUrl}`,          
          '--window-position=100,100',   
          '--window-size=1000,720',      
          '--hide-scrollbars',           
          '--mute-audio',
          '--disable-infobars'           
        ],     
        ignoreDefaultArgs: ['--enable-automation', '--no-sandbox', '--disable-blink-features=AutomationControlled']
      });
      
      const page = browserContext.pages().length > 0 
        ? browserContext.pages()[0] 
        : await browserContext.newPage()

      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
        delete window.navigator.languages;
        window.navigator.languages = ['zh-CN', 'zh'];
      })

      // 🌟 修复问题2核心：改为 domcontentloaded，不准死等网络空闲！
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => {
         if (e.message.includes('Target page, context or browser has been closed')) {
            console.log('用户已手动关闭沙盒窗口，属正常行为。');
         } else {
            throw e; 
         }
      });

      return { success: true }
      
    } catch (error) {
      console.error('[open-account-session] 错误:', error.message)
      if (error.message.includes('Target page, context or browser has been closed')) {
         return { success: true }; 
      }
      if (error.message.includes('Target directory is in use') || error.message.includes('lock')) {
        return { 
          success: false, 
          message: '【拦截】该账号浏览器正被使用！已尝试强制清理，请 2 秒后再次点击唤起' 
        }
      }
      return { success: false, message: error.message }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ==================== Electron 退出时的精准清理 ====================
app.on('before-quit', () => {
  try {
    const killCmd = `wmic process where "name='chrome.exe' and (CommandLine like '%playwright_profiles%' or CommandLine like '%chrome_data_%')" call terminate`
    execSync(killCmd, { stdio: 'ignore' })
    console.log('[Matrix Armor] Electron 退出前已精准清理所有 RPA 浏览器进程')
  } catch (e) {
    console.warn('[Matrix Armor] before-quit 清理时出现轻微异常（可忽略）', e.message)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})