/**
 * @file wechat-channels-adapter.js
 * 微信视频号适配器 (v30 重写) - 实现统一适配器接口
 */

import { Adapter } from '../../browser/adapter-interface.js';

export class WechatChannelsAdapter extends Adapter {
  constructor() {
    super();
    this.browser = null;
    this.page = null;
    this.config = null;
    this.isConnected = false;
  }

  /**
   * 初始化适配器
   * @param {Object} browser - Puppeteer browser 实例
   * @param {Object} page - Puppeteer page 实例
   * @param {Object} config - 配置信息
   * @returns {Promise<void>}
   */
  async init(browser, page, config) {
    this.browser = browser;
    this.page = page;
    this.config = config;
    this.isConnected = true;

    console.log('[WechatChannelsAdapter] 适配器初始化完成');
  }

  /**
   * 导航到发布页面
   * @returns {Promise<void>}
   */
  async navigateToPublish() {
    if (!this.isConnected) {
      throw new Error('适配器未初始化');
    }

    console.log('[WechatChannelsAdapter] 导航到微信视频号发布页面...');
    await this.page.goto('https://channels.weixin.qq.com/platform/post/create', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 等待页面加载完成
    await this.page.waitForSelector('input[type="file"]', { timeout: 10000 });
    console.log('[WechatChannelsAdapter] 已到达发布页面');
  }

  /**
   * 上传视频并捕获ID
   * @param {string} videoPath - 视频文件路径
   * @returns {Promise<{ video_file_id: string }>}
   */
  async uploadAndCaptureId(videoPath) {
    if (!this.isConnected) {
      throw new Error('适配器未初始化');
    }

    console.log(`[WechatChannelsAdapter] 开始上传视频: ${videoPath}`);

    // 创建 Promise 来捕获视频上传响应
    const videoIdPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('视频上传超时'));
      }, 180000); // 3分钟超时

      // 监听响应事件
      this.page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/cgi-bin/mmfinderassistant-bin/post/post_upload')) {
          try {
            const data = await response.json();
            if (data && data.data && data.data.objectId) {
              clearTimeout(timeout);
              resolve({ video_file_id: data.data.objectId });
            }
          } catch (e) {
            // 解析 JSON 失败，继续等待
          }
        }
      });
    });

    // 执行上传操作
    const fileInput = await this.page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('未找到文件上传输入框');
    }

    await fileInput.uploadFile(videoPath);
    console.log('[WechatChannelsAdapter] 视频文件已选择，等待上传完成...');

    // 等待并返回视频ID
    const result = await videoIdPromise;
    console.log(`[WechatChannelsAdapter] 视频上传完成，获得 video_file_id: ${result.video_file_id}`);
    return result;
  }

  /**
   * 填写发布表单
   * @param {Object} task - 发布任务数据
   * @returns {Promise<void>}
   */
  async fillForm(task) {
    if (!this.isConnected) {
      throw new Error('适配器未初始化');
    }

    console.log('[WechatChannelsAdapter] 开始填写发布表单...');

    // 填写标题
    if (task.title) {
      await this.page.waitForSelector('#title-input', { timeout: 5000 });
      await this.page.type('#title-input', task.title, { delay: 100 });
      console.log('[WechatChannelsAdapter] 标题填写完成');
    }

    // 填写正文
    if (task.description) {
      await this.page.waitForSelector('#description-textarea', { timeout: 5000 });
      await this.page.type('#description-textarea', task.description, { delay: 100 });
      console.log('[WechatChannelsAdapter] 正文填写完成');
    }

    // 处理标签/话题（后续迭代）
    if (task.tags && Array.isArray(task.tags)) {
      // 暂时跳过标签处理
      console.log('[WechatChannelsAdapter] 标签处理（待实现）');
    }

    // 处理定时发布（后续迭代）
    if (task.scheduleTime) {
      // 暂时跳过定时发布处理
      console.log('[WechatChannelsAdapter] 定时发布处理（待实现）');
    }

    console.log('[WechatChannelsAdapter] 表单填写完成');
  }

  /**
   * 发布内容
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async publish() {
    if (!this.isConnected) {
      throw new Error('适配器未初始化');
    }

    console.log('[WechatChannelsAdapter] 开始发布内容...');

    try {
      // 点击发布按钮
      await this.page.waitForSelector('button[type="submit"]', { timeout: 5000 });
      await this.page.click('button[type="submit"]');

      // 等待发布成功标志
      await this.page.waitForSelector('.publish-success', { timeout: 30000 });

      console.log('[WechatChannelsAdapter] 内容发布成功');
      return { success: true };
    } catch (error) {
      console.error('[WechatChannelsAdapter] 发布失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清理资源
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log('[WechatChannelsAdapter] 清理适配器资源...');
    this.browser = null;
    this.page = null;
    this.config = null;
    this.isConnected = false;
    console.log('[WechatChannelsAdapter] 适配器资源清理完成');
  }
}

export default WechatChannelsAdapter;