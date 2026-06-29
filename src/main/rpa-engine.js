/**
 * @file rpa-engine.js
 * RPA 发布引擎 v3 — 生产级任务调度
 *
 * v3 改进:
 *   - CancelToken 同步中断检查 (wasCancelled)
 *   - 状态机: PENDING → STARTING → RUNNING → SUCCESS / FAILED / CANCELLED / MANUAL
 *   - 心跳巡检: Executor 每 5s ping, Manager 每 10s 扫描, 30s 超时 → 强制终止
 *   - 取消默认 = force-kill (立即销毁 BrowserView, 释放锁)
 *   - 手动接管 = opt-in (takeover-publish-task IPC)
 *   - 平台锁 traceable: Map<"accountId|platform", historyId>
 *   - 启动清理幽灵锁 + 孤立 BrowserView
 *   - 硬超时 30 分钟
 */
import { BrowserWindow, ipcMain } from 'electron';
import os from 'os';
import { loadPendingTasks, clearPendingTasks, addTaskToQueue, removeTaskFromQueue } from './startup-task-manager.mjs';

import { BrowserController } from './rpa/browser-controller.js';
import { ScriptManager } from './rpa/script-manager.js';
import { runRPASelfTest } from './rpa/self-test.js';
import { getDB } from './database.js';
import { closeEmbeddedAccountBrowser, getSessionByAccountId } from './account-browser-manager.js';
import { extractSessionIdentity } from './session-store.js';
import { executePublishTask } from './Publisher.js';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// ==========================================
// 0. CancelToken — 同步中断检查
// ==========================================
class CancelToken {
  #cancelled = false;
  #reason = '';

