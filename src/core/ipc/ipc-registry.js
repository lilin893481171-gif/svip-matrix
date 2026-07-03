/**
 * @file src/core/ipc/ipc-registry.js
 * @description IPC 注册表 - 通道白名单和处理器注册
 */

// IPC 通道白名单
export const IPC_CHANNELS = {
  // 数据库相关
  DB_GET_ACCOUNTS: 'db-get-accounts',
  DB_ADD_ACCOUNT: 'db-add-account',
  DB_UPDATE_ACCOUNT_ALIAS: 'db-update-account-alias',
  DB_UPDATE_ACCOUNT_STATS: 'db-update-account-stats',
  DB_DELETE_ACCOUNT: 'db-delete-account',
  DB_UPDATE_ACCOUNT_GROUP: 'db-update-account-group',
  GET_ACCOUNT_DATA_HISTORY: 'get-account-data-history',

  // 账号会话
  OPEN_ACCOUNT_SESSION: 'open-account-session',
  CLOSE_ACCOUNT_SESSION: 'close-account-session',
  CLEAR_ACCOUNT_SESSION_DATA: 'clear-account-session-data',
  IMPORT_ACCOUNT_COOKIE: 'import-account-cookie',
  AUTO_BIND_ACCOUNT: 'auto-bind-account',
  GET_ACCOUNT_LIST: 'get-account-list',
  CHECK_ACCOUNT_STATUS: 'check-account-status',

  // 数据统计
  GET_DASHBOARD_STATS: 'get-dashboard-stats',
  GET_GLOBAL_STATS: 'get-global-stats',
  GET_RISK_STATS: 'get-risk-stats',
  SYNC_ACCOUNT_STATS: 'sync-account-stats',
  SYNC_ACCOUNT_STATS_ALL: 'sync-account-stats-all',
  SYNC_30_DAYS_DATA: 'sync-30days-data',

  // AI 相关
  LLM_REQUEST: 'llm-request',

  // RPA 发布
  EXECUTE_AUTO_PUBLISH: 'execute-auto-publish',
  RETRY_PUBLISH: 'retry-publish',
  GET_TASK_STATS: 'get-task-stats',
  GET_SYSTEM_INFO: 'get-system-info',
  CLEAR_TASK_QUEUE: 'clear-task-queue',
  CANCEL_PUBLISH_TASK: 'cancel-publish-task',
  TAKEOVER_PUBLISH_TASK: 'takeover-publish-task',
  EMERGENCY_STOP_ALL: 'emergency-stop-all',
  COMPLETE_MANUAL_PUBLISH: 'complete-manual-publish',
  CONTINUE_AFTER_MANUAL_STEP: 'continue-after-manual-step',
  FORCE_CLOSE_MANUAL_PUBLISH: 'force-close-manual-publish',
  PAUSE_TASK_QUEUE: 'pause-task-queue',
  RESUME_TASK_QUEUE: 'resume-task-queue',
  CANCEL_TASK: 'cancel-task',
  RECONNECT_TASK_MONITOR: 'reconnect-task-monitor',
  ATTACH_ROBOT_VIEW: 'attach-robot-view',
  DETACH_ROBOT_VIEW: 'detach-robot-view',
  VERIFY_RPA_ARMOR: 'verify-rpa-armor',

  // 浏览器控制
  ATTACH_ACCOUNT_BROWSER: 'attach-account-browser',
  DETACH_ACCOUNT_BROWSER: 'detach-account-browser',
  NAVIGATE_ACCOUNT_BROWSER: 'navigate-account-browser',
  GET_ACCOUNT_BROWSER_URL: 'get-account-browser-url',
  ACCOUNT_BROWSER_GO_BACK: 'account-browser-go-back',
  ACCOUNT_BROWSER_GO_FORWARD: 'account-browser-go-forward',
  ACCOUNT_BROWSER_RELOAD: 'account-browser-reload',
  ACCOUNT_BROWSER_STOP: 'account-browser-stop',
  GET_ACTIVE_SESSIONS: 'get-active-sessions',
  OPEN_ACCOUNT_BROWSER_DEVTOOLS: 'open-account-browser-devtools',

  // 文件操作
  SELECT_LOCAL_VIDEOS: 'select-local-videos',
  SELECT_FOLDER: 'select-folder',
  SCAN_MEDIA_FOLDER: 'scan-media-folder',
  SAVE_TEMP_COVER: 'save-temp-cover',

  // 身份提取
  IDENTITY_EXTRACT_SESSION: 'identity:extract-session',
  IDENTITY_REQUEST_EXTRACT: 'identity:request-extract',

  // 系统操作
  SCAN_INSTALLED_APPS: 'scan-installed-apps',
  LAUNCH_OR_FOCUS_APP: 'launch-or-focus-app',
  SHOW_TOAST: 'show-toast',

  // R2 上传
  R2_UPLOAD_FILE: 'r2-upload-file',

  // 邮件系统
  EMAIL_ACCOUNTS_GET: 'email-accounts-get',
  EMAIL_ACCOUNTS_ADD: 'email-accounts-add',
  EMAIL_ACCOUNTS_REMOVE: 'email-accounts-remove',
  EMAIL_ACCOUNTS_TEST: 'email-accounts-test',
  EMAIL_ACCOUNTS_UPDATE: 'email-accounts-update',
  EMAIL_INBOX_FETCH: 'email-inbox-fetch',
  EMAIL_MESSAGES_CACHED: 'email-messages-cached',
  EMAIL_MESSAGE_GET: 'email-message-get',
  EMAIL_FOLDERS_LIST: 'email-folders-list',
  EMAIL_MARK_READ: 'email-mark-read',
  EMAIL_MARK_UNREAD: 'email-mark-unread',
  EMAIL_TOGGLE_STAR: 'email-toggle-star',
  EMAIL_DELETE: 'email-delete',
  EMAIL_SEND: 'email-send',
  EMAIL_SELECT_ATTACHMENTS: 'email-select-attachments',
  EMAIL_IDLE_START: 'email-idle-start',
  EMAIL_IDLE_STOP: 'email-idle-stop',

  // 邮件悬浮浏览器
  EMAIL_BROWSER_OPEN: 'email-browser-open',
  EMAIL_BROWSER_CLOSE: 'email-browser-close',
  EMAIL_BROWSER_GET_STATE: 'email-browser-get-state'
};

