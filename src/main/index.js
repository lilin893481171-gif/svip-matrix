import { launchSandbox } from './browser-manager.js';
import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { initDatabase, registerDatabaseIPC, getDB } from './database.js'
import { registerRPAEngineIPC, runRPASelfTest, PLATFORM_URLS, PLATFORM_HOME_URLS } from './rpa-engine.js'
import { registerDataEngineIPC } from './data-engine.js';
import { registerInteractionEngineIPC } from './interaction-engine.js';
import { registerDataSyncIPC } from './data-sync.js';
import { attachAccountBrowser, detachAccountBrowser, navigateAccountBrowser, getAccountBrowserUrl, goBackAccountBrowser, goForwardAccountBrowser, reloadAccountBrowser, stopAccountBrowser, getActiveSessions, openAccountBrowserDevTools } from './account-browser-manager.js';
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// 忽略 SSL 证书/协议错误（代理、自签证书、国内平台 CDN 兼容）
app.commandLine.appendSwitch('ignore-certificate-errors');

	// WebRTC 防泄漏: 掐断局域网 IP 暴露，国内直连矩阵专用
app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'default_public_interface_only');
console.log('[Network Policy] WebRTC IP 处理策略: default_public_interface_only');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440, height: 900, show: false, autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true, // 💥 核心开启：允许内嵌多标签隔离浏览器！
      devTools: false   // 🔒 生产环境禁用 DevTools 防绕过
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
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.yumatrix.studio')

  initDatabase()
  registerDatabaseIPC()
  registerRPAEngineIPC()
  registerInteractionEngineIPC();
  registerDataEngineIPC()
  registerDataSyncIPC();

  // 🔍 启动自检：CDP 持久化注入 + WebRTC 网络栈防护 (3秒延迟, 不影响启动)
  setTimeout(() => {
    runRPASelfTest().catch(e => console.error('[自检] 启动异常:', e.message));
  }, 3000);

  // 👇👇👇 Toast 通知中继：从主进程推送通知到渲染进程
  ipcMain.on('show-toast', (event, { type, title, message }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.webContents.send('toast-notification', { type, title, message });
    }
  });
  // 👆👆👆 Toast 通知中继

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

  // 👇👇👇 账户内嵌浏览器吸附/分离 👇👇👇
  ipcMain.on('attach-account-browser', (event, { accountId, bounds }) => {
    attachAccountBrowser(accountId, bounds);
  });
  ipcMain.on('detach-account-browser', (event, { accountId }) => {
    detachAccountBrowser(accountId);
  });
  ipcMain.handle('navigate-account-browser', (event, { accountId, url }) => {
    return navigateAccountBrowser(accountId, url);
  });
  ipcMain.handle('get-account-browser-url', (event, { accountId }) => {
    return getAccountBrowserUrl(accountId);
  });
  ipcMain.on('account-browser-go-back', (event, { accountId }) => {
    goBackAccountBrowser(accountId);
  });
  ipcMain.on('account-browser-go-forward', (event, { accountId }) => {
    goForwardAccountBrowser(accountId);
  });
  ipcMain.on('account-browser-reload', (event, { accountId }) => {
    reloadAccountBrowser(accountId);
  });
  ipcMain.on('account-browser-stop', (event, { accountId }) => {
    stopAccountBrowser(accountId);
  });
  ipcMain.handle('get-active-sessions', () => {
    return getActiveSessions();
  });
  ipcMain.handle('open-account-browser-devtools', (_event, accountId) => {
    return openAccountBrowserDevTools(accountId);
  });
  // 👆👆👆 账户内嵌浏览器吸附/分离 👆👆👆

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

  // 👇👇👇 发布工作台：选择文件夹 👇👇👇
  ipcMain.handle('select-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '选择媒体文件夹',
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return { success: false };
    return { success: true, path: filePaths[0] };
  });

  // 👇👇👇 发布工作台：扫描文件夹中的视频文件 👇👇👇
  ipcMain.handle('scan-media-folder', async (event, { folderPath }) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) {
        return { success: true, files: [] };
      }
      const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile() && videoExts.includes(path.extname(e.name).toLowerCase()))
        .map(e => {
          const fullPath = path.join(folderPath, e.name);
          let stat = {};
          try { stat = fs.statSync(fullPath); } catch (_) {}
          return {
            name: e.name,
            path: fullPath,
            size: stat.size || 0,
            date: stat.mtime ? stat.mtime.toISOString() : null
          };
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      return { success: true, files };
    } catch (err) {
      return { success: false, message: err.message, files: [] };
    }
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
    console.log('[Matrix Shield] Electron 退出前已精准清理所有 RPA 浏览器进程')
  } catch (e) {
    console.warn('[Matrix Shield] before-quit 清理时出现轻微异常（可忽略）', e.message)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})