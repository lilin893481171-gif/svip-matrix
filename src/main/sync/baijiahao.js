/**
 * @file sync/baijiahao.js
 * 百家号数据采集器 — API 强行直连版
 */
import { launchSandbox, closeSandbox } from '../browser-manager.js';
import { getDB } from '../database.js';

function ensureTrendColumn() {
  const db = getDB();
  try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}

export async function syncBaijiahaoData(accountId) {
  console.log(`\n🚀 [全域数据罗盘] 启动百家号节点 ${accountId} 数据采集器...`);
  ensureTrendColumn();
  let browserSession = null;

  try {
    const db = getDB();
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
    const { page } = browserSession;

    await page.goto('https://baijiahao.baidu.com/builder/rc/analysiscontent', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);

    const formatDate = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const startDayStr = formatDate(startDate);
    const endDayStr = formatDate(endDate);

    const apiUrl = `/author/eco/statistics/appStatisticV3?type=all&start_day=${startDayStr}&end_day=${endDayStr}&stat=0&special_filter_days=30`;

    const json = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url);
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    }, apiUrl);

    await closeSandbox(accountId);

    if (json && json.data && json.data.total_info && json.data.list) {
      const views = parseInt(json.data.total_info.view_count || "0", 10);
      const likes = parseInt(json.data.total_info.likes_count || "0", 10);

      const trendData = json.data.list.map(item => {
        const rawDate = String(item.event_day);
        const fDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        return { date: fDate, views: parseInt(item.view_count || "0", 10) };
      });

      if (trendData.length > 0) {
        db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
          .run(likes, JSON.stringify(trendData), accountId);

        return { success: true, message: `百家号同步成功！30天阅读:${views}，获赞:${likes}` };
      }
    }

    return { success: false, message: `百家号提取失败，API返回异常: ${json?.error || json?.errmsg || '未知错误'}` };

  } catch (error) {
    console.error(error);
    if (browserSession) await closeSandbox(accountId);
    return { success: false, message: error.message };
  }
}
