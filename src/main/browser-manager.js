import { chromium } from 'playwright';
import { FingerprintGenerator } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const activeBrowsers = new Map();

// 配置常量
const STATES_DIR = path.join(process.cwd(), 'account_states');
const FINGERPRINTS_DIR = path.join(process.cwd(), 'account_fingerprints');
const MAX_BACKUP_VERSIONS = 3;

// 初始化目录
[STATES_DIR, FINGERPRINTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ======================================
// 🔐 安全增强工具函数
// ======================================

function secureAtomicWriteFileSync(filePath, data, accountId) {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    try {
        const key = crypto.createHash('sha256').update(String(accountId)).digest(); 
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const payload = {
            data: encrypted,
            iv: iv.toString('hex'),
            timestamp: Date.now()
        };
        
        fs.writeFileSync(tempPath, JSON.stringify(payload), 'utf8');
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw error;
    }
}

function secureReadFileSync(filePath, accountId) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const payload = JSON.parse(content);
        
        const key = crypto.createHash('sha256').update(String(accountId)).digest();
        const iv = Buffer.from(payload.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        let decrypted = decipher.update(payload.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    } catch (error) {
        throw error;
    }
}

async function saveAccountState(accountId, context) {
    const stateFilePath = path.join(STATES_DIR, `${accountId}.json.enc`);
    try {
        const state = await context.storageState();
        
        const cleanedState = {
            ...state,
            origins: (state.origins || []).map(origin => ({
                ...origin,
                localStorage: (origin.localStorage || []).map(item => ({
                    ...item,
                    name: item.name.replace(/cdc_|webdriver|automation/gi, 'user_'),
                    value: item.value.replace(/cdc_|webdriver|automation/gi, 'user_data')
                }))
            }))
        };
        
        secureAtomicWriteFileSync(stateFilePath, cleanedState, accountId);
        
        const timestamp = Date.now();
        const backupPath = path.join(STATES_DIR, `${accountId}.${timestamp}.json.bak.enc`);
        secureAtomicWriteFileSync(backupPath, cleanedState, accountId);
        
        const backupFiles = fs.readdirSync(STATES_DIR)
            .filter(file => file.startsWith(`${accountId}.`) && file.endsWith('.json.bak.enc'))
            .sort()
            .reverse();
        
        backupFiles.slice(MAX_BACKUP_VERSIONS).forEach(oldFile => {
            try { fs.unlinkSync(path.join(STATES_DIR, oldFile)); } catch(e) {}
        });
        
        return true;
    } catch (error) {
        console.error(`❌ [持久化] 账号 [${accountId}] 状态保存失败:`, error.message);
        return false;
    }
}

/**
 * 🌐 智能代理转换引擎 (支持 ip:port:user:pass 格式)
 */
function parseProxyString(proxyStr) {
    if (!proxyStr) return undefined;
    try {
        const parts = proxyStr.trim().split(':');
        if (parts.length === 4) {
            // 格式: IP:Port:User:Pass
            return { server: `http://${parts[0]}:${parts[1]}`, username: parts[2], password: parts[3] };
        } else if (parts.length === 2) {
            // 格式: IP:Port
            return { server: `http://${parts[0]}:${parts[1]}` };
        }
        return { server: proxyStr }; // 兜底
    } catch (e) {
        console.warn('⚠️ 代理格式解析失败:', proxyStr);
        return undefined;
    }
}

function getOrCreateSessionProfile(accountId) {
    const fingerprintPath = path.join(FINGERPRINTS_DIR, `${accountId}.json.enc`);
    
    if (fs.existsSync(fingerprintPath)) {
        try {
            const data = secureReadFileSync(fingerprintPath, accountId);
            console.log(`🔑 [指纹] 加载账号 [${accountId}] 的固定硬件指纹`);
            return data;
        } catch (error) {
            console.warn(`⚠️ [指纹] 账号 [${accountId}] 指纹文件损坏，将重新生成`);
        }
    }
    
    console.log(`🎲 [指纹] 为账号 [${accountId}] 生成全新固定硬件指纹`);
    const fingerprintGenerator = new FingerprintGenerator({
        devices: ['desktop'],
        browsers: [{ name: 'chrome', minVersion: 125, maxVersion: 130 }],
        operatingSystems: ['windows'],
        locales: ['zh-CN'],
        hardwareConcurrency: { min: 2, max: 16 },
        deviceMemory: { min: 1, max: 8 }
    });
    
    const fingerprintData = fingerprintGenerator.getFingerprint();
    
    fingerprintData.fingerprint.webgl = {
        vendor: 'Intel Inc.',
        renderer: 'Intel Iris OpenGL Engine',
        version: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
        shadingLanguageVersion: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)'
    };
    
    secureAtomicWriteFileSync(fingerprintPath, fingerprintData, accountId);
    
    return fingerprintData;
}

