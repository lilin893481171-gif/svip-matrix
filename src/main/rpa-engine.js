/**
 * @file rpa-engine.js
 * RPA 发布引擎入口 — IPC 通信 + TaskManager 调度
 * 会话容器: rpa/browser-controller.js
 * 脚本加载: rpa/script-manager.js (远程 > 内置 > 旧适配器)
 * 自检: rpa/self-test.js
 *
 * 🆕 v2: 并发3 + 同平台互斥 + AbortController 真取消 + 暂停/恢复队列
 */
import { BrowserWindow, ipcMain } from 'electron';
import os from 'os';

import { BrowserController } from './rpa/browser-controller.js';
import { ScriptManager } from './rpa/script-manager.js';
import { runRPASelfTest } from './rpa/self-test.js';
import { getDB } from './database.js';

// ==========================================
// 1. 核心配置与全局变量
// ==========================================
function detectConcurrencyLimit() {
  const cpuCores = os.cpus().length;
  const totalMemGB = os.totalmem() / (1024 ** 3);
  const freeMemGB = os.freemem() / (1024 ** 3);

  // 每个 BrowserView ~200MB，保守留 1GB 给 Electron + 系统开销
  const memSlots = Math.floor((totalMemGB - 1) / 0.2);
  // 每个 BrowserView ~0.5 核心负载
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

// ==========================================
// 2. 基础工具组件
// ==========================================
// ── 广播节流：500ms 内合并中间状态，终端状态即时推送 ──
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

  // 中间状态节流：500ms 合并为一次
  if (_broadcastTimer) clearTimeout(_broadcastTimer);
  _broadcastTimer = setTimeout(_flushBroadcast, 500);
};

const sleep = (ms, wc = null) => {
  const jitter = ms * 0.1;
  const finalMs = ms + (Math.random() * jitter * 2 - jitter);
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, finalMs)),
    ...(wc ? [new Promise((_, reject) => {
      if (wc.isDestroyed()) reject(new Error('浏览器强制中断'));
      else wc.once('destroyed', () => reject(new Error('浏览器强制中断')));
    })] : [])
  ]);
};

// ==========================================
// 3. 生命周期执行器 (TaskExecutor)
// ==========================================
class TaskExecutor {
  constructor(task) {
    this.task = task;
    this.browserController = new BrowserController(task.accountId);
    this.abortController = new AbortController();  // 🆕 取消信号
    this.startTime = Date.now();                    // 🆕 入队时间
    this._manualStepResolve = null;                 // 🆕 步骤失败 → 等待用户手动完成
  }

  async run() {
    const { taskId, historyId, videoId, platform } = this.task;
    const signal = this.abortController.signal;

    let wc = null;
    let interactions = null;
    try {
      // 检查是否已被取消
      if (signal.aborted) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
        return;
      }

      // 🆕 abort 时只中断脚本，保留浏览器供用户手动接管
      signal.addEventListener('abort', () => {
        console.log(`[TaskExecutor] ${taskId} 收到取消信号 — 保留浏览器供手动接管`);
        // 不 close，用户手动操作完毕后通过 complete-manual-publish 关闭
      }, { once: true });

      broadcastProgress(taskId, historyId, videoId, '启动发布会话容器...', { startTime: this.startTime });
      const result = await this.browserController.launch();
      wc = result.webContents;
      interactions = result.interactions;

      // 再次检查取消信号（launch 可能耗时）
      if (signal.aborted) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
        return;
      }

      const targetUrl = PLATFORM_URLS[platform];
      await interactions.navigate(targetUrl);
      await sleep(4000, wc).catch(() => {});

      // 🆕 检测登录态：页面是否跳转到登录页
      if (signal.aborted) return;
      try {
        const currentUrl = wc.getURL();
        const needsLogin = /login|passport|signin|auth|verify/i.test(currentUrl) &&
                           !currentUrl.includes(targetUrl.split('/').slice(0, 3).join('/'));
        if (needsLogin) {
          this._manualTakeover = true;  // 保留浏览器供用户扫码
          taskManager.manualTakeovers.set(historyId, this);
          broadcastProgress(taskId, historyId, videoId, '需要重新扫码登录 — 请点击控制按钮进入实时页面扫码', {
            statusType: 'needs_relogin', startTime: this.startTime, platform
          });
          return;
        }
      } catch (e) {
        console.warn('[TaskExecutor] 登录态检测失败:', e.message);
      }

