/**
 * @file sync/bilibili.js
 * B站数据采集器 — 纳米 API 注入版
 */
import { launchSandbox, closeSandbox } from '../browser-manager.js';
import { getDB } from '../database.js';

function ensureTrendColumn() {
  const db = getDB();
  try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}

export async function syncBilibiliData(accountId) {
  console.log(`\n🚀 [全域数据罗盘] 启动 B 站节点 ${accountId} 数据采集器...`);
  ensureTrendColumn();

  let browserSession = null;
  try {
    const db = getDB();
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
    const { page } = browserSession;

    await page.goto('https://member.bilibili.com/platform/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const apiResult = await page.evaluate(async () => {
      try {
        const [numRes, graphRes, statRes] = await Promise.all([
          fetch('/x/web/data/v2/overview/stat/num?period=1&tab=0').then(r => r.json()),
          fetch('/x/web/data/v2/overview/stat/graph?period=1&type=play').then(r => r.json()),
          fetch('/x/web/index/stat').then(r => r.json())
        ]);
        return { numRes, graphRes, statRes, success: true };
      } catch (e) {
        return { success: false, error: e.toString() };
      }
    });

    await closeSandbox(accountId);

    if (!apiResult.success) {
      throw new Error("API 注入执行失败: " + apiResult.error);
    }

    let exact30DaysPlayFromNum = apiResult.numRes?.data?.play || 0;
    let totalLikes = apiResult.statRes?.data?.total_like || 0;
    let totalFans = apiResult.statRes?.data?.total_fans || 0;

    let interceptedTrendData = [];
    if (apiResult.graphRes?.data?.tendency && Array.isArray(apiResult.graphRes.data.tendency)) {
      interceptedTrendData = apiResult.graphRes.data.tendency.map(item => {
        const dateObj = new Date(item.date_key * 1000);
        const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        return { date: formattedDate, views: parseInt(item.total_inc) || 0 };
      });
    }

    if (interceptedTrendData.length > 0) {
      interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));
      const sumFromArray = interceptedTrendData.reduce((sum, item) => sum + item.views, 0);
      const final30DaysViewsSum = exact30DaysPlayFromNum > 0 ? exact30DaysPlayFromNum : sumFromArray;

      db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`).run(JSON.stringify(interceptedTrendData), accountId);

      if (totalLikes > 0) {
        db.prepare('UPDATE accounts SET total_views = ? WHERE id = ?').run(totalLikes, accountId);
      }
      if (totalFans > 0) {
        db.prepare('UPDATE accounts SET followers = ? WHERE id = ?').run(totalFans, accountId);
      }

      return { success: true, message: `B站同步成功！30天播放:${final30DaysViewsSum}，总赞:${totalLikes}` };
    }

    return { success: false, message: '未能从注入的底层接口中提取到图表数据，可能账号无数据。' };

  } catch (error) {
    console.error(error);
    if (browserSession) await closeSandbox(accountId);
    return { success: false, message: error.message };
  }
}
