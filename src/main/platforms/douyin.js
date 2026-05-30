// src/main/platforms/douyin.js

// =================================================================
// 1. 抖音：雷达扫描模块 (图文级精准巡检)
// =================================================================
async function runRadar(page, db, acc, randomSleep) {
    console.log(`\n🚀 [双擎雷达] 启动抖音【图文级精准巡检】引擎...`);

    let newCount = 0;
    let capturedTotal = 0;
    let videoDataMap = {}; 
    let videoListCaptured = false;
    let clickIndices = []; 
    let scannedVideoList = []; 

    const insertStmt = db.prepare(`
        INSERT INTO messages (platform, account_alias, username, avatar, video_cover, content, time, type, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, '评论', '未回复')
    `);

    page.on('response', async (res) => {
        const url = res.url();
        
        // 📡 拦截 1：无视有无评论，强制抓取最新发布的 1-3 个视频
        if (url.includes('item/list') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                if (json.item_info_list && Array.isArray(json.item_info_list)) {
                    const latest3Videos = json.item_info_list.slice(0, 3);
                    
                    latest3Videos.forEach((v, index) => {
                        let cleanTitle = v.title.split('#')[0].trim();
                        if (!cleanTitle) cleanTitle = '最新视频';
                        
                        let videoCover = v.video?.cover?.url_list?.[0] || v.video?.origin_cover?.url_list?.[0] || v.cover_image_url || '';
                        
                        let publishTime = '刚刚发布';
                        if (v.create_time) {
                            const date = new Date(v.create_time * 1000);
                            publishTime = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        }
                        
                        videoDataMap[String(v.item_id_plain)] = { title: cleanTitle, cover: videoCover };
                        
                        scannedVideoList.push({
                            id: String(v.item_id_plain),
                            title: cleanTitle,
                            cover: videoCover,
                            time: publishTime,
                            platform: '抖音',
                            account: acc.alias
                        });
                        
                        // 记录有评论的视频索引，后续引导页面点击
                        if (v.comment_count > 0) {
                            clickIndices.push(index);
                        }
                    });

                    console.log(`\n🎯 [战术扫描] 锁定最新 ${scannedVideoList.length} 个视频！准备制导...`);
                    videoListCaptured = true;
                }
            } catch(e) {}
        }

        // 📡 拦截 2：抓取评论列表
        if (url.includes('/comment/list') && res.ok() && res.request().method() !== 'OPTIONS') {
            try {
                const json = await res.json();
                const commentsArray = json.comments || (json.data && json.data.comments) || [];
                if (commentsArray.length > 0) {
                    let insertedCount = 0;
                    for (const comment of commentsArray) {
                        const username = comment.user?.nickname || '未知用户';
                        const rawContent = comment.text || '';
                        const awemeId = String(comment.aweme_id);
                        const userAvatar = comment.user?.avatar_thumb?.url_list?.[0] || comment.user?.avatar_url || '';
                        
                        if (!rawContent) continue;
                        const vData = videoDataMap[awemeId] || { title: '未知视频', cover: '' };
                        const finalContent = `[视频: ${vData.title}] ${rawContent}`;

                        let timeStr = '刚刚';
                        if (comment.create_time) {
                            const date = new Date(comment.create_time * 1000);
                            timeStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                        }

                        const exists = db.prepare('SELECT id FROM messages WHERE account_alias=? AND username=? AND content=?').get(acc.alias, username, finalContent);
                        if (!exists) {
                            insertStmt.run('抖音', acc.alias, username, userAvatar, vData.cover, finalContent, timeStr);
                            insertedCount++;
                            newCount++;
                        }
                    }
                    capturedTotal += commentsArray.length;
                }
            } catch(e) { }
        }
    });

    // ================= 会话交互逻辑 =================
    await page.goto('https://creator.douyin.com/creator-micro/interactive/comment', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 等待网络数据捕获
    for (let i = 0; i < 15; i++) {
        if (videoListCaptured) break;
        await page.waitForTimeout(1000);
    }

    if (clickIndices.includes(0)) {
        await randomSleep(page, 2000, 3000);
        await page.mouse.wheel(0, 1500); 
        await randomSleep(page, 2000, 3000);
    }

    const targetIndices = clickIndices.filter(idx => idx > 0 && idx < 3);
    if (targetIndices.length > 0) {
        for (let uiIndex of targetIndices) {
            try {
                const selectBtn = page.getByText('选择作品', { exact: true }).first();
                if (await selectBtn.isVisible()) {
                    await selectBtn.click();
                    await randomSleep(page, 1500, 2000);
                    
                    const targetBox = await page.evaluate((idx) => {
                        const imgs = Array.from(document.querySelectorAll('img'));
                        const drawerCovers = imgs.filter(img => {
                            const rect = img.getBoundingClientRect();
                            return rect.width > 40 && rect.width < 150 && rect.left > window.innerWidth / 2;
                        });
                        if (drawerCovers.length > idx) {
                            const rect = drawerCovers[idx].getBoundingClientRect();
                            return { x: rect.left + 20, y: rect.top + 20 };
                        }
                        return null;
                    }, uiIndex);

                    if (targetBox) {
                        await page.mouse.click(targetBox.x, targetBox.y);
                        await randomSleep(page, 2500, 3500); 
                        await page.mouse.wheel(0, 1500);     
                        await randomSleep(page, 1500, 2500);
                    }
                }
            } catch (e) {}
        }
    }
    
    return { 
        success: true, 
        message: `🎯 扫描完毕！锁定最新 ${scannedVideoList.length} 个视频。共新增 ${newCount} 条评论数据！`, 
        scannedVideos: scannedVideoList 
    };
}

