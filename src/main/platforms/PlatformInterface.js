/**
 * 平台插件基类
 * 所有平台适配器必须继承此类并实现必需方法
 */
class PlatformInterface {
  constructor(config = {}) {
    this.name = config.name || this.constructor.name
    this.version = config.version || '1.0.0'
    this.enabled = config.enabled !== false
  }

  /**
   * 平台唯一标识符
   * @returns {string} 如 'xiaohongshu', 'bilibili'
   */
  getPlatformId() {
    throw new Error('PlatformInterface.getPlatformId() must be implemented')
  }

  /**
   * 平台显示名称
   * @returns {string} 如 '小红书', 'B站'
   */
  getDisplayName() {
    throw new Error('PlatformInterface.getDisplayName() must be implemented')
  }

  /**
   * 获取平台图标（可选）
   * @returns {string} 图标路径或URL
   */
  getIcon() {
    return null
  }

  /**
   * 检测当前浏览器是否已登录此平台
   * @param {BrowserController} browserController
   * @returns {Promise<boolean>}
   */
  async checkLoginStatus(browserController) {
    throw new Error('PlatformInterface.checkLoginStatus() must be implemented')
  }

  /**
   * 执行发布任务
   * @param {BrowserController} browserController
   * @param {Object} content - 发布内容
   * @param {Object} options - 发布选项
   * @returns {Promise<Object>} 发布结果
   */
  async publish(browserController, content, options = {}) {
    throw new Error('PlatformInterface.publish() must be implemented')
  }

  /**
   * 获取账号信息
   * @param {BrowserController} browserController
   * @returns {Promise<Object>} 账号信息
   */
  async getAccountInfo(browserController) {
    throw new Error('PlatformInterface.getAccountInfo() must be implemented')
  }

  /**
   * 同步数据（可选）
   * @param {Object} params - 同步参数
   * @returns {Promise<Object>} 同步结果
   */
  async syncData(params) {
    return { success: true, message: 'Not implemented' }
  }

  /**
   * 获取平台配置模式（用于UI动态生成配置表单）
   * @returns {Object} JSON Schema
   */
  getConfigSchema() {
    return {
      type: 'object',
      properties: {}
    }
  }

  /**
   * 验证配置
   * @param {Object} config
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateConfig(config) {
    return { valid: true, errors: [] }
  }

  /**
   * 平台初始化（可选）
   * @param {Object} context - 应用上下文
   */
  async initialize(context) {
    // 子类可选实现
  }

  /**
   * 平台清理（可选）
   */
  async cleanup() {
    // 子类可选实现
  }

  /**
   * 获取RPA脚本路径（如果使用脚本）
   * @returns {string|null}
   */
  getRPAScriptPath() {
    return null
  }

  /**
   * 获取平台特定的浏览器参数
   * @returns {Object}
   */
  getBrowserArgs() {
    return {}
  }

  /**
   * 获取平台特定的Cookie域名
   * @returns {string[]}
   */
  getCookieDomains() {
    return []
  }
}

export default PlatformInterface
