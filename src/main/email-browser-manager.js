/**
 * @file email-browser-manager.js
 * @desc 邮件悬浮浏览器 — 独立 BrowserWindow，支持自由拖拽/最小化/最大化/关闭
 */

import { BrowserWindow, ipcMain } from 'electron';

// ======================================
// 全局状态
// ======================================

let mainWindow = null;
let openWindows = new Set();   // 所有已打开的悬浮窗口
let windowCounter = 0;         // 窗口计数，用于生成唯一分区

function getMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  mainWindow = BrowserWindow.getAllWindows()[0] || null;
  return mainWindow;
}

function pushState(channel, data) {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}

// ======================================
// 悬浮窗口创建与销毁
// ======================================

function openPopupWindow(url) {
  const parent = getMainWindow();
  const parentBounds = parent ? parent.getBounds() : { x: 100, y: 100, width: 1200, height: 800 };

  // 窗口尺寸：比主窗口略小
  const w = Math.min(1280, parentBounds.width);
  const h = Math.min(850, parentBounds.height);

  // 每个新窗口偏移 30px，避免完全重叠
  const offset = (openWindows.size % 8) * 30;
  const x = parentBounds.x + Math.round((parentBounds.width - w) / 2) + offset;
  const y = parentBounds.y + Math.round((parentBounds.height - h) / 2) + offset;

  // 每个窗口独立分区（非持久化），关闭即清除，防止钓鱼链接跨窗口窃取数据
  const partition = `email_popup_${++windowCounter}`;

  const win = new BrowserWindow({
    width: w,
    height: h,
    x: Math.max(0, x),
    y: Math.max(0, y),
    title: '邮件浏览器',
    show: true,
    parent: null,
    modal: false,
    webPreferences: {
      partition,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  openWindows.add(win);

  try {
    win.loadURL(url);
  } catch (e) {
    console.error('[EmailBrowser] loadURL 失败:', e.message);
  }

  // target=_blank 链接 → 在同一窗口导航
  win.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    try { win.loadURL(newUrl); } catch {}
    return { action: 'deny' };
  });

  // 窗口关闭 → 从集合移除
  win.on('closed', () => {
    openWindows.delete(win);
    pushState('email-browser-closed', { openCount: openWindows.size });
  });

  return { success: true, url, openCount: openWindows.size };
}

function closePopupWindow() {
  for (const win of openWindows) {
    try { if (!win.isDestroyed()) win.close(); } catch {}
  }
  openWindows.clear();
}

function getPopupState() {
  return {
    active: openWindows.size > 0,
    openCount: openWindows.size,
  };
}

// ======================================
// IPC 注册
// ======================================

export function registerEmailBrowserIPC() {
  // 打开/导航悬浮窗口
  ipcMain.handle('email-browser-open', async (_e, { url }) => {
    try {
      return openPopupWindow(url);
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  // 关闭悬浮窗口
  ipcMain.handle('email-browser-close', async () => {
    closePopupWindow();
    return { success: true };
  });

  // 查询状态
  ipcMain.handle('email-browser-get-state', async () => getPopupState());
}

export async function closeEmailBrowser() {
  closePopupWindow();
}