      const broadcast = (s) => {
        if (signal.aborted) return;
        broadcastProgress(taskId, historyId, videoId, s, { startTime: this.startTime });
      };

      const api = {
        interactions,
        task: this.task,
        wc,
        broadcast,
        sleep: (ms) => sleep(ms, wc),
        abortSignal: signal,  // 🆕 脚本可检查此信号

        // 🆕 步骤验证失败 → 暂停等用户手动完成
        pauseForManualStep: (stepName, reason) => {
          if (signal.aborted) return Promise.resolve('cancelled');
          this._manualTakeover = true;
          taskManager.manualTakeovers.set(historyId, this);
          broadcastProgress(taskId, historyId, videoId, `⚠️ 需要手动处理: ${stepName}`, {
            statusType: 'step_needs_manual',
            stepName,
            reason,
            startTime: this.startTime,
            platform
          });
          return new Promise((resolve) => {
            this._manualStepResolve = (action) => {
              if (action === 'continue') {
                broadcastProgress(taskId, historyId, videoId, `继续执行: ${stepName}`, {
                  statusType: 'step_manual_done',
                  startTime: this.startTime
                });
              }
              resolve(action);
            };
          });
        }
      };

      // 导入状态管理器
      try {
        const { TaskStatusManager } = await import('./rpa/task-status-manager.js');
        const statusManager = new TaskStatusManager(this.task.taskId, platform);

        statusManager.onStatusChange((statusUpdate) => {
          if (signal.aborted) return;
          broadcast(statusUpdate.message);
          broadcastProgress(taskId, historyId, videoId, statusUpdate.status, {
            message: statusUpdate.message,
            timestamp: statusUpdate.timestamp,
            elapsed: statusUpdate.elapsed,
            totalMessages: statusUpdate.totalMessages,
            startTime: this.startTime
          });
        });

        api.statusManager = statusManager;
        console.log(`[TaskExecutor] 状态管理器已注册: ${taskId}`);
      } catch (e) {
        console.warn(`[TaskExecutor] 状态管理器加载失败: ${e.message}`);
      }

      if (signal.aborted) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
        return;
      }

      await ScriptManager.executePlatform(platform, api);

      if (!signal.aborted) {
        broadcastProgress(taskId, historyId, videoId, '任务圆满成功', {
          statusType: 'success', startTime: this.startTime, endTime: Date.now()
        });
      }
    } catch (error) {
      if (signal.aborted) {
        broadcastProgress(taskId, historyId, videoId, '任务已取消', {
          statusType: 'cancelled', startTime: this.startTime
        });
      } else {
        console.error("\n🔴 [底层报错 - TaskExecutor]:", error, "\n");
        broadcastProgress(taskId, historyId, videoId, '流程受阻: ' + error.message, {
          statusType: 'error', error: error.message, startTime: this.startTime, endTime: Date.now()
        });
        if (wc) await sleep(600000, wc).catch(() => {});
      }
    } finally {
      if (!this._manualTakeover) {
        await this.browserController.close();
      }
    }
  }

  /** 🆕 中断当前执行 */
  abort() {
    this.abortController.abort();
  }
}

// ==========================================
// 4. 任务管理器与 IPC (IPC 通信层)
// ==========================================
class TaskManager {
  constructor() {
    this.queue = [];
    this.running = 0;
    this.executors = new Map();           // historyId → TaskExecutor
    this.manualTakeovers = new Map();    // 🆕 historyId → TaskExecutor (手动接管)
    this.runningPlatforms = new Set();    // 🆕 "accountId|platform" 互斥
    this.#paused = false;                 // 🆕 队列暂停
  }

  // 🆕 暂停状态
  #paused = false;

