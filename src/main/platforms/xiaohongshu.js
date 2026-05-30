// src/main/platforms/xiaohongshu.js

/**
 * 🌟 小红书纯前台版 - 极简高能版
 * 依赖底层 browser-manager.js 提供的神级 API (humanClick, humanType, randomDelay等)
 */

/**
 * 验证码检测（前台专用）- 保留了小红书特有的业务特征
 */
async function checkAndHandleCaptcha(page) {
    try {
        const hasCaptcha = await page.evaluate(() => {
            const t = document.body.innerText;
            return t.includes('拖动滑块') || t.includes('安全验证');
        });
        if (hasCaptcha) {
            console.log('⚠️ [风控雷达] 前台触发安全验证，页面紧急悬停！等待手动完成（60秒倒计时）...');
            await page.waitForFunction(() => {
                const t = document.body.innerText;
                return !t.includes('拖动滑块') && !t.includes('安全验证');
            }, { timeout: 60000 });
            console.log('✅ [风控雷达] 验证通过，解除悬停！');
            await page.randomDelay(2000, 3000);
        }
    } catch (e) {}
}

// ======================================
// 1. 前台笔记雷达（获取最新发布）
// ======================================
export async function runVideoRadar(page, acc) {
    console.log('\n🚀 [视觉雷达] 正在导航至小红书前台个人主页...');
    const notes = [];

    try {
        // 🌟 核心：启动 C 端雷达前，强制调用状态扫描！如果没登录，就悬停等你扫码！
        if (typeof ensureLogin === 'function') {
            await ensureLogin(page);
        }

        // 安全进入 C 端首页
        await page.goto('https://www.xiaohongshu.com', { timeout: 30000 });
        await page.randomDelay(2000, 3000);
        await checkAndHandleCaptcha(page);

        // 🤖 仿生学点击：寻找并点击“我”进入个人主页
        await page.humanClick('text="我"');
        await page.randomDelay(3000, 5000);
        
        // 🤖 仿生学滚动：模拟人类看主页下拉
        await page.humanScroll('down', { distance: 'medium' });

        // 纯前台 DOM 提取笔记
        const list = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('a[href*="/item/"]').forEach(el => {
                const url = el.href;
                const title = el.querySelector('img')?.alt || '小红书笔记';
                const cover = el.querySelector('img')?.src || '';
                if (url) items.push({ url, title, cover });
            });
            return items.slice(0, 3);
        });

        notes.push(...list);
        console.log(`🎯 [视觉雷达] 物理视觉扫描完毕，截获 ${notes.length} 篇最新笔记`);

    } catch (e) {
        console.log('❌ 前台笔记采集发生致命失败:', e.message);
    }

    return {
        success: true,
        scannedVideos: notes.map(n => ({
            ...n, id: n.url.split('/').pop(), platform: '小红书', account: acc.alias, time: '刚刚'
        }))
    };
}

