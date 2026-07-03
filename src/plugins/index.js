/**
 * 平台注册引导
 * 在应用启动时注册所有平台插件
 */
const PlatformRegistry = require('../PlatformRegistry')

// 导入平台插件
const XiaohongshuPlugin = require('./xiaohongshu-plugin')
const BilibiliPlugin = require('./bilibili-plugin')
const DouyinPlugin = require('./douyin-plugin')
const KuaishouPlugin = require('./kuaishou-plugin')
const BaijiahaoPlugin = require('./baijiahao-plugin')
const WechatChannelsPlugin = require('./wechat-channels-plugin')

/**
 * 注册所有平台插件
 * @param {Object} context - 应用上下文
 */
function registerPlatforms(context = {}) {
  console.log('🚀 开始注册平台插件...')

  // 注册平台
  PlatformRegistry.register(new XiaohongshuPlugin({
    enabled: true,
    version: '1.0.0'
  }))

  PlatformRegistry.register(new BilibiliPlugin({
    enabled: true,
    version: '1.0.0'
  }))

  PlatformRegistry.register(new DouyinPlugin({
    enabled: true,
    version: '1.0.0'
  }))

  PlatformRegistry.register(new KuaishouPlugin({
    enabled: true,
    version: '1.0.0'
  }))

  PlatformRegistry.register(new BaijiahaoPlugin({
    enabled: true,
    version: '1.0.0'
  }))

  PlatformRegistry.register(new WechatChannelsPlugin({
    enabled: true,
    version: '1.0.0'
  }))

  console.log(`✅ 平台注册完成，共 ${PlatformRegistry.getAll().length} 个平台`)
}

/**
 * 初始化所有平台
 */
async function initializePlatforms(context) {
  await PlatformRegistry.initializeAll(context)
}

/**
 * 获取平台清单（用于UI）
 */
function getPlatformManifest() {
  return PlatformRegistry.exportManifest()
}

export {
  registerPlatforms,
  initializePlatforms,
  getPlatformManifest,
  PlatformRegistry
}
