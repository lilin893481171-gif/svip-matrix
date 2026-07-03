/**
 * @file src/core/ipc/index.js
 * @description 统一 IPC 管理 - 从主进程 IPC 处理器提取
 */

import { ipcMain, ipcRenderer } from 'electron';
import { ipcGateway } from './ipc-gateway.js';
import { IPC_CHANNELS } from './ipc-registry.js';

// IPC 事件命名空间 (保持向后兼容)
export const IPC_EVENTS = IPC_CHANNELS;

// 主进程 IPC 注册器 (保持向后兼容)
export class IPCRegistrar {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * 注册 IPC 处理器
   */
  handle(event, handler) {
    this.handlers.set(event, handler);
    ipcGateway.register(event, handler);
  }

  /**
   * 注册事件监听器
   */
  on(event, listener) {
    ipcMain.on(event, listener);
  }

  /**
   * 移除 IPC 处理器
   */
  remove(event) {
    this.handlers.delete(event);
    ipcGateway.unregister(event);
  }

  /**
   * 批量注册
   */
  registerAll(handlersMap) {
    Object.entries(handlersMap).forEach(([event, handler]) => {
      this.handle(event, handler);
    });
  }
}

// 渲染进程 IPC 调用器 (保持向后兼容)
export class IPCCaller {
  constructor() {
    if (!ipcRenderer) {
      throw new Error('IPCCaller 仅可在渲染进程使用');
    }
  }

  /**
   * 调用 IPC handler
   */
  async invoke(event, ...args) {
    try {
      return await ipcRenderer.invoke(event, ...args);
    } catch (error) {
      console.error(`[IPC] 调用 ${event} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 发送事件（不等待响应）
   */
  send(event, ...args) {
    ipcRenderer.send(event, ...args);
  }

  /**
   * 监听事件
   */
  on(event, callback) {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on(event, handler);
    return handler;
  }

  /**
   * 移除事件监听
   */
  removeListener(event, handler) {
    if (handler) {
      ipcRenderer.removeListener(event, handler);
    } else {
      ipcRenderer.removeAllListeners(event);
    }
  }
}

// 默认实例
export const ipcRegistrar = new IPCRegistrar();
export const ipcCaller = new IPCCaller();

// 导出 Electron IPC 原始 API 供特殊场景使用
export { ipcMain, ipcRenderer };