// =================================================================
// 2. 抖音：批量首发置顶模块
// =================================================================
async function runBatchPin(page, targetVideos, replyText, randomSleep) {
    let successCount = 0;
    await page.goto('https://creator.douyin.com/creator-micro/interactive/comment', { waitUntil: 'domcontentloaded' });
    await randomSleep(page, 2500, 3500);

    for (const video of targetVideos) {
        console.log(`🎬 [首发引擎] 正在处理抖音视频: [${video.title}]`);
        try {
            const triggerClicked = await page.evaluate(() => {
                const triggers = Array.from(document.querySelectorAll('*')).filter(el => el.innerText === '全部作品' || el.innerText === '选择作品');
                if (triggers.length > 0) { triggers[triggers.length - 1].click(); return true; }
                return false;
            });

            if (triggerClicked) {
                await randomSleep(page, 1500, 2000);
                const shortTitle = video.title.substring(0, 8).replace(/\s+/g, '');

                const videoClicked = await page.evaluate((titleText) => {
                    const items = Array.from(document.querySelectorAll('*')).filter(el => {
                        const txt = (el.innerText || '').replace(/\s+/g, '');
                        if (!txt.includes(titleText)) return false;
                        for (let child of el.children) {
                            if ((child.innerText || '').replace(/\s+/g, '').includes(titleText)) return false;
                        }
                        return true;
                    });
                    if (items.length > 0) { items[0].click(); return true; }
                    return false;
                }, shortTitle);

                if (videoClicked) {
                    await randomSleep(page, 2500, 3500);

                    console.log(`🎯 [首发引擎] 锁定主评论框...`);
                    const inputBox = page.locator('div[contenteditable="true"]').filter({ hasAttribute: 'placeholder', hasText: /好听|有爱|评论/ }).last();
                    const fallbackBox = page.locator('div[contenteditable="true"]').first();
                    const targetBox = (await inputBox.isVisible()) ? inputBox : fallbackBox;

                    if (await targetBox.isVisible()) {
                        await targetBox.click();
                        await randomSleep(page, 500, 1000);
                        await page.keyboard.insertText(replyText);
                        console.log(`[自动制导] 首评话术填装完毕！`);
                        await randomSleep(page, 1000, 1500);

                        const sendBtn = page.locator('button', { hasText: '发送' }).last();
                        if (await sendBtn.isVisible()) {
                            await sendBtn.click();
                            successCount++;
                            console.log(`🔥 [首发引擎] 视频 [${shortTitle}] 首评发射成功！`);
                            await randomSleep(page, 2000, 3000);
                        } else {
                            await page.keyboard.press('Enter');
                            successCount++;
                        }
                    } else {
                        console.log(`❌ 未能找到首评输入框。`);
                    }
                } else {
                    await page.mouse.click(10, 10);
                }
            }
        } catch (e) {
            console.log(`⚠️ 视频处理异常:`, e.message);
        }
    }
    return { success: true, message: `抖音批量首发执行完毕！成功下发 ${successCount}/${targetVideos.length} 个视频。` };
}

