/**
 * @file src/core/ipc/ipc-gateway.js
 * @description IPC 网关 - 中央请求路由器
 */

import { ipcMain } from 'electron';
import { ipcRegistrar } from './index.js';
import { IPCValidator } from './ipc-validator.js';

// IPC 网关类
export class IPCGateway {
  constructor() {
    this.validator = new IPCValidator();
    this.handlers = new Map();
    this.middleware = [];
  }

  /**
   * 注册中间件
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * 注册 IPC 处理器
   */
  register(channel, handler, options = {}) {
    // 验证通道名格式
    if (!this.validator.validateChannel(channel)) {
      throw new Error(`Invalid IPC channel name: ${channel}`);
    }

    // 存储处理器和选项
    this.handlers.set(channel, { handler, options });

    // 注册到 ipcMain
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        // 执行中间件链
        for (const middleware of this.middleware) {
          const result = await middleware(channel, args, event);
          if (result === false) {
            return { success: false, error: 'Request blocked by middleware' };
          }
        }

        // 验证请求参数
        if (options.validate) {
          const validationResult = this.validator.validateRequest(channel, args);
          if (!validationResult.valid) {
            return { success: false, error: validationResult.error };
          }
        }

        // 执行处理器
        const result = await handler(event, ...args);
        return result;
      } catch (error) {
        console.error(`[IPC Gateway] ${channel} 处理失败:`, error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * 注册事件监听器
   */
  on(channel, listener) {
    ipcMain.on(channel, listener);
  }

  /**
   * 移除 IPC 处理器
   */
  unregister(channel) {
    this.handlers.delete(channel);
    ipcMain.removeHandler(channel);
  }

  /**
   * 批量注册
   */
  registerAll(handlersMap, options = {}) {
    Object.entries(handlersMap).forEach(([channel, handler]) => {
      this.register(channel, handler, options);
    });
  }

  /**
   * 获取所有已注册的通道
   */
  getRegisteredChannels() {
    return Array.from(this.handlers.keys());
  }
}

// 默认实例
export const ipcGateway = new IPCGateway();