// 通道权限分类
export const IPC_CHANNEL_PERMISSIONS = {
  // 只能从主进程调用的通道
  MAIN_PROCESS_ONLY: new Set([
    // 这些通道应该只在主进程中使用，不应该暴露给渲染进程
  ]),

  // 需要认证的通道
  AUTH_REQUIRED: new Set([
    // 需要用户认证的敏感操作
    IPC_CHANNELS.DB_DELETE_ACCOUNT,
    IPC_CHANNELS.IMPORT_ACCOUNT_COOKIE,
    IPC_CHANNELS.AUTO_BIND_ACCOUNT,
    IPC_CHANNELS.EMAIL_ACCOUNTS_ADD,
    IPC_CHANNELS.EMAIL_ACCOUNTS_REMOVE,
    IPC_CHANNELS.EMAIL_SEND
  ]),

  // 公开通道
  PUBLIC: new Set([
    // 可以公开访问的通道
    IPC_CHANNELS.GET_DASHBOARD_STATS,
    IPC_CHANNELS.GET_GLOBAL_STATS,
    IPC_CHANNELS.GET_RISK_STATS,
    IPC_CHANNELS.GET_ACCOUNT_LIST,
    IPC_CHANNELS.GET_ACCOUNT_DATA_HISTORY,
    IPC_CHANNELS.SELECT_LOCAL_VIDEOS,
    IPC_CHANNELS.SELECT_FOLDER,
    IPC_CHANNELS.SCAN_MEDIA_FOLDER,
    IPC_CHANNELS.SCAN_INSTALLED_APPS
  ])
};