// ======================================
// 🧍 人类行为模拟核心函数
// ======================================

function randomDelay(min, max) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
}

function bezierCurve(t, p0, p1, p2, p3) {
    const cX = 3 * (p1.x - p0.x);
    const bX = 3 * (p2.x - p1.x) - cX;
    const aX = p3.x - p0.x - cX - bX;
    const cY = 3 * (p1.y - p0.y);
    const bY = 3 * (p2.y - p1.y) - cY;
    const aY = p3.y - p0.y - cY - bY;
    const x = aX * Math.pow(t, 3) + bX * Math.pow(t, 2) + cX * t + p0.x;
    const y = aY * Math.pow(t, 3) + bY * Math.pow(t, 2) + cY * t + p0.y;
    return { x, y };
}

async function humanMouseMove(page, targetX, targetY, options = {}) {
    const { speed = 'normal', overshoot = true, jitter = true } = options;
    const speedConfig = {
        fast: { steps: 20, delay: [5, 15], overshootAmount: 5 },
        normal: { steps: 40, delay: [10, 25], overshootAmount: 10 },
        slow: { steps: 60, delay: [20, 40], overshootAmount: 15 }
    }[speed];
    
    const startPos = await page.evaluate(() => ({ x: window.mouseX || 0, y: window.mouseY || 0 }));
    const control1 = { x: startPos.x + (targetX - startPos.x) * 0.3 + (Math.random() - 0.5) * 100, y: startPos.y + (targetY - startPos.y) * 0.3 + (Math.random() - 0.5) * 100 };
    const control2 = { x: startPos.x + (targetX - startPos.x) * 0.7 + (Math.random() - 0.5) * 100, y: startPos.y + (targetY - startPos.y) * 0.7 + (Math.random() - 0.5) * 100 };
    
    let finalTarget = { x: targetX, y: targetY };
    if (overshoot && Math.random() > 0.3) {
        finalTarget = { x: targetX + (Math.random() - 0.5) * speedConfig.overshootAmount, y: targetY + (Math.random() - 0.5) * speedConfig.overshootAmount };
    }
    
    for (let i = 0; i <= speedConfig.steps; i++) {
        const t = i / speedConfig.steps;
        const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const pos = bezierCurve(easedT, startPos, control1, control2, finalTarget);
        if (jitter && i > 0 && i < speedConfig.steps) {
            pos.x += (Math.random() - 0.5) * 2;
            pos.y += (Math.random() - 0.5) * 2;
        }
        await page.mouse.move(Math.round(pos.x), Math.round(pos.y));
        await randomDelay(...speedConfig.delay);
    }
    
    if (overshoot && (finalTarget.x !== targetX || finalTarget.y !== targetY)) {
        await randomDelay(50, 150);
        await page.mouse.move(targetX, targetY);
        await randomDelay(30, 80);
    }
    
    await page.evaluate((x, y) => { window.mouseX = x; window.mouseY = y; }, targetX, targetY);
}

async function humanClick(page, selector, options = {}) {
    const { clickCount = 1, button = 'left', delay = 0 } = options;
    const element = await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
    const box = await element.boundingBox();
    if (!box) throw new Error(`元素 ${selector} 不可点击`);
    const clickX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const clickY = box.y + box.height * (0.2 + Math.random() * 0.6);
    await humanMouseMove(page, Math.round(clickX), Math.round(clickY), options);
    await randomDelay(80, 250);
    await page.mouse.down({ button });
    await randomDelay(50 + delay, 150 + delay);
    await page.mouse.up({ button });
    await randomDelay(100, 300);
    for (let i = 1; i < clickCount; i++) {
        await randomDelay(200, 400);
        await page.mouse.down({ button });
        await randomDelay(50, 150);
        await page.mouse.up({ button });
    }
    return element;
}

