import { contextBridge, ipcRenderer } from 'electron'

// ═══════════════════════════════════════════════════════
// IPC 通道安全白名单 (已移至主进程管理)
// ═══════════════════════════════════════════════════════

// 通过 IPC 网关的安全 API
const electronAPI = {
  ipcRenderer: {
    // 通过 IPC 网关调用
    invoke: async (channel, ...args) => {
      try {
        // 所有调用都通过统一的网关通道
        const result = await ipcRenderer.invoke('ipc-gateway-request', { channel, args });
        return result;
      } catch (error) {
        console.error(`[Preload] IPC 调用失败 ${channel}:`, error);
        throw error;
      }
    },

    // 发送事件
    send: (channel, ...args) => {
      // 发送事件也通过网关
      ipcRenderer.send('ipc-gateway-send', { channel, args });
    },

    // 监听事件
    on: (channel, listener) => {
      const subscription = (event, ...args) => listener(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },

    // 移除监听器
    off: (channel, listener) => {
      ipcRenderer.removeListener(channel, listener);
    },

    // 移除所有监听器
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
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