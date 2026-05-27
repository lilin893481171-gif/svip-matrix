// src/main/platforms/baijiahao.js

/**
 * 🌟 核心突破 1：百家号专属防白屏隐形斗篷
 */
async function applyBaiduStealth(page) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.navigator.chrome = { runtime: {}, app: {} };
    });
}

/**
 * 🌟 核心突破 2：安全滑块悬停拦截器
 */
async function checkAndHandleCaptcha(page, randomSleep) {
    try {
        const captchaVisible = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('百度安全验证') && text.includes('请完成下方验证后继续操作');
        });

        if (captchaVisible) {
            console.log(`⚠️ [风控预警] 触发百度行为风控！机甲已紧急悬停，请在沙盒中【手动完成滑块】！倒计时 60 秒...`);
            await page.waitForFunction(() => {
                const text = document.body.innerText || '';
                return !(text.includes('百度安全验证') && text.includes('请完成下方验证后继续操作'));
            }, { timeout: 60000 });
            console.log(`✅ [风控解除] 滑块验证通过，机甲恢复执行！`);
            await randomSleep(page, 2000, 3000);
        }
    } catch (e) {}
}

/**
 * 🌟 核心突破 3：百家号智能前置导航器
 */
async function navigateToBaijiahaoComments(page, randomSleep) {
    console.log(`🎬 [智能导航] 正在初始化百家号全局环境...`);
    await page.goto('https://baijiahao.baidu.com/builder/rc/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomSleep(page, 4000, 5000); 

    await checkAndHandleCaptcha(page, randomSleep);

    console.log(`🎬 [智能导航] 正在模拟真人点击侧边栏...`);
    try {
        const navSuccess = await page.evaluate(async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const allElements = Array.from(document.querySelectorAll('div, span, li, a'));
            const hudong = allElements.find(el => el.innerText && el.innerText.trim() === '互动管理' && el.children.length === 0);
            if (hudong) hudong.click();
            await sleep(1500);
            const comments = Array.from(document.querySelectorAll('li, div, span, a')).filter(el => el.innerText && el.innerText.trim() === '评论管理');
            const target = comments.reverse().find(el => el.offsetWidth > 0 && el.offsetHeight > 0); 
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (navSuccess) {
            console.log(`✅ [智能导航] 成功通过侧边栏进入评论大厅！`);
            await randomSleep(page, 3000, 4000);
        } else {
            console.log(`⚠️ [智能导航] 侧边栏点击失败，尝试兜底软路由...`);
            await page.goto('https://baijiahao.baidu.com/builder/rc/comment', { waitUntil: 'domcontentloaded' });
            await randomSleep(page, 3000, 4000);
        }
    } catch(e) {
        await page.goto('https://baijiahao.baidu.com/builder/rc/comment', { waitUntil: 'domcontentloaded' });
    }
}

/**
 * 1. 百家号：【视频雷达】获取最新发布的 1-3 个视频
 */
export async function runVideoRadar(page, acc, randomSleep) {
    console.log(`\n🚀 [视频雷达] 启动 百家号【时序精准采集】引擎...`);
    await applyBaiduStealth(page); 

    let scannedVideoList = []; 
    let uniqueIds = new Set(); 

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/pcui/comment/articleList') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const list = json.data?.list || [];
                if (Array.isArray(list) && list.length > 0) {
                    const latestVideos = list.slice(0, 3);
                    latestVideos.forEach(item => {
                        const videoId = item.id || item.article_id;
                        if (!videoId) return;
                        if (!uniqueIds.has(videoId)) {
                            uniqueIds.add(videoId);
                            let timeStr = item.publish_time || item.publish_at || '刚刚发布';
                            let previewUrl = item.url || `https://baijiahao.baidu.com/builder/preview/s?id=${videoId}`;
                            if (previewUrl.startsWith('http:')) previewUrl = previewUrl.replace('http:', 'https:');
                            let coverUrl = item.crosswise_cover || '';
                            if (coverUrl.startsWith('http:')) coverUrl = coverUrl.replace('http:', 'https:');

                            scannedVideoList.push({
                                id: videoId, title: item.title || '百家号最新作品', cover: coverUrl, 
                                time: timeStr, url: previewUrl, platform: '百家号', account: acc.alias
                            });
                        }
                    });
                }
            } catch(e) {}
        }
    });

    await navigateToBaijiahaoComments(page, randomSleep);
    
    try {
        const filterBox = page.locator('.article-filter, input[placeholder*="搜索"]').first();
        if (await filterBox.isVisible()) {
            await filterBox.click();
            await randomSleep(page, 1500, 2000);
        }
    } catch(e) {}

    if (scannedVideoList.length === 0) {
        console.log(`⚠️ UI 拦截未命中，启动 API 强穿透模式窃取最新视频...`);
        try {
            const fallbackList = await page.evaluate(async () => {
                const urls = [
                    '/pcui/comment/articleList?size=5&type=ugc_video&search=&sub_type=vertical_small_video&page=1', 
                    '/pcui/comment/articleList?size=5&type=video&search=&page=1', 
                    '/pcui/comment/articleList?size=5&type=article&search=&page=1', 
                    '/pcui/comment/articleList?size=5&page=1' 
                ];
                for (let u of urls) {
                    try {
                        const res = await fetch(u).then(r => r.json());
                        if (res && res.data && res.data.list && res.data.list.length > 0) return res.data.list; 
                    } catch(e) {}
                }
                return [];
            });

            if (fallbackList && fallbackList.length > 0) {
                fallbackList.slice(0, 3).forEach(item => {
                    const videoId = item.id || item.article_id;
                    if (!uniqueIds.has(videoId)) {
                        uniqueIds.add(videoId);
                        let previewUrl = item.url || `https://baijiahao.baidu.com/builder/preview/s?id=${videoId}`;
                        if (previewUrl.startsWith('http:')) previewUrl = previewUrl.replace('http:', 'https:');
                        let coverUrl = item.crosswise_cover || '';
                        if (coverUrl.startsWith('http:')) coverUrl = coverUrl.replace('http:', 'https:');

                        scannedVideoList.push({
                            id: videoId, title: item.title || '百家号最新作品', cover: coverUrl, 
                            time: item.publish_time || item.publish_at || '刚刚发布', url: previewUrl, 
                            platform: '百家号', account: acc.alias
                        });
                    }
                });
                console.log(`✅ [API强穿透] 成功锁定最新发布的 ${scannedVideoList.length} 个百家号作品！`);
            }
        } catch(e) {}
    }

    return { success: true, message: scannedVideoList.length > 0 ? `🎯 百家号最新作品检索完毕！锁定 ${scannedVideoList.length} 个作品！` : `⚠️ 未能获取到最新作品。`, scannedVideos: scannedVideoList };
}

