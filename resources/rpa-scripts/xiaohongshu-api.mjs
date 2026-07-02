/**
 * @file xiaohongshu-api.mjs
 * 小红书发布脚本 v17 - 纯 API 模式（不依赖 DOM 操作）
 *
 * 架构：
 *   1. 读取本地 Cookie/Token（从浏览器会话）
 *   2. Node.js 直接调用小红书上传 API
 *   3. formData 上传视频文件
 *   4. 获取 video_file_id
 *   5. 调用发布 API
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  platform: '小红书',
  version: 17,
  minAppVersion: '3.0.0'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * ============================================================
 * 1. Cookie 解析器 - 从浏览器 Cookie 字符串提取关键令牌
 * ============================================================
 */
function parseCookies(cookieStr) {
  const cookies = {};
  if (!cookieStr) return cookies;

  cookieStr.split(';').forEach(pair => {
    const [key, value] = pair.trim().split('=');
    if (key && value) {
      cookies[key.trim()] = decodeURIComponent(value.trim());
    }
  });

  return cookies;
}

/**
 * 提取关键令牌
 */
function extractTokens(cookies) {
  // 小红书关键 Cookie
  const keyCookies = ['lгин', 'xids', 'web_session', 'csg', 'deviceid', 'ttcid'];

  // 尝试从各种可能的 Cookie 名称中提取
  const possibleNames = {
    lгин: ['lгин', 'lgin', 'lg', 'lgin'],
    xids: ['xids', 'XIDS', 'xid'],
    web_session: ['web_session', 'webSession', 'SESSION'],
    csg: ['csg', 'CSG', 'cso'],
    deviceid: ['deviceid', 'deviceId', 'device_id'],
    ttcid: ['ttcid', 'TTcid', 'tt_cid']
  };

  const result = {};

  for (const [targetKey, variants] of Object.entries(possibleNames)) {
    for (const variant of variants) {
      if (cookies[variant]) {
        result[targetKey] = cookies[variant];
        break;
      }
    }
  }

  return result;
}

/**
 * ============================================================
 * 2. 视频上传管理器 - 使用 Node.js formData 上传
 * ============================================================
 */
class VideoUploader {
  constructor(cookies, tokens) {
    this.cookies = cookies;
    this.tokens = tokens;
    this.cookieHeader = this._buildCookieHeader();
  }

  _buildCookieHeader() {
    const parts = [];
    for (const [key, value] of Object.entries(this.cookies)) {
      parts.push(`${key}=${value}`);
    }
    return parts.join('; ');
  }

