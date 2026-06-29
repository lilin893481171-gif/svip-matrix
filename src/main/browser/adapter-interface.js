/**
 * @file adapter-interface.js
 * 统一适配器接口定义
 */

/**
 * 平台适配器接口
 * @interface Adapter
 */
export class Adapter {
  /**
   * 初始化适配器
   * @param {Object} browser - 浏览器实例（Puppeteer browser 或 Electron webContents）
   * @param {Object} page - 页面实例（Puppeteer page 或 Electron webContents）
   * @param {Object} config - 配置信息
   * @returns {Promise<void>}
   */
  async init(browser, page, config) {
    throw new Error('init method must be implemented');
  }

  /**
   * 导航到发布页面
   * @returns {Promise<void>}
   */
  async navigateToPublish() {
    throw new Error('navigateToPublish method must be implemented');
  }

  /**
   * 上传视频并捕获ID
   * @param {string} videoPath - 视频文件路径
   * @returns {Promise<{ video_file_id: string }>}
   */
  async uploadAndCaptureId(videoPath) {
    throw new Error('uploadAndCaptureId method must be implemented');
  }

  /**
   * 填写发布表单
   * @param {Object} task - 发布任务数据
   * @returns {Promise<void>}
   */
  async fillForm(task) {
    throw new Error('fillForm method must be implemented');
  }

  /**
   * 发布内容
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async publish() {
    throw new Error('publish method must be implemented');
  }

  /**
   * 清理资源
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('cleanup method must be implemented');
  }
}

export default Adapter;