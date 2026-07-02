# 平台插件开发指南

## 架构概览

YuMatrix Studio 采用**插件式架构**管理各内容平台（小红书、B站、抖音等）。

```
┌─────────────────────────────────────────┐
│         PlatformRegistry                │
│  ┌───────────────────────────────────┐  │
│  │  Map<platformId, PlatformInterface>│  │
│  └───────────────────────────────────┘  │
│                 │                        │
│        ┌────────┴────────┐               │
│        │                 │               │
│  ┌─────▼─────┐    ┌─────▼─────┐         │
│  │Xiaohongshu│    │  Bilibili │         │
│  │  Plugin   │    │  Plugin   │         │
│  └───────────┘    └───────────┘         │
└─────────────────────────────────────────┘
```

---

## 核心组件

### 1. PlatformInterface（基类）

**位置**: `src/main/platforms/PlatformInterface.js`

**职责**: 定义平台插件的标准接口

**必需实现方法**:
- `getPlatformId()` - 返回平台唯一标识
- `getDisplayName()` - 返回平台显示名称
- `checkLoginStatus(browserController)` - 检测登录状态
- `publish(browserController, content, options)` - 执行发布
- `getAccountInfo(browserController)` - 获取账号信息

**可选实现方法**:
- `initialize(context)` - 平台初始化
- `cleanup()` - 平台清理
- `syncData(params)` - 数据同步
- `getConfigSchema()` - 配置表单Schema
- `getRPAScriptPath()` - RPA脚本路径
- `getBrowserArgs()` - 浏览器启动参数
- `getCookieDomains()` - Cookie域名列表

---

### 2. PlatformRegistry（注册表）

**位置**: `src/main/PlatformRegistry.js`

**职责**: 管理平台插件的注册、发现和生命周期

**核心API**:
```javascript
// 注册单个平台
PlatformRegistry.register(platformInstance)

// 批量注册
PlatformRegistry.registerAll([platform1, platform2])

// 获取平台
const platform = PlatformRegistry.get('xiaohongshu')

// 获取所有平台
const allPlatforms = PlatformRegistry.getAll()

// 初始化所有平台
await PlatformRegistry.initializeAll(context)

// 导出清单（用于UI）
const manifest = PlatformRegistry.exportManifest()
```

---

## 开发新平台插件

### Step 1: 创建插件目录

```
src/main/platforms/
└── my-platform/
    ├── index.js          # 插件入口
    ├── adapter.js        # 平台适配器（可选）
    └── README.md         # 文档（可选）
```

---

### Step 2: 实现插件类

```javascript
// src/main/platforms/my-platform/index.js
const PlatformInterface = require('../PlatformInterface')

class MyPlatform extends PlatformInterface {
  constructor(config) {
    super(config)
    // 自定义初始化
  }

  getPlatformId() {
    return 'my-platform'
  }

  getDisplayName() {
    return '我的平台'
  }

  async checkLoginStatus(browserController) {
    // 实现登录检测逻辑
    const page = await browserController.getActivePage()
    await page.goto('https://my-platform.com/profile')
    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('.user-avatar') !== null
    })
    return isLoggedIn
  }

  async publish(browserController, content, options) {
    // 实现发布逻辑
    const page = await browserController.getActivePage()

    // 导航到发布页
    await page.goto('https://my-platform.com/publish')

    // 填充内容
    await page.fill('#title', content.title)
    await page.fill('#description', content.description)

    // 上传封面
    if (content.coverImage) {
      const fileInput = await page.$('input[type="file"]')
      await fileInput.setInputFiles(content.coverImage)
    }

    // 点击发布
    await page.click('#submit-button')

    return { success: true, message: '发布成功' }
  }

  async getAccountInfo(browserController) {
    const page = await browserController.getActivePage()
    await page.goto('https://my-platform.com/profile')

    const info = await page.evaluate(() => {
      return {
        username: document.querySelector('.username')?.textContent,
        followers: document.querySelector('.followers')?.textContent
      }
    })

    return info
  }

  getRPAScriptPath() {
    // 如果使用RPA脚本
    return path.join(__dirname, 'rpa-script.mjs')
  }
}

module.exports = MyPlatform
```

---

### Step 3: 注册插件

