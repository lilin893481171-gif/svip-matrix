# 浏览器引擎调用链路分析报告

## 1. 内嵌/私有浏览器调用映射

### 文件和函数：
- **src/main/browser/embedded-browser-regression-test.js**
  - `runEmbeddedBrowserRegressionTest()` - 模拟内嵌浏览器引擎进行测试
  - 创建模拟的内嵌引擎对象，类型为 'embedded'

- **src/main/browser/engine-selector.js**
  - 在选择逻辑中包含对内嵌浏览器的引用（第32-35行、40行、121行、197行）
  - 当用户偏好设置为 'embedded' 时显式抛出错误："发布功能不支持内嵌浏览器，请安装 Chrome 或 Edge 浏览器"

### 业务场景：
- 代码库中保留了内嵌浏览器功能主要用于：
  - 备用/测试场景
  - 适配器回归测试
- 然而，当前实现明确禁止将内嵌浏览器用于发布："发布功能不支持内嵌浏览器"

## 2. 真实/本地UI浏览器调用映射

### 文件和函数：
- **src/main/browser/engine-selector.js**
  - `selectEngine(useSystemChrome = false)` - 引擎选择的主入口点
  - `selectRealBrowserEngine(browser, useSystemChrome = false)` - 选择并启动真实浏览器引擎

- **src/main/browser/browser-detector.js**
  - `detectAllBrowsers()` - 扫描系统中的Chrome/Edge安装
  - `getChromePaths()` 和 `getEdgePaths()` - 返回平台特定路径
  - `getBestBrowser()` - 优先选择Chrome而不是Edge

- **src/main/browser/chrome-launcher.js**
  - `launch(browserPath, useSystemChrome = false)` - 使用特定参数启动Chrome/Edge
  - `getUserDataDir(useSystemChrome = false)` - 根据系统Chrome使用情况不同地管理用户数据目录
  - 使用不同的用户数据目录：
    - 系统Chrome：`system-chrome-user-data`（用于登录状态同步）
    - 常规：`chrome-user-data`

- **src/main/browser/puppeteer-connector.js**
  - `connect(debugPort, options = {})` - 将Puppeteer连接到启动的浏览器
  - 管理连接生命周期（重新连接、断开连接等）

- **src/main/browser/user-data-manager.js**
  - `checkUserLoggedInSystemChrome(platform)` - 检查用户是否在系统Chrome中登录到平台
  - `checkPlatformDataExists(profileDir, platform)` - 验证平台特定数据是否存在

### 业务场景：
- **二维码登录**：当用户未在系统Chrome中登录时，需要可见浏览器进行登录
- **登录状态同步**：当用户在系统Chrome中登录时，使用 `useSystemChrome=true` 保持登录状态
- **高风险环境保护**：可见浏览器允许在需要时进行手动干预
- **平台发布**：所有发布活动都使用带Puppeteer控制的真实Chrome/Edge浏览器

## 3. 引擎路由和回退逻辑诊断

### 发布通道回退机制：
代码库中似乎存在一个清晰的路由机制：

1. **API直发**（在当前文件中不可见）→ 
2. **内嵌浏览器**（已禁用）→ 
3. **真实浏览器**

### 实现细节：
- **主要路由**：带Puppeteer控制的真实浏览器（Chrome/Edge）
- **回退已禁用**：内嵌浏览器明确禁用于发布功能
- **登录状态管理**： 
  - 如果用户在系统Chrome中登录：使用系统Chrome登录状态（`useSystemChrome=true`）
  - 如果用户未登录：需要可见浏览器进行手动登录

### 路由逻辑中的问题：
1. **硬编码限制**：内嵌浏览器明确禁用于发布功能，并带有硬编码错误消息
2. **缺少回退**：没有实际回退到内嵌浏览器；只是抛出错误
3. **单一引擎路径**：所有发布都通过真实Chrome/Edge浏览器进行

### 路由中的关键组件：
- **src/main/browser/platform-ipc-adapter.js**：
  - `getAdapterInstance(platform, task)` - 主路由逻辑
  - 使用 `checkUserLoggedInSystemChrome(platform)` 检查系统Chrome登录状态
  - 使用 `engineSelector.selectEngine(useSystemChrome)` 选择引擎
  - 在不使用系统Chrome登录状态时处理Cookie同步

路由逻辑并不混乱，而是明确设计为所有发布活动都使用真实浏览器，内嵌浏览器选项在生产环境中被禁用。