// src/main/platforms/kuaishou.js

/**
 * 🌟 核心导航器：模拟真人穿透快手左侧边栏
 */
async function navigateToKuaishouComments(page, randomSleep) {
    console.log(`🎬 正在尝试进入快手大厅...`);
    await page.goto('https://cp.kuaishou.com/profile', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomSleep(page, 3000, 4000);
    
    console.log(`🎬 正在通过侧边栏穿透评论大厅...`);
    try {
        // 使用更宽松的包含匹配，因为快手的文本被 span 包裹了
        const hudongMenu = page.locator('div.el-submenu__title:has-text("互动管理")').last();
        if (await hudongMenu.isVisible()) {
            await hudongMenu.click();
            await randomSleep(page, 1000, 1500);
        }
        
        // 尝试点击里面的子菜单
        const commentMenu = page.locator('li.el-menu-item:has-text("评论管理")').last();
        if (await commentMenu.isVisible()) {
            await commentMenu.click();
            console.log(`✅ 已成功点击“评论管理”侧边栏菜单`);
            await randomSleep(page, 3000, 4000);
        } else {
            console.log(`⚠️ 未找到“评论管理”菜单项，尝试强制路由。`);
            await page.goto('https://cp.kuaishou.com/article/comment', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomSleep(page, 3000, 4000);
        }
    } catch(e) { 
        console.log("侧边栏点击异常，尝试备用路由:", e.message); 
        await page.goto('https://cp.kuaishou.com/article/comment', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomSleep(page, 3000, 4000);
    }
}

/**
 * 🌟 视频选择器：处理快手的弹窗列表 (加入“当前默认视频”智能免切换检测)
 */
async function selectTargetVideoInDialog(page, videoTitle, randomSleep) {
    const shortTitle = videoTitle.substring(0, 8).replace(/\s+/g, '');

    // 🌟 新增优化：第一步，先看一眼当前页面默认展示的视频是不是我们要找的！
    const isAlreadyActive = await page.evaluate((t) => {
        // 抓取当前页面主区域（非弹窗）展示的默认视频标题
        const currentVideoTitleEl = document.querySelector('.comment-home-video .video-info__content__title') || 
                                    document.querySelector('.video-info__content__title');
        if (currentVideoTitleEl) {
            const currentTxt = currentVideoTitleEl.innerText.replace(/\s+/g, '');
            // 如果默认视频包含我们要找的标题，说明可以直接评论！
            if (currentTxt.includes(t)) {
                return true;
            }
        }
        return false;
    }, shortTitle);

    if (isAlreadyActive) {
        console.log(`✅ [智能识别] 当前默认视频即为首发目标，跳过列表选择，直接进入射击姿态！`);
        await randomSleep(page, 1000, 1500); // 稍微停顿，让输入框充分加载
        return true; 
    }

    // 🌟 如果默认视频不是我们要找的，再走原来的弹窗搜索逻辑
    const selectVideoBtn = page.locator('button.comment__header__video-btn, button:has-text("选择视频")').first();
    if (await selectVideoBtn.isVisible()) {
        await selectVideoBtn.click();
        await randomSleep(page, 1500, 2000);

        const videoClicked = await page.evaluate((t) => {
            // 确保只在弹窗内搜索
            const dialog = document.querySelector('.el-dialog__wrapper[style*="display: none"]');
            const searchArea = dialog && dialog.style.display !== 'none' ? dialog : document.body;
            
            // 通过标题找到目标视频
            const titles = Array.from(searchArea.querySelectorAll('.video-info__content__title')).filter(el => {
                const txt = (el.innerText || '').replace(/\s+/g, '');
                return txt.includes(t); 
            });
            
            if (titles.length > 0) {
                const parentBox = titles[0].parentElement;
                if (parentBox) {
                    // 避开标题跳链，点击安全区
                    const safeClickArea = parentBox.querySelector('.video-info__content__date') || 
                                          parentBox.querySelector('.video-info__content__detail') || 
                                          parentBox;
                    safeClickArea.click();
                    return true;
                }
            }
            return false;
        }, shortTitle);

        if (videoClicked) {
            await randomSleep(page, 2500, 3500);
            return true;
        } else {
            // 没找到，关掉弹窗
            const closeBtn = page.locator('.el-dialog__close').last();
            if (await closeBtn.isVisible()) await closeBtn.click();
            else await page.mouse.click(10, 10);
            return false;
        }
    }
    return false;
}

/**
 * 1. 快手：【视频雷达】只抓最新发布的 1-3 个视频
 */
export async function runVideoRadar(page, acc, randomSleep) {
    console.log(`\n🚀 [视频雷达] 启动 快手【时序精准采集】引擎...`);
    let scannedVideoList = []; 
    let uniqueIds = new Set(); 

    page.on('response', async (res) => {
        const url = res.url();
        if ((url.includes('/photoList') || url.includes('/video/list') || url.includes('/article/list')) && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const list = json.data?.photoList || json.data?.list || json.data?.visionProfilePhotoList || [];
                
                if (Array.isArray(list) && list.length > 0) {
                    const latestVideos = list.slice(0, 3);
                    latestVideos.forEach(item => {
                        const videoId = item.photoId || item.id;
                        if (!videoId) return;
                        if (!uniqueIds.has(videoId)) {
                            uniqueIds.add(videoId);
                            let timeStr = '刚刚发布';
                            const timestamp = item.uploadTime || item.timestamp || item.createTime;
                            if (timestamp) {
                                let pTime = new Date(timestamp);
                                timeStr = `${(pTime.getMonth() + 1).toString().padStart(2, '0')}-${pTime.getDate().toString().padStart(2, '0')} ${pTime.getHours().toString().padStart(2, '0')}:${pTime.getMinutes().toString().padStart(2, '0')}`;
                            }
                            scannedVideoList.unshift({
                                id: videoId, title: item.title || item.caption || '快手最新视频',
                                cover: item.cover || item.coverUrl || item.coverUrls?.[0]?.url || '', time: timeStr, platform: '快手', account: acc.alias
                            });
                        }
                    });
                    console.log(`🎯 [视频雷达] 已锁定最新发布的 ${scannedVideoList.length} 个快手视频。`);
                }
            } catch(e) {}
        }
    });

    await navigateToKuaishouComments(page, randomSleep);
    
    // 唤起选择视频下拉框，引出最新视频 API
    try {
        const selectBtn = page.locator('button.comment__header__video-btn, button:has-text("选择视频")').first();
        if (await selectBtn.isVisible()) {
            await selectBtn.click();
            await randomSleep(page, 1500, 2000);
            const closeBtn = page.locator('.el-dialog__close').last();
            if (await closeBtn.isVisible()) await closeBtn.click();
            else await page.mouse.click(10, 10);
        }
    } catch(e) {}

    return { success: true, message: `🎯 快手最新视频检索完毕！锁定 ${scannedVideoList.length} 个视频！`, scannedVideos: scannedVideoList };
}

/**
 * 2. 快手：【评论雷达】只抓最新粉丝评论
 */
export async function runCommentRadar(page, db, acc, randomSleep) {
    console.log(`\n🚀 [评论雷达] 启动 快手粉丝留言监控引擎...`);
    let newCount = 0;
    const insertStmt = db.prepare(`INSERT INTO messages (platform, account_alias, username, avatar, video_cover, content, time, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    page.on('response', async (res) => {
        const url = res.url();
        if ((url.includes('/commentList') || url.includes('/comment/list') || url.includes('/interaction/comment')) && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const commentsArray = json.data?.list || json.data?.comments || [];
                if (commentsArray.length > 0) {
                    for (const item of commentsArray) {
                        const username = item.authorName || item.userName || '未知用户';
                        if (username === acc.alias) continue;
                        const rawContent = item.content || '';
                        if (!rawContent) continue;
                        const finalContent = `[视频: 快手作品] ${rawContent}`;
                        let timeStr = '刚刚';
                        const timestamp = item.timestamp || item.createTime;
                        if (timestamp) {
                            let d = new Date(timestamp);
                            timeStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        }
                        const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, username, finalContent);
                        if (!exists) {
                            insertStmt.run('快手', acc.alias, username, item.headurl || item.headUrl || '', '', finalContent, timeStr, '未回复', '评论');
                            newCount++;
                        }
                    }
                    console.log(`🎯 [评论雷达] 拦截提取完毕，新入库 ${newCount} 条快手留言。`);
                }
            } catch(e) {}
        }
    });

    await navigateToKuaishouComments(page, randomSleep);
    await page.mouse.wheel(0, 1000); 
    await randomSleep(page, 1500, 2500);

    return { success: true, message: `🎯 快手评论库更新完毕！新增 ${newCount} 条粉丝评论！` };
}

/**
 * 3. 快手：批量首发置顶模块 (完全匹配你抓的 DOM)
 */
export async function runBatchPin(page, targetVideos, replyText, randomSleep) {
    let successCount = 0;
    await navigateToKuaishouComments(page, randomSleep);

    for (const video of targetVideos) {
        console.log(`🎬 [首发引擎] 正在处理快手视频: [${video.title}]`);
        try {
            const isSelected = await selectTargetVideoInDialog(page, video.title, randomSleep);

            if (isSelected) {
                // 匹配你抓包的 .author-comment-input__row__input
                const inputBox = page.locator('.author-comment-input__row__input[contenteditable="true"], div[placeholder*="有爱评论"]').first();
                if (await inputBox.isVisible()) {
                    await inputBox.click();
                    await randomSleep(page, 500, 1000);
                    await page.keyboard.insertText(replyText);
                    await randomSleep(page, 1000, 1500);

                    // 匹配你抓包的 .author-comment-input__row__btn
                    const sendBtn = page.locator('.author-comment-input__row__btn').filter({ hasText: '发送' }).first();
                    if (await sendBtn.isVisible()) {
                        await sendBtn.click();
                        successCount++;
                        console.log(`🔥 [首发引擎] 快手视频首评发射成功！`);
                        await randomSleep(page, 2000, 3000);
                    } else { await page.keyboard.press('Enter'); successCount++; }
                } else {
                    console.log(`❌ 首评输入框未找到。`);
                }
            } else {
                console.log(`⚠️ 未能在弹窗中找到指定视频标题。`);
            }
        } catch (e) { console.log(`⚠️ 快手首发异常:`, e.message); }
    }
    return { success: true, message: `快手批量首发完毕！成功下发 ${successCount} 条。` };
}

/**
 * 4. 快手：精准回复模块 (完全匹配你抓的 DOM)
 */
export async function runReply(page, msg, replyText, randomSleep) {
    console.log(`🚀 [降临引擎] 正在空降快手评论管理页...`);
    await navigateToKuaishouComments(page, randomSleep);

    const videoTitleMatch = msg.content.match(/\[视频:\s*([\s\S]*?)\]/);
    const targetVideoTitle = videoTitleMatch ? videoTitleMatch[1].trim() : null;

    if (targetVideoTitle && targetVideoTitle !== '快手作品') {
        console.log(`🎬 [机甲导航] 准备切换至快手视频: [${targetVideoTitle.substring(0, 10)}]`);
        await selectTargetVideoInDialog(page, targetVideoTitle, randomSleep);
    }

    const textOnlyContent = msg.content.replace(/\[视频:[\s\S]*?\]\s*/, '').replace(/\[.*?\]/g, '').trim();
    const searchSnippet = textOnlyContent.substring(0, 8);
    const exactUser = msg.username; 

    console.log(`🎯 最终锁定 -> 目标用户: [${exactUser}], 特征码: [${searchSnippet || '纯表情无文字'}]`);

    // 使用物理坐标锁定目标位置，匹配你抓包的 .comment-item 及其内部结构
    const targetIndex = await page.evaluate(async ({ exactUser, searchSnippet }) => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        let foundIdx = -1;
        for (let i = 0; i < 5; i++) {
            const items = Array.from(document.querySelectorAll('.comment-item')); 
            for (let idx = 0; idx < items.length; idx++) {
                const usernameEl = items[idx].querySelector('.comment-content__username');
                const contentEl = items[idx].querySelector('.comment-content__detail');
                
                const actualUser = usernameEl ? usernameEl.innerText.replace(/\s+/g, '') : '';
                const actualContent = contentEl ? contentEl.innerText.replace(/\s+/g, '') : '';

                if (actualUser === exactUser.replace(/\s+/g, '') && (!searchSnippet || actualContent.includes(searchSnippet.replace(/\s+/g, '')))) {
                    foundIdx = idx; break; 
                }
            }
            if (foundIdx !== -1) break;
            window.scrollBy(0, 800); await sleep(1500);
        }
        return foundIdx;
    }, { exactUser, searchSnippet });

    if (targetIndex !== -1) {
        console.log(`✅ [视觉雷达] 锁定目标评论！正在召唤物理鼠标...`);
        try {
            const targetItem = page.locator('.comment-item').nth(targetIndex);
            
            // 匹配你抓包的 .comment-content__btns__btn
            const nativeReplyBtn = targetItem.locator('.comment-content__btns__btn').filter({ hasText: '回复' }).first();
            await nativeReplyBtn.scrollIntoViewIfNeeded();
            await nativeReplyBtn.click(); 
            await randomSleep(page, 1500, 2000);

            // 匹配你抓包的 .comment-input 及其弹出的状态
            const inputBox = page.locator('.comment-input[contenteditable="true"]:visible').last();
            if (await inputBox.isVisible()) {
                await inputBox.click();
                await page.keyboard.insertText(replyText);
                await randomSleep(page, 1000, 1500);
                
                // 匹配你抓包的 .sure-btn
                const sendBtn = page.locator('.sure-btn:visible').filter({ hasText: '确认' }).last();
                if (await sendBtn.isVisible()) {
                    await sendBtn.click();
                    console.log(`🔥 [降临引擎] 快手回复物理击发成功！`);
                } else { await page.keyboard.press('Enter'); }
            } else { console.log(`❌ 未能捕获到快手弹出的回复框。`); }
        } catch (e) { console.log(`❌ 快手回复执行异常:`, e.message); }
        await randomSleep(page, 2000, 3000);
    } else {
        console.log(`⚠️ 滚动扫描后未发现该评论，可能已被删除。`);
    }
}