// 通道验证规则
export const IPC_CHANNEL_VALIDATION = {
  [IPC_CHANNELS.DB_ADD_ACCOUNT]: {
    required: ['alias', 'platform'],
    optional: ['group', 'customUrl']
  },
  [IPC_CHANNELS.DB_UPDATE_ACCOUNT_ALIAS]: {
    required: ['id', 'newAlias']
  },
  [IPC_CHANNELS.DB_UPDATE_ACCOUNT_STATS]: {
    required: ['id'],
    optional: ['followers', 'following', 'posts', 'total_views', 'real_name', 'username', 'user_id', 'avatar']
  },
  [IPC_CHANNELS.DB_DELETE_ACCOUNT]: {
    required: ['id']
  },
  [IPC_CHANNELS.DB_UPDATE_ACCOUNT_GROUP]: {
    required: ['id', 'newGroup']
  },
  [IPC_CHANNELS.GET_ACCOUNT_DATA_HISTORY]: {
    required: ['accountId', 'platform']
  },
  [IPC_CHANNELS.OPEN_ACCOUNT_SESSION]: {
    required: ['platform', 'accountId'],
    optional: ['customUrl']
  },
  [IPC_CHANNELS.CLOSE_ACCOUNT_SESSION]: {
    required: ['accountId']
  },
  [IPC_CHANNELS.CLEAR_ACCOUNT_SESSION_DATA]: {
    required: ['accountId']
  },
  [IPC_CHANNELS.IMPORT_ACCOUNT_COOKIE]: {
    required: ['platform', 'cookieStr']
  },
  [IPC_CHANNELS.AUTO_BIND_ACCOUNT]: {
    required: ['platform']
  },
  [IPC_CHANNELS.CHECK_ACCOUNT_STATUS]: {
    required: ['accountId', 'platform']
  },
  [IPC_CHANNELS.SYNC_ACCOUNT_STATS]: {
    required: ['accountId', 'platform']
  },
  [IPC_CHANNELS.LLM_REQUEST]: {
    required: ['url', 'options']
  },
  [IPC_CHANNELS.SELECT_LOCAL_VIDEOS]: {
    // 无参数
  },
  [IPC_CHANNELS.SELECT_FOLDER]: {
    // 无参数
  },
  [IPC_CHANNELS.SCAN_MEDIA_FOLDER]: {
    required: ['folderPath']
  },
  [IPC_CHANNELS.SAVE_TEMP_COVER]: {
    required: ['base64Data']
  },
  [IPC_CHANNELS.IDENTITY_EXTRACT_SESSION]: {
    required: ['accountId', 'webContentsId']
  },
  [IPC_CHANNELS.LAUNCH_OR_FOCUS_APP]: {
    required: ['name', 'path']
  },
  [IPC_CHANNELS.R2_UPLOAD_FILE]: {
    required: ['filePath', 'putUrl', 'filename']
  },
  [IPC_CHANNELS.EMAIL_ACCOUNTS_ADD]: {
    required: ['email', 'password', 'provider'],
    optional: ['displayName', 'smtpHost', 'smtpPort', 'imapHost', 'imapPort']
  },
  [IPC_CHANNELS.EMAIL_ACCOUNTS_REMOVE]: {
    required: ['accountId']
  },
  [IPC_CHANNELS.EMAIL_ACCOUNTS_TEST]: {
    required: ['accountId']
  },
  [IPC_CHANNELS.EMAIL_ACCOUNTS_UPDATE]: {
    required: ['accountId'],
    optional: ['displayName', 'isActive']
  },
  [IPC_CHANNELS.EMAIL_INBOX_FETCH]: {
    required: ['accountId'],
    optional: ['folder', 'limit']
  },
  [IPC_CHANNELS.EMAIL_MESSAGE_GET]: {
    required: ['accountId', 'uid', 'folder']
  },
  [IPC_CHANNELS.EMAIL_MARK_READ]: {
    required: ['accountId', 'uid', 'folder']
  },
  [IPC_CHANNELS.EMAIL_MARK_UNREAD]: {
    required: ['accountId', 'uid', 'folder']
  },
  [IPC_CHANNELS.EMAIL_TOGGLE_STAR]: {
    required: ['accountId', 'uid', 'folder', 'starred']
  },
  [IPC_CHANNELS.EMAIL_DELETE]: {
    required: ['accountId', 'uid', 'folder']
  },
  [IPC_CHANNELS.EMAIL_SEND]: {
    required: ['accountId', 'to', 'subject', 'bodyHtml'],
    optional: ['cc', 'attachments']
  },
  [IPC_CHANNELS.EMAIL_IDLE_START]: {
    required: ['accountId']
  },
  [IPC_CHANNELS.EMAIL_IDLE_STOP]: {
    required: ['accountId']
  },
  [IPC_CHANNELS.EMAIL_BROWSER_OPEN]: {
    required: ['url']
  }
};