// =================================================================
// 3. 抖音：精准回复模块
// =================================================================
async function runReply(page, msg, replyText, randomSleep) {
    console.log(`🚀 [执行引擎] 正在导航至抖音评论大厅...`);
    await page.goto('https://creator.douyin.com/creator-micro/interactive/comment', { waitUntil: 'domcontentloaded' });
    
    await randomSleep(page, 2500, 3500);

    if (!replyText) return;

    // 🌟 前置：视频精准导航引擎
    const videoTitleMatch = msg.content.match(/\[视频:\s*([\s\S]*?)\]/);
    const targetVideoTitle = videoTitleMatch ? videoTitleMatch[1].trim() : null;

    if (targetVideoTitle) {
        console.log(`🎬 [页面导航] 检测到所属视频，准备精准切换至: [${targetVideoTitle.substring(0, 10)}...]`);
        try {
            const triggerClicked = await page.evaluate(() => {
                const triggers = Array.from(document.querySelectorAll('*')).filter(el => 
                    el.innerText === '全部作品' || el.innerText === '选择作品'
                );
                if (triggers.length > 0) {
                    triggers[triggers.length - 1].click(); 
                    return true;
                }
                return false;
            });

            if (triggerClicked) {
                await randomSleep(page, 1500, 2000);
                const shortTitleForNav = targetVideoTitle.substring(0, 8).replace(/\s+/g, '');
                
                const videoClicked = await page.evaluate((titleText) => {
                    const items = Array.from(document.querySelectorAll('*')).filter(el => {
                        const txt = (el.innerText || '').replace(/\s+/g, '');
                        if (!txt.includes(titleText)) return false;
                        for (let child of el.children) {
                            if ((child.innerText || '').replace(/\s+/g, '').includes(titleText)) return false;
                        }
                        return true;
                    });
                    
                    if (items.length > 0) {
                        items[0].click();
                        return true;
                    }
                    return false;
                }, shortTitleForNav);

                if (videoClicked) {
                    console.log(`✅ [页面导航] 成功选中对应视频！等待独立评论列表重载...`);
                    await randomSleep(page, 2500, 3500); 
                } else {
                    console.log(`⚠️ [页面导航] 下拉框已展开，但没找到视频: [${shortTitleForNav}]，将在默认列表硬搜。`);
                    await page.mouse.click(10, 10); 
                }
            }
        } catch (e) {
            console.log(`⚠️ [页面导航] 切换视频发生错误:`, e.message);
        }
    }

    // 🌟 后置：视觉雷达精准找人
    console.log(`🔍 [视觉雷达] 视频列表已就绪，开始执行找人扫描...`);
    
    const pureContent = msg.content.replace(/\[视频:[\s\S]*?\]\s*/, '').trim();
    const textOnlyContent = pureContent.replace(/\[.*?\]/g, '').trim();
    const searchSnippet = textOnlyContent.substring(0, 5);
    const shortUser = msg.username.length > 3 ? msg.username.substring(0, 3) : msg.username;

    console.log(`🎯 目标锁定 -> 模糊用户: [${shortUser}], 核心特征码: [${searchSnippet || '纯表情无文字'}]`);

    const replySuccess = await page.evaluate(async ({ shortUser, searchSnippet }) => {
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        let foundBtn = null;
        
        for (let i = 0; i < 20; i++) {
            const replyBtns = Array.from(document.querySelectorAll('span, div')).filter(el => el.innerText === '回复' || el.innerText === '回复TA');
            
            for (let btn of replyBtns) {
                let parent = btn.parentElement;
                let maxDepth = 6; 
                let matched = false;
                
                while(parent && maxDepth > 0) {
                    const rawText = parent.innerText || '';
                    const cleanText = rawText.replace(/\s+/g, '');
                    const cleanUser = shortUser.replace(/\s+/g, '');
                    const cleanSnippet = searchSnippet.replace(/\s+/g, '');

                    if (cleanText.includes(cleanUser)) {
                        if (!cleanSnippet || cleanText.includes(cleanSnippet)) {
                            matched = true;
                            break;
                        }
                    }
                    parent = parent.parentElement;
                    maxDepth--;
                }
                
                if (matched) {
                    btn.click(); 
                    foundBtn = true;
                    break;
                }
            }

            if (foundBtn) break;
            window.scrollBy(0, 800);
            await sleep(1500); 
        }
        return foundBtn;
    }, { shortUser: shortUser, searchSnippet: searchSnippet });

    if (replySuccess) {
        console.log(`✅ [视觉雷达] 完美锁定目标评论！开始执行原生级结构突破...`);
        await randomSleep(page, 1000, 1500);

        try {
            const inputBox = page.locator('div[contenteditable="true"]').last();
            if (await inputBox.isVisible()) {
                await inputBox.click(); 
                await randomSleep(page, 500, 1000);

                await page.keyboard.insertText(replyText);
                console.log(`[自动制导] 话术成功注入底层数据流！`);
                await randomSleep(page, 1000, 1500);

                const sendBtn = page.locator('button', { hasText: '发送' }).last();
                if (await sendBtn.isVisible()) {
                    await sendBtn.click();
                    console.log(`🔥 [执行引擎] 成功触发”发送”按钮！已执行！`);
                } else {
                    console.log(`⚠️ 未能在 DOM 中找到发送按钮，尝试使用硬回车 (Enter) 强行发送！`);
                    await page.keyboard.press('Enter');
                }
            } else {
                console.log(`❌ 未能捕获到可编辑的 div 区块。`);
            }
        } catch (e) {
            console.log(`❌ 突破输入框结构时发生异常:`, e.message);
        }
        
        console.log(`✅ [执行引擎] 自动化回复序列执行完毕！`);
        await randomSleep(page, 2000, 3000);
    } else {
        console.log(`⚠️ [视觉雷达] 滚动了20屏依然未找到目标评论。可能已被删除。`);
    }
}

export { runRadar, runBatchPin, runReply };