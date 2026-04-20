import { launchSandbox, closeSandbox } from './browser-manager.js';
import { ipcMain } from 'electron';
import { getDB } from './database.js'; 
import OpenAI from 'openai';

// ==========================================================
// 🧠 AI 大模型解析引擎 (DeepSeek V3 接入)
// ==========================================================
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1', 
    apiKey: 'sk-d2ba92f063f04c96b9b80fd1e949b6a7' // ⚠️ 请务必换上你真实充值的 Key！
});

// ==========================================================
// 🧠 AI 大模型解析引擎 (✨ 升级防弹 JSON 提取版)
// ==========================================================
async function extractTrendDataWithAI(platform, rawText) {
    console.log(`🧠 [AI 引擎] 开始解析 ${platform} 文本数据，长度: ${rawText.length} 字符...`);
    
    // 防爆破：截取前 25000 个字符
    const safeText = rawText.substring(0, 25000); 

    const prompt = `你是一个顶级的数据提取黑客。以下是从【${platform}】创作者后台直接复制的网页文本或API报文。
请你在这些文本中寻找【日期】和对应的【播放量/阅读量/观看量】。
提取最近30天的数据（如果是小红书，注意规避7天的数据，必须寻找30个左右节点的序列）。
严格按以下JSON数组格式返回，不要有任何多余的文本、解释或 Markdown 标记：
[{"date": "2023-10-01", "views": 1234}, ...]`;

    try {
        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "你是一个只输出合法JSON的API节点，绝不说废话。" },
                { role: "user", content: `${prompt}\n\n网页纯文本/API报文：\n${safeText}` }
            ],
            temperature: 0.1, 
        });
        
        let result = response.choices[0].message.content.trim();
        
        // 💥 绝杀：暴力抠出 JSON 数组！无视 AI 的任何废话！
        const startIndex = result.indexOf('[');
        const endIndex = result.lastIndexOf(']');
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            result = result.substring(startIndex, endIndex + 1);
        } else {
            throw new Error("大模型返回的内容中没有合法的 JSON 数组结构");
        }
        
        const trendData = JSON.parse(result);
        trendData.sort((a, b) => new Date(a.date) - new Date(b.date));
        return trendData;
        
    } catch (error) {
        console.error("❌ [AI 引擎] 解析失败或格式异常:", error.message);
        // 把 AI 乱说的废话打印出来，方便死得瞑目
        console.log("⚠️ AI 原始返回内容:", error.message.includes("JSON") ? "" : response?.choices[0]?.message?.content);
        return null;
    }
}

// ==========================================================
// 🚨 右护法：全域数据罗盘 - 深度数据抽水机 (AI 升维版)
// ==========================================================

function ensureTrendColumn() {
    const db = getDB();
    try { db.prepare("ALTER TABLE accounts ADD COLUMN trend_data TEXT").run(); } catch (e) {}
}

/**
 * 🛠️ 核心辅助：iframe 穿透字符探测雷达
 */
async function getFullFramesText(page) {
    let allText = '';
    for (const frame of page.frames()) {
        try {
            const text = await frame.evaluate(() => document.body.innerText);
            if (text && text.trim().length > 0) {
                allText += text + '\n\n';
            }
        } catch (e) {
            // 忽略跨域报错
        }
    }
    return allText;
}

/**
 * 🛠️ 核心辅助：iframe 穿透等待雷达
 */
async function waitForFramesTextLength(page, minLength, timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const currentText = await getFullFramesText(page);
        if (currentText.length > minLength) return true;
        await page.waitForTimeout(1000); 
    }
    return false;
}

/**
 * 1. 抖音 (Douyin) 数据抽水机 (✨ 高亮直瞄 + API 窃听提纯版)
 */
