import { launchSandbox } from './browser-manager.js';
import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'
import fs from 'fs'
import { execSync, execFile } from 'child_process'
import { chromium } from 'playwright'
import { initDatabase, registerDatabaseIPC, getDB } from './database.js'
import { registerRPAEngineIPC, runRPASelfTest, PLATFORM_URLS, PLATFORM_HOME_URLS } from './rpa-engine.js'
import { registerDataEngineIPC } from './data-engine.js';
import { registerInteractionEngineIPC } from './interaction-engine.js';
import { registerDataSyncIPC } from './data-sync.js';
import { registerEmailIPC, closeAllEmailConnections } from './email-engine.js';
import { registerEmailBrowserIPC, closeEmailBrowser } from './email-browser-manager.js';
import { attachAccountBrowser, detachAccountBrowser, navigateAccountBrowser, getAccountBrowserUrl, goBackAccountBrowser, goForwardAccountBrowser, reloadAccountBrowser, stopAccountBrowser, getActiveSessions, openAccountBrowserDevTools } from './account-browser-manager.js';
import { startupCleanStalePartitions } from './safe-delete.js';
import { startTLSProxy, stopTLSProxy, getTLSProxyRules } from './tls-proxy-launcher.js';

// 导出给其他模块使用 (account-browser-manager, rpa/browser-controller)
export { getTLSProxyRules };

// 全局异常兜底 — 防止未处理的 Promise 拒绝导致静默崩溃
process.on('unhandledRejection', (reason) => {
  console.error('[Main] 未处理的 Promise 拒绝:', reason);
});

// 忽略 SSL 证书/协议错误（代理、自签证书、国内平台 CDN 兼容）
app.commandLine.appendSwitch('ignore-certificate-errors');
// 强制 HTTP/1.1 回退 — 部分国内 CDN 节点的 HTTP/2 ALPN 协商失败导致 ERR_SSL_PROTOCOL_ERROR
app.commandLine.appendSwitch('disable-http2');
// 禁用 QUIC (HTTP/3) — 代理/中间盒不兼容 QUIC 会导致 SSL 协议握手失败 (-107)
app.commandLine.appendSwitch('disable-quic');
// 放宽自动播放策略 — RPA BrowserView 无真实用户手势，小红书视频上传后
// 页面需 <video> 自动播放来驱动 WASM 解码器完成首帧解析，autoplay 被拒 → 转码卡住
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 🔐 代理/抓包场景：全平台域名证书白名单静默放行
// ignore-certificate-errors 仅跳过内置错误页，代理 MITM 证书仍会触发 SSL 握手失败
// certificate-error 事件在证书链校验阶段拦截，callback(true) 即信任
const SSL_WHITELIST_DOMAINS = [
  'douyin.com', 'toutiao.com', 'bytedance.com', 'ibytedtos.com', 'snssdk.com',
  'kuaishou.com', 'yximgs.com',
  'weixin.qq.com', 'gtimg.com', 'qpic.cn',
  'bilibili.com', 'hdslb.com', 'bilivideo.com',
  'xiaohongshu.com', 'xhscdn.com',
  'baidu.com', 'bdstatic.com', 'bdimg.com',
];

function isDomainWhitelisted(hostname) {
  const h = hostname.toLowerCase();
  return SSL_WHITELIST_DOMAINS.some(d => h === d || h.endsWith('.' + d));
}

app.on('certificate-error', (_event, _webContents, _url, _error, _certificate, callback) => {
  try {
    const hostname = new URL(_url).hostname;
    if (isDomainWhitelisted(hostname)) {
      callback(true);  // 信任此证书，静默放行
      return;
    }
  } catch {}
  callback(false); // 其他域名沿用全局策略
});

	// WebRTC 防泄漏: 掐断局域网 IP 暴露，国内直连矩阵专用
app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'default_public_interface_only');