async function humanType(page, selector, text, options = {}) {
    const { typingSpeed = 'normal', errorRate = 0.05, backspaceDelay = [100, 200] } = options;
    await humanClick(page, selector);
    await page.press(selector, 'Ctrl+A');
    await randomDelay(100, 200);
    await page.press(selector, 'Backspace');
    await randomDelay(150, 300);
    const speedConfig = { 
        fast: { charDelay: [30, 80], wordDelay: [50, 150] }, 
        normal: { charDelay: [60, 150], wordDelay: [100, 250] }, 
        slow: { charDelay: [100, 250], wordDelay: [200, 400] } 
    }[typingSpeed];
    const chars = text.split('');
    let i = 0;
    while (i < chars.length) {
        if (Math.random() < errorRate && i > 0 && i < chars.length - 3) {
            const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            await page.keyboard.type(wrongChar);
            await randomDelay(...speedConfig.charDelay);
            await randomDelay(...backspaceDelay);
            await page.keyboard.press('Backspace');
            await randomDelay(...backspaceDelay);
            continue;
        }
        await page.keyboard.type(chars[i]);
        await randomDelay(...speedConfig.charDelay);
        if (chars[i] === ' ' || chars[i] === '，' || chars[i] === '。') {
            await randomDelay(...speedConfig.wordDelay);
        }
        i++;
    }
    await randomDelay(300, 600);
}

async function humanScroll(page, direction = 'down', options = {}) {
    const { distance = 'medium', speed = 'normal' } = options;
    const distanceConfig = { small: [100, 300], medium: [300, 600], large: [600, 1000] }[distance];
    const speedConfig = { 
        fast: { stepDelay: [10, 20], stepSize: [30, 50] }, 
        normal: { stepDelay: [20, 40], stepSize: [15, 30] }, 
        slow: { stepDelay: [40, 80], stepSize: [5, 15] } 
    }[speed];
    const scrollAmount = Math.floor(Math.random() * (distanceConfig[1] - distanceConfig[0] + 1)) + distanceConfig[0];
    let scrolled = 0;
    while (scrolled < scrollAmount) {
        const step = Math.floor(Math.random() * (speedConfig.stepSize[1] - speedConfig.stepSize[0] + 1)) + speedConfig.stepSize[0];
        const actualStep = Math.min(step, scrollAmount - scrolled);
        const scrollDirection = direction === 'down' ? actualStep : -actualStep;
        await page.evaluate(delta => window.scrollBy(0, delta), scrollDirection);
        scrolled += actualStep;
        await randomDelay(...speedConfig.stepDelay);
        if (Math.random() < 0.1) await randomDelay(200, 800);
    }
    await randomDelay(500, 1500);
}

async function humanRead(page, options = {}) {
    const { minTime = 2000, maxTime = 10000, scrollProbability = 0.7 } = options;
    const readTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    const startTime = Date.now();
    while (Date.now() - startTime < readTime) {
        if (Math.random() < scrollProbability) {
            const direction = Math.random() > 0.3 ? 'down' : 'up';
            await humanScroll(page, direction, { distance: 'small' });
        }
        await randomDelay(500, 2000);
    }
}

// ======================================
// 增强版会话容器核心函数 (纯事件驱动版，0心跳)
// ======================================

