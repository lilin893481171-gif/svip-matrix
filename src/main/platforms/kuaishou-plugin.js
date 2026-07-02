/**
 * 快手平台插件
 * @extends PlatformInterface
 */
const PlatformInterface = require('../PlatformInterface')
const path = require('path')

class KuaishouPlugin extends PlatformInterface {
  constructor(config = {}) {
    super(config)
  }

  getPlatformId() {
    return 'kuaishou'
  }

  getDisplayName() {
    return '快手'
  }

  async checkLoginStatus(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://cp.kuaishou.com', { timeout: 30000 })

      const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('.user-info') !== null
      })

      return isLoggedIn
    } catch (error) {
      console.error('[KuaishouPlugin] 检测登录状态失败:', error)
      return false
    }
  }

  async publish(browserController, content, options = {}) {
    try {
      const page = await browserController.getActivePage()

      await page.goto('https://cp.kuaishou.com/article/publish/video', {
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

      await page.waitForSelector('.submit-btn', { timeout: 5000 })
      await page.click('.submit-btn')

      return { success: true, message: '发布成功' }
    } catch (error) {
      console.error('[KuaishouPlugin] 发布失败:', error)
      return { success: false, error: error.message }
    }
  }

  async getAccountInfo(browserController) {
    try {
      const page = await browserController.getActivePage()
      await page.goto('https://cp.kuaishou.com/profile', { timeout: 30000 })

      const info = await page.evaluate(() => {
        return {
          username: document.querySelector('.username')?.textContent?.trim() || '',
          followers: document.querySelector('.fans-count')?.textContent?.trim() || '0'
        }
      })

      return info
    } catch (error) {
      console.error('[KuaishouPlugin] 获取账号信息失败:', error)
      return null
    }
  }

  getRPAScriptPath() {
    return path.join(__dirname, '../../../resources/rpa-scripts/kuaishou.mjs')
  }

  getCookieDomains() {
    return ['.kuaishou.com', 'kuaishou.com']
  }
}

export default KuaishouPlugin
