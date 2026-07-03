/**
 * @file startup-task-manager.mjs
 * 启动时任务队列管理器
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// 获取应用数据目录
function getAppDataPath() {
  return app.getPath('userData');
}

// 任务队列文件路径
const TASK_QUEUE_FILE = join(getAppDataPath(), 'pending_tasks.json');

// 保存任务队列
export function savePendingTasks(tasks) {
  try {
    const data = {
      tasks: tasks,
      timestamp: Date.now(),
      version: '1.0'
    };
    writeFileSync(TASK_QUEUE_FILE, JSON.stringify(data, null, 2));
    console.log('[StartupManager] 任务队列已保存');
  } catch (error) {
    console.error('[StartupManager] 保存任务队列失败:', error.message);
  }
}

// 加载任务队列
export function loadPendingTasks() {
  try {
    if (!existsSync(TASK_QUEUE_FILE)) {
      return [];
    }

    const data = JSON.parse(readFileSync(TASK_QUEUE_FILE, 'utf8'));

    // 检查数据有效性
    if (!data || !Array.isArray(data.tasks)) {
      return [];
    }

    // 过滤掉过期的任务（超过24小时）
    const now = Date.now();
    const validTasks = data.tasks.filter(task => {
      const taskAge = now - (task.timestamp || 0);
      return taskAge < 24 * 60 * 60 * 1000; // 24小时内
    });

    console.log(`[StartupManager] 加载到 ${validTasks.length} 个待处理任务`);
    return validTasks;
  } catch (error) {
    console.error('[StartupManager] 加载任务队列失败:', error.message);
    return [];
  }
}

// 检查任务是否已完成（避免重复执行）
export function isTaskCompleted(task) {
  try {
    const historyPath = join(getAppDataPath(), 'publish_history_v1.json');
    if (!existsSync(historyPath)) {
      return false;
    }

    const data = JSON.parse(readFileSync(historyPath, 'utf8'));
    const records = data.records || [];

    // 检查是否存在相同的任务且状态为已完成
    return records.some(record => {
      // 根据 historyId 或 taskId 匹配
      const sameTask = record.historyId === task.historyId || record.taskId === task.taskId;
      if (!sameTask) return false;

      // 检查任务是否已完成
      const completedStatus = ['任务成功', '任务失败', '已取消', '任务已取消', '用户终止', '已转手动接管', '手动发布已完成'];
      return completedStatus.includes(record.status);
    });
  } catch (error) {
    console.error('[StartupManager] 检查任务状态失败:', error.message);
    return false;
  }
}

// 清空任务队列
export function clearPendingTasks() {
  try {
    if (existsSync(TASK_QUEUE_FILE)) {
      writeFileSync(TASK_QUEUE_FILE, JSON.stringify({ tasks: [], timestamp: Date.now(), version: '1.0' }, null, 2));
    }
    console.log('[StartupManager] 任务队列已清空');
  } catch (error) {
    console.error('[StartupManager] 清空任务队列失败:', error.message);
  }
}

// 添加任务到队列
export function addTaskToQueue(task) {
  try {
    const tasks = loadPendingTasks();
    task.timestamp = Date.now();
    tasks.push(task);
    savePendingTasks(tasks);
  } catch (error) {
    console.error('[StartupManager] 添加任务到队列失败:', error.message);
  }
}

// 从队列中移除任务
export function removeTaskFromQueue(taskId) {
  try {
    const tasks = loadPendingTasks();
    const filteredTasks = tasks.filter(task => task.taskId !== taskId);
    savePendingTasks(filteredTasks);
  } catch (error) {
    console.error('[StartupManager] 从队列移除任务失败:', error.message);
  }
}

// 检查是否有待处理任务
export function hasPendingTasks() {
  try {
    const tasks = loadPendingTasks();
    return tasks.length > 0;
  } catch (error) {
    console.error('[StartupManager] 检查待处理任务失败:', error.message);
    return false;
  }
}

export { TASK_QUEUE_FILE };