// 禁用 Blink 自动化特征 (navigator.webdriver / AutomationControlled)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
console.log('[Network Policy] WebRTC IP 处理策略: default_public_interface_only');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440, height: 900, show: false, autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,              // ESM preload 不兼容 sandbox:true，其他安全措施已补偿
      contextIsolation: true,
      webSecurity: false,          // 主窗口需要跨域加载本地/远程混合资源
      allowRunningInsecureContent: false,
      webviewTag: true,
      devTools: true
    },
    // 主 UI 窗口的参数，不影响 Playwright，保持原样即可
    additionalArguments: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(details.url);
      }
    } catch {}
    return { action: 'deny' }
  })

  // UA 与 Electron 内置 Chromium 版本保持一致，避免硬编码版本号不匹配
  const chromeVersion = process.versions.chrome || '132.0.0.0';
  mainWindow.webContents.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
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

  // 🔐 注册 matrix-media:// 自定义协议 — 替代危险的 file:// 直读
  protocol.handle('matrix-media', (request) => {
    try {
      const filePath = request.url.slice('matrix-media://'.length);
      const decodedPath = decodeURIComponent(filePath);
      return net.fetch(`file:///${decodedPath}`);
    } catch (e) {
      console.warn('[matrix-media] 协议转换失败:', e.message);
      return new Response(null, { status: 404 });
    }
  });

  // 🧹 启动时清理上次运行时残留的 RPA 分区（此时无活跃 BrowserView，文件不被锁）
  const partitionsDir = path.join(app.getPath('userData'), 'Partitions');
  startupCleanStalePartitions(partitionsDir);

  // 🔐 启动 TLS 指纹伪装代理 (JA3→Chrome132, 对抗小红书 TLS 级风控)
  startTLSProxy();

  initDatabase()
  registerDatabaseIPC()
  registerRPAEngineIPC()
  registerInteractionEngineIPC();
  registerDataEngineIPC()
  registerDataSyncIPC();
  registerEmailIPC();
  registerEmailBrowserIPC();

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
    try { attachAccountBrowser(accountId, bounds); } catch (e) { console.error('[IPC] attach-account-browser:', e.message); }
  });
  ipcMain.on('detach-account-browser', (event, { accountId }) => {
    try { detachAccountBrowser(accountId); } catch (e) { console.error('[IPC] detach-account-browser:', e.message); }
  });
  ipcMain.handle('navigate-account-browser', (event, { accountId, url }) => {
    return navigateAccountBrowser(accountId, url);
  });
  ipcMain.handle('get-account-browser-url', (event, { accountId }) => {
    return getAccountBrowserUrl(accountId);
  });
  ipcMain.on('account-browser-go-back', (event, { accountId }) => {
    try { goBackAccountBrowser(accountId); } catch (e) { console.error('[IPC] go-back:', e.message); }
  });
  ipcMain.on('account-browser-go-forward', (event, { accountId }) => {
    try { goForwardAccountBrowser(accountId); } catch (e) { console.error('[IPC] go-forward:', e.message); }
  });
  ipcMain.on('account-browser-reload', (event, { accountId }) => {
    try { reloadAccountBrowser(accountId); } catch (e) { console.error('[IPC] reload:', e.message); }
  });
  ipcMain.on('account-browser-stop', (event, { accountId }) => {
    try { stopAccountBrowser(accountId); } catch (e) { console.error('[IPC] stop:', e.message); }
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

  // ═══════════════════════════════════════════════════════════
  // 应用坞：扫描本机已安装应用 (Start Menu .lnk 解析)
  // ═══════════════════════════════════════════════════════════
  function guessAppCategory(name) {
    const n = name.toLowerCase();
    if (/chrome|edge|firefox|brave|opera|vivaldi|arc|浏览器/i.test(n)) return 'Globe';
    if (/微信|wechat|qq|钉钉|飞书|telegram|discord|slack|zoom|腾讯会议|teams|skype|line|whatsapp/i.test(n)) return 'MessageCircle';
    if (/code|webstorm|sublime|notepad\+\+|atom|cursor|windsurf|intellij|pycharm|phpstorm|goland|vim/i.test(n)) return 'Code';
    if (/photoshop|illustrator|figma|sketch|墨刀|eagle|lightroom|indesign|blender/i.test(n)) return 'PenTool';
    if (/剪映|capcut|premiere|davinci|obs|potplayer|vlc|抖音|快手|bilibili/i.test(n)) return 'Film';
    if (/网易云|spotify|qq音乐|酷狗|酷我|foobar/i.test(n)) return 'Music';
    if (/wps|word|excel|powerpoint|notion|obsidian|typora|xmind|onenote|evernote/i.test(n)) return 'FileText';
    if (/terminal|powershell|cmd|git bash|hyper|warp|alacritty/i.test(n)) return 'Terminal';
    if (/百度网盘|阿里云盘|onedrive|dropbox|坚果云|网盘/i.test(n)) return 'Cloud';
    if (/snipaste|截图|screenpresso/i.test(n)) return 'Camera';
    if (/7-zip|bandizip|winrar|peazip/i.test(n)) return 'Box';
    if (/postman|docker|insomnia/i.test(n)) return 'Box';
    return 'Box';
  }

  // ═══════════════════════════════════════════════════════════
  // 应用坞：扫描本机已安装应用
  // ═══════════════════════════════════════════════════════════
  const isWin32 = process.platform === 'win32';
  const isDarwin = process.platform === 'darwin';

  ipcMain.handle('scan-installed-apps', async () => {
    if (isWin32) {
      // Windows: PowerShell + WScript.Shell 解析 Start Menu .lnk
      const psScript = `
$paths = @(
  [Environment]::GetFolderPath('CommonStartMenu') + '\\Programs',
  [Environment]::GetFolderPath('StartMenu') + '\\Programs'
)
$wsh = New-Object -ComObject WScript.Shell
$seen = @{}
foreach ($p in $paths) {
  if (-not (Test-Path $p)) { continue }
  Get-ChildItem -Path $p -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $target = $wsh.CreateShortcut($_.FullName).TargetPath
      if ($target -and (Test-Path $target) -and ($target -match '\\.(exe|bat|cmd)$') -and -not $seen.ContainsKey($_.BaseName)) {
        $seen[$_.BaseName] = $target
        Write-Output "$($_.BaseName)|$target"
      }
    } catch {}
  }
}
`.trim();
      try {
        const tmpDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'yumatrix-'));
        const tmpFile = path.join(tmpDir, 'scan.ps1');
        fs.writeFileSync(tmpFile, psScript, 'utf-8');
        const output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, {
          encoding: 'utf-8', timeout: 20000, windowsHide: true
        });
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
        const apps = parseAppOutput(output);
        return { success: true, apps };
      } catch (err) {
        console.error('[AppLauncher] Win scan failed:', err.message);
        return { success: false, error: err.message, apps: [] };
      }
    } else if (isDarwin) {
      // macOS: mdfind Spotlight query for .app bundles
      try {
        const output = execSync(
          `mdfind 'kMDItemKind == "Application"' -onlyin /Applications -onlyin /System/Applications -onlyin ~/Applications 2>/dev/null; mdfind 'kMDItemKind == "Application"' -onlyin /Applications 2>/dev/null`,
          { encoding: 'utf-8', timeout: 15000 }
        );
        const seen = new Set();
        const apps = output
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const appPath = line.trim();
            const name = path.basename(appPath, '.app');
            if (!name || seen.has(name)) return null;
            seen.add(name);
            return {
              id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              name,
              path: appPath,
              cat: guessAppCategory(name),
            };
          })
          .filter(Boolean);
        return { success: true, apps };
      } catch (err) {
        console.error('[AppLauncher] Mac scan failed:', err.message);
        return { success: false, error: err.message, apps: [] };
      }
    }
    return { success: false, error: 'unsupported platform', apps: [] };
  });

  function parseAppOutput(output) {
    return output
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const idx = line.indexOf('|');
        if (idx === -1) return null;
        const name = line.slice(0, idx).trim();
        const targetPath = line.slice(idx + 1).trim();
        if (!name || !targetPath) return null;
        return {
          id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          name,
          path: targetPath,
          cat: guessAppCategory(name),
        };
      })
      .filter(Boolean);
  }

  // ═══════════════════════════════════════════════════════════
  // 应用坞：启动应用或聚焦已运行窗口
  // ═══════════════════════════════════════════════════════════
  ipcMain.handle('launch-or-focus-app', async (_event, { name, path: appPath }) => {
    if (isWin32) {
      if (!appPath || !fs.existsSync(appPath)) {
        return { success: false, error: `未找到 ${name} 的可执行文件` };
      }
      const exeName = path.basename(appPath, path.extname(appPath));
      // 校验 exeName 仅含安全字符，防止命令注入
      if (!/^[a-zA-Z0-9._\- ]+$/.test(exeName)) {
        return { success: false, error: `应用名包含非法字符: ${exeName}` };
      }
      // 尝试聚焦已运行的窗口
      try {
        const focusScript = `
$p = Get-Process -Name '${exeName}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($p) {
  Add-Type -Name W32F -Namespace TMP -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);'
  $h = $p.MainWindowHandle
  if ([TMP.W32F]::IsIconic($h)) { [TMP.W32F]::ShowWindow($h, 9) | Out-Null }
  [TMP.W32F]::SetForegroundWindow($h) | Out-Null
  Write-Output 'focused'
} else {
  Write-Output 'not-found'
}
`.trim();
        const tmpDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'yumatrix-'));
        const tmpFile = path.join(tmpDir, 'focus.ps1');
        fs.writeFileSync(tmpFile, focusScript, 'utf-8');
        const result = await new Promise((resolve, reject) => {
          execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], {
            encoding: 'utf-8', timeout: 8000, windowsHide: true
          }, (err, stdout) => err ? reject(err) : resolve(stdout));
        });
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
        if (result.trim() === 'focused') return { success: true, action: 'focused', name };
      } catch (e) { /* 聚焦失败，降级为启动新实例 */ }
      shell.openPath(appPath);
      return { success: true, action: 'launched', name };
    } else if (isDarwin) {
      const appName = path.basename(String(appPath), '.app');
      // 校验 appName 防止 osascript 注入
      if (!/^[a-zA-Z0-9._\- ]+$/.test(appName)) {
        return { success: false, error: `应用名包含非法字符: ${appName}` };
      }
      // 尝试聚焦已运行的窗口
      try {
        await new Promise((resolve, reject) => {
          execFile('osascript', ['-e', `tell application "${appName}" to activate`], {
            encoding: 'utf-8', timeout: 5000
          }, (err, stdout) => err ? reject(err) : resolve(stdout));
        });
        return { success: true, action: 'focused', name };
      } catch (e) {
        // 未运行则启动
        try {
          shell.openPath(appPath);
          return { success: true, action: 'launched', name };
        } catch (e2) {
          return { success: false, error: e2.message };
        }
      }
    }
    // 其他平台：降级为 openPath
    if (appPath && fs.existsSync(appPath)) {
      shell.openPath(appPath);
      return { success: true, action: 'launched', name };
    }
    return { success: false, error: `未找到 ${name}` };
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
  stopTLSProxy();
  closeAllEmailConnections().catch(() => {});
  closeEmailBrowser().catch(() => {});
  try {
    if (process.platform === 'win32') {
      execSync(
        `wmic process where "name='chrome.exe' and (CommandLine like '%playwright_profiles%' or CommandLine like '%chrome_data_%')" call terminate`,
        { stdio: 'ignore' }
      );
    } else if (process.platform === 'darwin') {
      execSync(
        `pkill -f 'playwright_profiles|chrome_data_' 2>/dev/null; pkill -f 'Chromium.*playwright' 2>/dev/null`,
        { stdio: 'ignore' }
      );
    }
  } catch (e) {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})