export async function launchSandbox(accountId, options = {}) {
    if (activeBrowsers.has(accountId)) {
        const session = activeBrowsers.get(accountId);
        try {
            const pages = session.context.pages();
            if (pages.length > 0 && session.browser.isConnected()) {
                console.warn(`⚠️ [Session Manager] 账号 [${accountId}] 会话容器已在运行，直接激活窗口`);
                try { await pages[0].bringToFront(); } catch(e){}
                return session;
            }
        } catch (e) {}

        console.log(`🧹 [Session Manager] 发现账号 [${accountId}] 的遗留进程，正在清理...`);
        try { await session.browser.close(); } catch(e) {}
        activeBrowsers.delete(accountId);
    }

    console.log(`\n🛡️ [Session Manager] 正在为账号 [${accountId}] 部署隔离会话容器...`);

    try {
        const fingerprintData = getOrCreateFingerprint(accountId);
        const fingerprint = fingerprintData.fingerprint;
        const headers = fingerprintData.headers;

        const browser = await chromium.launch({
            headless: options.headless ?? false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-infobars',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=Translate,MediaRouter,OptimizationHints',
                '--disable-search-engine-choice-screen',
                '--disable-default-apps',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-webrtc',
                '--disable-rtc-smoothness-algorithm',
                '--disable-webrtc-hw-decoding',
                '--disable-webrtc-hw-encoding',
                '--enforce-webrtc-ip-permission-check',
                '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-site-isolation-trials',
                '--disable-background-networking',
                '--disable-background-timer-accuracy-reduction',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--disable-features=VizDisplayCompositor',
                '--disable-gpu-sandbox',
                '--no-zygote',
                '--no-sandbox',
            ],
            timeout: 60000,
        });

        const contextOptions = {
            userAgent: fingerprint.navigator.userAgent,
            viewport: { width: fingerprint.screen.width, height: fingerprint.screen.height },
            deviceScaleFactor: fingerprint.screen.devicePixelRatio,
            extraHTTPHeaders: { 'accept-language': headers['accept-language'] },
            permissions: ['geolocation'],
            geolocation: options.geolocation || { latitude: 30.2741, longitude: 120.1551 },
            // 代理配置：将代理 IP 绑定到当前会话上下文
            proxy: options.proxy ? parseProxyString(options.proxy) : undefined
        };

        const stateFilePath = path.join(STATES_DIR, `${accountId}.json.enc`);
        if (fs.existsSync(stateFilePath)) {
            try {
                const stateData = secureReadFileSync(stateFilePath, accountId);
                if (stateData.cookies && stateData.origins) {
                    console.log(`📂 [持久化] 检测到账号 [${accountId}] 的有效状态，正在恢复会话...`);
                    const tempStatePath = path.join(STATES_DIR, `${accountId}_temp.json`);
                    fs.writeFileSync(tempStatePath, JSON.stringify(stateData));
                    contextOptions.storageState = tempStatePath;
                    
                    setTimeout(() => {
                        try { fs.unlinkSync(tempStatePath); } catch(e) {}
                    }, 30000);
                } else {
                    throw new Error('状态文件格式无效');
                }
            } catch (error) {
                console.warn(`⚠️ [持久化] 账号 [${accountId}] 状态文件损坏，将使用全新会话`);
                try { fs.renameSync(stateFilePath, `${stateFilePath}.corrupted.${Date.now()}`); } catch(e) {}
            }
        }

        const context = await browser.newContext(contextOptions);

        const fingerprintInjector = new FingerprintInjector();
        await fingerprintInjector.attachFingerprintToPlaywright(context, fingerprintData);

        const getStableSeed = (id) => {
            let hash = 0;
            const str = String(id);
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0; 
            }
            return Math.abs(hash) || 12345;
        };
        const stableSeed = getStableSeed(accountId);

        await context.addInitScript((seed) => {
            const deterministicRandom = (inputStr) => {
                let hash = 0;
                for (let i = 0; i < inputStr.length; i++) {
                    hash = ((hash << 5) - hash) + inputStr.charCodeAt(i);
                    hash |= 0;
                }
                const x = Math.sin(hash) * 10000;
                return x - Math.floor(x);
            };

            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(...args) {
                try {
                    const ctx = this.getContext('2d');
                    if (ctx && this.width > 10 && this.height > 10) {
                        for (let i = 0; i < 5; i++) {
                            const randX = deterministicRandom(`x_${seed}_${this.width}_${i}`);
                            const randY = deterministicRandom(`y_${seed}_${this.height}_${i}`);
                            const x = Math.floor(randX * this.width);
                            const y = Math.floor(randY * this.height);
                            
                            const r = Math.floor(deterministicRandom(`r_${seed}_${i}`) * 3);
                            const g = Math.floor(deterministicRandom(`g_${seed}_${i}`) * 3);
                            const b = Math.floor(deterministicRandom(`b_${seed}_${i}`) * 3);
                            
                            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.002)`;
                            ctx.fillRect(x, y, 1, 1);
                        }
                    }
                } catch(e) {}
                return originalToDataURL.apply(this, args);
            };

            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
            CanvasRenderingContext2D.prototype.getImageData = function(...args) {
                const imageData = originalGetImageData.apply(this, args);
                try {
                    if (imageData && imageData.data && imageData.data.length > 100) {
                        for (let i = 0; i < 10; i++) {
                            const randIdx = deterministicRandom(`idx_${seed}_${imageData.data.length}_${i}`);
                            const maxPixels = Math.floor(imageData.data.length / 4);
                            const idx = Math.floor(randIdx * maxPixels) * 4;
                            
                            const noiseR = Math.floor(deterministicRandom(`nr_${seed}_${i}`) * 3);
                            const noiseG = Math.floor(deterministicRandom(`ng_${seed}_${i}`) * 3);
                            const noiseB = Math.floor(deterministicRandom(`nb_${seed}_${i}`) * 3);

                            imageData.data[idx] = (imageData.data[idx] + noiseR) % 255;
                            imageData.data[idx+1] = (imageData.data[idx+1] + noiseG) % 255;
                            imageData.data[idx+2] = (imageData.data[idx+2] + noiseB) % 255;
                        }
                    }
                } catch(e) {}
                return imageData;
            };

            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                switch (parameter) {
                    case 37445: return 'Intel Inc.';
                    case 37446: return 'Intel Iris OpenGL Engine';
                    default: return originalGetParameter.call(this, parameter);
                }
            };

            const originalCreateAnalyser = window.AudioContext ? AudioContext.prototype.createAnalyser : null;
            if (originalCreateAnalyser) {
                AudioContext.prototype.createAnalyser = function() {
                    const analyser = originalCreateAnalyser.call(this);
                    const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
                    analyser.getFloatFrequencyData = function(array) {
                        originalGetFloatFrequencyData.call(this, array);
                        for (let i = 0; i < array.length; i++) {
                            const rand = deterministicRandom(`audio_${seed}_${i}`);
                            if (rand < 0.01) { 
                                array[i] += (deterministicRandom(`val_${seed}_${i}`) - 0.5) * 0.001;
                            }
                        }
                        return array;
                    };
                    return analyser;
                };
            }

            delete window.cdc_adoQpoasnfa76pfcZLmcfl_;
            delete window.cdc_asdjflasutopfhvcZLmcfl_;
            delete window.$cdc_asdjflasutopfhvcZLmcfl_;
            delete window.$wdc_;
            
            const fakePlugins = {
                length: 3,
                0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
                refresh: () => {}
            };
            fakePlugins.item = function(index) { return this[index] || null; };
            fakePlugins.namedItem = function(name) { return this[name] || null; };

            Object.defineProperties(navigator, {
                webdriver: { get: () => undefined },
                plugins: { get: () => fakePlugins },
                languages: { get: () => ['zh-CN', 'zh', 'en'] }
            });

            Object.defineProperties(window, {
                outerHeight: { get: () => screen.height },
                outerWidth: { get: () => screen.width },
                innerHeight: { get: () => screen.height - 85 },
                innerWidth: { get: () => screen.width }
            });

            window.mouseX = window.innerWidth / 2;
            window.mouseY = window.innerHeight / 2;
            
            document.addEventListener('mousemove', (e) => {
                window.mouseX = e.clientX;
                window.mouseY = e.clientY;
            });
        }, stableSeed);

        // 🌟 核心删除：彻底拔除定时心跳管子！
        // 已经完全删除了 setInterval

        const page = await context.newPage();

        // 🌟 纯事件驱动 1：路由跳转抓拍（扫码成功必触发）
        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                try {
                    if (browser.isConnected()) {
                        await saveAccountState(accountId, context);
                        console.log(`📸 [Session Manager] 检测到页面跳转，自动保存最新状态`);
                    }
                } catch (e) {}
            }
        });

        // 🌟 纯事件驱动 2：关闭浏览器时最后封装
        context.on('close', async () => {
            try { 
                if (browser.isConnected()) await saveAccountState(accountId, context); 
            } catch(e) {}
            console.log(`🛑 账号 [${accountId}] 窗口已关闭，状态已安全封存。`);
            
            if (activeBrowsers.has(accountId)) {
                activeBrowsers.delete(accountId);
                try { await browser.close(); } catch(e) {}
            }
        });

        browser.on('disconnected', async () => {
            if (activeBrowsers.has(accountId)) {
                activeBrowsers.delete(accountId);
                console.log(`⚠️ 账号 [${accountId}] 浏览器已断开连接`);
            }
        });

        await page.evaluate(() => {
            Object.defineProperty(screen, 'availWidth', { value: screen.width });
            Object.defineProperty(screen, 'availHeight', { value: screen.height - 40 });
            Object.defineProperty(navigator, 'platform', { value: 'Win32' });
            
            if (window.navigator.webdriver !== undefined) {
                delete window.navigator.webdriver;
            }
        });

        page.humanClick = (selector, opts) => humanClick(page, selector, opts);
        page.humanType = (selector, text, opts) => humanType(page, selector, text, opts);
        page.humanScroll = (direction, opts) => humanScroll(page, direction, opts);
        page.humanRead = (opts) => humanRead(page, opts);
        page.humanMouseMove = (x, y, opts) => humanMouseMove(page, x, y, opts);
        page.randomDelay = (min, max) => randomDelay(min, max);

        // 注意：session 中移除了 saveInterval
        const session = { browser, context, page };
        activeBrowsers.set(accountId, session);

        console.log(`✅ [Session Manager] 账号 [${accountId}] 隔离会话容器就绪！\n`);

        return session;

    } catch (error) {
        console.error(`❌ [Session Manager] 账号 [${accountId}] 会话容器启动失败:`, error.message);
        if (activeBrowsers.has(accountId)) {
            const session = activeBrowsers.get(accountId);
            try { await session.browser.close(); } catch(e) {}
            activeBrowsers.delete(accountId);
        }
        throw error;
    }
}

export async function closeSandbox(accountId) {
    const session = activeBrowsers.get(accountId);
    if (!session) {
        console.warn(`⚠️ 账号 [${accountId}] 没有运行中的会话容器`);
        return false;
    }

    try {
        console.log(`💾 [持久化] 正在保存账号 [${accountId}] 的最终状态...`);
        await saveAccountState(accountId, session.context);
        
        await session.browser.close();
        activeBrowsers.delete(accountId);
        
        console.log(`🛑 账号 [${accountId}] 会话容器已安全回收。\n`);
        return true;
    } catch (error) {
        console.error(`❌ 账号 [${accountId}] 会话容器关闭失败:`, error.message);
        return false;
    }
}

export async function saveAllStates() {
    console.log(`\n💾 [紧急备份] 正在保存所有运行中账号的状态...`);
    const promises = [];
    for (const [accountId, session] of activeBrowsers) {
        promises.push(saveAccountState(accountId, session.context));
    }
    await Promise.all(promises);
    console.log(`✅ [紧急备份] 所有账号状态保存完成\n`);
}
// ======================================
// Cookie 导入与登录会话初始化引擎
// ======================================
export async function importCookieAndInitialize(accountId, cookieStr, platform, options = {}) {
    const domainMap = {
        '小红书': '.xiaohongshu.com',
        '抖音': '.douyin.com',
        'B站': '.bilibili.com',
        '快手': '.kuaishou.com',
        '百家号': '.baidu.com',
        '微信视频号': '.qq.com'
    };
    const domain = domainMap[platform] || '.xiaohongshu.com';
    const targetUrl = `https://www${domain}`;

    // 1. 智能解析 CK (兼容 JSON 和 Header 字符串)
    let cookies = [];
    try {
        if (cookieStr.trim().startsWith('[')) {
            cookies = JSON.parse(cookieStr);
            cookies = cookies.map(c => ({...c, domain: c.domain || domain}));
        } else {
            cookies = cookieStr.split(';').map(pair => {
                const index = pair.indexOf('=');
                if (index === -1) return null;
                return {
                    name: pair.substring(0, index).trim(),
                    value: pair.substring(index + 1).trim(),
                    domain: domain,
                    path: '/'
                };
            }).filter(c => c !== null);
        }
    } catch (e) {
        throw new Error('CK 格式解析失败，请检查格式');
    }

    console.log(`\n🛡️ [Cookie Manager] 正在为账号 [${accountId}] 启动隔离会话容器...`);
    // 将 proxy 透传给底层会话
    const session = await launchSandbox(accountId, { headless: true, proxy: options.proxy });
    const { context, page } = session;

    try {
        // 3. 注入 Cookie
        await context.addCookies(cookies);

        // 4. 预热会话：访问首页，让官方下发 LocalStorage
        console.log(`[Cookie Manager] 正在前往 ${targetUrl} 预热环境...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.randomDelay(2000, 3000);

        // 5. 会话握手：刷新页面，让前后端 Token 完成校验
        console.log(`[Cookie Manager] 触发深度重载，生成合法缓存...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.randomDelay(3000, 5000);

        // 6. 保存状态并关闭会话
        await saveAccountState(accountId, context);
        await closeSandbox(accountId);
        console.log(`✅ [Cookie Manager] 账号 [${accountId}] 会话初始化并加密持久化成功！\n`);
        return true;
    } catch (error) {
        await closeSandbox(accountId);
        throw new Error('会话初始化过程被平台拦截: ' + error.message);
    }
}

// ======================================
// 🔍 状态探活接口
// ======================================
export function isSandboxActive(accountId) {
    return activeBrowsers.has(accountId);
}

process.on('SIGINT', async () => {
    console.log(`\n\n⚠️ 检测到程序退出信号`);
    await saveAllStates();
    for (const [accountId] of activeBrowsers) {
        await closeSandbox(accountId);
    }
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error(`\n\n❌ 未捕获的异常:`, error);
    await saveAllStates();
    process.exit(1);
});