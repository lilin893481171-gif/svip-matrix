import { contextBridge, ipcRenderer } from 'electron'

// ═══════════════════════════════════════════════════════
// IPC 通道安全白名单
// ═══════════════════════════════════════════════════════
const ALLOWED_INVOKE = new Set([
  // AI / LLM
  'llm-request',
  // RPA 发布
  'execute-auto-publish', 'retry-publish', 'save-temp-cover',
  'get-task-stats', 'get-system-info', 'clear-task-queue',
  'cancel-publish-task', 'takeover-publish-task', 'emergency-stop-all',
  'complete-manual-publish', 'continue-after-manual-step',
  'force-close-manual-publish', 'pause-task-queue', 'resume-task-queue', 'cancel-task',
  'verify-rpa-armor',
  // 账号 BrowserView（嵌入式浏览器）
  'open-account-session', 'close-account-session', 'clear-account-session-data',
  'navigate-account-browser', 'get-account-browser-url', 'open-account-browser-devtools',
  'get-active-sessions', 'check-account-status',
  'import-account-cookie', 'auto-bind-account',
  // 账号 DB CRUD
  'db-get-accounts', 'db-add-account',
  'db-update-account-alias', 'db-update-account-stats', 'db-update-account-group',
  'db-delete-account', 'get-account-data-history',
  // 数据看板 + 同步
  'get-dashboard-stats', 'get-global-stats', 'get-risk-stats',
  'sync-account-stats', 'sync-account-stats-all', 'sync-30days-data',
  // 互动消息
  'get-messages', 'open-reply-session', 'sync-platform-interactions',
  // 媒体资源 / 本地应用
  'select-local-videos', 'select-folder', 'scan-media-folder',
  'scan-installed-apps', 'launch-or-focus-app',
  // 邮件系统
  'email-accounts-get', 'email-accounts-add', 'email-accounts-remove',
  'email-accounts-test', 'email-accounts-update',
  'email-inbox-fetch', 'email-messages-cached', 'email-message-get',
  'email-folders-list',
  'email-mark-read', 'email-mark-unread', 'email-toggle-star', 'email-delete',
  'email-send', 'email-select-attachments',
  // R2 云盘上传
  'r2-upload-file',
  'email-idle-start', 'email-idle-stop',
  // 邮件悬浮浏览器
  'email-browser-open', 'email-browser-close', 'email-browser-get-state',
  // 🔥 无头发射引擎 (Publisher)
  'publisher-execute',
  // 调试面板 → 主进程: BrowserView 视口管理
  'debug-panel-visibility',
]);

const ALLOWED_SEND = new Set([
  'navigate-url', 'write-clipboard', 'show-toast',
  // 账号 BrowserView 嵌入控制
  'attach-account-browser', 'detach-account-browser',
  'account-browser-go-back', 'account-browser-go-forward',
  'account-browser-reload', 'account-browser-stop',
  // RPA 浏览器机械臂
  'attach-robot-view', 'detach-robot-view',
  // RPA 任务重连
  'reconnect-task-monitor',
]);

const ALLOWED_RECEIVE = new Set([
  'task-progress-update', 'robot-status-update',
  'toast-notification', 'rpa-progress', 'sync-progress',
  // 账号 BrowserView 状态回传
  'account-browser-url-change', 'account-browser-title-change',
  'account-browser-url-changed', 'account-onboarding-data',
  'account-session-opened', 'account-session-closed',
  // 面板快捷键 (主进程 globalShortcut → IPC)
  'hotkey-toggle-protocol-aggregator', 'hotkey-toggle-debug-panel',
  // 邮件系统
  'email-new-message', 'email-sync-progress', 'email-connection-status',
  // 邮件悬浮浏览器
  'email-browser-url-changed', 'email-browser-closed',
  // IPC 注册完成事件
  'ipc-registered',
]);

const electronAPI = {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (!ALLOWED_INVOKE.has(channel)) return Promise.reject(new Error(`IPC 通道未授权: ${channel}`));
      return ipcRenderer.invoke(channel, ...args);
    },
    send: (channel, ...args) => {
      if (!ALLOWED_SEND.has(channel)) throw new Error(`IPC 通道未授权: ${channel}`);
      ipcRenderer.send(channel, ...args);
    },
    on: (channel, listener) => {
      if (!ALLOWED_RECEIVE.has(channel)) return () => {};
      const subscription = (event, ...args) => listener(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    off: (channel, listener) => {
      if (!ALLOWED_RECEIVE.has(channel)) return;
      ipcRenderer.removeListener(channel, (event, ...args) => listener(...args));
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  }
}

// 注入到前端的 window 对象中
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error("[Preload] 桥梁注入失败:", error)
  }
}
