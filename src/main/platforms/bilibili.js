// src/main/platforms/bilibili.js

/**
 * 1. B站：【视频雷达】只抓最新发布的 1-3 个视频 (用于首发置顶)
 */
export async function runVideoRadar(page, acc, randomSleep) {
    console.log(`\n🚀 [视频雷达] 启动 B站稿件检索引擎...`);
    let scannedVideoList = []; 
    let uniqueBvids = new Set(); 

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/x/web/archives') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                if (json.data && Array.isArray(json.data.arc_audits)) {
                    const latestVideos = json.data.arc_audits.slice(0, 3);
                    latestVideos.forEach(item => {
                        const arch = item.Archive;
                        if (!arch || !arch.bvid) return;
                        
                        if (!uniqueBvids.has(arch.bvid)) {
                            uniqueBvids.add(arch.bvid);
                            let pTime = arch.ptime ? new Date(arch.ptime * 1000) : new Date();
                            let timeStr = `${(pTime.getMonth() + 1).toString().padStart(2, '0')}-${pTime.getDate().toString().padStart(2, '0')} ${pTime.getHours().toString().padStart(2, '0')}:${pTime.getMinutes().toString().padStart(2, '0')}`;
                            
                            scannedVideoList.unshift({
                                id: arch.bvid,
                                title: arch.title,
                                cover: arch.cover || arch.cover_url,
                                time: timeStr,
                                platform: 'B站',
                                account: acc.alias
                            });
                        }
                    });
                    console.log(`🎯 [视频雷达] 已锁定最新发布的 ${scannedVideoList.length} 个视频。`);
                }
            } catch(e) {}
        }
    });

    console.log(`🎬 正在空降稿件管理大厅...`);
    await page.goto('https://member.bilibili.com/platform/upload-manager/article', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomSleep(page, 3000, 4500); 

    return { 
        success: true, 
        message: `🎯 B站最新视频检索完毕！锁定 ${scannedVideoList.length} 个视频！`, 
        scannedVideos: scannedVideoList 
    };
}

/**
 * 2. B站：【评论雷达】只抓最新粉丝评论 (用于回复互动)
 */
export async function runCommentRadar(page, db, acc, randomSleep) {
    console.log(`\n🚀 [评论雷达] 启动 B站粉丝留言监控引擎...`);
    let newCount = 0;
    const insertStmt = db.prepare(`
        INSERT INTO messages (platform, account_alias, username, avatar, video_cover, content, time, status, type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('/x/v2/reply/up/fulllist') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                if (json.data && Array.isArray(json.data.list)) {
                    for (const item of json.data.list) {
                        const username = item.member?.uname || '未知用户';
                        if (username === acc.alias) continue; // 过滤 UP 主自己

                        const rawContent = item.content?.message || '';
                        if (!rawContent) continue;
                        
                        const finalContent = `[视频: ${item.title || '未知视频'}] ${rawContent}`;
                        let timeStr = '刚刚';
                        if (item.ctime) {
                            let d = new Date(item.ctime * 1000);
                            timeStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        }
                        
                        const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, username, finalContent);
                        if (!exists) {
                            insertStmt.run('B站', acc.alias, username, item.member?.avatar || '', item.cover_url || '', finalContent, timeStr, '未回复', '评论');
                            newCount++;
                        }
                    }
                    console.log(`🎯 [评论雷达] 拦截提取完毕，新入库 ${newCount} 条留言。`);
                }
            } catch(e) {}
        }
    });

    console.log(`🎬 正在空降视频评论管理页...`);
    await page.goto('https://member.bilibili.com/platform/comment/article', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomSleep(page, 3000, 4000);
    await page.mouse.wheel(0, 1000); 
    await randomSleep(page, 1500, 2500);

    return { 
        success: true, 
        message: `🎯 B站评论库更新完毕！新增 ${newCount} 条粉丝评论！` 
    };
}

/**
 * 3. B站：批量首发置顶模块
 */
export async function runBatchPin(page, targetVideos, replyText, randomSleep) {
    let successCount = 0;
    for (const video of targetVideos) {
        console.log(`🎬 [首发引擎] 正在空降 B站视频页: [${video.title}]`);
        try {
            await page.goto(`https://www.bilibili.com/video/${video.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomSleep(page, 4000, 5000);
            await page.mouse.wheel(0, 1200);
            await randomSleep(page, 2000, 3000);

            const inputBox = page.locator('.brt-editor[contenteditable="true"], .reply-box textarea').first();
            if (await inputBox.isVisible()) {
                await inputBox.click();
                await randomSleep(page, 500, 1000);
                await page.keyboard.insertText(replyText);
                await randomSleep(page, 1000, 1500);

                const sendBtn = page.locator('#pub button, .reply-box .send-text').filter({ hasText: /发布|发送/ }).first();
                if (await sendBtn.isVisible()) {
                    await sendBtn.click();
                    successCount++;
                    console.log(`🔥 [首发引擎] B站视频 [${video.id}] 首评发射成功！`);
                    await randomSleep(page, 2000, 3000);
                } else {
                    await page.keyboard.press('Enter');
                    successCount++;
                }
            }
        } catch (e) { console.log(`⚠️ B站首发异常:`, e.message); }
    }
    return { success: true, message: `B站批量首发完毕！成功下发 ${successCount} 条。` };
}