export async function syncDouyinData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动抖音节点 ${accountId} 数据抽水机 (满血API拦截版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        // 💥 终极 API 窃听器：抖音的图表数据全在 XHR/Fetch 请求中
        let apiPayloads = [];
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                // 拦截抖音创作者中心的接口
                if (url.includes('douyin.com') && res.ok()) {
                    try {
                        const text = await res.text();
                        // 寻找包含播放、日期、统计等抖音特征字段的数据包
                        if (text.length > 200 && text.includes('{') && (text.includes('play') || text.includes('stat') || text.includes('date'))) {
                            apiPayloads.push(text);
                        }
                    } catch(e) {}
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入抖音创作者中心...`);
        await page.goto('https://creator.douyin.com/creator-micro/data-center/operation', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`[全域数据罗盘] 潜伏 5 秒！等待数据大盘渲染...`);
        await page.waitForTimeout(5000); 

        console.log(`[全域数据罗盘] 强制锁定页面顶部，准备视觉追踪...`);
        await page.evaluate(() => window.scrollTo(0, 0)).catch(()=>{});

        let clicked = false;
        
        try {
            console.log(`[全域数据罗盘] 🔍 启动 Playwright 原生高亮制导...`);
            
            // 抖音是平铺按钮，直接精准找"近30天"
            const thirtyBtns = await page.getByText('近30天', { exact: true }).all();
            
            for (let i = 0; i < thirtyBtns.length; i++) { 
                const btn = thirtyBtns[i];
                if (await btn.isVisible()) {
                    // 💥 涂黄标红，确认目标！让你肉眼看到它锁定了！
                    await btn.evaluate(node => { 
                        node.style.border = '3px solid red'; 
                        node.style.backgroundColor = 'yellow'; 
                    });
                    console.log(`[全域数据罗盘] 🎯 准星已锁定抖音【近30天】！开火！`);
                    await page.waitForTimeout(1000); // 停顿一秒让你确认
                    
                    // 🚨 核心：在点下去的瞬间，清空窃听器！确保只抓取 30 天的新数据
                    apiPayloads = []; 

                    await btn.evaluate(n => {
                        n.click();
                        if (n.parentElement) n.parentElement.click();
                    }).catch(()=>{});
                    await btn.click({ force: true }).catch(()=>{});
                    
                    clicked = true;
                    break;
                }
            }
        } catch (e) {
            console.log(`⚠️ 点击逻辑出现异常: ${e.message}`);
        }

        if (!clicked) {
            console.log(`⚠️ [警告] 未能点击抖音【近30天】！截图留证...`);
            await page.screenshot({ path: `debug-btn-missing-dy-${accountId}.png` });
        }

        console.log(`[全域数据罗盘] 🚀 执行深度下潜！触发图表与数据的懒加载...`);
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
            setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1000);
        }).catch(()=>{});

        console.log(`[全域数据罗盘] 潜伏 5 秒，等待网络报文回传与图表重绘...`);
        await page.waitForTimeout(5000); 

        console.log(`[全域数据罗盘] 正在汇总抖音核心绝密数据...`);
        
        let finalPayloadText = "";
        const domText = await page.evaluate(() => document.body.innerText);

        if (apiPayloads.length > 0) {
            // 倒序排列，最新抓到的包放最前面
            apiPayloads.reverse(); 
            console.log(`[全域数据罗盘] 🟢 成功截获 ${apiPayloads.length} 个底层 API 报文！启动纯净投喂！`);
            
            finalPayloadText = `[🚨 强制指令：以下是抖音后台数据包。请提取30天的趋势序列！]\n\n`;
            finalPayloadText += `【后台API报文(最新优先)】:\n${apiPayloads.join('\n\n')}`;
        } else {
            console.log(`[全域数据罗盘] 🟡 API 嗅探为空，全量使用 DOM 文本 (${domText.length} 字符)...`);
            finalPayloadText = domText;
        }

        // 截断数据防止超出限制
        finalPayloadText = finalPayloadText.substring(0, 20000);

        console.log(`\n--- 🕵️‍♂️ 本次喂给 AI 的数据长度: ${finalPayloadText.length} 字符 ---`);

        await closeSandbox(accountId); 
        
        const trendArray = await extractTrendDataWithAI('抖音', finalPayloadText);

        if (trendArray && trendArray.length > 0) {
            console.log(`\n==================================================================`);
            console.log(`🎯 [AI 视觉雷达] 大模型解析完毕！成功提取 ${trendArray.length} 天数据！`);
            
            const finalSum = trendArray.reduce((sum, item) => sum + item.views, 0);
            
            console.log(`💰 AI 结算: 最终落库总阅读/播放量为 ${finalSum}`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(finalSum, JSON.stringify(trendArray), accountId);
              
            return { success: true, message: `抖音 AI 同步成功！提取 ${trendArray.length} 天数据，总量: ${finalSum}` };
        }

        return { success: false, message: 'AI 未能从抖音网络报文或网页文本中识别出有效的数据序列。' };

    } catch (error) {
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在执行中途发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 2. 小红书 (Xiaohongshu) 数据抽水机 (✨ 卡片级绝对锁定 + 防呆修正版)
 */
export async function syncXiaohongshuData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动小红书节点 ${accountId} 数据抽水机 (真·双脑最终版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { 
            headless: false, 
            slowMo: 150,
            args: ['--disable-blink-features=AutomationControlled'] 
        });
        const { page } = browserSession;

        let apiPayloads = [];
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                if (url.includes('creator.xiaohongshu.com/api') && res.ok()) {
                    try {
                        const text = await res.text();
                        if (text.length > 200 && text.includes('{') && text.includes('}')) {
                            apiPayloads.push(text);
                        }
                    } catch(e) {}
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入小红书创作者中心...`);
        await page.goto('https://creator.xiaohongshu.com/statistics/account/v2', { waitUntil: 'domcontentloaded', timeout: 40000 });
        
        console.log(`[全域数据罗盘] 潜伏 6 秒！等待数据大盘渲染，若有滑块请手动操作...`);
        await page.waitForTimeout(6000); 

        console.log(`[全域数据罗盘] 强制锁定页面顶部，准备视觉追踪...`);
        await page.evaluate(() => window.scrollTo(0, 0)).catch(()=>{});

        // ====================================================================
        // 💥 细胞级物理破甲：强点【近30日】
        // ====================================================================
        let clicked = await page.evaluate(async () => {
            try {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let nodes = [];
                let node;
                while(node = walker.nextNode()) {
                    if (/近\s*30\s*日/.test(node.nodeValue.replace(/\s+/g, ''))) {
                        nodes.push(node.parentElement);
                    }
                }
                if (nodes.length > 0) {
                    let target = nodes[nodes.length - 1]; 
                    target.style.border = '3px solid red'; 
                    target.style.backgroundColor = 'yellow';
                    target.click();
                    if (target.parentElement) target.parentElement.click();
                    return true;
                }
                return false;
            } catch (e) { return false; }
        });

        if (clicked) {
            console.log(`[全域数据罗盘] ✅ 准星锁定！成功击发小红书【近30日】！`);
        } else {
            console.log(`⚠️ 未能自动点击【近30日】，请注意观察！`);
        }

        console.log(`[全域数据罗盘] 🚀 执行深度下潜！触发小红书图表重绘...`);
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
            setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1000);
        }).catch(()=>{});

        await page.waitForTimeout(5000); 

        // ====================================================================
        // 💥 修复版视觉引擎：卡片圈禁法，只抓观看数卡片内的数字
        // ====================================================================
        console.log(`[全域数据罗盘] 👁️ 启动视觉引擎：圈禁【观看数】卡片进行精准提取...`);
        let visualTotalViews = await page.evaluate(() => {
            try {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while(node = walker.nextNode()) {
                    if (node.nodeValue.trim() === '观看数') {
                        // 往上找 3 层，把整个观看数卡片罩住
                        let parent = node.parentElement;
                        for(let i=0; i<3; i++) {
                            if(parent) {
                                // 把卡片里的文字全部拼起来去空格，比如 "观看数18.7万环比..."
                                let fullText = parent.innerText.replace(/\s+/g, '');
                                // 精准提取观看数紧跟着的那个数字
                                let match = fullText.match(/观看数.*?(\d+(?:\.\d+)?)(万?)/);
                                if (match) {
                                    let n = parseFloat(match[1]);
                                    if (match[2] === '万') n = Math.floor(n * 10000);
                                    return n;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }
                }
                return null;
            } catch(e) { return null; }
        });

        if (visualTotalViews !== null) {
            console.log(`[全域数据罗盘] 🎯 视觉锁定：已捕获小红书前端卡片核心数 -> ${visualTotalViews}`);
        } else {
            console.log(`[全域数据罗盘] ⚠️ 视觉捕获失败，将完全信任底层折线图。`);
        }

        // ====================================================================
        // 💥 JSON 纯净投喂与提取
        // ====================================================================
        let finalPayloadText = "";
        const aiPromptInjection = `
[🚨 强制指令 🚨]
这是小红书后台绝密数据包。里面极其阴险地同时混合了【7天】和【30天】的数据！
你的任务：
1. 忽略前面的短数据，必须找到包含约 30 个数据点的序列！
2. 提取所有的【日期】和对应的【观看/阅读量】。
3. 必须且只能输出 JSON 数组格式，不准说一句废话！
`;

        if (apiPayloads.length > 0) {
            apiPayloads.reverse(); 
            finalPayloadText = aiPromptInjection + `\n\n【后台API报文(最新优先)】:\n${apiPayloads.join('\n\n')}`;
            console.log(`[全域数据罗盘] 🟢 截获 ${apiPayloads.length} 个底层 API 报文！启动纯净投喂！`);
        } else {
            finalPayloadText = aiPromptInjection + "\n\n" + await page.evaluate(() => document.body.innerText);
        }

        finalPayloadText = finalPayloadText.substring(0, 30000);
        await closeSandbox(accountId); 
        
        const rawTrendArray = await extractTrendDataWithAI('小红书', finalPayloadText);

        if (rawTrendArray && rawTrendArray.length > 0) {
            const dateMap = {};
            let maxTime = 0;
            rawTrendArray.forEach(item => {
                const match = item.date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/) || item.date.match(/(\d{1,2})[-/](\d{1,2})/);
                if (match) {
                    let y = match.length === 4 ? match[1] : new Date().getFullYear();
                    let m = match[match.length-2].padStart(2, '0');
                    let d = match[match.length-1].padStart(2, '0');
                    const key = `${y}-${m}-${d}`;
                    const t = new Date(`${key}T00:00:00`).getTime();
                    if (t > maxTime) maxTime = t;
                    dateMap[key] = (dateMap[key] || 0) + item.views;
                }
            });

            const finalTrendArray = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date((maxTime || Date.now()) - i * 24 * 60 * 60 * 1000);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                finalTrendArray.push({ date: key, views: dateMap[key] || 0 });
            }

            const arraySum = finalTrendArray.reduce((s, i) => s + i.views, 0);
            
            // 🚨 终极防呆底线：取视觉和底层的最大值，谁大信谁，绝不漏掉一滴流量！
            let finalSum = arraySum;
            if (visualTotalViews !== null) {
                finalSum = Math.max(visualTotalViews, arraySum);
                console.log(`💰 财务终审: 启用防呆核算 -> 最终采纳 ${finalSum} (视觉端: ${visualTotalViews}, 底层累加: ${arraySum})`);
            } else {
                console.log(`💰 财务终审: 采用底层折线图累加数据 -> ${finalSum}`);
            }

            console.log(`\n==================================================================`);
            console.log(`🎯 大满贯！小红书 30 天序列已挂载，大盘流量 [ ${finalSum} ] 已绝对锁定！`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(finalSum, JSON.stringify(finalTrendArray), accountId);
              
            return { success: true, message: `小红书同步成功！总量: ${finalSum}` };
        }

        return { success: false, message: '数据提取失败' };

    } catch (error) {
        console.error(error);
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 3. B站 (Bilibili) 数据抽水机 (✨ 文本降维雷达版 - 专治 DOM 迷宫)
 */
export async function syncBilibiliData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动 B 站节点 ${accountId} 数据抽水机 (文本降维版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        let apiPayloads = [];
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                if (url.includes('member.bilibili.com') && res.ok()) {
                    try {
                        const text = await res.text();
                        if (text.length > 100 && text.includes('{') && (text.includes('play') || text.includes('view') || text.includes('stat'))) {
                            apiPayloads.push(text);
                        }
                    } catch(e) {}
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入 B 站创作者中心...`);
        await page.goto('https://member.bilibili.com/platform/data-up/video/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await page.waitForTimeout(4000); 

        console.log(`[全域数据罗盘] 正在执行【近30天】物理穿透...`);
        await page.evaluate(async () => {
            const findAndClick = (txt) => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while(node = walker.nextNode()) {
                    if (node.nodeValue.replace(/\s+/g, '') === txt) {
                        node.parentElement.click();
                        return true;
                    }
                }
                return false;
            };
            findAndClick('近7天');
            await new Promise(r => setTimeout(r, 1500));
            
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let thirtyNodes = [];
            let node;
            while(node = walker.nextNode()) {
                if (node.nodeValue.replace(/\s+/g, '') === '近30天') thirtyNodes.push(node.parentElement);
            }
            if(thirtyNodes.length > 0) thirtyNodes[thirtyNodes.length - 1].click();
        });

        console.log(`[全域数据罗盘] 潜伏 5 秒，等待大盘数据 (179) 渲染...`);
        await page.waitForTimeout(5000); 

        // ====================================================================
        // 💥 终极视觉引擎：文本降维雷达，按行扫荡，无视嵌套！
        // ====================================================================
        console.log(`[全域数据罗盘] 👁️ 启动文本块降维雷达：无视前端迷宫，强抓核心数...`);
        let visualTotalViews = await page.evaluate(() => {
            try {
                let rawText = document.body.innerText;
                
                // 兜底策略A：如果 tooltip 刚才被触发了，直接抓
                let hoverMatch = rawText.match(/播放量[:：]\s*([\d,]+)/);
                if (hoverMatch) return parseInt(hoverMatch[1].replace(/,/g, ''));

                // 核心策略B：把网页全文本拆成一行一行的字符串
                let lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
                
                // 找到“播放量”所在的行
                let playIdx = lines.indexOf('播放量');
                if (playIdx === -1) {
                    playIdx = lines.findIndex(l => l.includes('播放量') && l.length < 10);
                }

                if (playIdx !== -1) {
                    // 从“播放量”往下看 4 行
                    for (let i = playIdx + 1; i <= playIdx + 4 && i < lines.length; i++) {
                        let line = lines[i];
                        
                        // ⚡️ 核心避障：看到这些带着箭头的行、或者下一个指标的名字，直接跳过！
                        if (line.includes('▾') || line.includes('▴') || line.includes('较') || line.includes('比') || line.includes('访客') || line.includes('粉丝')) {
                            continue;
                        }

                        // 匹配万字大数 (如 7.6万)
                        let wanMatch = line.match(/^(\d+(?:\.\d+)?)\s*万$/);
                        if (wanMatch) return Math.floor(parseFloat(wanMatch[1]) * 10000);
                        
                        // 匹配纯数字 (如 179 或 1,234)
                        let pureNumStr = line.replace(/,/g, '');
                        if (/^\d+$/.test(pureNumStr)) return parseInt(pureNumStr);
                    }
                }
                return null;
            } catch(e) { return null; }
        });

        if (visualTotalViews !== null) {
            console.log(`[全域数据罗盘] 🎯 视觉锁定：已暴力洞穿前端伪装！抓取大盘 -> ${visualTotalViews}`);
        } else {
            console.log(`[全域数据罗盘] ⚠️ 视觉捕获仍然失败，降级交由 AI 处理。`);
        }

// ====================================================================
        // 💥 极限脱水与 AI 解析 (严苛拦截版：无 API 数据绝不喂给 AI)
        // ====================================================================
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(()=>{});
        await page.waitForTimeout(1000);

        // 🚨 核心修复：如果没有抓取到 API 数据报文，直接阻断，不让 AI 去猜 8000 字的 DOM 垃圾文本
        if (apiPayloads.length === 0) {
            console.log(`[全域数据罗盘] ⚠️ 未能截获 B 站底层 API 数据报文。`);
            await closeSandbox(accountId); 
            
            // 如果虽然没抓到 API，但刚才肉眼视觉抓到了大盘数据，至少把大盘更新一下
            if (visualTotalViews !== null) {
                console.log(`\n==================================================================`);
                console.log(`🎯 API提取失败，但已成功保底前台视觉大盘数据 [ ${visualTotalViews} ]`);
                console.log(`==================================================================\n`);
                db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
                  .run(visualTotalViews, JSON.stringify([]), accountId);
                return { success: true, message: `B站部分同步成功！仅更新大盘总量: ${visualTotalViews}，折线图需重试。` };
            }
            
            return { success: false, message: 'B站同步失败：平台接口未响应或改版，且视觉抓取未命中，请稍后重试。' };
        }

        // 如果截获了数据，则正常执行纯净脱水
        let finalPayloadText = "";
        const latestPayload = apiPayloads[apiPayloads.length - 1];
        try {
            let obj = JSON.parse(latestPayload);
            const clean = (d) => {
                if (Array.isArray(d)) d.forEach(clean);
                else if (typeof d === 'object' && d !== null) {
                    Object.keys(d).forEach(k => {
                        const lk = k.toLowerCase();
                        if (lk.includes('url') || lk.includes('title') || lk.includes('img') || lk.includes('bvid') || lk.includes('desc') || lk.includes('name')) delete d[k];
                        else clean(d[k]);
                    });
                }
            };
            clean(obj);
            finalPayloadText = JSON.stringify(obj).substring(0, 8000);
        } catch (e) {
            finalPayloadText = latestPayload.substring(0, 8000);
        }

        const aiPromptInjection = `[🚨 极速指令 🚨] 提取下面数据中的【日期】和【播放量(view/play)】，只输出严格的 JSON 数组 [{"date":"YYYY-MM-DD", "views": 123}]，禁止废话。`;
        finalPayloadText = aiPromptInjection + `\n\n【脱水核心报文】:\n${finalPayloadText}`;
        
        await closeSandbox(accountId); 
        
        console.log(`🧠 [AI 引擎] 开始极速解析，数据量已压缩至: ${finalPayloadText.length} 字符...`);
        const rawTrendArray = await extractTrendDataWithAI('B站', finalPayloadText);
        
        // ... (下方 rawTrendArray 解析处理部分保持原样) ...

        if (rawTrendArray && rawTrendArray.length > 0) {
            const dateMap = {};
            let maxTime = 0;
            rawTrendArray.forEach(item => {
                const match = item.date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/) || item.date.match(/(\d{1,2})[-/](\d{1,2})/);
                if (match) {
                    let y = match.length === 4 ? match[1] : new Date().getFullYear();
                    let m = match[match.length-2].padStart(2, '0');
                    let d = match[match.length-1].padStart(2, '0');
                    const key = `${y}-${m}-${d}`;
                    const t = new Date(`${key}T00:00:00`).getTime();
                    if (t > maxTime) maxTime = t;
                    dateMap[key] = (dateMap[key] || 0) + item.views;
                }
            });

            const finalTrendArray = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date((maxTime || Date.now()) - i * 24 * 60 * 60 * 1000);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                finalTrendArray.push({ date: key, views: dateMap[key] || 0 });
            }

            const arraySum = finalTrendArray.reduce((s, i) => s + i.views, 0);
            
            // 💰 最终对账：强信任视觉大盘
            let finalSum = arraySum;
            if (visualTotalViews !== null && visualTotalViews >= arraySum) {
                finalSum = visualTotalViews;
                console.log(`💰 财务终审: 采用前台视觉大盘数据 -> ${finalSum} (底层历史折线累加 ${arraySum})`);
            } else {
                finalSum = visualTotalViews || arraySum;
                console.log(`💰 财务终审: 采用底层折线累加数据 -> ${finalSum}`);
            }

            console.log(`\n==================================================================`);
            console.log(`🎯 大满贯收官！B 站 30 天序列已挂载，真实大盘流量 [ ${finalSum} ] 已锁定！`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(finalSum, JSON.stringify(finalTrendArray), accountId);
              
            return { success: true, message: `B站同步成功！总量: ${finalSum}` };
        }

        if (visualTotalViews !== null) {
            console.log(`\n==================================================================`);
            console.log(`🎯 AI提取失败，直接采用前台视觉数据 [ ${visualTotalViews} ]`);
            console.log(`==================================================================\n`);
            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(visualTotalViews, JSON.stringify([]), accountId);
            return { success: true, message: `B站同步成功！总量: ${visualTotalViews}` };
        }

        return { success: false, message: '未获取到数据' };

    } catch (error) {
        console.error(error);
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 4. 微信视频号 数据抽水机 (✨ 微信专用完美版)
 */
export async function syncWechatChannelsData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动微信视频号节点 ${accountId} 数据抽水机 (AI 升维版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        console.log(`[全域数据罗盘] 正在突入微信视频号创作者中心...`);
        await page.goto('https://channels.weixin.qq.com/platform/statistic/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`[全域数据罗盘] 正在雷达扫描：等待主数据区挂载 (穿透探测中)...`);
        const isLoaded = await waitForFramesTextLength(page, 150, 15000);
        if (!isLoaded) console.log(`⚠️ 主界面挂载超时，可能是微信服务器卡顿。`);

        console.log(`[全域数据罗盘] 执行强行下潜，确保底部明细表加载完毕...`);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(()=>{});
        await page.waitForTimeout(1000); 

        console.log(`[全域数据罗盘] 锁定主界面，全域雷达扫描【近30天】坐标...`);
        let clicked = false;

        for (let attempt = 0; attempt < 15; attempt++) { 
            for (const frame of page.frames()) {
                try {
                    const textNodes = await frame.getByText(/近\s*30\s*天/).all();
                    if (textNodes.length > 0) {
                        console.log(`[全域数据罗盘] 🎯 发现 ${textNodes.length} 个【近30天】文本节点！锁定最底部目标...`);
                        const bottomTargetNode = textNodes[textNodes.length - 1];
                        await bottomTargetNode.scrollIntoViewIfNeeded().catch(()=>{});

                        await bottomTargetNode.evaluate(node => {
                            node.click();
                            if (node.parentElement) {
                                node.parentElement.click();
                                if (node.parentElement.parentElement) {
                                    node.parentElement.parentElement.click();
                                }
                            }
                            const wrapper = node.closest('label') || node.parentElement;
                            if (wrapper) {
                                const radio = wrapper.querySelector('input[type="radio"]');
                                if (radio) {
                                    radio.click();
                                    radio.checked = true;
                                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        }).catch(()=>{});

                        await bottomTargetNode.locator('..').click({ force: true }).catch(()=>{});

                        console.log(`[全域数据罗盘] ✅ 最底部【近30天】父级连环触发完毕！数据大盘应该开始刷新了！`);
                        clicked = true;
                        break; 
                    }
                } catch (e) {}
            }
            if (clicked) break; 
            await page.waitForTimeout(1000); 
        }

        if (!clicked) {
            console.log(`⚠️ [警告] 雷达扫描了 15 秒，依然找不到可见的【近30天】按钮！`);
            await page.screenshot({ path: `debug-btn-missing-wechat-${accountId}.png` });
        }

        await page.waitForTimeout(4000); 
        console.log(`[全域数据罗盘] 潜伏等待 30 天数据大盘拉取 (智能探测中)...`);
        await waitForFramesTextLength(page, 800, 5000); 
        
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(()=>{});
        
        console.log(`[全域数据罗盘] 正在跨 Frame 全量剥离网页 DOM 纯文本...`);
        const pageText = await getFullFramesText(page);

        console.log(`\n--- 🕵️‍♂️ 本次成功剥离字符数: ${pageText.length} ---`);
        await closeSandbox(accountId); 
        
        const trendArray = await extractTrendDataWithAI('微信视频号', pageText);

        if (trendArray && trendArray.length > 0) {
            console.log(`\n==================================================================`);
            console.log(`🎯 [AI 视觉雷达] 大模型解析完毕！成功提取 ${trendArray.length} 天数据！`);
            const finalSum = trendArray.reduce((sum, item) => sum + item.views, 0);
            console.log(`💰 AI 结算: 最终落库总播放量为 ${finalSum}`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(finalSum, JSON.stringify(trendArray), accountId);
            return { success: true, message: `视频号 AI 同步成功！提取 ${trendArray.length} 天数据，总播放量: ${finalSum}` };
        }

        return { success: false, message: 'AI 未能从网页文本中识别出有效的数据序列。' };

    } catch (error) {
        console.log(`\n❌ [致命崩溃] 节点 ${accountId} 在执行中途发生异常！`);
        console.error(error); 
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 5. 百家号 (Baijiahao) 数据抽水机 (✨ 全屏大数暴击 + 纯净断舍离版)
 */
export async function syncBaijiahaoData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动百家号节点 ${accountId} 数据抽水机 (完美收官版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        let apiPayloads = [];
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                const url = res.url();
                if (url.includes('baijiahao.baidu.com') && res.ok()) {
                    try {
                        const text = await res.text();
                        if (text.length > 200 && text.includes('{') && (text.includes('read') || text.includes('play') || text.includes('view') || text.includes('list'))) {
                            apiPayloads.push(text);
                        }
                    } catch(e) {}
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入百家号创作者中心...`);
        await page.goto('https://baijiahao.baidu.com/builder/rc/analysiscontent', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await page.waitForTimeout(5000); 

        console.log(`[全域数据罗盘] 正在执行【近30天】物理穿透...`);
        await page.evaluate(async () => {
            const findAndClick = (txt) => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while(node = walker.nextNode()) {
                    if (node.nodeValue.replace(/\s+/g, '') === txt) {
                        node.parentElement.click();
                        return true;
                    }
                }
                return false;
            };
            findAndClick('近7天');
            await new Promise(r => setTimeout(r, 1500));
            
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let thirtyNodes = [];
            let node;
            while(node = walker.nextNode()) {
                if (node.nodeValue.replace(/\s+/g, '') === '近30天') thirtyNodes.push(node.parentElement);
            }
            if(thirtyNodes.length > 0) thirtyNodes[thirtyNodes.length - 1].click();
        });

        console.log(`[全域数据罗盘] 潜伏 5 秒，等待核心数据渲染...`);
        await page.waitForTimeout(5000); 

        // ====================================================================
        // 💥 视觉引擎：全屏大数扫描，捕获 49400！
        // ====================================================================
        console.log(`[全域数据罗盘] 👁️ 启动暴风吸入式对焦：扫描全屏大数值...`);
        let visualTotalViews = await page.evaluate(() => {
            try {
                let maxNum = 0;
                const allText = document.body.innerText;
                const matches = [...allText.matchAll(/(\d+(?:\.\d+)?)\s*万/g)];
                for (let m of matches) {
                    let n = Math.floor(parseFloat(m[1]) * 10000);
                    if (n > maxNum && n < 999999999) maxNum = n;
                }
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while(node = walker.nextNode()) {
                    const txt = node.nodeValue.trim().replace(/,/g, ''); 
                    if (/^\d{4,8}$/.test(txt)) { 
                        let n = parseInt(txt);
                        let parent = node.parentElement;
                        let isValid = true;
                        for (let i = 0; i < 4; i++) {
                            if (parent) {
                                if (parent.innerText.includes('粉丝') || parent.innerText.includes('昨日')) { isValid = false; break; }
                                parent = parent.parentElement;
                            }
                        }
                        if (isValid && n > maxNum) maxNum = n;
                    }
                }
                return maxNum > 0 ? maxNum : null;
            } catch(e) { return null; }
        });

        if (visualTotalViews) {
            console.log(`[全域数据罗盘] 🎯 视觉锁定：已暴力捕获最大真实盘面 -> ${visualTotalViews}`);
        }

        // ====================================================================
        // 💥 API 纯净脱水提取
        // ====================================================================
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(2000);

        const minifiedPayloads = apiPayloads.map(text => {
            try {
                let obj = JSON.parse(text);
                const clean = (d) => {
                    if (Array.isArray(d)) d.forEach(clean);
                    else if (typeof d === 'object' && d !== null) {
                        Object.keys(d).forEach(k => {
                            const lk = k.toLowerCase();
                            if (lk.includes('url') || lk.includes('title') || lk.includes('img') || lk.includes('avatar') || lk.includes('desc')) delete d[k];
                            else clean(d[k]);
                        });
                    }
                };
                clean(obj);
                return JSON.stringify(obj);
            } catch(e) { return ""; }
        }).filter(t => t.length > 50);

        let finalPayloadText = "";
        
        // 🚨 核心修复：坚决不传网页 DOM 文本了！只传最纯净的 API 骨架！
        const aiPromptInjection = `
[🚨 强制指令 🚨]
任务：无脑提取以下脱水报文里所有的日期和播放量/阅读量！
不要做任何加法运算！同一天有多个数据，直接原样列出多行。
【致命要求】：必须且只能输出合法的 JSON 数组，格式如 [{"date":"YYYY-MM-DD", "views": 123}]。不要有任何多余的废话！
`;

        if (minifiedPayloads.length > 0) {
            minifiedPayloads.reverse();
            finalPayloadText = aiPromptInjection + `\n\n【脱水API报文】:\n${minifiedPayloads.join('\n\n')}`;
            console.log(`[全域数据罗盘] 🟢 启用纯净投喂模式，斩断一切网页垃圾文本！`);
        } else {
            // 兜底方案
            finalPayloadText = aiPromptInjection + "\n\n" + await page.evaluate(() => document.body.innerText);
        }

        finalPayloadText = finalPayloadText.substring(0, 30000);
        await closeSandbox(accountId); 
        
        const rawTrendArray = await extractTrendDataWithAI('百家号', finalPayloadText);

        if (rawTrendArray && rawTrendArray.length > 0) {
            const dateMap = {};
            let maxTime = 0;
            rawTrendArray.forEach(item => {
                const match = item.date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/) || item.date.match(/(\d{1,2})[-/](\d{1,2})/);
                if (match) {
                    let y = match.length === 4 ? match[1] : new Date().getFullYear();
                    let m = match[match.length-2].padStart(2, '0');
                    let d = match[match.length-1].padStart(2, '0');
                    const key = `${y}-${m}-${d}`;
                    const t = new Date(`${key}T00:00:00`).getTime();
                    if (t > maxTime) maxTime = t;
                    dateMap[key] = (dateMap[key] || 0) + item.views;
                }
            });

            const finalTrendArray = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date((maxTime || Date.now()) - i * 24 * 60 * 60 * 1000);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                finalTrendArray.push({ date: key, views: dateMap[key] || 0 });
            }

            const arraySum = finalTrendArray.reduce((s, i) => s + i.views, 0);
            
            // 💰 终极仲裁：前端捕获的 49400 优先！
            let finalSum = arraySum;
            if (visualTotalViews !== null && visualTotalViews > arraySum) {
                finalSum = visualTotalViews;
                console.log(`💰 财务终审: 采用上帝视角真实大盘数据 -> ${finalSum} (折线分布 ${arraySum})`);
            } else {
                console.log(`💰 财务终审: 采用折线图累加数据 -> ${finalSum}`);
            }

            console.log(`\n==================================================================`);
            console.log(`🎯 完美收官！30天数组已挂载，大盘流量 [ ${finalSum} ] 已锁定！`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(finalSum, JSON.stringify(finalTrendArray), accountId);
              
            return { success: true, message: `百家号同步成功！总量: ${finalSum}` };
        }

        return { success: false, message: 'AI提取失败，未识别到有效JSON' };

    } catch (error) {
        console.error(error);
        if (browserSession) await closeSandbox(accountId);
        return { success: false, message: error.message };
    }
}

