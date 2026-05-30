/**
 * @file sync/kuaishou.js
 * 快手数据采集器 — 双路由覆盖 + 原生触发版
 */
import { launchSandbox, closeSandbox } from '../browser-manager.js';
import { getDB } from '../database.js';

function ensureTrendColumn() {
  const db = getDB();
  try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}

export async function syncKuaishouData(accountId) {
  console.log(`\n🚀 [全域数据罗盘] 启动快手节点 ${accountId} 数据采集器...`);
  ensureTrendColumn();

  let browserSession = null;
  try {
    const db = getDB();
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
    const { page } = browserSession;

    let interceptedTrendData = null;
    let thirtyDaysViewsSum = 0;
    let thirtyDaysLikesSum = 0;
    let maxTrendLength = 0;

    page.on('response', async (res) => {
      if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
        const url = res.url();
        if (url.includes('/analysis/pc/') && res.ok()) {
          try {
            const json = await res.json();
            if (json?.data?.basicData && Array.isArray(json.data.basicData)) {
              const playData = json.data.basicData.find(item => item.tab === 'PLAY');
              if (playData && playData.trendData && playData.trendData.length > maxTrendLength) {
                maxTrendLength = playData.trendData.length;
                thirtyDaysViewsSum = parseInt(playData.sumCount) || 0;

                interceptedTrendData = playData.trendData.map(item => {
                  const rawDate = String(item.date);
                  const formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
                  return { date: formattedDate, views: parseInt(item.count) || 0 };
                });

                const likeData = json.data.basicData.find(item => item.tab === 'LIKE');
                if (likeData) {
                  thirtyDaysLikesSum = parseInt(likeData.sumCount) || 0;
                }
              }
            }
          } catch (e) {}
        }
      }
    });

    await page.goto('https://cp.kuaishou.com/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.goto('https://cp.kuaishou.com/data/overview', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    await page.evaluate(async () => {
      const hitTarget = (textArray) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let target = null;
        let n;
        while (n = walker.nextNode()) {
          if (textArray.includes(n.nodeValue.replace(/\s+/g, ''))) {
            target = n.parentElement;
          }
        }
        if (target) {
          target.style.outline = '3px solid red';
          target.click();
          target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          if (target.parentNode) { target.parentNode.click(); }
          return true;
        }
        return false;
      };

      hitTarget(['近7日', '近7天', '7日', '7天']);
      await new Promise(r => setTimeout(r, 1500));
      hitTarget(['近30日', '近30天', '30日', '30天']);
    }).catch(() => {});

    await page.waitForTimeout(4000);
    await closeSandbox(accountId);

    if (interceptedTrendData && interceptedTrendData.length > 0) {
      interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));

      db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`)
        .run(JSON.stringify(interceptedTrendData), accountId);

      if (thirtyDaysLikesSum > 0) {
        db.prepare('UPDATE accounts SET total_views = ? WHERE id = ?').run(thirtyDaysLikesSum, accountId);
      }

      return { success: true, message: `快手同步成功！${maxTrendLength}天播放:${thirtyDaysViewsSum}，获赞:${thirtyDaysLikesSum}` };
    }

    return { success: false, message: '未能拦截到快手的数据报文，可能是页面未渲染或账号暂无数据。' };

  } catch (error) {
    console.error(error);
    if (browserSession) await closeSandbox(accountId);
    return { success: false, message: error.message };
  }
}