  async uploadVideo(videoPath) {
    console.log(`[Uploader] 开始上传视频: ${videoPath}`);

    if (!fs.existsSync(videoPath)) {
      throw new Error(`视频文件不存在: ${videoPath}`);
    }

    const stats = fs.statSync(videoPath);
    const fileSize = stats.size;
    const fileName = path.basename(videoPath);

    console.log(`[Uploader] 文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

    // 小红书上传 API（需要根据实际抓包结果调整）
    // 常见的上传端点：
    // - https://upload.xiaohongshu.com/api/v1/video/upload
    // - https://creator.xiaohongshu.com/api/v1/video/upload

    const apiUrl = 'https://creator.xiaohongshu.com/api/v1/video/upload';

    // 构建 formData
    const formData = {
      file: {
        value: fs.createReadStream(videoPath),
        options: {
          filename: fileName,
          contentType: 'video/mp4'
        }
      },
      // 可能需要的字段
      device_id: this.tokens.deviceid,
      ttcid: this.tokens.ttcid,
      // 添加必要的请求头
    };

    try {
      // 使用 Node.js fetch (Node 18+) 或 node-fetch
      const fetch = globalThis.fetch || (await import('node-fetch')).default;

      // 构建 multipart/form-data
      const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
      const chunks = [];

      for (const [key, value] of Object.entries(formData)) {
        if (key === 'file') {
          chunks.push(
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="${key}"; filename="${value.options.filename}"\r\n`,
            `Content-Type: ${value.options.contentType}\r\n`,
            '\r\n'
          );
          // 文件内容通过流处理
        } else {
          chunks.push(
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="${key}"\r\n`,
            '\r\n',
            `${value}\r\n`
          );
        }
      }
      chunks.push(`--${boundary}--\r\n`);

      const headers = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': this.cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://creator.xiaohongshu.com',
        'Referer': 'https://creator.xiaohongshu.com/publish/publish',
      };

      console.log(`[Uploader] 正在调用上传 API...`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        // 注意：formData 需要特殊处理，这里简化处理
        body: Buffer.from(chunks.join(''))
      });

      const result = await response.json();

      console.log(`[Uploader] 上传响应:`, JSON.stringify(result, null, 2));

      if (response.ok && result.code === 200) {
        return {
          success: true,
          video_file_id: result.data?.video_id || result.data?.file_id || result.data?.video_file_id,
          url: result.data?.url
        };
      }

      throw new Error(result.msg || `上传失败: ${response.status}`);

    } catch (error) {
      console.error('[Uploader] 上传异常:', error.message);

      // 降级：尝试使用旧的 XHR 协议
      console.log('[Uploader] 降级尝试：使用旧版协议...');

      return await this._fallbackUpload(videoPath, fileName);
    }
  }

  /**
   * 降级方案：使用旧版 XHR 协议
   */
  async _fallbackUpload(videoPath, fileName) {
    console.log(`[Uploader] 启动降级上传流程...`);

    // 旧版上传 API
    const fallbackUrl = 'https:// upload.xiaohongshu.com/spectrum/upload';

    // 从 localStorage 读取可能的上传凭证
    const uploadState = this._getUploadStateFromLocalStorage();

    if (uploadState && uploadState.video_file_id) {
      console.log(`[Uploader] 从 localStorage 恢复 video_file_id: ${uploadState.video_file_id}`);
      return {
        success: true,
        video_file_id: uploadState.video_file_id
      };
    }

    throw new Error('所有上传方案均失败');
  }

  /**
   * 从 localStorage 读取上传状态
   */
  _getUploadStateFromLocalStorage() {
    try {
      // 这里应该从实际的浏览器会话中读取
      // 但由于我们是纯 API 模式，需要从传入的 cookies 中推断
      return null;
    } catch (e) {
      return null;
    }
  }
}

/**
 * ============================================================
 * 3. 发布管理器 - 调用发布 API
 * ============================================================
 */
class Publisher {
  constructor(cookies, tokens) {
    this.cookies = cookies;
    this.tokens = tokens;
    this.cookieHeader = this._buildCookieHeader();
  }

  _buildCookieHeader() {
    const parts = [];
    for (const [key, value] of Object.entries(this.cookies)) {
      parts.push(`${key}=${value}`);
    }
    return parts.join('; ');
  }

  async publish(task, videoInfo) {
    console.log(`[Publisher] 开始发布笔记...`);

    const apiUrl = 'https://edith.xiaohongshu.com/web_api/sns/v2/note';

    // 构建请求体
    const payload = this._buildPayload(task, videoInfo);

    try {
      const fetch = globalThis.fetch || (await import('node-fetch')).default;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://creator.xiaohongshu.com',
          'Referer': 'https://creator.xiaohongshu.com/publish/publish',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      console.log(`[Publisher] 发布响应:`, JSON.stringify(result, null, 2));

      if (response.ok && result.code === 200) {
        return {
          success: true,
          note_id: result.data?.note_id,
          url: result.data?.url
        };
      }

      throw new Error(result.msg || `发布失败: ${response.status}`);

    } catch (error) {
      console.error('[Publisher] 发布异常:', error.message);
      throw error;
    }
  }

  _buildPayload(task, videoInfo) {
    const videoFileId = String(videoInfo.video_file_id || '');

    // 时间处理
    const binds = {};
    if (task.scheduleTime) {
      const dtimeTs = Math.floor(new Date(task.scheduleTime).getTime() / 1000);
      if (dtimeTs > 0) {
        binds.notePostTiming = { postTime: dtimeTs * 1000 };
      }
    }

    if (Number(task.copyright) === 1) {
      binds.optionRelationList = [{ type: 'original_declaration', value: 1 }];
    }

    // 标签处理
    const transformTags = (text) => {
      return (text || '').replace(/#([^\s#，。！？\.\?!]+)/g, (full, tag) => {
        if (tag.endsWith('[话题]')) return full;
        return '#' + tag + '[话题]#';
      });
    };

    const desc = transformTags(task.desc);
    const tagText = task.tags
      ? String(task.tags).split(/[\s,，]+/).filter(Boolean)
          .map(t => '#' + t.replace(/^#/, '') + '[话题]#').join(' ')
      : '';

    const fullDesc = [desc, tagText].filter(Boolean).join('\n');

    return {
      common: {
        type: 'video',
        note_id: '',
        title: String(task.title || ''),
        desc: fullDesc,
        hash_tag: [],
        capa_trace_info: {},
        business_binds: JSON.stringify(binds),
      },
      video_info: {
        fileid: videoFileId,
        file_id: videoFileId,
        cover: { fileid: '', file_id: '' },
        composite_metadata: { format: 'mp4', width: 1080, height: 1920 }
      }
    };
  }
}

/**
 * ============================================================
 * 4. 主执行函数
 * ============================================================
 */
export async function execute(api) {
  const { task, broadcast, sleep: apiSleep, getCookieString } = api;

  broadcast('🚀 小红书 v17 (纯 API 发布版启动)...');

  // 步骤 1: 读取 Cookie
  broadcast('📥 正在读取浏览器会话 Cookie...');

  // 从 api 中获取 Cookie（需要从 BrowserView 会话中读取）
  const cookieStr = await getCookieString();

  if (!cookieStr) {
    throw new Error('无法获取 Cookie，请确保已登录');
  }

  const cookies = parseCookies(cookieStr);
  const tokens = extractTokens(cookies);

  console.log(`[v17] 提取到的令牌:`, Object.keys(tokens));
  broadcast(`✅ Cookie 解析完成，共 ${Object.keys(cookies).length} 个 Cookie`);

  // 步骤 2: 上传视频
  broadcast('📤 正在上传视频...');
  const uploader = new VideoUploader(cookies, tokens);
  const videoInfo = await uploader.uploadVideo(task.videoPath);

  if (!videoInfo.success || !videoInfo.video_file_id) {
    throw new Error('视频上传失败');
  }

  broadcast(`✅ 视频上传成功，video_file_id: ${videoInfo.video_file_id.substring(0, 16)}...`);

  // 步骤 3: 发布笔记
  broadcast('🔥 正在发布笔记...');
  const publisher = new Publisher(cookies, tokens);
  const publishResult = await publisher.publish(task, videoInfo);

  if (!publishResult.success) {
    throw new Error('笔记发布失败');
  }

  broadcast(`✅ 发布成功！note_id: ${publishResult.note_id}`);

  return {
    success: true,
    note_id: publishResult.note_id,
    url: publishResult.url
  };
}