/**
 * 6. 快手 (Kuaishou) 数据抽水机 (✨ 强制深蹲 + 懒加载破甲版)
 */
export async function syncKuaishouData(accountId) {
    console.log(`\n🚀 [全域数据罗盘] 启动快手节点 ${accountId} 数据抽水机 (满血修复版)...`);
    ensureTrendColumn();
    
    let browserSession = null;
    try {
        const db = getDB();
        browserSession = await launchSandbox(accountId, { headless: false, slowMo: 100 });
        const { page } = browserSession;

        // 💥 升级版网络拦截器：放宽条件，宁可错杀绝不放过
        let pureApiData = "";
        page.on('response', async (res) => {
            if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
                if (res.url().includes('kuaishou') && res.ok()) {
                    try {
                        const text = await res.text();
                        // 只要包含这些常见的数据大盘字段，统统截获
                        if (text.includes('play') || text.includes('view') || text.includes('stat') || text.includes('trend')) {
                            pureApiData += text.substring(0, 3000) + "\n\n"; 
                        }
                    } catch(e) {}
                }
            }
        });

        console.log(`[全域数据罗盘] 正在突入快手创作者服务平台...`);
        await page.goto('https://cp.kuaishou.com/statistics/works', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`[全域数据罗盘] 等待页面基础组件挂载...`);
        await page.waitForTimeout(4000); 

        console.log(`[全域数据罗盘] 强制锁定页面顶部，准备视觉追踪...`);
        await page.evaluate(() => window.scrollTo(0, 0)).catch(()=>{});

        let clicked = false;
        pureApiData = ""; // 清空拦截器，准备抓取点击后的新数据
        
        try {
            console.log(`[全域数据罗盘] 🔍 启动 Playwright 原生高亮制导...`);
            const thirtyBtns = await page.getByText('近30天', { exact: true }).all();
            
            for (const btn of thirtyBtns) {
                if (await btn.isVisible()) {
                    // 💥 涂黄标红，确认目标！
                    await btn.evaluate(node => { 
                        node.style.border = '3px solid red'; 
                        node.style.backgroundColor = 'yellow'; 
                    });
                    console.log(`[全域数据罗盘] 🎯 准星已锁定快手【近30天】！开火！`);
                    await page.waitForTimeout(800); 
                    
                    await btn.click({ force: true });
                    clicked = true;
                    break;
                }
            }
        } catch (e) {
            console.log(`⚠️ 点击逻辑出现异常！`);
        }

        if (!clicked) {
            console.log(`⚠️ [警告] 未能点击快手【近30天】！截图留证...`);
            await page.screenshot({ path: `debug-btn-missing-ks-${accountId}.png` });
        }

        // 🚨 核心修复区：点击后立刻执行“强制深蹲”，逼迫快手加载明细表格
        console.log(`[全域数据罗盘] 🚀 执行深度下潜！逼迫快手懒加载渲染底层明细...`);
        await page.evaluate(() => {
            // 先滚到一半，触发第一波加载
            window.scrollTo(0, document.body.scrollHeight / 2);
            // 1秒后再滚到底部，触发完全加载
            setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1000);
        }).catch(()=>{});

        console.log(`[全域数据罗盘] 潜伏 5 秒，等待网络请求回传与 DOM 重绘...`);
        // 加长等待时间，确保 API 数据拿到，且 DOM 渲染完毕
        await page.waitForTimeout(5000); 

        // 提取前，再次确认屏幕在最底部
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(()=>{});

        console.log(`[全域数据罗盘] 正在汇总前后台双模数据...`);
        
        let finalPayloadText = "";
        
        // 获取网页可见纯文本
        const domText = await page.evaluate(() => document.body.innerText);

        // 如果截获到了 API 数据，和网页文本拼装在一起（防止单一方式失效）
        if (pureApiData.trim().length > 50) {
            console.log(`[全域数据罗盘] 🟢 成功截获底层 API 报文，启动双模融合！`);
            finalPayloadText = `【网页提取文本】:\n${domText}\n\n【后台API报文】:\n${pureApiData}`;
        } else {
            console.log(`[全域数据罗盘] 🟡 API 嗅探为空，全量使用 DOM 文本 (${domText.length} 字符)...`);
            finalPayloadText = domText;
        }

        // 截断防止溢出 Token
        finalPayloadText = finalPayloadText.substring(0, 15000);

        console.log(`\n--- 🕵️‍♂️ 本次喂给 AI 的数据长度: ${finalPayloadText.length} 字符 ---`);

        await closeSandbox(accountId); 
        
        const trendArray = await extractTrendDataWithAI('快手', finalPayloadText);

        if (trendArray && trendArray.length > 0) {
            console.log(`\n==================================================================`);
            console.log(`🎯 [AI 视觉雷达] 大模型解析完毕！成功提取 ${trendArray.length} 天数据！`);
            
            const finalSum = trendArray.reduce((sum, item) => sum + item.views, 0);
            
            console.log(`💰 AI 结算: 最终落库总播放量为 ${finalSum}`);
            console.log(`==================================================================\n`);

            db.prepare(`UPDATE accounts SET total_views = ?, trend_data = ? WHERE id = ?`)
              .run(finalSum, JSON.stringify(trendArray), accountId);
              
            return { success: true, message: `快手 AI 同步成功！提取 ${trendArray.length} 天数据，总量: ${finalSum}` };
        }

        return { success: false, message: 'AI 未能从网络报文或网页文本中识别出有效的数据序列。' };

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
        if (platform === 'B站') return await syncBilibiliData(accountId);//遇到顽固反爬，待修复
        if (platform === '微信视频号') return await syncWechatChannelsData(accountId);//已完成
        if (platform === '百家号') return await syncBaijiahaoData(accountId);//已完成
        if (platform === '快手') return await syncKuaishouData(accountId);// 已完成
        return { success: false, message: `暂不支持 ${platform} 同步` };
    });
}