```javascript
// src/main/index.js
const MyPlatform = require('./platforms/my-platform')
const PlatformRegistry = require('./PlatformRegistry')

// 注册平台
PlatformRegistry.register(new MyPlatform({
  enabled: true,
  version: '1.0.0'
}))

// 初始化所有平台
await PlatformRegistry.initializeAll(appContext)
```

---

## 最佳实践

### 1. 错误处理

```javascript
async publish(browserController, content, options) {
  try {
    // 发布逻辑
    return { success: true }
  } catch (error) {
    console.error(`[${this.getPlatformId()}] Publish failed:`, error)
    return {
      success: false,
      error: error.message,
      code: 'PUBLISH_FAILED'
    }
  }
}
```

---

### 2. 配置验证

```javascript
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
        maximum: 300
      }
    }
  }
}

validateConfig(config) {
  const errors = []

  if (config.publishDelay && config.publishDelay > 300) {
    errors.push('发布延迟不能超过300秒')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

---

### 3. 资源清理

```javascript
async initialize(context) {
  // 初始化资源
  this.watcher = fs.watch('/some/path', () => {})
}

async cleanup() {
  // 清理资源
  if (this.watcher) {
    this.watcher.close()
  }
}
```

---

### 4. 使用RPA脚本

```javascript
getRPAScriptPath() {
  return path.join(__dirname, 'scripts', 'publish.mjs')
}

async publish(browserController, content, options) {
  const scriptPath = this.getRPAScriptPath()
  const result = await browserController.executeScript(scriptPath, {
    content,
    options
  })
  return result
}
```

---

## 平台生命周期

```
┌─────────────┐
│  new Plugin │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  register() │
└──────┬──────┘
       │
       ▼
┌──────────────┐
│ initialize() │  ← 应用启动时调用
└──────┬───────┘
       │
       ▼
┌─────────────┐
│  Running    │  ← 处理请求
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  cleanup()  │  ← 应用退出时调用
└─────────────┘
```

---

## 迁移现有平台

### 旧架构（硬编码）

```javascript
// src/main/index.js
if (platform === 'xiaohongshu') {
  // 硬编码逻辑
}
```

### 新架构（插件化）

```javascript
// src/main/index.js
const platform = PlatformRegistry.get(platformId)
if (!platform) {
  throw new Error(`Unknown platform: ${platformId}`)
}
await platform.publish(browserController, content, options)
```

---

## UI集成

### 获取平台列表

```javascript
// 渲染进程
const platforms = await ipcRenderer.invoke('get-platforms')
// 返回: [{ id, name, icon, enabled, version, configSchema }]
```

### 动态生成配置表单

```javascript
import { JsonSchemaForm } from '@rjsf/core'

function PlatformConfig({ platform }) {
  const schema = platform.configSchema
  return <JsonSchemaForm schema={schema} />
}
```

---

## 调试技巧

### 1. 查看已注册平台

```javascript
console.log('Registered platforms:', PlatformRegistry.getIds())
console.log('Manifest:', PlatformRegistry.exportManifest())
```

### 2. 测试单个平台

```javascript
const platform = PlatformRegistry.get('xiaohongshu')
const isLoggedIn = await platform.checkLoginStatus(browserController)
console.log('Login status:', isLoggedIn)
```

### 3. 模拟发布

```javascript
const result = await platform.publish(browserController, {
  title: '测试标题',
  description: '测试内容'
})
console.log('Publish result:', result)
```

---

## 常见问题

### Q: 如何支持多账号？

A: 每个账号对应一个 BrowserController 实例，平台插件应支持并发调用。

### Q: 如何处理平台API变更？

A: 在插件内部实现版本兼容逻辑，或发布新版本插件。

### Q: 如何实现平台间共享逻辑？

A: 创建 Mixin 或工具类，在多个插件中复用。

### Q: 如何禁用平台？

A: 注册时设置 `enabled: false`，或调用 `PlatformRegistry.unregister(platformId)`。

---

## 下一步

1. 查看 `src/main/platforms/PlatformInterface.js` 了解接口细节
2. 参考 `src/main/PlatformRegistry.js` 了解注册表实现
3. 查看示例平台插件实现（待迁移）
