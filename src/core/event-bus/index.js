/**
 * @file src/core/event-bus/index.js
 * @description 统一事件总线 - 模块间通信中心
 */

// 全局事件中心
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.maxListeners = 20;
  }

  /**
   * 注册事件监听器
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event);
    if (listeners.length >= this.maxListeners) {
      console.warn(`[EventBus] 警告: 事件 "${event}" 监听器数量达到上限`);
    }

    listeners.push(listener);
    return this;
  }

  /**
   * 注册一次性事件监听器
   */
  once(event, listener) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    this.onceListeners.get(event).push(listener);
    return this;
  }

  /**
   * 移除事件监听器
   */
  off(event, listener) {
    if (!this.listeners.has(event)) return this;

    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(listener);

    if (index !== -1) {
      listeners.splice(index, 1);
    }

    return this;
  }

  /**
   * 触发事件
   */
  emit(event, ...args) {
    // 触发普通监听器
    if (this.listeners.has(event)) {
      const listeners = [...this.listeners.get(event)];
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`[EventBus] 事件 "${event}" 监听器执行失败:`, error.message);
        }
      });
    }

    // 触发一次性监听器
    if (this.onceListeners.has(event)) {
      const onceListeners = [...this.onceListeners.get(event)];
      this.onceListeners.delete(event);

      onceListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`[EventBus] 一次性事件 "${event}" 监听器执行失败:`, error.message);
        }
      });
    }

    return this;
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event) {
    let count = this.listeners.get(event)?.length || 0;
    count += this.onceListeners.get(event)?.length || 0;
    return count;
  }

  /**
   * 获取所有监听的事件
   */
  eventNames() {
    const events = new Set();
    this.listeners.forEach((_, event) => events.add(event));
    this.onceListeners.forEach((_, event) => events.add(event));
    return Array.from(events);
  }

  /**
   * 清空所有监听器
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
    return this;
  }

  /**
   * 设置最大监听器数量
   */
  setMaxListeners(n) {
    this.maxListeners = n;
    return this;
  }
}

// 创建全局实例
const eventBus = new EventBus();

// 导出
export default eventBus;
export { EventBus };
