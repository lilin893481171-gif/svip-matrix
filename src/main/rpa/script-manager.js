/**
 * @file rpa/script-manager.js
 * RPA 脚本管理器 — 下载/缓存/校验/加载/三级回退
 *
 * 三级回退:
 *   1. userData/rpa-scripts/  (GitHub 下载，最新)
 *   2. resources/rpa-scripts/  (ASAR 内置，出厂版本)
 *   3. adapters/ 旧类          (迁移保底)
 */
import { app } from 'electron';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { pathToFileURL } from 'url';

// ==========================================
// 平台名 → 文件名映射
// ==========================================
const PLATFORM_KEY = {
  '小红书': 'xiaohongshu',
  '抖音': 'douyin',
  '快手': 'kuaishou',
  'B站': 'bilibili',
  '百家号': 'baijiahao',
  '微信视频号': 'wechat-channels'
};

const MANIFEST_URL = 'https://raw.githubusercontent.com/lilin893481171-gif/svip-matrix/main/rpa-scripts/manifest.json';

// ==========================================
// ScriptManager 单例
// ==========================================
export class ScriptManager {
  /** @type {Map<string, { version: number, filePath: string, module: object }>} */
  static #registry = new Map();

  static #initialized = false;

  // ---- 路径解析 ----

  /** ASAR 内置脚本目录 */
  static get #bundledDir() {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'rpa-scripts');
    }
    return join(app.getAppPath(), 'resources', 'rpa-scripts');
  }

  /** 用户缓存目录 */
  static get #cacheDir() {
    return join(app.getPath('userData'), 'rpa-scripts');
  }

  static #fileKey(platform) {
    const k = PLATFORM_KEY[platform];
    if (!k) throw new Error('未知的发布平台：' + platform);
    return k;
  }

  // ---- 初始化 ----

  /** 确保缓存目录存在 + 后台检查更新（非阻塞） */
  static init() {
    if (this.#initialized) return;
    this.#initialized = true;

    try { mkdirSync(this.#cacheDir, { recursive: true }); } catch (e) {}

    // 后台非阻塞检查更新
    this.#checkForUpdates().catch(e => {
      console.warn('[ScriptManager] 后台更新检查失败:', e.message);
    });
  }

  // ---- 公共入口 ----

  /**
   * TaskExecutor 唯一入口: 加载脚本 + 执行
   * @param {string} platform - 中文平台名
   * @param {object} api - { interactions, task, wc, broadcast, sleep }
   */
  static async executePlatform(platform, api) {
    // 确保已初始化（首次调用兜底）
    if (!this.#initialized) this.init();

    const mod = await this.#loadScript(platform);
    await mod.execute(api);
  }

  // ---- 脚本加载（三级回退） ----

  /** @returns {Promise<{ execute: Function, meta: object }>} */
  static async #loadScript(platform) {
    const key = this.#fileKey(platform);

    // Tier 1: 用户缓存（GitHub 下载的最新版）
    const cached = this.#registry.get(platform);
    if (cached?.module) return cached.module;

    const cachePath = join(this.#cacheDir, `${key}.mjs`);
    if (existsSync(cachePath)) {
      try {
        const mod = await import(pathToFileURL(cachePath).href);
        this.#registry.set(platform, { version: mod.meta?.version || 0, filePath: cachePath, module: mod });
        console.log(`[ScriptManager] ${platform} → 缓存脚本 v${mod.meta?.version || '?'}`);
        return mod;
      } catch (e) {
        console.warn(`[ScriptManager] 缓存脚本损坏 (${platform}), 回退内置...`, e.message);
      }
    }

    // Tier 2: ASAR 内置
    const bundledPath = join(this.#bundledDir, `${key}.mjs`);
    if (existsSync(bundledPath)) {
      try {
        const mod = await import(pathToFileURL(bundledPath).href);
        this.#registry.set(platform, { version: mod.meta?.version || 0, filePath: bundledPath, module: mod });
        console.log(`[ScriptManager] ${platform} → 内置脚本 v${mod.meta?.version || '?'}`);
        return mod;
      } catch (e) {
        console.warn(`[ScriptManager] 内置脚本失败 (${platform}), 回退旧适配器...`, e.message);
      }
    }

    // Tier 3: 旧适配器类（迁移保底）
    console.warn(`[ScriptManager] ${platform} → 旧适配器（保底）`);
    return this.#loadLegacyAdapter(platform);
  }

  /** 动态加载旧适配器类并包装为脚本接口 */
  static async #loadLegacyAdapter(platform) {
    const { KuaishouAdapter, BaijiahaoAdapter, BilibiliAdapter, DouyinAdapter, WechatChannelsAdapter, XiaohongshuAdapter } = await import('./adapters/index.js');

    const AdapterMap = {
      '抖音': DouyinAdapter,
      '微信视频号': WechatChannelsAdapter, 'B站': BilibiliAdapter,
      '快手': KuaishouAdapter, '百家号': BaijiahaoAdapter,
      '小红书': XiaohongshuAdapter
    };

    const Adapter = AdapterMap[platform];
    return {
      meta: { platform, version: 0, legacy: true },
      execute: async (api) => {
        const { interactions, task, wc, broadcast } = api;
        const adapter = new Adapter(interactions, task, wc, broadcast);
        await adapter.execute();
      }
    };
  }

  // ---- 更新检查 ----

  /** 后台拉取 manifest → diff 版本 → 下载新脚本 → SHA256 校验 */
  static async #checkForUpdates() {
    let remoteManifest;
    try {
      const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      remoteManifest = await res.json();
    } catch (e) {
      console.warn('[ScriptManager] 无法拉取 manifest:', e.message);
      return;
    }

    const remoteScripts = remoteManifest?.scripts;
    if (!remoteScripts) return;

    // 读本地 manifest
    let localManifest = {};
    const localManifestPath = join(this.#cacheDir, 'manifest.json');
    try {
      if (existsSync(localManifestPath)) {
        localManifest = JSON.parse(readFileSync(localManifestPath, 'utf-8'));
      }
    } catch (e) {}

    const localScripts = localManifest.scripts || {};

    for (const [platform, info] of Object.entries(remoteScripts)) {
      const key = PLATFORM_KEY[platform];
      if (!key) continue;

      const localVersion = localScripts[platform]?.version || 0;
      if (info.version <= localVersion) continue; // 无需更新

      console.log(`[ScriptManager] 发现新版本: ${platform} v${localVersion} → v${info.version}`);

      try {
        const url = info.url || `https://raw.githubusercontent.com/lilin893481171-git/svip-matrix/main/rpa-scripts/${key}.mjs`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const code = await res.text();

        // SHA256 校验
        const actualHash = createHash('sha256').update(code, 'utf-8').digest('hex');
        if (info.sha256 && actualHash !== info.sha256) {
          throw new Error(`SHA256 不匹配! 期望 ${info.sha256.slice(0, 12)}... 实际 ${actualHash.slice(0, 12)}...`);
        }

        // 写入缓存
        const destPath = join(this.#cacheDir, `${key}.mjs`);
        writeFileSync(destPath, code, 'utf-8');
        console.log(`[ScriptManager] ✅ ${platform} v${info.version} 下载完成`);

        // 更新本地 manifest
        localScripts[platform] = { version: info.version, sha256: info.sha256 };
      } catch (e) {
        console.warn(`[ScriptManager] ❌ ${platform} 下载失败:`, e.message);
      }
    }

    // 写回本地 manifest
    try {
      writeFileSync(localManifestPath, JSON.stringify({ scripts: localScripts }, null, 2), 'utf-8');
    } catch (e) {}

    // 清除已缓存的旧模块引用，下次加载时走新文件
    this.#registry.clear();
  }
}
