import { launchSandbox, closeSandbox } from './browser-manager.js';
import { ipcMain } from 'electron';
import { getDB } from './database.js'; 

// ==========================================================
// 🚨 右护法：全域数据罗盘 - 深度数据抽水机 (AI 升维版)
// ==========================================================

function ensureTrendColumn() {
    const db = getDB();
    try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}
/**
 * 1. 抖音 (Douyin) 数据抽水机 (✨ 圣杯 Dashboard 直连版)
 */
export async function syncDouyinData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动抖音节点 ${accountId} 数据抽水机 (圣杯 Dashboard 直连版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        let interceptedTrendData = null;

        // 💥 终极 API 窃听器：通杀 overview/all 和最新的 overview/dashboard
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                if ((url.includes('/overview/all') || url.includes('/overview/dashboard')) && res.ok()) {
                    console.log(`\n[雷达警报] 发现核心数据包: ${url.substring(0, 80)}...`);
                    try {
                        const json = await res.json();
                        
                        // 🌟 优先解析用户刚刚发现的“圣杯” Dashboard 接口
                        if (json?.metrics) {
                            const playMetric = json.metrics.find(m => m.english_metric_name === 'play_cnt');
                            if (playMetric && playMetric.trends && playMetric.trends.length > 15) {
                                interceptedTrendData = playMetric.trends.map(item => {
                                    // 将 "20260406" 格式化为 "2026-04-06"
                                    const rawDate = item.date_time.toString();
                                    const formattedDate = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                                    return {
                                        date: formattedDate,
                                        views: parseInt(item.value) || 0
                                    };
                                });
                                console.log(`🎯 [底层雷达] 成功拦截抖音最新 Dashboard 接口！提取到 ${interceptedTrendData.length} 天播放数据。`);
                            }
                        }
                        // 备用兼容老版 overview/all 接口
                        else if (json?.data?.play?.option_list) {
                            const list = json.data.play.option_list;
                            if (list.length > 15 && (!interceptedTrendData || list.length > interceptedTrendData.length)) {
                                interceptedTrendData = list.map(item => ({
                                    date: item.date,
                                    views: parseInt(item.count) || 0
                                }));
                                console.log(`🎯 [底层雷达] 成功拦截抖音 All 接口！提取到 ${list.length} 天播放数据。`);
                            }
                        }
                    } catch(e) {
                        console.log(`⚠️ [雷达警报] 数据包解析异常: ${e.message}`);
                    }
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入抖音创作者中心...`);
        await page.goto('https://creator.douyin.com/creator-micro/data-center/operation', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`[全域数据罗盘] 潜伏 5 秒！等待数据大盘及前端框架加载完毕...`);
        await page.waitForTimeout(5000); 

        console.log(`[全域数据罗盘] 🚀 启动全屏滚动与霰弹枪盲射战术...`);
        
        // 1. 全屏滚动触发懒加载
        await page.evaluate(() => {
            window.scrollTo(0, 500);
            setTimeout(() => window.scrollTo(0, 1000), 1000);
            setTimeout(() => window.scrollTo(0, 0), 2000);
        }).catch(()=>{});
        await page.waitForTimeout(2500);

        // 2. 原生 JS 暴力点击：先点所有“近7天”逼迫切频，再点所有“近30天”
        await page.evaluate(() => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let n7 = [], n30 = [];
            let node;
            while(node = walker.nextNode()) {
                const txt = node.nodeValue.replace(/\s+/g, '');
                if (txt === '近7天') n7.push(node.parentElement);
                if (txt === '近30天') n30.push(node.parentElement);
            }
            // 狂点近7天
            n7.forEach(n => { try { n.click(); if(n.parentElement) n.parentElement.click(); } catch(e){} });
            
            setTimeout(() => {
                // 狂点近30天
                n30.forEach(n => { 
                    try { 
                        n.style.border = '3px solid red'; // 标红确认击中
                        n.click(); 
                        if(n.parentElement) n.parentElement.click(); 
                    } catch(e){} 
                });
            }, 1500);
        }).catch(()=>{});

        // 3. Playwright 二次补枪
        try {
            await page.waitForTimeout(2000);
            const thirtyBtns = await page.getByText('近30天', { exact: true }).all();
            for (const btn of thirtyBtns) {
                if (await btn.isVisible()) {
                    await btn.click({ force: true }).catch(()=>{});
                }
            }
        } catch (e) {}

        console.log(`[全域数据罗盘] 潜伏 5 秒，等待底层 30天 JSON 报文回传...`);
        await page.waitForTimeout(5000); 

        await closeSandbox(accountId); 

        // 💥 直接结算
        if (interceptedTrendData && interceptedTrendData.length > 0) {
            interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));
            const finalSum = interceptedTrendData.reduce((sum, item) => sum + item.views, 0);
            
            console.log(`\n==================================================================`);
            console.log(`🎯 [精准狙击] JSON 底层解析完毕！`);
            console.log(`💰 数据结算: 提取天数 ${interceptedTrendData.length}，30天总播放量 ${finalSum}`);
            console.log(`==================================================================\n`);

            // 🚨 只更新 30 天趋势数据，绝对不覆盖基础的获赞量
            db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`)
              .run(JSON.stringify(interceptedTrendData), accountId);
              
            return { success: true, message: `抖音数据同步成功！提取 ${interceptedTrendData.length} 天，30天播放总量: ${finalSum}` };
        }

        return { success: false, message: '未能拦截到抖音的 30 天数据底层报文，请检查网络或重试。' };

    } catch (error) {
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在执行中途发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 2. 小红书 (Xiaohongshu) 数据抽水机 (✨ 终极圣杯 API 拦截版 - 0 交互)
 */
export async function syncXiaohongshuData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动小红书节点 ${accountId} 数据抽水机 (API 狙击极速版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        let interceptedTrendData = null;
        let thirtyDaysViewsSum = 0;

        // 💥 终极 API 窃听器：全面潜伏，等待 account/base 圣杯数据包
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                
                // 🎯 精准狙击指挥官发现的核心大盘 API
                if (url.includes('/api/galaxy/v2/creator/datacenter/account/base') && res.ok()) {
                    console.log(`\n[雷达警报] 发现小红书核心双轨数据包 (7天/30天合并包)...`);
                    try {
                        const json = await res.json();
                        
                        // 直接提取 thirty (30天) 节点下的 view_list
                        if (json?.data?.thirty?.view_list) {
                            const list = json.data.thirty.view_list;
                            thirtyDaysViewsSum = json.data.thirty.view_count || 0; // 官方给的30天总阅读/播放量

                            interceptedTrendData = list.map(item => {
                                // 小红书的 date 直接就是精确的毫秒级时间戳 (如 1777910400000)
                                const dateObj = new Date(item.date);
                                const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                                return {
                                    date: formattedDate,
                                    views: parseInt(item.count) || 0
                                };
                            });
                            console.log(`🎯 [底层雷达] 成功提取小红书 30 天趋势分布！`);
                        }
                    } catch(e) {
                        console.log(`⚠️ [雷达警报] 小红书数据包解析异常: ${e.message}`);
                    }
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入小红书创作者中心数据总览页...`);
        // 直接空降小红书数据中心页，此页面加载时必定触发 account/base
        await page.goto('https://creator.xiaohongshu.com/statistics/account/v2', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`[全域数据罗盘] 潜伏 5 秒！等待底层 JSON 报文回传...`);
        await page.waitForTimeout(5000); 

        // 🚨 兜底战术：如果网速太慢没抓到，强行在控制台执行一次切频点击
        if (!interceptedTrendData) {
            console.log(`[全域数据罗盘] 🔄 未自动捕获，执行防缓存切频战术...`);
            await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('span, div, button'));
                const btn30 = elements.find(el => el.textContent.trim() === '近30日' || el.textContent.trim() === '近30天');
                if (btn30) btn30.click();
            }).catch(()=>{});
            await page.waitForTimeout(3000); 
        }

        await closeSandbox(accountId); 

        // 💥 直接结算
        if (interceptedTrendData && interceptedTrendData.length > 0) {
            // 确保日期升序排序
            interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            console.log(`\n==================================================================`);
            console.log(`🎯 [精准狙击] JSON 底层解析完毕！全程无感提取！`);
            console.log(`💰 数据结算: 提取天数 ${interceptedTrendData.length}，小红书 30天总播放/阅读量 ${thirtyDaysViewsSum}`);
            console.log(`==================================================================\n`);

            // 将截获到的 30 天数据落库
            db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`)
              .run(JSON.stringify(interceptedTrendData), accountId);
              
            return { success: true, message: `小红书数据同步成功！30天播放(阅读)总量: ${thirtyDaysViewsSum}` };
        }

        return { success: false, message: '未能拦截到小红书的 30 天数据底层报文，请检查网络或重试。' };

    } catch (error) {
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在执行中途发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 3. B站 (Bilibili) 数据抽水机 (✨ 终极纳米注入版 - 加入总获赞提取)
 */
export async function syncBilibiliData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动 B 站节点 ${accountId} 数据抽水机 (纳米 API 注入版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        console.log(`[全域数据罗盘] 正在突入 B 站创作者中心基座...`);
        await page.goto('https://member.bilibili.com/platform/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`[全域数据罗盘] 潜伏 3 秒！等待账号通行证 (Cookie) 生效...`);
        await page.waitForTimeout(3000); 

        console.log(`[全域数据罗盘] 💉 绕过前端防线，向 B 站底层直接注射 API 提取请求...`);
        
        const apiResult = await page.evaluate(async () => {
            try {
                // 并发请求指挥官截获的三大圣杯接口
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

        // 💥 直接从窃取回来的 JSON 里结算数据
        let exact30DaysPlayFromNum = apiResult.numRes?.data?.play || 0;
        
        // 🚨 核心变动：抓取 B 站的【总点赞数】，直接顶替掉以前的播放量！
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
            
            console.log(`\n==================================================================`);
            console.log(`🎯 [底层注入] 数据窃取完毕！全程 0 次 UI 点击，0 次页面跳转！`);
            console.log(`💰 数据结算: 30天精准播放 ${final30DaysViewsSum} | 总获赞量 ${totalLikes}`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`).run(JSON.stringify(interceptedTrendData), accountId);
            
            // 将总获赞量存入 total_views 字段，实现全平台统一！
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
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在执行中途发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 4. 微信视频号 数据抽水机 (✨ 修复乌龙，专杀视频号 UI 遮挡版)
 */
export async function syncWechatChannelsData(accountId) {
    console.log(`\n======================================================`);
    console.log(`🚀 [数据同步] 开始同步【微信视频号】数据 (节点ID: ${accountId})`);
    console.log(`======================================================`);

    const db = getDB();
    let browserSession;

    try {
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        let statsData = null;
        let interceptedTrendData = null;
        let maxTrendLength = 0; // 🎯 核心：动态锁定最长天数的数据包

        // 🚨 1. 挂载网络拦截器
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/statistic/new_post_total_data')) {
                try {
                    const json = await response.json();
                    if (json.errCode === 0 && json.data && json.data.totalData) {
                        const totalData = json.data.totalData;
                        
                        // 🎯 核心防反杀：只要新抓到的数组比之前长，就无脑覆盖！
                        if (totalData.browse && totalData.browse.length > maxTrendLength) {
                            maxTrendLength = totalData.browse.length;
                            console.log(`🎯 [网络拦截] 捕获视频号黄金数据包！当前锁定天数: ${maxTrendLength}天`);
                            
                            const sumArray = (arr) => arr ? arr.reduce((acc, val) => acc + parseInt(val || "0", 10), 0) : 0;
                            
                            statsData = {
                                views: sumArray(totalData.browse),     // 总播放
                                likes: sumArray(totalData.like),       // 总获赞
                                days: maxTrendLength
                            };

                            // 🧠 动态构建趋势 JSON 数组
                            interceptedTrendData = totalData.browse.map((val, index) => {
                                const offset = maxTrendLength - 1 - index;
                                const d = new Date(Date.now() - offset * 86400000);
                                const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                return { 
                                    date: dateStr, 
                                    views: parseInt(val || "0", 10) 
                                };
                            });
                        } else {
                            console.log(`⏳ [雷达过滤] 扫到短周期包(${totalData.browse?.length || 0}天)，已忽略，继续蹲守 30 天包...`);
                        }
                    }
                } catch (e) {
                    // 忽略异常
                }
            }
        });

        console.log(`🌐 [页面导航] 正在驾驶浏览器前往微信视频号控制台...`);
        await page.goto('https://channels.weixin.qq.com/platform/statistic/post', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        });

        console.log(`⏳ [等待渲染] 等待数据组件彻底加载完毕...`);
        await page.waitForTimeout(4000);
        
        console.log(`👊 [物理穿透] 执行多重维度暴击，强行触发【近30天】数据...`);
        
        // ⚔️ 维度 1: Playwright 原生击穿
        try {
            const btns = await page.getByText(/近\s*30\s*天|30\s*天/).all();
            for (const btn of btns) {
                if (await btn.isVisible()) {
                    await btn.click({ force: true });
                    await page.waitForTimeout(500);
                }
            }
        } catch (e) {}

        // ⚔️ 维度 2: 原生 JS 暴力点击 (专治 Vue/React 拦截)
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            for (let el of elements) {
                // 找到只有文本的最底层节点
                if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
                    const txt = el.textContent.replace(/\s+/g, '');
                    if (txt === '近30天' || txt === '30天' || txt === '近30日') {
                        el.style.border = '2px solid red'; // 标红确认命中
                        el.click(); // 点自己
                        if (el.parentElement) el.parentElement.click(); // 连带点父级
                        
                        // 寻找深层的 radio 输入框强行触发 change 事件
                        const radio = el.closest('label')?.querySelector('input[type="radio"]');
                        if (radio) {
                            radio.click();
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
            }
        }).catch(()=>{});

        console.log(`[全域数据罗盘] 正在等待 30 天底层报文回传 (最多轮询15秒)...`);
        for (let i = 0; i < 15; i++) {
            if (maxTrendLength >= 28) break; // 拿到接近 30 天的数据直接跳出
            await page.waitForTimeout(1000);
        }

        // 💾 结算并落库
        if (statsData && interceptedTrendData) {
            console.log(`\n==================================================================`);
            console.log(`🎯 [完美收官] 微信视频号近 ${statsData.days} 天解析完毕！`);
            console.log(`💰 数据结算: 总播放量 ${statsData.views}，获赞量 ${statsData.likes}`);
            console.log(`==================================================================\n`);

            // ⚠️ 写入总获赞与日历曲线
            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(statsData.likes, JSON.stringify(interceptedTrendData), accountId);
            
            await closeSandbox(accountId);
            return { 
                success: true, 
                message: `微信视频号同步成功！${statsData.days}天播放:${statsData.views}，获赞:${statsData.likes}` 
            };
        }

        // 🛡️ 兜底失败
        await closeSandbox(accountId);
        return { success: false, message: '未能拦截到视频号30天数据，可能是节点未登录或暂无任何发布数据。' };

    } catch (error) {
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在微信视频号同步发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 5. 百家号 (Baijiahao) 数据抽水机 (✨ 全屏大数暴击 + 纯净断舍离版)
 */
export async function syncBaijiahaoData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动百家号节点 ${accountId} 数据抽水机 (API 强行直连版)...`);
    ensureTrendColumn();
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        console.log(`[全域数据罗盘] 正在空降百家号大盘，建立通行证授权...`);
        // 1. 先访问主页，确保 Cookie 和 Token 挂载成功
        await page.goto('https://baijiahao.baidu.com/builder/rc/analysiscontent', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); // 稍微等一下授权态生效

        console.log(`[全域数据罗盘] 授权完成！开始组装 30 天时光机参数...`);

        // 2. 动态计算 start_day 和 end_day (格式 YYYYMMDD)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 29); // 往前推 29 天，包含今天正好 30 天

        const formatDate = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const startDayStr = formatDate(startDate);
        const endDayStr = formatDate(endDate);

        // 拼接出你抓到的那个无敌 API
        const apiUrl = `/author/eco/statistics/appStatisticV3?type=all&start_day=${startDayStr}&end_day=${endDayStr}&stat=0&special_filter_days=30`;
        console.log(`[全域数据罗盘] 💉 绕过前端 UI，向百家号心脏直接注射 API 请求:`);
        console.log(`-> ${apiUrl}`);

        // 3. 终极杀招：直接在浏览器的控制台里执行 fetch！完全无视前端按钮点不点得动！
        const json = await page.evaluate(async (url) => {
            try {
                // 带着浏览器的原生登录态去拿数据
                const res = await fetch(url);
                return await res.json();
            } catch (e) {
                return { error: e.message };
            }
        }, apiUrl);

        await closeSandbox(accountId);

        // 4. 解析神圣回传的 JSON
        if (json && json.data && json.data.total_info && json.data.list) {
            const views = parseInt(json.data.total_info.view_count || "0", 10);
            const likes = parseInt(json.data.total_info.likes_count || "0", 10);
            
            const trendData = json.data.list.map(item => {
                const rawDate = String(item.event_day);
                const fDate = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                return { date: fDate, views: parseInt(item.view_count || "0", 10) };
            });

            if (trendData.length > 0) {
                console.log(`\n==================================================================`);
                console.log(`🎯 [完美收官] API 直取成功！无视任何 UI 阻挡，拿到 ${trendData.length} 天数据！`);
                console.log(`💰 数据结算: 30天总阅读/播放 ${views}，获赞量 ${likes}`);
                console.log(`==================================================================\n`);

                // ⚠️ 落库：点赞量写入 total_views 供前端展示，30天曲线存入 trend_data
                db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
                  .run(likes, JSON.stringify(trendData), accountId);
                  
                return { success: true, message: `百家号同步成功！30天阅读:${views}，获赞:${likes}` };
            }
        }

        return { success: false, message: `百家号提取失败，API返回异常: ${json?.error || json?.errmsg || '未知错误'}` };

    } catch (error) {
        console.error(`\n❌ [致命崩溃] 百家号节点 ${accountId} 同步异常！`, error);
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 4. 快手 (Kuaishou) 数据抽水机 (✨ 终极穿甲版 - 双路由覆盖 + 原生击穿)
 */
export async function syncKuaishouData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动快手节点 ${accountId} 数据抽水机 (穿甲狙击版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        let interceptedTrendData = null;
        let thirtyDaysViewsSum = 0;
        let thirtyDaysLikesSum = 0;
        let maxTrendLength = 0; // 核心：记录截获到的最长天数（优选30天）

        // 💥 终极 API 窃听器：放宽视野，无视签名，自动优选最长周期
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                
                // 🎯 只要是快手的数据分析大盘接口，统统拦截
                if (url.includes('/analysis/pc/') && res.ok()) {
                    try {
                        const json = await res.json();
                        
                        if (json?.data?.basicData && Array.isArray(json.data.basicData)) {
                            const playData = json.data.basicData.find(item => item.tab === 'PLAY');
                            // 只有当新截获的数据天数 > 之前的天数时，才更新覆盖 (例如 30天 覆盖 7天)
                            if (playData && playData.trendData && playData.trendData.length > maxTrendLength) {
                                maxTrendLength = playData.trendData.length;
                                thirtyDaysViewsSum = parseInt(playData.sumCount) || 0;
                                
                                interceptedTrendData = playData.trendData.map(item => {
                                    const rawDate = String(item.date);
                                    const formattedDate = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
                                    return {
                                        date: formattedDate,
                                        views: parseInt(item.count) || 0
                                    };
                                });

                                const likeData = json.data.basicData.find(item => item.tab === 'LIKE');
                                if (likeData) {
                                    thirtyDaysLikesSum = parseInt(likeData.sumCount) || 0;
                                }
                                
                                console.log(`\n🎯 [底层雷达] 成功截获快手大盘！当前锁定周期: ${maxTrendLength}天`);
                            }
                        }
                    } catch(e) {}
                }
            }
        });

        // ====================================================================
        // 🚀 双重路由空降：确保降落在能触发 API 的绝对核心区域
        // ====================================================================
        console.log(`[全域数据罗盘] 突入快手创作者中心首页...`);
        await page.goto('https://cp.kuaishou.com/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); 

        console.log(`[全域数据罗盘] 强制跳转至核心数据总览面板...`);
        await page.goto('https://cp.kuaishou.com/data/overview', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});
        await page.waitForTimeout(3000); 

        // ====================================================================
        // 🚨 穿甲弹点击战术：注入底层 MouseEvent 强行唤醒 React 异步请求
        // ====================================================================
        console.log(`[全域数据罗盘] 🔄 执行穿甲切频打击...`);
        await page.evaluate(async () => {
            const hitTarget = (textArray) => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let target = null;
                let n;
                while(n = walker.nextNode()) {
                    if (textArray.includes(n.nodeValue.replace(/\s+/g, ''))) {
                        target = n.parentElement;
                    }
                }
                if (target) {
                    target.style.outline = '3px solid red'; // 标红确认命中
                    target.click(); // 普通点击
                    // 💥 发送原生鼠标事件，击穿 React 虚拟 DOM 防御
                    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    if (target.parentNode) {
                        target.parentNode.click();
                    }
                    return true;
                }
                return false;
            };
            
            // 第一发：打击近7日
            hitTarget(['近7日', '近7天', '7日', '7天']);
            
            // 停顿 1.5 秒
            await new Promise(r => setTimeout(r, 1500));
            
            // 第二发：致命一击近30日
            hitTarget(['近30日', '近30天', '30日', '30天']);
        }).catch(()=>{});

        console.log(`[全域数据罗盘] 潜伏 4 秒，等待底层全家桶报文回传...`);
        await page.waitForTimeout(4000); 

        await closeSandbox(accountId); 

        // 💥 直接结算
        if (interceptedTrendData && interceptedTrendData.length > 0) {
            interceptedTrendData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            console.log(`\n==================================================================`);
            console.log(`🎯 [精准狙击] 快手 JSON 底层解析完毕！成功击穿虚假 DOM！`);
            console.log(`💰 数据结算: 提取天数 ${interceptedTrendData.length}，近${maxTrendLength}天总播放 ${thirtyDaysViewsSum}，总赞 ${thirtyDaysLikesSum}`);
            console.log(`==================================================================\n`);

            // 写入 30天 播放曲线图 JSON
            db.prepare(`UPDATE accounts SET trend_data = ? WHERE id = ?`)
              .run(JSON.stringify(interceptedTrendData), accountId);
            
            // 录入获赞量
            if (thirtyDaysLikesSum > 0) {
                db.prepare('UPDATE accounts SET total_views = ? WHERE id = ?').run(thirtyDaysLikesSum, accountId);
            }
              
            return { success: true, message: `快手同步成功！${maxTrendLength}天播放:${thirtyDaysViewsSum}，获赞:${thirtyDaysLikesSum}` };
        }

        return { success: false, message: '未能拦截到快手的数据报文，可能是页面未渲染或账号暂无数据。' };

    } catch (error) {
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在执行中途发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}


// ==========================================================
// 🚨 4. 注册所有 IPC 通信
// ==========================================================
export function registerDataSyncIPC() {
    ipcMain.handle('sync-30days-data', async (event, { accountId, platform }) => {
        if (platform === '抖音') return await syncDouyinData(accountId); //已完成
        if (platform === '小红书') return await syncXiaohongshuData(accountId);//已完成
        if (platform === 'B站') return await syncBilibiliData(accountId);//已完成
        if (platform === '微信视频号') return await syncWechatChannelsData(accountId);//已完成
        if (platform === '百家号') return await syncBaijiahaoData(accountId);//已完成
        if (platform === '快手') return await syncKuaishouData(accountId);// 已完成
        return { success: false, message: `暂不支持 ${platform} 同步` };
    });
}