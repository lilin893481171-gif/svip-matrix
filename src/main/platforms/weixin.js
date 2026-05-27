// src/main/platforms/weixin.js

/**
 * 🌟 深度指纹伪装与反爬斗篷
 */
async function applyWeixinStealth(page) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {}, app: {} };
    });
}

/**
 * 🤖 仿生学组件：贝塞尔曲线鼠标移动
 */
async function humanMouseMove(page, x, y) {
    const offsetX = x + (Math.random() * 40 - 20);
    const offsetY = y + (Math.random() * 40 - 20);
    await page.mouse.move(offsetX, offsetY, { steps: Math.floor(Math.random() * 5) + 3 });
    await page.waitForTimeout(Math.floor(Math.random() * 100) + 50);
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 3) + 2 });
}

/**
 * 🤖 仿生学组件：思考式打字
 */
async function humanType(page, text) {
    for (let i = 0; i < text.length; i++) {
        await page.keyboard.type(text[i], { delay: Math.floor(Math.random() * 80) + 30 });
        if (['，', '。', '！', '？', ',', '.', '!', '?'].includes(text[i]) || Math.random() < 0.1) {
            await page.waitForTimeout(Math.floor(Math.random() * 400) + 200); 
        }
    }
}

/**
 * =========================================================
 * 1. 微信视频号：【视频雷达】(严格控制当日发布，含前3条历史兜底)
 * =========================================================
 */
export async function runVideoRadar(page, acc, randomSleep) {
    console.log(`\n🚀 [视频号雷达] 启动监控引擎...`);
    await applyWeixinStealth(page);

    let scannedNoteList = []; 
    let uniqueIds = new Set(); 

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/mmfinderassistant-bin/post/post_list') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const list = json.data?.list || [];
                
                if (list.length > 0) {
                    const now = new Date();
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;

                    // 筛选今天发布的视频
                    let targetVideos = list.filter(item => item.createTime >= startOfToday);

                    // 🌟 核心兜底规则更新：如果没有当日视频，默认获取历史发布的前 3 条
                    if (targetVideos.length === 0) {
                        console.log(`[视频号雷达] ⚠️ 今日无新发布内容！触发兜底机制：默认获取历史发布的前 3 条视频。`);
                        targetVideos = list.slice(0, 3);
                    } else {
                        // 如果有当日视频，也最多只处理最新的 3 条
                        targetVideos = targetVideos.slice(0, 3);
                    }

                    targetVideos.forEach(item => {
                        const videoId = item.objectId;
                        if (!uniqueIds.has(videoId)) {
                            uniqueIds.add(videoId);
                            let d = new Date(item.createTime * 1000);
                            
                            // 🌟 智能时间显示：今天的视频显示"今天"，历史视频显示具体的月日
                            let timeStr = item.createTime >= startOfToday 
                                ? `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                                : `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                            
                            const desc = item.desc?.description || '视频号动态';
                            // 🌟 封面兜底：优先用 coverUrl，没有的话用 thumbUrl
                            const cover = item.desc?.media?.[0]?.coverUrl || item.desc?.media?.[0]?.thumbUrl || '';
                            const videoUrl = `https://channels.weixin.qq.com/platform/post/detail?objectId=${videoId}`;

                            scannedNoteList.push({
                                id: videoId, 
                                title: desc.substring(0, 20), 
                                cover: cover, 
                                time: timeStr, 
                                url: videoUrl, 
                                platform: '微信视频号', 
                                account: acc.alias
                            });
                        }
                    });
                    console.log(`🎯 [视频号雷达] 扫描完毕，锁定 ${scannedNoteList.length} 条视频进入首发队列！`);
                }
            } catch(e) {}
        }
    });

    console.log(`🎬 正在空降视频号 创作者管理大厅...`);
    await page.goto('https://channels.weixin.qq.com/platform/post/list', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomSleep(page, 3000, 5000); 
    await page.mouse.wheel(0, 400);

    return { 
        success: true, 
        message: scannedNoteList.length > 0 ? `🎯 视频号视频检索完毕！锁定 ${scannedNoteList.length} 篇！` : `⚠️ 未获取到视频。`, 
        scannedVideos: scannedNoteList 
    };
}

/**
 * =========================================================
 * 🌟 核心破局模块：微前端架构侧边栏智能物理寻路
 * =========================================================
 */