  get paused() { return this.#paused; }

  addTask(task) {
    this.queue.push(task);
    this.processNext();
  }

  async processNext() {
    // 🆕 暂停时不取新任务
    if (this.#paused) return;
    if (this.running >= CONFIG.CONCURRENCY_LIMIT || this.queue.length === 0) return;

    // 🆕 找第一个不与当前运行任务冲突的队列项（同平台互斥）
    let idx = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const t = this.queue[i];
      const key = `${t.accountId}|${t.platform}`;
      if (!this.runningPlatforms.has(key)) { idx = i; break; }
    }
    if (idx === -1) return; // 所有排队任务都与运行中任务冲突，等待

    const task = this.queue.splice(idx, 1)[0];

    const platformKey = `${task.accountId}|${task.platform}`;
    this.runningPlatforms.add(platformKey);
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
      // 🆕 手动接管：保留平台互斥锁，阻止同平台新任务，但释放并发槽位
      if (executor._manualTakeover) {
        // platformKey 保留在 runningPlatforms 中，防止同平台重复执行
        this.running--;
        // 不自动取下一个 — 用户手动关闭后再清理
      } else {
        this.runningPlatforms.delete(platformKey);
        this.running--;
        if (!this.#paused) {
          setTimeout(() => this.processNext(), 1500);
        }
      }
    }
  }

  getRunningExecutor(historyId) {
    return this.executors.get(historyId) || this.manualTakeovers.get(historyId);
  }

  getStats() {
    return {
      queued: this.queue.length,
      running: this.running,
      paused: this.#paused,
      runningPlatforms: [...this.runningPlatforms],
      concurrencyLimit: CONFIG.CONCURRENCY_LIMIT
    };
  }

  clearQueue() {
    this.queue = [];
  }

  /** 🆕 按 historyId 取消 — 中断脚本但保留浏览器供手动接管 */
  cancelByHistoryId(historyId) {
    const executor = this.executors.get(historyId);
    if (executor) {
      executor._manualTakeover = true;  // 标记为手动接管
      this.manualTakeovers.set(historyId, executor);
      executor.abort();
      broadcastProgress(executor.task.taskId, historyId, executor.task.videoId, '已转手动接管', {
        statusType: 'manual_takeover', startTime: executor.startTime, endTime: Date.now(),
        platform: executor.task.platform
      });
      return { success: true, cancelled: 'running', manualTakeover: true };
    }
    // 可能还在队列中
    const idx = this.queue.findIndex(t => t.historyId === historyId);
    if (idx !== -1) {
      const removed = this.queue.splice(idx, 1)[0];
      broadcastProgress(removed.taskId, historyId, removed.videoId, '任务已取消', {
        statusType: 'cancelled'
      });
      return { success: true, cancelled: 'queued' };
    }
    return { success: false, message: '未找到指定任务' };
  }

  /** 🆕 完成手动发布 — 用户手动操作完毕后关闭浏览器 */
  async completeManualPublish(historyId) {
    const executor = this.manualTakeovers.get(historyId);
    if (!executor) {
      return { success: false, message: '未找到手动接管的任务' };
    }

    const { taskId, videoId, platform } = executor.task;
    const platformKey = `${executor.task.accountId}|${platform}`;

    broadcastProgress(taskId, historyId, videoId, '手动发布完成，正在关闭...', {
      statusType: 'manual_done'
    });

    // 注入成功检测脚本，等发布成功后再关闭
    try {
      const wc = executor.browserController.webContents;
      if (wc && !wc.isDestroyed()) {
        // 监听页面上的发布成功提示
        await wc.executeJavaScript(`
          (function() {
            return new Promise((resolve) => {
              const patterns = /发布成功|已发布|上传成功|审核中|提交成功|success|published/i;
              const timeout = Date.now() + 30000; // 30s 超时
              const check = () => {
                if (document.body.innerText.match(patterns)) return resolve('detected');
                if (Date.now() > timeout) return resolve('timeout');
                setTimeout(check, 1500);
              };
              setTimeout(check, 2000); // 先等 2s 给页面反应
            });
          })()
        `).catch(() => {});
        // 多等 3s 确保请求发送完毕
        await sleep(3000, wc).catch(() => {});
      }
    } catch (e) {
      console.warn('[TaskManager] 发布成功检测失败:', e.message);
    }

    // 关闭浏览器并清理
    try {
      await executor.browserController.close();
    } catch (e) {
      console.warn('[TaskManager] 浏览器关闭失败:', e.message);
    }

    this.manualTakeovers.delete(historyId);
    this.runningPlatforms.delete(platformKey);

    broadcastProgress(taskId, historyId, videoId, '手动发布已完成', {
      statusType: 'success', startTime: executor.startTime, endTime: Date.now()
    });

    // 释放槽位
    if (!this.#paused) {
      setTimeout(() => this.processNext(), 1500);
    }

    return { success: true, message: '浏览器已关闭' };
  }

