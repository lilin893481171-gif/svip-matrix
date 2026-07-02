/**
 * 微信视频号平台插件
 * @extends PlatformInterface
 */
const PlatformInterface = require('../PlatformInterface')
const path = require('path')

class WechatChannelsPlugin extends PlatformInterface {
  constructor(config = {}) {
    super(config)
  }

  getPlatformId() {
    return 'wechat-channels'
  }

  getDisplayName() {
    return '微信视频号'
  }

  async checkLoginStatus(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://channels.weixin.qq.com', { timeout: 30000 })

      const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('.user-avatar') !== null
      })

      return isLoggedIn
    } catch (error) {
      console.error('[WechatChannelsPlugin] 检测登录状态失败:', error)
      return false
    }
  }

  async publish(browserController, content, options = {}) {
    try {
      const page = await browserController.getActivePage()

      await page.goto('https://channels.weixin.qq.com/account/manage/video', {
        waitUntil: 'networkidle0',
        timeout: 30000
      })

      if (content.videoPath) {
        const fileInput = await page.$('input[type="file"]')
        await fileInput.uploadFile(content.videoPath)
      }

      if (content.title) {
        await page.waitForSelector('.title-input', { timeout: 5000 })
        await page.type('.title-input', content.title, { delay: 100 })
      }

      await page.waitForSelector('.publish-btn', { timeout: 5000 })
      await page.click('.publish-btn')

      return { success: true, message: '发布成功' }
    } catch (error) {
      console.error('[WechatChannelsPlugin] 发布失败:', error)
      return { success: false, error: error.message }
    }
  }

  async getAccountInfo(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://channels.weixin.qq.com/account/manage', { timeout: 30000 })

      const info = await page.evaluate(() => {
        return {
          username: document.querySelector('.nickname')?.textContent?.trim() || '',
          followers: document.querySelector('.followers-count')?.textContent?.trim() || '0'
        }
      })

      return info
    } catch (error) {
      console.error('[WechatChannelsPlugin] 获取账号信息失败:', error)
      return null
    }
  }

  getRPAScriptPath() {
    return path.join(__dirname, '../../../resources/rpa-scripts/wechat-channels.mjs')
  }

  getCookieDomains() {
    return ['.weixin.qq.com', 'channels.weixin.qq.com']
  }
}

export default WechatChannelsPlugin