  cancel(reason = '用户终止') {
    if (this.#cancelled) return;
    this.#cancelled = true;
    this.#reason = reason;
  }

  wasCancelled() { return this.#cancelled; }
  get reason() { return this.#reason; }
}

// ==========================================
// 1. 核心配置
// ==========================================
function detectConcurrencyLimit() {
  const cpuCores = os.cpus().length;
  const totalMemGB = os.totalmem() / (1024 ** 3);
  const freeMemGB = os.freemem() / (1024 ** 3);
  const memSlots = Math.floor((totalMemGB - 1) / 0.2);
  const cpuSlots = Math.floor(cpuCores * 0.5);
  const limit = Math.max(2, Math.min(5, memSlots, cpuSlots));
  console.log(
    `[AutoScale] CPU: ${cpuCores}核 | 内存: ${totalMemGB.toFixed(1)}GB (可用 ${freeMemGB.toFixed(1)}GB) ` +
    `→ 并发上限: ${limit} (memSlots=${memSlots}, cpuSlots=${cpuSlots})`
  );
  return { limit, cpuCores, totalMemGB, freeMemGB, memSlots, cpuSlots };
}

const SYSTEM_INFO = detectConcurrencyLimit();

const CONFIG = {
  CONCURRENCY_LIMIT: SYSTEM_INFO.limit,
  HEARTBEAT_INTERVAL: 5_000,
  HEARTBEAT_TIMEOUT: 30_000,
  HARD_TIMEOUT: 30 * 60_000,
};

const getUrl = (b64) => Buffer.from(b64, 'base64').toString('utf-8');

export const PLATFORM_URLS = {
  '抖音': getUrl('aHR0cHM6Ly9jcmVhdG9yLmRvdXlpbi5jb20vY3JlYXRvci1taWNyby9ob21l'),
  '快手': getUrl('aHR0cHM6Ly9jcC5rdWFpc2hvdS5jb20vcHJvZmlsZQ=='),
  '微信视频号': getUrl('aHR0cHM6Ly9jaGFubmVscy53ZWl4aW4ucXEuY29tL3BsYXRmb3Jt'),
  'B站': getUrl('aHR0cHM6Ly9tZW1iZXIuYmlsaWJpbGkuY29tL3BsYXRmb3JtL3VwbG9hZC92aWRlby9mcmFtZQ=='),
  '小红书': getUrl('aHR0cHM6Ly9jcmVhdG9yLnhpYW9ob25nc2h1LmNvbS9uZXcvaG9tZQ=='),
  '百家号': getUrl('aHR0cHM6Ly9iYWlqaWFoYW8uYmFpZHUuY29tL2J1aWxkZXIvcmMvaG9tZQ==')
};

export const PLATFORM_HOME_URLS = { ...PLATFORM_URLS };

export let currentBrowserController = null;

export function resizeCurrentBrowserView(margin) {
  if (currentBrowserController && currentBrowserController.view && !currentBrowserController.view.webContents?.isDestroyed()) {
    currentBrowserController.resizeForDebugPanel(margin);
  }
}

// ==========================================
// 2. 广播 — 节流 500ms, 终端状态即时
// ==========================================
let _broadcastTimer = null;
let _lastBroadcastPayload = null;
const TERMINAL_STATUSES = ['任务圆满成功', '任务成功', '任务失败', '任务已取消'];

function _flushBroadcast() {
  if (_broadcastTimer) { clearTimeout(_broadcastTimer); _broadcastTimer = null; }
  const payload = _lastBroadcastPayload;
  if (!payload) return;
  _lastBroadcastPayload = null;
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    try {
      if (win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('task-progress-update', payload);
      }
    } catch {}
  }
}

const broadcastProgress = (taskId, historyId, videoId, status, details = {}) => {
  const payload = { taskId, historyId, videoId, status, timestamp: Date.now(), ...details };
  _lastBroadcastPayload = payload;
  const isTerminal = TERMINAL_STATUSES.some(s => status.includes(s));
  if (isTerminal) { _flushBroadcast(); return; }
  if (_broadcastTimer) clearTimeout(_broadcastTimer);
  _broadcastTimer = setTimeout(_flushBroadcast, 500);
};

/**
 * v3 sleep: 接受 cancelToken，被取消时立即 throw
 */
const sleep = (ms, cancelToken = null, wc = null) => {
  const jitter = ms * 0.1;
  const finalMs = ms + (Math.random() * jitter * 2 - jitter);
  return new Promise((resolve, reject) => {
    if (cancelToken?.wasCancelled()) return reject(new Error('CANCELLED'));
    const timer = setTimeout(() => {
      if (cancelToken?.wasCancelled()) return reject(new Error('CANCELLED'));
      resolve();
    }, finalMs);
    if (wc && !wc.isDestroyed()) {
      wc.once('destroyed', () => { clearTimeout(timer); reject(new Error('浏览器强制中断')); });
    }
  });
};

// ==========================================
// 3. TaskExecutor v3 — 状态机 + 心跳 + force-kill
// ==========================================
const ExecutorState = Object.freeze({
  PENDING: 'PENDING',
  STARTING: 'STARTING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  MANUAL: 'MANUAL',
});

class TaskExecutor {
  constructor(task) {
    this.task = task;
    this.browserController = new BrowserController(task.accountId);
    this.cancelToken = new CancelToken();
    this.state = ExecutorState.PENDING;
    this.startTime = Date.now();
    this.lastHeartbeat = Date.now();
    this._hbTimer = null;
    this._manualTakeover = false;
    this._manualStepResolve = null;
  }

  _startHeartbeat() {
    this._hbTimer = setInterval(() => { this.lastHeartbeat = Date.now(); }, CONFIG.HEARTBEAT_INTERVAL);
  }

  _stopHeartbeat() {
    if (this._hbTimer) { clearInterval(this._hbTimer); this._hbTimer = null; }
  }

  get heartbeatAge() { return Date.now() - this.lastHeartbeat; }

  async forceKill(reason) {
    if (this.state === ExecutorState.CANCELLED || this.state === ExecutorState.SUCCESS) return;
    this.cancelToken.cancel(reason);
    this.state = ExecutorState.CANCELLED;
    this._stopHeartbeat();
    try { await this.browserController.terminate(); } catch (e) {
      console.warn('[TaskExecutor] forceKill terminate() 失败:', e.message);
    }
  }

  async run() {
    const { taskId, historyId, videoId, platform } = this.task;
    const ct = this.cancelToken;

    let wc = null;
    let interactions = null;

    try {
      this.state = ExecutorState.STARTING;
      this._startHeartbeat();

      if (ct.wasCancelled()) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
        return;
      }

      broadcastProgress(taskId, historyId, videoId, '启动发布会话容器...', { startTime: this.startTime });
      const result = await this.browserController.launch({ isTestRun: !!this.task.isTest }); // ✨ PASS isTest FLAG
      wc = result.webContents;
      interactions = result.interactions;

      if (ct.wasCancelled()) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
        return;
      }

      // v17 排毒清理: 拦截器注入链路已移除，RPA 发布现在使用纯 CDP 直注 + 原生 XHR 协议发包

      if (platform === 'B站') {
        broadcastProgress(taskId, historyId, videoId, '🧹 无痕重置: 核弹清理残留草稿...', {
          statusType: 'uploading', startTime: this.startTime
        });
        try {
          await wc.loadURL('https://member.bilibili.com');
          await sleep(3000, ct, wc).catch(() => {});
          await wc.session.clearStorageData({
            origin: 'https://member.bilibili.com',
            storages: ['localstorage', 'sessionstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage', 'filesystems'],
            quotas: ['temporary', 'persistent', 'syncable'],
          });
          await sleep(500, ct, wc).catch(() => {});
          await wc.executeJavaScript(`
            (() => {
              localStorage.clear(); sessionStorage.clear();
              try { if (typeof indexedDB !== 'undefined' && indexedDB.databases) { indexedDB.databases().then(dbs => { dbs.forEach(db => indexedDB.deleteDatabase(db.name)); }).catch(() => {}); } } catch (_) {}
            })()
          `);
          await sleep(500, ct, wc).catch(() => {});
          await wc.loadURL('https://member.bilibili.com');
          await sleep(3000, ct, wc).catch(() => {});
        } catch (e) {
          console.warn('[StateReset] 核弹清理失败:', e.message);
        }
      }

      const targetUrl = PLATFORM_URLS[platform];
      await interactions.navigate(targetUrl);
      await sleep(4000, ct, wc).catch(() => {});

      if (ct.wasCancelled()) return;
      try {
        const checkNeedsLogin = async () => {
          const currentUrl = wc.getURL();
          return /login|passport|signin|auth|verify/i.test(currentUrl) && !currentUrl.includes(targetUrl.split('/').slice(0, 3).join('/'));
        };

        if (await checkNeedsLogin()) {
          broadcastProgress(taskId, historyId, videoId, '需要重新扫码登录 — 请在弹出的窗口中完成登录', {
            statusType: 'needs_relogin', startTime: this.startTime, platform
          });

          const loginDeadline = Date.now() + 5 * 60 * 1000; // 5 minute timeout
          let loggedIn = false;

          while (Date.now() < loginDeadline) {
            if (ct.wasCancelled()) throw new Error('CANCELLED');

            await sleep(3000, ct, wc); // Wait 3 seconds before checking again

            if (!(await checkNeedsLogin())) {
              loggedIn = true;
              broadcastProgress(taskId, historyId, videoId, '✅ 登录成功，继续执行任务...', { statusType: 'running' });
              await sleep(4000, ct, wc); // Wait for page to settle after redirect
              break;
            }
          }

          if (!loggedIn) {
            throw new Error('登录超时 (5分钟)');
          }
        }
      } catch (e) {
        if (e.message === 'CANCELLED') throw e;
        console.warn('[TaskExecutor] 登录态检测失败:', e.message);
      }

      this.state = ExecutorState.RUNNING;

      const broadcast = (s) => {
        if (ct.wasCancelled()) return;
        broadcastProgress(taskId, historyId, videoId, s, { startTime: this.startTime });
      };

      const api = {
        interactions,
        task: this.task,
        wc,
        broadcast,
        sleep: (ms) => sleep(ms, ct, wc),
        abortSignal: null,
        cancelToken: ct,
        scheduled: this.task.scheduled || false,
        scheduleTime: this.task.scheduleTime || '',

        // ✨ v17 新增：Cookie 透传 - 支持各平台 API 发布模式
        getCookieString: async () => {
          try {
            const accountId = String(this.task.accountId || this.task.platform || 'unknown');
            const ua = await wc.getUserAgent().catch(() => DEFAULT_UA);
            const identity = await extractSessionIdentity(wc.session, accountId, ua);
            return identity.cookies || '';
          } catch (e) {
            console.warn('[getCookieString] 提取失败:', e.message);
            return '';
          }
        },

        injectInterceptor: async (taskData) => {
          return this.browserController.injectInterceptor(taskData || this.task);
        },

        pauseForManualStep: (stepName, reason) => {
          if (ct.wasCancelled()) return Promise.resolve('cancelled');
          this._manualTakeover = true;
          this.state = ExecutorState.MANUAL;
          taskManager.manualTakeovers.set(historyId, this);
          broadcastProgress(taskId, historyId, videoId, `⚠️ 需要手动处理: ${stepName}`, {
            statusType: 'step_needs_manual', stepName, reason, startTime: this.startTime, platform
          });
          return new Promise((resolve) => {
            this._manualStepResolve = (action) => {
              if (action === 'continue') {
                this.state = ExecutorState.RUNNING;
                broadcastProgress(taskId, historyId, videoId, `继续执行: ${stepName}`, {
                  statusType: 'step_manual_done', startTime: this.startTime
                });
              }
              resolve(action);
            };
          });
        },

        executePublisherTask: async (finalPayload, requestUrl, wc) => {
          try {
            const accountId = String(this.task.accountId || this.task.platform || 'bilibili');
            let identity = null;
            try {
              const sessionData = getSessionByAccountId(accountId);
              if (sessionData?.identity?.biliJct && sessionData?.identity?.cookies) {
                identity = sessionData.identity;
              }
            } catch (_) {}
            if (!identity) {
              let ua = DEFAULT_UA;
              try { ua = wc.getUserAgent() || ua; } catch (_) {}
              identity = await extractSessionIdentity(wc.session, accountId, ua);
            }
            const cookieStr = identity.cookies || '';
            const biliJct = identity.biliJct || '';
            const finalUa = (identity.ua && identity.ua !== 'unknown') ? identity.ua : DEFAULT_UA;
            if (biliJct && !requestUrl.includes(`csrf=${encodeURIComponent(biliJct)}`)) {
              const urlObj = new URL(requestUrl);
              urlObj.searchParams.set('csrf', biliJct);
              requestUrl = urlObj.toString();
            }
            broadcastProgress(taskId, historyId, videoId, '🔥 协议发射中...', {
              statusType: 'publishing', startTime: this.startTime
            });
            return await executePublishTask(this.task, finalPayload, requestUrl, cookieStr, {
              timeout: 30_000,
              extraHeaders: {
                'User-Agent': finalUa,
                Referer: 'https://member.bilibili.com/platform/upload/video/frame',
              },
            });
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
      };

      try {
        const { TaskStatusManager } = await import('./rpa/task-status-manager.js');
        const statusManager = new TaskStatusManager(this.task.taskId, platform);
        statusManager.onStatusChange((statusUpdate) => {
          if (ct.wasCancelled()) return;
          broadcast(statusUpdate.message);
          broadcastProgress(taskId, historyId, videoId, statusUpdate.status, {
            message: statusUpdate.message, timestamp: statusUpdate.timestamp,
            elapsed: statusUpdate.elapsed, totalMessages: statusUpdate.totalMessages,
            startTime: this.startTime
          });
        });
        api.statusManager = statusManager;
      } catch (e) {
        console.warn(`[TaskExecutor] 状态管理器加载失败: ${e.message}`);
      }

      if (ct.wasCancelled()) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
        return;
      }

      console.log('[TaskExecutor] coverPath =', JSON.stringify(this.task.coverPath),
        'videoPath =', JSON.stringify(this.task.videoPath),
        'scheduled =', this.task.scheduled,
        'title =', JSON.stringify(this.task.title),
        'tags =', JSON.stringify(this.task.tags));

      await ScriptManager.executePlatform(platform, api);

      if (!ct.wasCancelled()) {
        this.state = ExecutorState.SUCCESS;
        broadcastProgress(taskId, historyId, videoId, '任务圆满成功', {
          statusType: 'success', startTime: this.startTime, endTime: Date.now()
        });
      }
    } catch (error) {
      if (ct.wasCancelled() || error.message === 'CANCELLED') {
        this.state = ExecutorState.CANCELLED;
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
      } else {
        this.state = ExecutorState.FAILED;
        console.error("\n🔴 [TaskExecutor]:", error, "\n");
        broadcastProgress(taskId, historyId, videoId, '流程受阻: ' + error.message, {
          statusType: 'error', error: error.message, startTime: this.startTime, endTime: Date.now()
        });
        if (wc) await sleep(600000, ct, wc).catch(() => {});
      }
    } finally {
      this._stopHeartbeat();
      if (!this._manualTakeover && this.state !== ExecutorState.MANUAL) {
        await this.browserController.close();
      }
    }
  }
}

// ==========================================
// 4. TaskManager v3 — force-kill 默认 + 心跳巡检 + 启动清理
// ==========================================
class TaskManager {
  constructor() {
    this.queue = [];
    this.running = 0;
    this.executors = new Map();
    this.manualTakeovers = new Map();
    this.platformLocks = new Map();  // "accountId|platform" → historyId
    this._hbMonitor = null;
  }

