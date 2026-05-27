import { contextBridge, ipcRenderer } from 'electron'

// 强行剥离第三方工具包，我们手搓最纯净的 IPC 通信接口
const electronAPI = {
  ipcRenderer: {
    // 发送并等待主进程返回结果 (你前端用的最多的方法)
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    
    // 监听主进程发来的消息
    on: (channel, listener) => {
      const subscription = (event, ...args) => listener(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    
    // 移除监听
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  }
}

// 注入到前端的 window 对象中
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    console.log("✅ [Preload] 跨海大桥已完美对接！");
  } catch (error) {
    console.error("❌ [Preload] 桥梁注入失败:", error)
  }
} else {
  // 兼容非隔离模式
  window.electron = electronAPI
}