/**
 * 2. 百家号：【评论雷达】只抓最新粉丝评论
 */
export async function runCommentRadar(page, db, acc, randomSleep) {
    console.log(`\n🚀 [评论雷达] 启动 百家号粉丝留言监控引擎...`);
    await applyBaiduStealth(page); 
    let newCount = 0;
    const insertStmt = db.prepare(`INSERT INTO messages (platform, account_alias, username, avatar, video_cover, content, time, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/pcui/comment/list') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const commentsArray = json.data?.reply_list || [];
                if (commentsArray.length > 0) {
                    for (const item of commentsArray) {
                        const username = item.uname || '未知用户';
                        if (item.is_author || username === acc.alias) continue;

                        const rawContent = item.content || '';
                        if (!rawContent) continue;
                        
                        const finalContent = `[视频: ${item.title ? item.title.substring(0, 10) : '百家号作品'}] ${rawContent}`;
                        let timeStr = '刚刚';
                        if (item.create_time) {
                            let d = new Date(parseInt(item.create_time) * 1000);
                            timeStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        }
                        let avatar = item.avatar || '';
                        if (avatar.startsWith('\\/\\/')) avatar = avatar.replace(/\\\/\\\//g, 'https://');
                        
                        const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, username, finalContent);
                        if (!exists) {
                            insertStmt.run('百家号', acc.alias, username, avatar, '', finalContent, timeStr, '未回复', '评论');
                            newCount++;
                        }
                    }
                    console.log(`🎯 [评论雷达] 拦截提取完毕，新入库 ${newCount} 条百家号留言。`);
                }
            } catch(e) {}
        }
    });

    await navigateToBaijiahaoComments(page, randomSleep);
    await page.mouse.wheel(0, 800); 
    await randomSleep(page, 1500, 2500);

    return { success: true, message: `🎯 百家号评论库更新完毕！新增 ${newCount} 条粉丝评论！` };
}

/**
 * 3. 百家号：批量首发置顶模块 (搭载拟人化键盘与鼠标轨迹)
 */
export async function runBatchPin(page, targetVideos, replyText, randomSleep) {
    let successCount = 0;
    await applyBaiduStealth(page); 

    for (const video of targetVideos) {
        console.log(`🎬 [首发引擎] 正在空降百家号作品播放页: [${video.title}]`);
        try {
            if (!video.url) continue;

            await page.goto('https://baijiahao.baidu.com/builder/rc/home', { waitUntil: 'domcontentloaded' });
            await randomSleep(page, 1000, 1500);
            
            await checkAndHandleCaptcha(page, randomSleep);

            await page.goto(video.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomSleep(page, 3000, 4500);
            
            await checkAndHandleCaptcha(page, randomSleep);

            // 🌟 拟人化操作：随机滑动鼠标，骗过轨迹探针
            await page.mouse.move(300 + Math.random() * 200, 400 + Math.random() * 200, { steps: 5 });
            await page.mouse.wheel(0, 600); 
            await randomSleep(page, 1500, 2000);

            const inputBox = page.locator('textarea, .comment-input, [contenteditable="true"]').filter({ visible: true }).first();
            
            if (await inputBox.isVisible()) {
                await inputBox.click({ delay: Math.floor(Math.random() * 100) + 50 }); // 模拟按下鼠标的停顿
                await randomSleep(page, 500, 1000);
                
                // 🌟 终极拟人化打字：不再使用瞬间粘贴！像真人一样一个个字敲进去！
                await page.keyboard.type(replyText, { delay: Math.floor(Math.random() * 100) + 50 }); 
                
                await randomSleep(page, 1000, 1500);

                // 🌟 发送前再次微调鼠标位置
                await page.mouse.move(600 + Math.random() * 100, 600 + Math.random() * 100, { steps: 3 });
                const sendBtn = page.locator('button:visible, .submit-btn:visible').filter({ hasText: /发表|评论|发布|发送/ }).first();
                
                if (await sendBtn.isVisible()) {
                    await sendBtn.click({ delay: Math.floor(Math.random() * 100) + 50 });
                    successCount++;
                    console.log(`🔥 [首发引擎] 百家号首评发射成功！(拟人化击发)`);
                    await randomSleep(page, 2000, 3000);
                } else {
                    await page.keyboard.press('Enter', { delay: 100 });
                    successCount++;
                }
            }
        } catch (e) { console.log(`⚠️ 百家号首发异常:`, e.message); }
    }
    return { success: true, message: `百家号批量首发完毕！成功下发 ${successCount} 条。` };
}

/**
 * 4. 百家号：精准回复模块 (搭载拟人化键盘与鼠标轨迹)
 */
export async function runReply(page, msg, replyText, randomSleep) {
    console.log(`🚀 [降临引擎] 正在空降百家号评论管理页...`);
    await applyBaiduStealth(page); 

    await navigateToBaijiahaoComments(page, randomSleep);

    const textOnlyContent = msg.content.replace(/\[视频:[\s\S]*?\]\s*/, '').replace(/\[.*?\]/g, '').trim();
    const searchSnippet = textOnlyContent.substring(0, 8);
    const exactUser = msg.username; 

    console.log(`🎯 最终锁定 -> 目标用户: [${exactUser}], 特征码: [${searchSnippet || '纯表情无文字'}]`);

    const isClicked = await page.evaluate(async ({ exactUser, searchSnippet }) => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        for (let i = 0; i < 5; i++) {
            const items = Array.from(document.querySelectorAll('div, li')).filter(el => {
                return el.offsetHeight > 40 && el.offsetHeight < 300 && el.innerText && el.innerText.includes(exactUser);
            });
            for (let el of items) {
                const cleanText = el.innerText.replace(/\s+/g, '');
                if (cleanText.includes(exactUser.replace(/\s+/g, '')) && (!searchSnippet || cleanText.includes(searchSnippet.replace(/\s+/g, '')))) {
                    el.click();
                    return true; 
                }
            }
            const nextBtn = document.querySelector('.btn-next, .ivu-pagination-next');
            if (nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
                await sleep(2500);
            } else {
                const scrollables = Array.from(document.querySelectorAll('*')).filter(el => el.scrollHeight > el.clientHeight && el.clientHeight > 200);
                if (scrollables.length > 0) scrollables.forEach(s => s.scrollBy(0, 500));
                else window.scrollBy(0, 800); 
                await sleep(1500);
            }
        }
        return false;
    }, { exactUser, searchSnippet });

    if (isClicked) {
        console.log(`✅ [视觉雷达] 成功点击左侧卡片，右侧回复面板已激活！`);
        await randomSleep(page, 1500, 2000); 

        try {
            // 🌟 拟人化操作：随机滑动鼠标
            await page.mouse.move(500 + Math.random() * 200, 500 + Math.random() * 200, { steps: 5 });

            const inputBox = page.locator('textarea[placeholder*="回复"], textarea').filter({ visible: true }).last();
            if (await inputBox.isVisible()) {
                await inputBox.click({ delay: Math.floor(Math.random() * 100) + 50 });
                await randomSleep(page, 500, 1000);
                
                // 🌟 终极拟人化打字
                await page.keyboard.type(replyText, { delay: Math.floor(Math.random() * 100) + 50 });
                
                await randomSleep(page, 1000, 1500);
                
                const sendBtn = page.locator('button:visible, span:visible, div[role="button"]:visible').filter({ hasText: /^回\s*复$|^发\s*送$/ }).last();
                if (await sendBtn.isVisible()) {
                    await sendBtn.click({ delay: Math.floor(Math.random() * 100) + 50 });
                    console.log(`🔥 [降临引擎] 百家号右侧面板回复击发成功！`);
                } else {
                    await page.keyboard.press('Enter', { delay: 100 });
                }
            } else {
                console.log(`❌ 未能捕获到右侧的回复框。`);
            }
        } catch (e) { console.log(`❌ 百家号回复执行异常:`, e.message); }
        await randomSleep(page, 2000, 3000);
    } else {
        console.log(`⚠️ 滚动扫描后未发现该评论，可能已被删除。`);
    }
}