  _paused = false;
  get paused() { return this._paused; }

  startHeartbeatMonitor() {
    if (this._hbMonitor) return;
    this._hbMonitor = setInterval(() => {
      for (const [historyId, executor] of this.executors) {
        if (executor.state === ExecutorState.MANUAL) continue;
        if (executor.heartbeatAge > CONFIG.HEARTBEAT_TIMEOUT) {
          console.warn(`[TaskManager] 心跳超时 (${executor.heartbeatAge}ms), 强制终止: ${historyId}`);
          this._forceKillExecutor(executor, '心跳超时');
        }
      }
      for (const [historyId, executor] of this.executors) {
        if (executor.state === ExecutorState.MANUAL || executor.state === ExecutorState.CANCELLED) continue;
        if (Date.now() - executor.startTime > CONFIG.HARD_TIMEOUT) {
          console.warn(`[TaskManager] 硬超时 (${CONFIG.HARD_TIMEOUT}ms), 强制终止: ${historyId}`);
          this._forceKillExecutor(executor, '任务超时');
        }
      }
    }, 10_000);
  }

  stopHeartbeatMonitor() {
    if (this._hbMonitor) { clearInterval(this._hbMonitor); this._hbMonitor = null; }
  }

  cleanupOrphanState() {
    console.log('[TaskManager] 启动清理 — 释放所有幽灵锁');
    this.platformLocks.clear();
    this.executors.clear();
    this.manualTakeovers.clear();
    this.running = 0;
    this.queue = [];
  }