// ======================================
// 2. ✅ 前台评论雷达（核心：仅前台消息中心抓取）
// ======================================
export async function runCommentRadar(page, db, acc) {
    console.log('\n🚀 [情报雷达] 潜入小红书消息中心提取互动数据...');
    let newCount = 0;

    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT, account_alias TEXT, username TEXT,
            avatar TEXT, content TEXT, time TEXT, status TEXT
        )`).run();
    } catch (e) {}

    const insert = db.prepare(`INSERT OR IGNORE INTO messages 
        (platform,account_alias,username,avatar,content,time,status) 
        VALUES (?,?,?,?,?,?,?)`);

    try {
        await page.goto('https://www.xiaohongshu.com/message', { timeout: 30000 });
        await page.randomDelay(3000, 5000);
        await checkAndHandleCaptcha(page);

        // 🌟🌟🌟 核心防线：404 弹射拦截器！
        // 如果发现被小红书一脚踹回了 explore?source=404，或者被弹到了登录页，说明 Cookie 彻底失效
        if (page.url().includes('source=404') || page.url().includes('login')) {
            console.log(`⚠️ [致命风控] 账号 [${acc.alias}] 核心权限已掉签！被强制弹射至 404 页面或登录页！`);
            console.log(`👉 解决方案：请在系统中删除此账号，并重新扫码入网或导入新 CK！`);
            throw new Error('Cookie失效，遭遇404弹射拦截'); // 直接熔断，抛出异常阻断后续代码
        }

        try {
            // 🤖 仿生学操作：精准点击“@我的”
            await page.humanClick('text="@我的"');
            await page.randomDelay(2000, 3000);
            await page.humanScroll('down', { distance: 'large' });
        } catch (clickErr) {
            console.log('⚠️ [风控预警] 未能在侧边栏找到【@我的】按钮，可能遭遇特殊UI或风控拦截。');
            throw new Error('找不到 @我的 按钮'); // 抛给外层 catch 处理
        }

        const comments = await page.evaluate(() => {
            const data = [];
            const items = document.querySelectorAll('.message-item,.comment-item');
            
            items.forEach(el => {
                const username = el.querySelector('.user-name')?.innerText?.trim() || '';
                const avatar = el.querySelector('img.avatar')?.src || '';
                const content = el.querySelector('.content,.comment-content')?.innerText?.trim() || '';
                const time = el.querySelector('.time')?.innerText?.trim() || '刚刚';
                if (username && content) data.push({ username, avatar, content, time });
            });
            return data;
        });

        for (const c of comments) {
            if (c.username === acc.alias) continue;
            const res = insert.run('小红书', acc.alias, c.username, c.avatar, c.content, c.time, '未回复');
            if (res.changes) newCount++;
        }

        console.log(`🎯 [情报雷达] 提取完毕，数据库新增 ${newCount} 条高意向评论`);

    } catch (e) {
        console.log(`❌ 前台评论抓取失败: ${e.message}`);
    }

    return { success: true, message: `前台抓取完成，新增 ${newCount} 条评论` };
}

// ======================================
// 3. 前台批量首评（笔记详情页纯前台操作）
// ======================================
export async function runBatchPin(page, targetVideos, replyText) {
    console.log('\n🚀 [执行引擎] 开始执行前台矩阵首评任务...');
    let success = 0;

    for (const video of targetVideos) {
        if (!video.url) continue;

        try {
            await page.goto(video.url, { timeout: 30000 });
            await page.randomDelay(3000, 5000);
            await checkAndHandleCaptcha(page);
            
            // 🤖 仿生学：模拟人类看笔记的驻留时间与上下滑动
            await page.humanRead({ minTime: 2000, maxTime: 4000 });

            const inputSelector = 'textarea[placeholder*="说点什么"]';
            
            try {
                // 🤖 连招：游离鼠标 -> 点击输入框 -> 思考式打字
                await page.humanType(inputSelector, replyText);
                await page.randomDelay(800, 1500);
                
                // 物理点击发送按钮
                await page.humanClick('text="发送"');
                success++;
                console.log(`🔥 [发送确认] 笔记首评成功：${video.title}`);
                await page.randomDelay(3000, 5000);
            } catch (err) {
                console.log(`⚠️ 当前笔记可能禁言或无法评论跳过: ${video.title}`);
            }

        } catch (e) {
            console.log('❌ 笔记跳转或处理异常:', e.message);
        }
    }

    return { success: true, message: `批量首评完成，成功 ${success} 条` };
}

// ======================================
// 4. 前台精准回复（纯前台消息中心）
// ======================================
export async function runReply(page, msg, replyText) {
    console.log('\n🚀 [执行引擎] 锁定目标靶位，执行前台消息回复...');

    try {
        await page.goto('https://www.xiaohongshu.com/message/mentions', { timeout: 30000 });
        await page.randomDelay(3000, 5000);
        await checkAndHandleCaptcha(page);

        // 🌟🌟🌟 核心防线：回复引擎也要加装 404 弹射拦截器！
        if (page.url().includes('source=404') || page.url().includes('login')) {
            console.log(`⚠️ [致命风控] 账号核心权限已掉签！被强制弹射至 404 页面或登录页！`);
            throw new Error('Cookie失效，遭遇404弹射拦截');
        }

        // 利用浏览器原生环境寻找目标并点击触发回复框
        const found = await page.evaluate(({ username, content }) => {
            const items = document.querySelectorAll('.message-item');
            for (const el of items) {
                if (el.innerText.includes(username) && el.innerText.includes(content.substring(0, 8))) {
                    const btn = el.querySelector('button,span');
                    if(btn) { 
                        btn.click(); 
                        return true; 
                    }
                }
            }
            return false;
        }, { username: msg.username, content: msg.content });

        if (found) {
            console.log(`🎯 目标确认锁定，准备发送...`);
            await page.randomDelay(1000, 2000);
            
            const inputSelector = 'textarea[placeholder*="回复"]';
            try {
                // 🤖 连招：锁定输入框 -> 注入带错字修正的人类打字流
                await page.humanType(inputSelector, replyText);
                await page.randomDelay(800, 1500);
                
                // 🤖 点击可见的回复或发送按钮
                await page.humanClick('button:visible:has-text("回复"), button:visible:has-text("发送")');
                console.log('🔥 [执行引擎] 精准回复发送成功！');
            } catch (clickErr) {
                // 如果找不到按钮，直接模拟键盘重击回车键兜底
                await page.keyboard.press('Enter');
                console.log('🔥 [执行引擎] 使用硬回车发送成功！');
            }
        } else {
            console.log(`⚠️ 页面内未扫描到匹配目标：[${msg.username}] 的评论`);
        }

        await page.randomDelay(2000, 3000);

    } catch (e) {
        console.log(`❌ 前台回复执行异常: ${e.message}`);
    }
}