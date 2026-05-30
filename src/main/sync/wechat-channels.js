/**
 * @file sync/wechat-channels.js
 * 微信视频号数据采集器
 */
import { launchSandbox, closeSandbox } from '../browser-manager.js';
import { getDB } from '../database.js';

export async function syncWechatChannelsData(accountId) {
  console.log(`\n🚀 [数据同步] 开始同步【微信视频号】数据 (节点ID: ${accountId})`);

  const db = getDB();
  let browserSession;

  try {
    browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
    const { page } = browserSession;

    let statsData = null;
    let interceptedTrendData = null;
    let maxTrendLength = 0;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/statistic/new_post_total_data')) {
        try {
          const json = await response.json();
          if (json.errCode === 0 && json.data && json.data.totalData) {
            const totalData = json.data.totalData;

            if (totalData.browse && totalData.browse.length > maxTrendLength) {
              maxTrendLength = totalData.browse.length;

              const sumArray = (arr) => arr ? arr.reduce((acc, val) => acc + parseInt(val || "0", 10), 0) : 0;

              statsData = {
                views: sumArray(totalData.browse),
                likes: sumArray(totalData.like),
                days: maxTrendLength
              };

              interceptedTrendData = totalData.browse.map((val, index) => {
                const offset = maxTrendLength - 1 - index;
                const d = new Date(Date.now() - offset * 86400000);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return { date: dateStr, views: parseInt(val || "0", 10) };
              });
            }
          }
        } catch (e) { /* 忽略异常 */ }
      }
    });

    await page.goto('https://channels.weixin.qq.com/platform/statistic/post', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(4000);

    try {
      const btns = await page.getByText(/近\s*30\s*天|30\s*天/).all();
      for (const btn of btns) {
        if (await btn.isVisible()) {
          await btn.click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    } catch (e) {}

    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (let el of elements) {
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
          const txt = el.textContent.replace(/\s+/g, '');
          if (txt === '近30天' || txt === '30天' || txt === '近30日') {
            el.style.border = '2px solid red';
            el.click();
            if (el.parentElement) el.parentElement.click();

            const radio = el.closest('label')?.querySelector('input[type="radio"]');
            if (radio) {
              radio.click();
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      }
    }).catch(() => {});

    for (let i = 0; i < 15; i++) {
      if (maxTrendLength >= 28) break;
      await page.waitForTimeout(1000);
    }

    if (statsData && interceptedTrendData) {
      db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
        .run(statsData.likes, JSON.stringify(interceptedTrendData), accountId);

      await closeSandbox(accountId);
      return { success: true, message: `微信视频号同步成功！${statsData.days}天播放:${statsData.views}，获赞:${statsData.likes}` };
    }

    await closeSandbox(accountId);
    return { success: false, message: '未能拦截到视频号30天数据，可能是节点未登录或暂无任何发布数据。' };

  } catch (error) {
    console.error(error);
    if (browserSession) await closeSandbox(accountId);
    return { success: false, message: error.message };
  }
}