  addTask(task) {
    this.queue.push(task);
    // 保存到持久化队列
    addTaskToQueue(task);
    this.processNext();
  }

  async processNext() {
    if (this._paused) return;
    if (this.running >= CONFIG.CONCURRENCY_LIMIT || this.queue.length === 0) return;

    let idx = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const t = this.queue[i];
      const key = `${t.accountId}|${t.platform}`;
      if (!this.platformLocks.has(key)) { idx = i; break; }
    }
    if (idx === -1) return;

    const task = this.queue.splice(idx, 1)[0];
    // 从持久化队列中移除
    removeTaskFromQueue(task.taskId);

    const platformKey = `${task.accountId}|${task.platform}`;
    this.platformLocks.set(platformKey, task.historyId);
    this.running++;

    const executor = new TaskExecutor(task);
    this.executors.set(task.historyId, executor);

    try {
      await executor.run();
    } catch (e) {
      broadcastProgress(task.taskId, task.historyId, task.videoId, '致命崩溃', {
        error: e.message, statusType: 'error', startTime: executor.startTime
      });
    } finally {
      this.executors.delete(task.historyId);
      if (executor.state === ExecutorState.MANUAL) {
        this.running--;
      } else {
        this.platformLocks.delete(platformKey);
        this.running--;
        if (!this._paused) {
          setTimeout(() => this.processNext(), 1500);
        }
      }
    }
  }