async function navigateToCommentPageViaSidebar(page, randomSleep) {
    console.log(`🎬 正在空降视频号 宿主大厅(Platform)...`);
    // 1. 强制降落在宿主根目录，避免 Cannot GET 报错
    await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomSleep(page, 3000, 5000);

    console.log(`🤖 遇到微前端架构，启动侧边栏物理寻路...`);
    // 2. 在左侧菜单疯狂寻找“互动管理”和“评论”按钮并点击
    const clickedMenu = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        
        // 步骤 A: 找“互动管理”并展开
        const interactMenu = Array.from(document.querySelectorAll('div, span, li')).find(el => el.innerText && el.innerText.trim() === '互动管理');
        if (interactMenu) {
            interactMenu.click();
            await sleep(1000); // 等待下拉动画
        }

        // 步骤 B: 找“评论”按钮进入目标子应用
        // 重新查询DOM，因为下拉菜单刚渲染出来
        const currentElements = Array.from(document.querySelectorAll('div, span, li, a'));
        const commentMenu = currentElements.find(el => el.innerText && el.innerText.trim() === '评论');
        if (commentMenu) {
            commentMenu.click();
            return true;
        }
        return false;
    });

    if (clickedMenu) {
        console.log(`✅ 成功通过侧边栏进入【互动评论】子应用！等待微前端渲染...`);
        await randomSleep(page, 3000, 5000);
        return true;
    } else {
        console.log(`⚠️ 物理寻路失败，未在侧边栏找到“评论”入口。`);
        return false;
    }
}

/**
 * =========================================================
 * 2. 微信视频号：【评论雷达】(底层拦截 + 双向深度滚动挖掘)
 * =========================================================
 */