/**
 * 4. B站：精准回复模块 (原生物理鼠标版)
 */
export async function runReply(page, msg, replyText, randomSleep) {
    console.log(`🚀 [降临引擎] 正在空降 B站 视频评论管理页...`);
    await page.goto('https://member.bilibili.com/platform/comment/article', { waitUntil: 'domcontentloaded' });
    await randomSleep(page, 3000, 4000);

    const textOnlyContent = msg.content.replace(/\[视频:[\s\S]*?\]\s*/, '').replace(/\[.*?\]/g, '').trim();
    const searchSnippet = textOnlyContent.substring(0, 8);
    const exactUser = msg.username; 

    if (searchSnippet) {
        console.log(`🔍 [视觉雷达] 正在执行 B站 评论内容搜索狙击: [${searchSnippet}]`);
        try {
            const searchInput = page.locator('input[placeholder*="搜索视频评论"]:visible, .bcc-input-inner:visible').first();
            if (await searchInput.isVisible()) {
                await searchInput.fill(searchSnippet);
                await page.keyboard.press('Enter');
                await randomSleep(page, 2500, 3500); 
            }
        } catch (e) { console.log(`⚠️ 搜索框定位失败。`); }
    }

    const targetIndex = await page.evaluate(async ({ exactUser, searchSnippet }) => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        let foundIdx = -1;
        for (let i = 0; i < 3; i++) {
            const items = Array.from(document.querySelectorAll('.comment-list-item'));
            for (let idx = 0; idx < items.length; idx++) {
                const userNode = items[idx].querySelector('a.user-avatar[card]');
                const actualUsername = userNode ? userNode.getAttribute('card') : '';
                const cleanText = (items[idx].innerText || '').replace(/\s+/g, '');
                if (actualUsername === exactUser && (!searchSnippet || cleanText.includes(searchSnippet.replace(/\s+/g, '')))) {
                    foundIdx = idx; break; 
                }
            }
            if (foundIdx !== -1) break;
            window.scrollBy(0, 800); await sleep(1500);
        }
        return foundIdx;
    }, { exactUser, searchSnippet });

    if (targetIndex !== -1) {
        console.log(`✅ [视觉雷达] 锁定第 ${targetIndex + 1} 条，物理点击回复...`);
        try {
            const targetItem = page.locator('.comment-list-item').nth(targetIndex);
            const nativeReplyBtn = targetItem.locator('.reply.action, span:has-text("回复")').first();
            await nativeReplyBtn.scrollIntoViewIfNeeded();
            await nativeReplyBtn.click(); 
            await randomSleep(page, 1500, 2000);

            const inputBox = page.locator('.reply-wrap textarea:visible, .brt-editor:visible').first();
            if (await inputBox.isVisible()) {
                await inputBox.click();
                await page.keyboard.insertText(replyText);
                await randomSleep(page, 1000, 1500);
                const sendBtn = page.locator('.reply-wrap button:visible').filter({ hasText: /发表回复|回复|发送/ }).first();
                if (await sendBtn.isVisible()) await sendBtn.click();
                else await page.keyboard.press('Enter');
                console.log(`🔥 [降临引擎] B站回复击发成功！`);
            }
        } catch (e) { console.log(`❌ B站回复执行异常:`, e.message); }
    } else {
        console.log(`⚠️ 未发现该评论。`);
    }
}