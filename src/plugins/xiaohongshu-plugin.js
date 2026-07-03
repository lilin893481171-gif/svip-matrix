/**
 * 小红书平台插件
 * @extends PlatformInterface
 */
const PlatformInterface = require('../PlatformInterface')
const path = require('path')

class XiaohongshuPlugin extends PlatformInterface {
  constructor(config = {}) {
    super(config)
    this.adapter = null
  }

  getPlatformId() {
    return 'xiaohongshu'
  }

  getDisplayName() {
    return '小红书'
  }

  getIcon() {
    return path.join(__dirname, 'assets/icon.png')
  }

  async initialize(context) {
    console.log('[XiaohongshuPlugin] 初始化...')
    // 可选：加载适配器
    // const XiaohongshuAdapter = require('./adapter')
    // this.adapter = new XiaohongshuAdapter()
  }

  async checkLoginStatus(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://creator.xiaohongshu.com', { timeout: 30000 })

      // 检测是否跳转到登录页
      const currentUrl = page.url()
      if (currentUrl.includes('login')) {
        return false
      }

      // 检测关键元素
      const hasAvatar = await page.evaluate(() => {
        return document.querySelector('.avatar, .user-avatar') !== null
      })

      return hasAvatar
    } catch (error) {
      console.error('[XiaohongshuPlugin] 检测登录状态失败:', error)
      return false
    }
  }

  async publish(browserController, content, options = {}) {
    try {
      const page = await browserController.getActivePage()

      // 导航到发布页
      await page.goto('https://creator.xiaohongshu.com/publish/publish', {
        waitUntil: 'networkidle0',
        timeout: 30000
      })

      // 上传视频
      if (content.videoPath) {
        const fileInput = await page.$('input[type="file"]')
        await fileInput.uploadFile(content.videoPath)
        console.log('[XiaohongshuPlugin] 视频上传中...')
      }

      // 填写标题
      if (content.title) {
        await page.waitForSelector('#title-input', { timeout: 5000 })
        await page.type('#title-input', content.title, { delay: 100 })
      }

      // 填写描述
      if (content.description) {
        await page.waitForSelector('#description-textarea', { timeout: 5000 })
        await page.type('#description-textarea', content.description, { delay: 100 })
      }

      // 点击发布
      await page.waitForSelector('button[type="submit"]', { timeout: 5000 })
      await page.click('button[type="submit"]')

      // 等待成功标志
      await page.waitForSelector('.publish-success', { timeout: 30000 })

      return { success: true, message: '发布成功' }
    } catch (error) {
      console.error('[XiaohongshuPlugin] 发布失败:', error)
      return { success: false, error: error.message }
    }
  }

  async getAccountInfo(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://creator.xiaohongshu.com/user', { timeout: 30000 })

      const info = await page.evaluate(() => {
        return {
          username: document.querySelector('.username')?.textContent?.trim() || '',
          avatar: document.querySelector('.avatar img')?.src || '',
          followers: document.querySelector('.followers-count')?.textContent?.trim() || '0'
        }
      })

      return info
    } catch (error) {
      console.error('[XiaohongshuPlugin] 获取账号信息失败:', error)
      return null
    }
  }

  getRPAScriptPath() {
    return path.join(__dirname, '../../../resources/rpa-scripts/xiaohongshu.mjs')
  }

  getBrowserArgs() {
    return {
      // 小红书特殊参数
    }
  }

  getCookieDomains() {
    return ['.xiaohongshu.com', 'xiaohongshu.com']
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        autoPublish: {
          type: 'boolean',
          title: '自动发布',
          default: false
        },
        publishDelay: {
          type: 'number',
          title: '发布延迟（秒）',
          minimum: 0,
          maximum: 300,
          default: 0
        }
      }
    }
  }

  async cleanup() {
    console.log('[XiaohongshuPlugin] 清理资源...')
    if (this.adapter) {
      await this.adapter.cleanup()
    }
  }
}

export default XiaohongshuPlugin
