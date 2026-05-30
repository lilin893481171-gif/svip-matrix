/**
 * @file data-sync.js
 * 全域数据同步入口 — IPC 路由分发
 * 采集器: sync/douyin.js | sync/xiaohongshu.js | sync/bilibili.js
 *         sync/wechat-channels.js | sync/baijiahao.js | sync/kuaishou.js
 */
import { ipcMain } from 'electron';

import { syncDouyinData } from './sync/douyin.js';
import { syncXiaohongshuData } from './sync/xiaohongshu.js';
import { syncBilibiliData } from './sync/bilibili.js';
import { syncWechatChannelsData } from './sync/wechat-channels.js';
import { syncBaijiahaoData } from './sync/baijiahao.js';
import { syncKuaishouData } from './sync/kuaishou.js';

export function registerDataSyncIPC() {
  ipcMain.handle('sync-30days-data', async (event, { accountId, platform }) => {
    if (platform === '抖音') return await syncDouyinData(accountId);
    if (platform === '小红书') return await syncXiaohongshuData(accountId);
    if (platform === 'B站') return await syncBilibiliData(accountId);
    if (platform === '微信视频号') return await syncWechatChannelsData(accountId);
    if (platform === '百家号') return await syncBaijiahaoData(accountId);
    if (platform === '快手') return await syncKuaishouData(accountId);
    return { success: false, message: `暂不支持 ${platform} 同步` };
  });
}