  /** 🆕 暂停队列调度（当前任务继续） */
  pauseQueue() {
    this.#paused = true;
    return { success: true, paused: true, stats: this.getStats() };
  }

  /** 🆕 恢复队列调度 */
  resumeQueue() {
    this.#paused = false;
    // 可能有多余并发槽位，尝试填充
    for (let i = 0; i < CONFIG.CONCURRENCY_LIMIT; i++) {
      this.processNext();
    }
    return { success: true, paused: false, stats: this.getStats() };
  }

  // @deprecated 保留旧接口兼容性
  cancelTask(taskId) {
    // 遍历查找匹配 taskId 的 executor
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

  ipcMain.handle('execute-auto-publish', async (event, taskData) => {
    const taskId = taskData.taskId || `task_${Date.now()}`;
    const task = { ...taskData, taskId };
    taskManager.addTask(task);
    return { success: true, taskId, message: '发布任务已加入队列' };
  });

  ipcMain.handle('get-task-stats', () => taskManager.getStats());

  // 🆕 系统诊断信息（解释并发上限如何得出）
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
    platform: os.platform(),   // 'win32' | 'darwin' | 'linux'
    arch: os.arch(),
  }));
  ipcMain.handle('clear-task-queue', () => {
    taskManager.clearQueue();
    return { success: true };
  });

  // 🆕 按 historyId 真取消（转手动接管）
  ipcMain.handle('cancel-publish-task', (event, historyId) => {
    return taskManager.cancelByHistoryId(historyId);
  });

  // 🆕 手动发布完成 — 关闭接管浏览器
  ipcMain.handle('complete-manual-publish', async (event, historyId) => {
    return taskManager.completeManualPublish(historyId);
  });

  // 🆕 步骤失败手动恢复 — 用户操作完点"继续", resolve pauseForManualStep 的 Promise
  ipcMain.handle('continue-after-manual-step', async (event, historyId) => {
    const executor = taskManager.manualTakeovers.get(historyId);
    if (!executor || !executor._manualStepResolve) {
      return { success: false, message: '未找到等待手动操作的步骤' };
    }
    executor._manualStepResolve('continue');
    executor._manualStepResolve = null;
    executor._manualTakeover = false;
    taskManager.manualTakeovers.delete(historyId);
    return { success: true };
  });

  // 🆕 强制关闭接管浏览器（放弃手动操作）
  ipcMain.handle('force-close-manual-publish', async (event, historyId) => {
    const executor = taskManager.manualTakeovers.get(historyId);
    if (!executor) return { success: false, message: '未找到接管的任务' };

    const { taskId, videoId, platform } = executor.task;
    const platformKey = `${executor.task.accountId}|${platform}`;

    try { await executor.browserController.close(); } catch (e) {}

    taskManager.manualTakeovers.delete(historyId);
    taskManager.runningPlatforms.delete(platformKey);

    broadcastProgress(taskId, historyId, videoId, '已取消', {
      statusType: 'cancelled', startTime: executor.startTime, endTime: Date.now()
    });

    if (!taskManager.paused) {
      setTimeout(() => taskManager.processNext(), 1500);
    }

    return { success: true, message: '浏览器已强制关闭' };
  });

  // 🆕 暂停/恢复队列
  ipcMain.handle('pause-task-queue', () => taskManager.pauseQueue());
  ipcMain.handle('resume-task-queue', () => taskManager.resumeQueue());

  // @deprecated 保留旧 IPC
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

// re-export self-test for index.js
export { runRPASelfTest };
