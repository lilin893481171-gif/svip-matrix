/**
 * @file data-sync.js
 * 全域数据同步入口 — IPC 路由分发
 * 已迁移至 PlatformRegistry 架构
 */
import { ipcMain } from 'electron';
import PlatformRegistry from './PlatformRegistry.js';

export function registerDataSyncIPC() {
  ipcMain.handle('sync-30days-data', async (event, { accountId, platform }) => {
    try {
      // 从 PlatformRegistry 获取平台实例
      const platformInstance = PlatformRegistry.getAll().find(
        p => p.getDisplayName() === platform
      );

      if (!platformInstance) {
        return { success: false, message: `平台 "${platform}" 未注册` };
      }

      // 调用平台的 syncData 方法
      if (typeof platformInstance.syncData === 'function') {
        return await platformInstance.syncData({ accountId });
      } else {
        return { success: false, message: `平台 "${platform}" 暂不支持数据同步` };
      }
    } catch (err) {
      console.error(`[DataSync] 同步失败:`, err);
      return { success: false, message: err.message };
    }
  });
}
