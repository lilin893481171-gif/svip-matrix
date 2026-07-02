
const { EventEmitter } = require('events');
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const fsPromises = fs.promises;
const execPromise = util.promisify(exec);
const os = require('os');

// 通过 playwright-core 包的主入口文件路径来构建 browsers.json 的路径
const PLAYWRIGHT_CORE_PATH = require.resolve('playwright-core');
const PLAYWRIGHT_BROWSERS_PATH = path.join(path.dirname(PLAYWRIGHT_CORE_PATH), 'browsers.json');

// Playwright 默认的缓存目录
const PLAYWRIGHT_CACHE_DIR = path.join(os.homedir(), '.cache', 'ms-playwright');

class BrowserEngineManager extends EventEmitter {
    constructor(splashWindow) {
        super();
        this.splashWindow = splashWindow;
        this.enginePath = this._getEngineBasePath();
        this.versionFilePath = path.join(this.enginePath, '.version');
        this._registerIPCListeners();
    }

    _getEngineBasePath() {
        // 首先检查 Playwright 的默认缓存目录
        if (fs.existsSync(PLAYWRIGHT_CACHE_DIR)) {
            return PLAYWRIGHT_CACHE_DIR;
        }

        // 如果 Playwright 的缓存目录不存在，则使用我们自己的目录
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'browser-engine');
    }

    _emitStatus(status, progress = null, message = '') {
        const payload = { status, progress, message };
        this.emit('status-changed', payload);
    }

    _registerIPCListeners() {
        const channel = 'engine-status-update';
        this.on('status-changed', (payload) => {
            if (this.splashWindow && !this.splashWindow.isDestroyed()) {
                this.splashWindow.webContents.send(channel, payload);
            }
        });
    }

    async getExecutablePath() {
        // 检查版本文件是否存在
        if (!fs.existsSync(this.versionFilePath)) {
            return null;
        }

        // 读取版本号
        const revision = await fsPromises.readFile(this.versionFilePath, 'utf-8');

        // 检查是否使用 Playwright 的默认缓存目录
        if (this.enginePath === PLAYWRIGHT_CACHE_DIR) {
            // Playwright 的目录结构: <cache-dir>/chromium-<revision>/chrome-<platform>/
            const platform = this._getPlatform();
            let executablePath;

            if (platform === 'mac') {
                executablePath = path.join(this.enginePath, `chromium-${revision}`, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            } else if (platform === 'win64') {
                executablePath = path.join(this.enginePath, `chromium-${revision}`, 'chrome-win', 'chrome.exe');
            } else if (platform === 'linux') {
                executablePath = path.join(this.enginePath, `chromium-${revision}`, 'chrome-linux', 'chrome');
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

            return fs.existsSync(executablePath) ? executablePath : null;
        } else {
            // 使用我们自己的目录结构
            const platform = this._getPlatform();
            const browserPath = path.join(this.enginePath, `chromium-${revision}`);

            let executablePath;
            if (platform === 'mac') {
                executablePath = path.join(browserPath, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            } else if (platform === 'win64') {
                executablePath = path.join(browserPath, 'chrome-win', 'chrome.exe');
            } else if (platform === 'linux') {
                executablePath = path.join(browserPath, 'chrome-linux', 'chrome');
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            return fs.existsSync(executablePath) ? executablePath : null;
        }
    }


    async ensureEngineReady() {
        try {
            const executablePath = await this.getExecutablePath();
            if (executablePath && await this._verify(executablePath, false)) {
                this._emitStatus('completed', 100, '浏览器引擎已就绪');
                return executablePath;
            }
            return await this._download();
        } catch (error) {
            console.error('Failed to ensure browser engine readiness:', error);
            this._emitStatus('error', null, `引擎初始化失败: ${error.message}`);
            throw error;
        }
    }

    _getPlatform() {
        const platform = process.platform;
        if (platform === 'darwin') return 'mac';
        if (platform === 'win32') return 'win64'; // Playwright uses win64 for Windows
        if (platform === 'linux') return 'linux';
        throw new Error(`Unsupported platform: ${platform}`);
    }

    async _getDownloadUrl() {
        const browsers = JSON.parse(await fsPromises.readFile(PLAYWRIGHT_BROWSERS_PATH, 'utf-8'));
        const chromium = browsers.browsers.find(b => b.name === 'chromium');
        const revision = chromium.revision;
        const platform = this._getPlatform();

        // As per documentation, linux is just 'linux', mac is 'mac', win32 is 'win64'
        const platformSuffix = platform === 'win64' ? 'win64' : platform;

        return {
            url: `https://playwright.azureedge.net/builds/chromium/${revision}/chromium-${platformSuffix}.zip`,
            revision: revision
        };
    }

    async _download() {
        // 使用 Playwright CLI 下载浏览器
        try {
            this._emitStatus('downloading', 0, '开始下载浏览器引擎...');

            // 设置环境变量，指定 Playwright 的缓存目录
            const env = { ...process.env };
            if (this.enginePath !== PLAYWRIGHT_CACHE_DIR) {
                env.PLAYWRIGHT_BROWSERS_PATH = this.enginePath;
            }

            // 调用 Playwright CLI 安装 Chromium
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            // 获取 Playwright CLI 的路径
            const cliPath = path.join(path.dirname(PLAYWRIGHT_CORE_PATH), 'cli.js');

            // 执行安装命令
            await execPromise(`node "${cliPath}" install chromium`, {
                cwd: process.cwd(),
                stdio: 'pipe',
                env: env
            });

            this._emitStatus('downloading', 100, '下载完成');

            // 获取版本号
            const browsers = JSON.parse(await fsPromises.readFile(PLAYWRIGHT_BROWSERS_PATH, 'utf-8'));
            const chromium = browsers.browsers.find(b => b.name === 'chromium');
            const revision = chromium.revision;

            // 验证安装
            const executablePath = await this.getExecutablePath();
            if (executablePath && await this._verify(executablePath, true)) {
                await fsPromises.writeFile(this.versionFilePath, revision);
                this._emitStatus('completed', 100, '浏览器引擎已成功安装并验证');
                return executablePath;
            } else {
                throw new Error('浏览器引擎验证失败');
            }
        } catch (error) {
            console.error('使用 Playwright CLI 下载失败:', error);
            this._emitStatus('error', null, `下载失败: ${error.message}`);
            throw error;
        }
    }

    async _unzipAndProcess(zipPath, revision) {
        const extractPath = path.join(this.enginePath, `chromium-${revision}`);
        await fsPromises.mkdir(extractPath, { recursive: true });

        this._emitStatus('unzipping', null, '正在解压文件...');
        await extract(zipPath, { dir: extractPath });
        this._emitStatus('unzipping', 100, '解压完成');
        await fsPromises.unlink(zipPath);

        await this._postProcess(extractPath);

        const executablePath = await this.getExecutablePathAfterDownload(extractPath);
        if(!executablePath) {
            throw new Error("Could not find executable after extraction and post-processing.");
        }

        if (await this._verify(executablePath, true)) {
            await fsPromises.writeFile(this.versionFilePath, revision);
            this._emitStatus('completed', 100, '浏览器引擎已成功安装并验证');
            return executablePath;
        } else {
            throw new Error('浏览器引擎验证失败');
        }
    }

    async getExecutablePathAfterDownload(browserPath) {
        const platform = this._getPlatform();

        // 检查是否使用 Playwright 的默认缓存目录
        if (this.enginePath === PLAYWRIGHT_CACHE_DIR) {
            // Playwright 的目录结构: <cache-dir>/chromium-<revision>/chrome-<platform>/
            let executablePath;

            if (platform === 'mac') {
                executablePath = path.join(browserPath, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            } else if (platform === 'win64') {
                executablePath = path.join(browserPath, 'chrome-win', 'chrome.exe');
            } else if (platform === 'linux') {
                executablePath = path.join(browserPath, 'chrome-linux', 'chrome');
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

            return fs.existsSync(executablePath) ? executablePath : null;
        } else {
            // 使用我们自己的目录结构
            let executablePath;
            if (platform === 'mac') {
                executablePath = path.join(browserPath, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            } else if (platform === 'win64') {
                executablePath = path.join(browserPath, 'chrome-win', 'chrome.exe');
            } else if (platform === 'linux') {
                executablePath = path.join(browserPath, 'chrome-linux', 'chrome');
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            return fs.existsSync(executablePath) ? executablePath : null;
        }
    }


    async _postProcess(engineDir) {
        const platform = process.platform;
        this._emitStatus('post-processing', null, '执行平台特定后处理...');

        // 检查是否使用 Playwright 的默认缓存目录
        if (this.enginePath === PLAYWRIGHT_CACHE_DIR) {
            // Playwright 会自动处理后处理，我们不需要做任何事情
            this._emitStatus('post-processing', 100, '后处理完成');
            return;
        }

        if (platform === 'darwin') {
            const appPath = path.join(engineDir, 'chrome-mac', 'Chromium.app');
            if(!fs.existsSync(appPath)) {
                 throw new Error(`Chromium.app not found at ${appPath}`);
            }
            console.log(`Running post-processing for macOS on: ${appPath}`);
            await execPromise(`xattr -cr "${appPath}"`);
            await execPromise(`chmod -R +x "${appPath}"`);
        } else if (platform === 'linux') {
            const executablePath = path.join(engineDir, 'chrome-linux', 'chrome');
             if(!fs.existsSync(executablePath)) {
                 throw new Error(`Chrome executable not found at ${executablePath}`);
            }
            console.log(`Running post-processing for Linux on: ${executablePath}`);
            await execPromise(`chmod +x "${executablePath}"`);
        }
        // No post-processing needed for Windows
        this._emitStatus('post-processing', 100, '后处理完成');
    }

    async _verify(executablePath, isFirstTime) {
        if(isFirstTime) this._emitStatus('verifying', null, '正在验证引擎...');

        try {
            const { stdout } = await execPromise(`"${executablePath}" --version`);
            if (stdout && stdout.includes('Chromium')) {
                if(isFirstTime) this._emitStatus('verifying', 100, `验证成功: ${stdout.trim()}`);
                return true;
            }
            throw new Error('验证失败: 无效的版本输出');
        } catch (error) {
            console.error(`Engine verification failed at ${executablePath}`, error);
            if(isFirstTime) this._emitStatus('error', null, `引擎验证失败: ${error.message}`);
            return false;
        }
    }
}

export default BrowserEngineManager;
