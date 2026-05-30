/**
 * @file sync/douyin.js
 * 抖音数据采集器 — 核心 Dashboard 直连版
 */
import { launchSandbox, closeSandbox } from '../browser-manager.js';
import { getDB } from '../database.js';

function ensureTrendColumn() {
  const db = getDB();
  try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}

export async function syncDouyinData(accountId) {
  console.log(`\n🚀 [全域数据罗盘] 启动抖音节点 ${accountId} 数据采集器...`);
  ensureTrendColumn();

  let browserSession = null;
  try {
    const db = getDB();
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
    const { page } = browserSession;

    let interceptedTrendData = null;

    page.on('response', async (res) => {
      if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
        const url = res.url();
        if ((url.includes('/overview/all') || url.includes('/overview/dashboard')) && res.ok()) {
          try {
            const json = await res.json();

            if (json?.metrics) {
              const playMetric = json.metrics.find(m => m.english_metric_name === 'play_cnt');
              if (playMetric && playMetric.trends && playMetric.trends.length > 15) {
                interceptedTrendData = playMetric.trends.map(item => {
                  const rawDate = item.date_time.toString();
                  const formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
                  return { date: formattedDate, views: parseInt(item.value) || 0 };
                });
              }
            } else if (json?.data?.play?.option_list) {
              const list = json.data.play.option_list;
              if (list.length > 15 && (!interceptedTrendData || list.length > interceptedTrendData.length)) {
                interceptedTrendData = list.map(item => ({
                  date: item.date,
                  views: parseInt(item.count) || 0
                }));
              }
            }
          } catch (e) {
            console.log(`⚠️ [雷达警报] 数据包解析异常: ${e.message}`);
          }
        }
      }
    });

    await page.goto('https://creator.douyin.com/creator-micro/data-center/operation', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    await page.evaluate(() => {
      window.scrollTo(0, 500);
      setTimeout(() => window.scrollTo(0, 1000), 1000);
      setTimeout(() => window.scrollTo(0, 0), 2000);
    }).catch(() => {});
    await page.waitForTimeout(2500);

    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let n7 = [], n30 = [], node;
      while (node = walker.nextNode()) {
        const txt = node.nodeValue.replace(/\s+/g, '');
        if (txt === '近7天') n7.push(node.parentElement);
        if (txt === '近30天') n30.push(node.parentElement);
      }
      n7.forEach(n => { try { n.click(); if (n.parentElement) n.parentElement.click(); } catch (e) {} });
      setTimeout(() => {
        n30.forEach(n => {
          try { n.style.border = '3px solid red'; n.click(); if (n.parentElement) n.parentElement.click(); } catch (e) {}
        });
      }, 1500);
    }).catch(() => {});

    try {
      await page.waitForTimeout(2000);
      const thirtyBtns = await page.getByText('近30天', { exact: true }).all();
      for (const btn of thirtyBtns) {
        if (await btn.isVisible()) { await btn.click({ force: true }).catch(() => {}); }
      }
    } catch (e) {}

    await page.waitForTimeout(5000);
    await closeSandbox(accountId);

    if (interceptedTrendData && interceptedTrendData.length > 0) {
      interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));
      const finalSum = interceptedTrendData.reduce((sum, item) => sum + item.views, 0);

      db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`)
        .run(JSON.stringify(interceptedTrendData), accountId);

      return { success: true, message: `抖音数据同步成功！提取 ${interceptedTrendData.length} 天，30天播放总量: ${finalSum}` };
    }

    return { success: false, message: '未能拦截到抖音的 30 天数据底层报文，请检查网络或重试。' };

  } catch (error) {
    console.error(error);
    if (browserSession) await closeSandbox(accountId);
    return { success: false, message: error.message };
  }
}