  async _forceKillExecutor(executor, reason) {
    const { taskId, historyId, videoId, platform } = executor.task;
    const platformKey = `${executor.task.accountId}|${platform}`;
    await executor.forceKill(reason);
    this.executors.delete(historyId);
    this.manualTakeovers.delete(historyId);
    this.platformLocks.delete(platformKey);
    this.running = Math.max(0, this.running - 1);
    // 从持久化队列中移除
    removeTaskFromQueue(taskId);
    broadcastProgress(taskId, historyId, videoId, '任务已取消', {
      statusType: 'cancelled', startTime: executor.startTime, endTime: Date.now(), reason
    });
    if (!this._paused) {
      setTimeout(() => this.processNext(), 1500);
    }
  }

  getRunningExecutor(historyId) {
    return this.executors.get(historyId) || this.manualTakeovers.get(historyId);
  }

  getStats() {
    return {
      queued: this.queue.length,
      running: this.running,
      paused: this._paused,
      runningPlatforms: [...this.platformLocks.keys()],
      concurrencyLimit: CONFIG.CONCURRENCY_LIMIT
    };
  }

  clearQueue() {
    this.queue = [];
    clearPendingTasks();
  }

  async cancelByHistoryId(historyId, mode = 'force') {
    const executor = this.executors.get(historyId);
    if (executor) {
      if (mode === 'manual_takeover') {
        executor._manualTakeover = true;
        executor.state = ExecutorState.MANUAL;
        this.manualTakeovers.set(historyId, executor);
        executor.cancelToken.cancel('转手动接管');
        broadcastProgress(executor.task.taskId, historyId, executor.task.videoId, '已转手动接管', {
          statusType: 'manual_takeover', startTime: executor.startTime, endTime: Date.now(),
          platform: executor.task.platform
        });
        return { success: true, cancelled: 'running', manualTakeover: true };
      }
      await this._forceKillExecutor(executor, '用户终止');
      return { success: true, cancelled: 'running', forceKilled: true };
    }
    const idx = this.queue.findIndex(t => t.historyId === historyId);
    if (idx !== -1) {
      const removed = this.queue.splice(idx, 1)[0];
      broadcastProgress(removed.taskId, historyId, removed.videoId, '任务已取消', {
        statusType: 'cancelled'
      });
      return { success: true, cancelled: 'queued' };
    }
    const manualExecutor = this.manualTakeovers.get(historyId);
    if (manualExecutor) {
      await this._forceKillExecutor(manualExecutor, '用户终止');
      return { success: true, cancelled: 'manual_takeover', forceKilled: true };
    }
    return { success: false, message: '未找到指定任务' };
  }

