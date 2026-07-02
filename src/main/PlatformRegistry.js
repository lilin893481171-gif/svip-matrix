import path from 'path'
import fs from 'fs'

/**
 * 平台注册表
 * 管理所有平台插件的注册、发现和生命周期
 */
class PlatformRegistry {
  static platforms = new Map()
  static initialized = false

  /**
   * 注册平台插件
   * @param {PlatformInterface} platformInstance
   */
  static register(platformInstance) {
    if (!platformInstance || typeof platformInstance.getPlatformId !== 'function') {
      throw new Error('Invalid platform instance: must implement PlatformInterface')
    }

    const platformId = platformInstance.getPlatformId()

    if (this.platforms.has(platformId)) {
      console.warn(`Platform "${platformId}" already registered, overwriting...`)
    }

    this.platforms.set(platformId, platformInstance)
    console.log(`✅ Platform registered: ${platformId} (${platformInstance.getDisplayName()})`)
  }

  /**
   * 批量注册平台
   * @param {PlatformInterface[]} platforms
   */
  static registerAll(platforms) {
    platforms.forEach(p => this.register(p))
  }

  /**
   * 获取平台实例
   * @param {string} platformId
   * @returns {PlatformInterface|null}
   */
  static get(platformId) {
    return this.platforms.get(platformId) || null
  }

  /**
   * 检查平台是否存在
   * @param {string} platformId
   * @returns {boolean}
   */
  static has(platformId) {
    return this.platforms.has(platformId)
  }

  /**
   * 获取所有已注册平台
   * @returns {PlatformInterface[]}
   */
  static getAll() {
    return Array.from(this.platforms.values())
  }

  /**
   * 获取所有启用的平台
   * @returns {PlatformInterface[]}
   */
  static getEnabled() {
    return this.getAll().filter(p => p.enabled)
  }

  /**
   * 获取平台ID列表
   * @returns {string[]}
   */
  static getIds() {
    return Array.from(this.platforms.keys())
  }

  /**
   * 注销平台
   * @param {string} platformId
   */
  static unregister(platformId) {
    const platform = this.platforms.get(platformId)
    if (platform && typeof platform.cleanup === 'function') {
      platform.cleanup()
    }
    this.platforms.delete(platformId)
    console.log(`🗑️ Platform unregistered: ${platformId}`)
  }

  /**
   * 初始化所有平台
   * @param {Object} context - 应用上下文
   */
  static async initializeAll(context) {
    if (this.initialized) {
      console.warn('PlatformRegistry already initialized')
      return
    }

    const initPromises = this.getAll().map(async platform => {
      try {
        if (typeof platform.initialize === 'function') {
          await platform.initialize(context)
        }
      } catch (error) {
        console.error(`Failed to initialize platform ${platform.getPlatformId()}:`, error)
      }
    })

    await Promise.all(initPromises)
    this.initialized = true
    console.log(`🚀 PlatformRegistry initialized with ${this.platforms.size} platforms`)
  }

  /**
   * 清理所有平台
   */
  static async cleanupAll() {
    const cleanupPromises = this.getAll().map(async platform => {
      try {
        if (typeof platform.cleanup === 'function') {
          await platform.cleanup()
        }
      } catch (error) {
        console.error(`Failed to cleanup platform ${platform.getPlatformId()}:`, error)
      }
    })

    await Promise.all(cleanupPromises)
    this.platforms.clear()
    this.initialized = false
    console.log('🧹 PlatformRegistry cleaned up')
  }

  /**
   * 从目录自动加载平台插件
   * @param {string} pluginsDir - 插件目录路径
   * @param {Object} context - 应用上下文
   */
  static async loadFromDirectory(pluginsDir, context = {}) {
    if (!fs.existsSync(pluginsDir)) {
      console.warn(`Plugins directory not found: ${pluginsDir}`)
      return
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginPath = path.join(pluginsDir, entry.name)
      const indexPath = path.join(pluginPath, 'index.js')

      if (!fs.existsSync(indexPath)) {
        console.warn(`Plugin missing index.js: ${entry.name}`)
        continue
      }

      try {
        const { default: PluginClass } = await import(`file://${indexPath}`)

        if (typeof PluginClass !== 'function') {
          console.warn(`Invalid plugin export in ${entry.name}: must be a class`)
          continue
        }

        const instance = new PluginClass(context)
        this.register(instance)
      } catch (error) {
        console.error(`Failed to load plugin ${entry.name}:`, error)
      }
    }
  }

  /**
   * 导出平台清单（用于UI展示）
   * @returns {Object[]}
   */
  static exportManifest() {
    return this.getAll().map(platform => ({
      id: platform.getPlatformId(),
      name: platform.getDisplayName(),
      icon: platform.getIcon(),
      enabled: platform.enabled,
      version: platform.version,
      configSchema: platform.getConfigSchema()
    }))
  }
}

export default PlatformRegistry