export async function runCommentRadar(page, db, acc, randomSleep) {
    console.log(`\n🚀 [视频号雷达] 启动【互动评论】深挖吸盘引擎...`);
    await applyWeixinStealth(page); 
    
    let newCount = 0;
    const insertStmt = db.prepare(`INSERT INTO messages (platform, account_alias, username, avatar, video_cover, content, time, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    page.on('response', async (res) => {
        if (res.url().includes('/comment/comment_list') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const comments = json.data?.comment || [];
                
                if (comments.length > 0) {
                    for (const c of comments) {
                        const username = c.commentNickname || '未知用户';
                        const content = c.commentContent;
                        if (!content || username === acc.alias || username.includes('@finder')) continue;

                        let d = new Date(parseInt(c.commentCreatetime) * 1000); 
                        let timeStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        let avatar = c.commentHeadurl || '';
                        
                        const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, username, content);
                        if (!exists) {
                            insertStmt.run('微信视频号', acc.alias, username, avatar, '', content, timeStr, '未回复', '评论');
                            newCount++;
                        }
                    }
                }
            } catch(e) {}
        }
    });

    // 🌟 调用物理寻路进入评论页
    const isNavigated = await navigateToCommentPageViaSidebar(page, randomSleep);
    if (!isNavigated) return { success: false, message: `视频号进入评论页失败，请检查侧边栏。` };

    console.log(`🤖 开始模拟真人遍历左侧视频列表，并执行深度滚动深挖...`);
    
    // 定位左侧和右侧的独立滚动容器（基于你提供的情报源码）
    const leftFeedContainer = page.locator('div.feeds-container').first();
    const rightCommentContainer = page.locator('div.feed-comment__wrp').first();

    const maxScan = 8; // 我们把扫描深度增加到前 8 个视频
    
    for (let i = 0; i < maxScan; i++) {
        // 注意：每次循环都要重新获取视频卡片，因为滚动后 DOM 会更新
        const videoCards = page.locator('div.comment-feed-wrap');
        const currentCount = await videoCards.count();
        
        // 🌟 左手拨轮：如果当前想点的视频超出了可见范围，先去左侧往下滚一滚！
        if (i >= currentCount - 1 && await leftFeedContainer.isVisible()) {
            console.log(`[评论雷达] 左侧视频列表到底了，模拟真人往下滑动加载更多视频...`);
            await leftFeedContainer.hover({ force: true });
            await page.mouse.wheel(0, 1000);
            await randomSleep(page, 1500, 2500);
        }

        const card = videoCards.nth(i);
        if (await card.isVisible()) {
            // 点击左侧视频卡片
            await card.click({ delay: Math.floor(Math.random() * 80) + 40 });
            console.log(`[评论雷达] 👈 点击第 ${i + 1} 个视频，开始榨取右侧评论...`);
            await randomSleep(page, 1500, 2000); // 等第一波评论接口返回
            
            // 🌟 右手拨轮：把鼠标移到右侧评论区，往下深挖翻页！榨干历史评论！
            if (await rightCommentContainer.isVisible()) {
                await rightCommentContainer.hover({ force: true });
                
                // 连滚 3 次，每次停顿，诱发底层的分页 API (downContinueFlag)
                for (let scrollCount = 0; scrollCount < 3; scrollCount++) {
                    // 检查是否显示“暂无评论”或“正在加载”，决定是否继续滚
                    const noMoreTips = page.locator('p.scroll-bottom__tips').filter({ hasText: '暂无评论' });
                    if (await noMoreTips.isVisible()) break; 

                    await page.mouse.wheel(0, 1500);
                    await randomSleep(page, 800, 1500); // 停顿等待新 API 响应加载
                }
            }
        }
    }

    return { success: true, message: `🎯 视频号评论库深度更新完毕！狂吸 ${newCount} 条粉丝评论！` };
}

/**
 * =========================================================
 * 3. 微信视频号：批量首发置顶模块 (拟人化击发)
 * =========================================================
 */
export async function runBatchPin(page, targetVideos, replyText, randomSleep) {
    let successCount = 0;
    await applyWeixinStealth(page); 

    for (const video of targetVideos) {
        console.log(`🎬 [首发引擎] 正在空降视频详情页: [${video.title}]`);
        try {
            if (!video.url) continue;

            await page.goto(video.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomSleep(page, 3000, 4500);

            await page.mouse.wheel(0, 300); 
            await randomSleep(page, 1000, 1500);

            const inputBox = page.locator('textarea.create-input').first();
            
            if (await inputBox.isVisible()) {
                await inputBox.click({ delay: Math.floor(Math.random() * 100) + 50 }); 
                await randomSleep(page, 500, 1000);
                
                await humanType(page, replyText); 
                await randomSleep(page, 1000, 1500);

                const sendBtn = page.locator('div.tag-wrap.primary').filter({ hasText: '评论' }).first();
                
                if (await sendBtn.isVisible()) {
                    await sendBtn.click({ force: true, delay: Math.floor(Math.random() * 100) + 50 });
                    successCount++;
                    console.log(`🔥 [首发引擎] 视频号首评发射成功！`);
                    await randomSleep(page, 2000, 3000);
                } else {
                    await page.keyboard.press('Enter', { delay: 100 });
                    successCount++;
                }
            } else {
                console.log(`❌ 未能找到视频号详情页的评论输入框。`);
            }
        } catch (e) { console.log(`⚠️ 视频号首发异常:`, e.message); }
    }
    return { success: true, message: `视频号批量首发完毕！成功下发 ${successCount} 条。` };
}

/**
 * =========================================================
 * 4. 微信视频号：精准回复模块 (双重 Locator 物理锁定)
 * =========================================================
 */
export async function runReply(page, msg, replyText, randomSleep) {
    console.log(`🚀 [降临引擎] 正在前往视频号 互动评论中心...`);
    await applyWeixinStealth(page); 

    // 🌟 核心修复：调用物理寻路进入评论页
    const isNavigated = await navigateToCommentPageViaSidebar(page, randomSleep);
    if (!isNavigated) {
        console.log(`❌ 视频号回复终止：无法进入互动管理页面。`);
        return;
    }

    const exactUser = msg.username; 
    console.log(`🎯 正在全图锁定粉丝: [${exactUser}]`);

    try {
        const videoCards = page.locator('div.comment-feed-wrap');
        const cardCount = await videoCards.count();
        let foundUser = false;

        for (let i = 0; i < Math.min(10, cardCount); i++) {
            await videoCards.nth(i).click({ delay: Math.floor(Math.random() * 80) + 40 });
            await randomSleep(page, 1000, 1500);

            const userCommentBlock = page.locator('div.comment-item-main').filter({ hasText: exactUser }).first();
            
            if (await userCommentBlock.isVisible()) {
                console.log(`✅ [视觉雷达] 成功锁定目标！开始执行回复突击...`);
                foundUser = true;

                await humanMouseMove(page, 400 + Math.random() * 300, 500 + Math.random() * 200);

                const replyIcon = userCommentBlock.locator('span.weui-icon-outlined-comment').first();
                await replyIcon.click({ force: true, delay: 50 });
                await randomSleep(page, 800, 1200);

                const inputBox = page.locator('textarea.create-input').last(); 
                if (await inputBox.isVisible()) {
                    await inputBox.click();
                    await randomSleep(page, 500, 800);
                    
                    await humanType(page, replyText);
                    await randomSleep(page, 800, 1200);
                    
                    const sendBtn = page.locator('div.tag-wrap.primary').filter({ hasText: '评论' }).last();
                    if (await sendBtn.isVisible()) {
                        await sendBtn.click({ force: true, delay: 50 });
                        console.log(`🔥 [降临引擎] 视频号精准回复击发成功！`);
                    } else {
                        await page.keyboard.press('Enter');
                    }
                }
                break; 
            }
        }

        if (!foundUser) {
            console.log(`⚠️ 遍历了前排视频，未能找到该评论，可能已被删除或隐藏。`);
        }

    } catch (e) { 
        console.log(`❌ 视频号回复执行异常:`, e.message); 
    }
    
    await randomSleep(page, 2000, 3000);
}