  async completeManualPublish(historyId) {
    const executor = this.manualTakeovers.get(historyId);
    if (!executor) return { success: false, message: '未找到手动接管的任务' };

    const { taskId, videoId, platform } = executor.task;
    const platformKey = `${executor.task.accountId}|${platform}`;

    broadcastProgress(taskId, historyId, videoId, '手动发布完成，正在关闭...', {
      statusType: 'manual_done'
    });

    try {
      const wc = executor.browserController.webContents;
      if (wc && !wc.isDestroyed()) {
        await wc.executeJavaScript(`
          (function() {
            return new Promise((resolve) => {
              const patterns = /发布成功|已发布|上传成功|审核中|提交成功|success|published/i;
              const timeout = Date.now() + 30000;
              const check = () => {
                if (document.body.innerText.match(patterns)) return resolve('detected');
                if (Date.now() > timeout) return resolve('timeout');
                setTimeout(check, 1500);
              };
              setTimeout(check, 2000);
            });
          })()
        `).catch(() => {});
        await sleep(3000, null, wc).catch(() => {});
      }
    } catch (e) {
      console.warn('[TaskManager] 发布成功检测失败:', e.message);
    }

    await executor.browserController.terminate();
    this.manualTakeovers.delete(historyId);
    this.platformLocks.delete(platformKey);
    // 从持久化队列中移除
    removeTaskFromQueue(taskId);
    executor.state = ExecutorState.SUCCESS;

    broadcastProgress(taskId, historyId, videoId, '手动发布已完成', {
      statusType: 'success', startTime: executor.startTime, endTime: Date.now()
    });

    if (!this._paused) {
      setTimeout(() => this.processNext(), 1500);
    }
    return { success: true, message: '浏览器已关闭' };
  }

