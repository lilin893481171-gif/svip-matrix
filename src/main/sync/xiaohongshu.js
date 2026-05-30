/**
 * @file sync/xiaohongshu.js
 * 小红书数据采集器 — API 拦截极速版
 */
import { launchSandbox, closeSandbox } from '../browser-manager.js';
import { getDB } from '../database.js';

function ensureTrendColumn() {
  const db = getDB();
  try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}

export async function syncXiaohongshuData(accountId) {
  console.log(`\n🚀 [全域数据罗盘] 启动小红书节点 ${accountId} 数据采集器...`);
  ensureTrendColumn();

  let browserSession = null;
  try {
    const db = getDB();
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
    const { page } = browserSession;

    let interceptedTrendData = null;
    let thirtyDaysViewsSum = 0;

    page.on('response', async (res) => {
      if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
        const url = res.url();
        if (url.includes('/api/galaxy/v2/creator/datacenter/account/base') && res.ok()) {
          try {
            const json = await res.json();
            if (json?.data?.thirty?.view_list) {
              const list = json.data.thirty.view_list;
              thirtyDaysViewsSum = json.data.thirty.view_count || 0;

              interceptedTrendData = list.map(item => {
                const dateObj = new Date(item.date);
                const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                return { date: formattedDate, views: parseInt(item.count) || 0 };
              });
            }
          } catch (e) {
            console.log(`⚠️ [雷达警报] 小红书数据包解析异常: ${e.message}`);
          }
        }
      }
    });

    await page.goto('https://creator.xiaohongshu.com/statistics/account/v2', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    if (!interceptedTrendData) {
      console.log(`[全域数据罗盘] 🔄 未自动捕获，执行防缓存切频战术...`);
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('span, div, button'));
        const btn30 = elements.find(el => el.textContent.trim() === '近30日' || el.textContent.trim() === '近30天');
        if (btn30) btn30.click();
      }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    await closeSandbox(accountId);

    if (interceptedTrendData && interceptedTrendData.length > 0) {
      interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));

      db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`)
        .run(JSON.stringify(interceptedTrendData), accountId);

      return { success: true, message: `小红书数据同步成功！30天播放(阅读)总量: ${thirtyDaysViewsSum}` };
    }

    return { success: false, message: '未能拦截到小红书的 30 天数据底层报文，请检查网络或重试。' };

  } catch (error) {
    console.error(error);
    if (browserSession) await closeSandbox(accountId);
    return { success: false, message: error.message };
  }
}
