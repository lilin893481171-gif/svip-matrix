// src/main/core-downloader.js
import os from 'os';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import extract from 'extract-zip';
import { app } from 'electron';

// 你的专属阿里云/腾讯云 CDN 地址
const CDN_BASE_URL = 'https://your-cdn-domain.com/browser-cores'; 

// 定义内核存放的绝对安全路径 (放在用户的 AppData 隐藏目录下，绝不丢失)
const CORE_DIR = path.join(app.getPath('userData'), 'Matrix_Browser_Core');

/**
 * 1. 智能侦测客户系统类型，返回对应的下载链接
 */
function getSystemCoreUrl() {
    const platform = os.platform(); // 'win32' 或 'darwin' (mac)
    const arch = os.arch();         // 'x64' 或 'arm64'

    if (platform === 'win32' && arch === 'x64') {
        return `${CDN_BASE_URL}/chrome-win-x64.zip`;
    } else if (platform === 'darwin' && arch === 'arm64') {
        return `${CDN_BASE_URL}/chrome-mac-arm64.zip`; // 苹果 M 系列芯片
    } else if (platform === 'darwin' && arch === 'x64') {
        return `${CDN_BASE_URL}/chrome-mac-x64.zip`;   // 苹果 Intel 芯片
    } else {
        throw new Error('抱歉，暂不支持该操作系统！');
    }
}

/**
 * 2. 核心大招：静默下载、进度回传、自动解压
 * @param {object} mainWindow - 用于向前端 UI 发送进度条数据
 */
export async function ensureBrowserCore(mainWindow) {
    // 检查是否已经下载过了，避免重复下载
    const executablePath = getExecutablePath();
    if (fs.existsSync(executablePath)) {
        console.log('✅ 底层装甲已存在，直接启动！');
        return executablePath;
    }

    console.log('⚠️ 未检测到底层装甲，启动云端下发协议...');
    const zipUrl = getSystemCoreUrl();
    const zipPath = path.join(app.getPath('userData'), 'core.zip');

    // 确保目录存在
    if (!fs.existsSync(CORE_DIR)) fs.mkdirSync(CORE_DIR, { recursive: true });

    // 开始流式下载
    const response = await axios({
        url: zipUrl,
        method: 'GET',
        responseType: 'stream'
    });

    const totalLength = parseInt(response.headers['content-length'], 10);
    let downloadedLength = 0;

    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            const progress = Math.round((downloadedLength / totalLength) * 100);
            
            // 🌟 实时向你的 Vue/React 前端发送进度条数据
            if (mainWindow) {
                mainWindow.webContents.send('core-download-progress', progress);
            }
            console.log(`📥 装甲下发中: ${progress}%`);
        });

        writer.on('finish', async () => {
            console.log('📦 下载完毕，开始极速解压...');
            if (mainWindow) mainWindow.webContents.send('core-download-status', '正在解压底层驱动...');
            
            try {
                await extract(zipPath, { dir: CORE_DIR });
                fs.unlinkSync(zipPath); // 解压完删掉压缩包省空间
                
                // ⚠️ Mac 系统下需要给浏览器赋执行权限
                if (os.platform() === 'darwin') {
                    fs.chmodSync(getExecutablePath(), '755');
                }
                
                console.log('🎉 底层装甲部署彻底完成！');
                if (mainWindow) mainWindow.webContents.send('core-download-status', '部署完成，系统启动！');
                resolve(getExecutablePath());
            } catch (err) {
                reject(`解压失败: ${err.message}`);
            }
        });

        writer.on('error', reject);
    });
}

/**
 * 3. 动态获取最终的启动文件路径 (.exe 或 Mac的可执行文件)
 */
export function getExecutablePath() {
    const platform = os.platform();
    if (platform === 'win32') {
        return path.join(CORE_DIR, 'chrome-win', 'chrome.exe'); // 根据你压缩包内部的真实结构调整
    } else {
        return path.join(CORE_DIR, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'); 
    }
}