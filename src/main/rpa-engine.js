/**
 * @file rpa-engine.js
 * RPA 发布引擎入口 — IPC 通信 + TaskManager 调度
 * 会话容器: rpa/browser-controller.js
 * 平台适配器: rpa/adapters/
 * 自检: rpa/self-test.js
 */
import { BrowserWindow, ipcMain } from 'electron';

import { BrowserController } from './rpa/browser-controller.js';
import {
  XiaohongshuAdapter,
  KuaishouAdapter,
  BaijiahaoAdapter,
  BilibiliAdapter,
  DouyinAdapter,
  WechatChannelsAdapter
} from './rpa/adapters/index.js';
import { runRPASelfTest } from './rpa/self-test.js';

// ==========================================
// 1. 核心配置与全局变量
// ==========================================
const CONFIG = {
  CONCURRENCY_LIMIT: 1,
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
const broadcastProgress = (taskId, historyId, videoId, status, details = {}) => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0 && windows[0].webContents && !windows[0].webContents.isDestroyed()) {
    windows[0].webContents.send('task-progress-update', {
      taskId, historyId, videoId, status, timestamp: Date.now(), ...details
    });
  }
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
  }

  async run() {
    const { taskId, historyId, videoId, platform } = this.task;

    let wc = null;
    let interactions = null;
    try {
      broadcastProgress(taskId, historyId, videoId, '启动发布会话容器...');
      const result = await this.browserController.launch();
      wc = result.webContents;
      interactions = result.interactions;

      const targetUrl = PLATFORM_URLS[platform];
      await interactions.navigate(targetUrl);
      await sleep(3000);

      const broadcast = (s) => broadcastProgress(taskId, historyId, videoId, s);

      let adapter;
      switch (platform) {
        case '抖音': adapter = new DouyinAdapter(interactions, this.task, wc, broadcast); break;
        case '小红书': adapter = new XiaohongshuAdapter(interactions, this.task, wc, broadcast); break;
        case '微信视频号': adapter = new WechatChannelsAdapter(interactions, this.task, wc, broadcast); break;
        case 'B站': adapter = new BilibiliAdapter(interactions, this.task, wc, broadcast); break;
        case '快手': adapter = new KuaishouAdapter(interactions, this.task, wc, broadcast); break;
        case '百家号': adapter = new BaijiahaoAdapter(interactions, this.task, wc, broadcast); break;
        default: throw new Error('未知的发布平台：' + platform);
      }

      await adapter.execute();

      if (this.task.dryRun) {
        broadcastProgress(taskId, historyId, videoId, '预览暂停，请手动控制查看网页...');
        await sleep(600000, wc).catch(() => {});
      }

      broadcastProgress(taskId, historyId, videoId, '任务圆满成功');
    } catch (error) {
      console.error("\n🔴 [底层报错 - TaskExecutor]:", error, "\n");
      broadcastProgress(taskId, historyId, videoId, '流程受阻: ' + error.message);
      if (wc) await sleep(600000, wc).catch(() => {});
    } finally {
      await this.browserController.close();
    }
  }
}

// ==========================================
// 4. 任务管理器与 IPC (IPC 通信层)
// ==========================================
class TaskManager {
  constructor() {
    this.queue = [];
    this.running = 0;
    this.cancelled = new Set();
    this.executors = new Map();
  }

  addTask(task) {
    this.queue.push(task);
    this.processNext();
  }

  async processNext() {
    if (this.running >= CONFIG.CONCURRENCY_LIMIT || this.queue.length === 0) return;
    const task = this.queue.shift();
    if (this.cancelled.has(task.taskId)) return this.processNext();

    this.running++;
    const executor = new TaskExecutor(task);
    this.executors.set(task.historyId, executor);

    try {
      await executor.run();
    } catch (e) {
      broadcastProgress(task.taskId, task.historyId, task.videoId, '致命崩溃', { error: e.message });
    } finally {
      this.executors.delete(task.historyId);
      this.running--;
      setTimeout(() => this.processNext(), 3000);
    }
  }

  getRunningExecutor(historyId) {
    return this.executors.get(historyId);
  }

  getStats() { return { queued: this.queue.length, running: this.running }; }
  clearQueue() { this.queue = []; }
  cancelTask(taskId) { this.cancelled.add(taskId); return { success: true }; }
}

const taskManager = new TaskManager();

// ==========================================
// 5. IPC 注册
// ==========================================
export const registerRPAEngineIPC = () => {
  ipcMain.handle('execute-auto-publish', async (event, taskData) => {
    const taskId = taskData.taskId || `task_${Date.now()}`;
    const task = { ...taskData, taskId };
    taskManager.addTask(task);
    return { success: true, taskId, message: '发布任务已加入队列' };
  });

  ipcMain.handle('get-task-stats', () => taskManager.getStats());
  ipcMain.handle('clear-task-queue', () => {
    taskManager.clearQueue();
    return { success: true };
  });
  ipcMain.handle('cancel-task', (event, taskId) => taskManager.cancelTask(taskId));

  ipcMain.on('attach-robot-view', (event, { taskId, bounds }) => {
    const executor = taskManager.getRunningExecutor(taskId);
    if (executor && executor.browserController) {
      executor.browserController.attachToWindow(bounds);
      currentBrowserController = executor.browserController;
    }
  });

  ipcMain.on('detach-robot-view', (event) => {
    if (currentBrowserController) {
      currentBrowserController.detachFromWindow();
      currentBrowserController = null;
    }
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
