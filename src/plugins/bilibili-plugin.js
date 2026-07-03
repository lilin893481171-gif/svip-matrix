/**
 * B站平台插件
 * @extends PlatformInterface
 */
const PlatformInterface = require('../PlatformInterface')
const path = require('path')

class BilibiliPlugin extends PlatformInterface {
  constructor(config = {}) {
    super(config)
    this.adapter = null
  }

  getPlatformId() {
    return 'bilibili'
  }

  getDisplayName() {
    return 'B站'
  }

  getIcon() {
    return path.join(__dirname, 'assets/bilibili-icon.png')
  }

  async initialize(context) {
    console.log('[BilibiliPlugin] 初始化...')
  }

  async checkLoginStatus(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://member.bilibili.com', { timeout: 30000 })

      // 检测登录状态
      const isLoggedIn = await page.evaluate(() => {
        return !document.querySelector('.login-btn') &&
               document.querySelector('.user-info') !== null
      })

      return isLoggedIn
    } catch (error) {
      console.error('[BilibiliPlugin] 检测登录状态失败:', error)
      return false
    }
  }

  async publish(browserController, content, options = {}) {
    try {
      const page = await browserController.getActivePage()

      // 导航到发布页
      await page.goto('https://member.bilibili.com/platform/upload/video/frame', {
        waitUntil: 'networkidle0',
        timeout: 30000
      })

      // 上传视频
      if (content.videoPath) {
        const fileInput = await page.$('input[type="file"]')
        await fileInput.uploadFile(content.videoPath)
        console.log('[BilibiliPlugin] 视频上传中...')
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

      // B站特有：选择分区
      if (content.category) {
        // TODO: 实现分区选择
      }

      // 点击发布
      await page.waitForSelector('button[type="submit"]', { timeout: 5000 })
      await page.click('button[type="submit"]')

      // 等待成功标志
      await page.waitForSelector('.publish-success', { timeout: 30000 })

      return { success: true, message: '发布成功' }
    } catch (error) {
      console.error('[BilibiliPlugin] 发布失败:', error)
      return { success: false, error: error.message }
    }
  }

  async getAccountInfo(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://space.bilibili.com', { timeout: 30000 })

      const info = await page.evaluate(() => {
        return {
          username: document.querySelector('.username')?.textContent?.trim() || '',
          avatar: document.querySelector('.avatar img')?.src || '',
          followers: document.querySelector('.fans-count')?.textContent?.trim() || '0'
        }
      })

      return info
    } catch (error) {
      console.error('[BilibiliPlugin] 获取账号信息失败:', error)
      return null
    }
  }

  getRPAScriptPath() {
    return path.join(__dirname, '../../../resources/rpa-scripts/bilibili.mjs')
  }

  getCookieDomains() {
    return ['.bilibili.com', 'bilibili.com']
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
        category: {
          type: 'string',
          title: '默认分区',
          enum: ['知识区', '科技区', '生活区', '娱乐区', '游戏区'],
          default: '知识区'
        }
      }
    }
  }

  async cleanup() {
    console.log('[BilibiliPlugin] 清理资源...')
    if (this.adapter) {
      await this.adapter.cleanup()
    }
  }
}

export default BilibiliPlugin