  async emergencyStopAll() {
    const running = [...this.executors.values()];
    const results = [];
    for (const executor of running) {
      try {
        await this._forceKillExecutor(executor, '紧急全部停止');
        results.push({ historyId: executor.task.historyId, ok: true });
      } catch (e) {
        results.push({ historyId: executor.task.historyId, ok: false, error: e.message });
      }
    }
    this.queue = [];
    clearPendingTasks();
    return { success: true, stopped: results.length, details: results };
  }

  pauseQueue() {
    this._paused = true;
    return { success: true, paused: true, stats: this.getStats() };
  }

  resumeQueue() {
    this._paused = false;
    for (let i = 0; i < CONFIG.CONCURRENCY_LIMIT; i++) {
      this.processNext();
    }
    return { success: true, paused: false, stats: this.getStats() };
  }

  cancelTask(taskId) {
    for (const [historyId, executor] of this.executors) {
      if (executor.task.taskId === taskId) {
        return this.cancelByHistoryId(historyId);
      }
    }
    return { success: false, message: '未找到运行中的任务' };
  }
}

const taskManager = new TaskManager();

// ==========================================
// 5. IPC 注册
// ==========================================
export const registerRPAEngineIPC = () => {
  ScriptManager.init();

  taskManager.cleanupOrphanState();
  taskManager.startHeartbeatMonitor();

  // 启动时检查待处理任务
  setTimeout(async () => {
    try {
      const pendingTasks = loadPendingTasks();
      if (pendingTasks.length > 0) {
        console.log(`[RPAEngine] 启动时加载 ${pendingTasks.length} 个待处理任务`);
        for (const task of pendingTasks) {
          taskManager.addTask(task);
        }
        // 清空已加载的任务队列
        clearPendingTasks();
      }
    } catch (error) {
      console.error('[RPAEngine] 启动时加载待处理任务失败:', error.message);
    }
  }, 1000);

  ipcMain.handle('execute-auto-publish', async (event, taskData) => {
    console.log('[execute-auto-publish] scheduled =', taskData.scheduled, 'scheduleTime =', taskData.scheduleTime);
    const taskId = taskData.taskId || `task_${Date.now()}`;
    const task = { ...taskData, taskId };
    taskManager.addTask(task);
    return { success: true, taskId, message: '发布任务已加入队列' };
  });

  ipcMain.handle('retry-publish', async (event, originalTask) => {
    const newHistoryId = `hist_${Date.now()}`;
    const taskId = `task_${Date.now()}`;
    const task = { ...originalTask, historyId: newHistoryId, taskId };
    taskManager.addTask(task);
    return { success: true, taskId, historyId: newHistoryId };
  });

  ipcMain.handle('get-task-stats', () => taskManager.getStats());

  ipcMain.handle('get-system-info', () => ({
    cpuCores: SYSTEM_INFO.cpuCores,
    totalMemGB: +SYSTEM_INFO.totalMemGB.toFixed(1),
    freeMemGB: +SYSTEM_INFO.freeMemGB.toFixed(1),
    concurrencyLimit: SYSTEM_INFO.limit,
    breakdown: {
      memSlots: SYSTEM_INFO.memSlots,
      cpuSlots: SYSTEM_INFO.cpuSlots,
      perBrowserMB: 200,
      reserveGB: 1,
      minLimit: 2,
      maxLimit: 5,
    },
    platform: os.platform(),
    arch: os.arch(),
  }));

  ipcMain.handle('clear-task-queue', () => {
    taskManager.clearQueue();
    return { success: true };
  });

  // v3: 取消 → 默认 force-kill
  ipcMain.handle('cancel-publish-task', async (event, historyId) => {
    return taskManager.cancelByHistoryId(historyId, 'force');
  });

  // v3 新增: 手动接管 (opt-in)
  ipcMain.handle('takeover-publish-task', async (event, historyId) => {
    return taskManager.cancelByHistoryId(historyId, 'manual_takeover');
  });

  // v3 新增: 紧急停止全部
  ipcMain.handle('emergency-stop-all', async () => {
    return taskManager.emergencyStopAll();
  });

  ipcMain.handle('complete-manual-publish', async (event, historyId) => {
    return taskManager.completeManualPublish(historyId);
  });

  ipcMain.handle('continue-after-manual-step', async (event, historyId) => {
    const executor = taskManager.manualTakeovers.get(historyId);
    if (!executor || !executor._manualStepResolve) {
      return { success: false, message: '未找到等待手动操作的步骤' };
    }
    executor._manualStepResolve('continue');
    executor._manualStepResolve = null;
    executor._manualTakeover = false;
    executor.state = ExecutorState.RUNNING;
    taskManager.manualTakeovers.delete(historyId);
    return { success: true };
  });

  ipcMain.handle('force-close-manual-publish', async (event, historyId) => {
    let executor = taskManager.manualTakeovers.get(historyId);
    if (!executor) executor = taskManager.executors.get(historyId);
    if (!executor) return { success: false, message: '未找到接管的任务' };

    const platformKey = `${executor.task.accountId}|${executor.task.platform}`;
    await executor.forceKill('前端强制关闭');
    taskManager.manualTakeovers.delete(historyId);
    taskManager.executors.delete(historyId);
    taskManager.platformLocks.delete(platformKey);
    taskManager.running = Math.max(0, taskManager.running - 1);

    broadcastProgress(executor.task.taskId, historyId, executor.task.videoId, '已取消', {
      statusType: 'cancelled', startTime: executor.startTime, endTime: Date.now()
    });

    if (!taskManager.paused) {
      setTimeout(() => taskManager.processNext(), 1500);
    }
    return { success: true, message: '浏览器已强制关闭' };
  });

  ipcMain.handle('pause-task-queue', () => taskManager.pauseQueue());
  ipcMain.handle('resume-task-queue', () => taskManager.resumeQueue());

  ipcMain.handle('cancel-task', (event, taskId) => taskManager.cancelTask(taskId));

  ipcMain.on('attach-robot-view', (event, { taskId, bounds }) => {
    try {
      const executor = taskManager.getRunningExecutor(taskId);
      if (executor && executor.browserController) {
        executor.browserController.attachToWindow(bounds);
        currentBrowserController = executor.browserController;
      }
    } catch (e) { console.error('[IPC] attach-robot-view:', e.message); }
  });

  ipcMain.on('detach-robot-view', (event) => {
    try {
      if (currentBrowserController) {
        currentBrowserController.detachFromWindow();
        currentBrowserController = null;
      }
    } catch (e) { console.error('[IPC] detach-robot-view:', e.message); }
  });

  ipcMain.handle('verify-rpa-armor', async (_event, accountId) => {
    const bc = new BrowserController(accountId || 'diag_test');
    try {
      const { webContents } = await bc.launch();
      const result = await bc.verifyFingerprint();
      await bc.close();
      return result;
    } catch (e) {
      try { await bc.close(); } catch (e2) {}
      return { ok: false, error: e.message, verdict: '❌ 诊断流程异常: ' + e.message };
    }
  });
};

export { runRPASelfTest, CancelToken, ExecutorState, taskManager };
