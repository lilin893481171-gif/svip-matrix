# AI_MEMORY_BANK.md

> YuMatrix 项目记忆库 — 跨对话上下文传递。新对话开局必读。

---

## 1. 架构全局观

```
src/main/
├── index.js                         # 主进程 + IPC + --ignore-certificate-errors
├── account-browser-manager.js       # 👑 原生沙盒（BrowserView + CDP反指纹，零Playwright）
├── rpa-engine.js                    # 👑 RPA引擎（sendInputEvent + 平台适配器）
├── native-interactions.js           # 👑 原生交互引擎30+方法
├── browser-manager.js               # 互动/同步（Playwright chromium.launch）
├── data-engine.js / database.js     # 数据引擎 + SQLite
├── vision-agent.js                  # SoM视觉Agent
└── platforms/                       # 平台脚本

src/renderer/src/
├── App.jsx                          # 👑 全局状态宿主 + PublishTask跨视图状态
├── config/matrixConfig.js           # 统一配置中心
├── components/
│   ├── AccountManagerView.jsx       # 多标签浏览器 + 地址栏
│   ├── PublishTask.jsx              # 3步发布 + 12平台编辑器
│   └── AiHub/                       # 9面板AI工具集 + AiTaskContext
└── services/llmRouteService.js
```

### 三引擎

| 引擎 | 驱动 | 用途 | 指纹防护 |
|------|------|------|----------|
| **RPA 发布** | Electron sendInputEvent | 视频发布（6平台）| ❌ 几乎裸奔 |
| **账户登录** | BrowserView + CDP | 扫码/密码登录 | ⚠️ 中等 |
| **互动+同步** | Playwright chromium.launch | 评论/数据同步 | ✅ 最完整 |

---

## 2. 多标签浏览器机制（精简）

- **生命周期**：点击账户→已有标签则 switchToTab，无标签则 launchEmbeddedAccountBrowser→新增 browserTabs→attach
- **跨视图存活**：切换页面仅 detach（移到屏幕外），不销毁。browserTabs/activeTabId 在 App.jsx 层
- **BrowserView 层级**：原生 OS 视图悬浮 DOM 之上，弹窗打开自动 detach，关闭后恢复
- **关键 IPC**：open-account-session / close-account-session / attach-account-browser / detach-account-browser / navigate-account-browser / account-browser-url-changed / get-active-sessions

---

## 3. 开发铁律（精简，完整18条）

### 账户沙盒
1. Map 键统一：`String(accountId)`
2. getActiveSessions() 返回 `[{ accountId, currentUrl }]`
3. BrowserView 初始 offscreen：bounds `(-10000, -10000, ...)`
4. **禁止 Emulation.setDeviceMetricsOverride**（白屏/错位）
5. 反指纹脚本安全：禁止 Plugin.prototype、AudioContext typeof 守卫、IIFE 包 try/catch
6. SSL 三层：commandLine ignore-certificate-errors + 分区清理 + did-fail-load 自动重试
7. 关闭销毁顺序：stop() → close() → debugger.detach() → removeBrowserView()
8. 多标签只 detach 不 close；跨视图仅 detach 不销毁
9. sessionData TDZ：`loadURL('about:blank')` 之前声明 `let sessionData = null`
10. webContents 必须 `isDestroyed()` 守卫 + try-catch
11. 事件回调必须 try/catch

### RPA 引擎
12. 唯一交互入口：`native-interactions.js`
13. 适配器签名：`constructor(interactions, task, webContents)`

### 通用
14. Preload 必须暴露 `send`（缺失→IPC 静默失败）
15. lucide-react 图标先 import 再用（否则白屏）
16. **状态提升原则**：跨视图存活→App.jsx，组件内状态随卸载丢失
17. dev 命令：`npm run dev`
18. Edit 工具弯引号陷阱→构建失败

---

## 4. 指纹抗风能力（截至 2026-05-28）

### 已覆盖
- **navigator 属性**：webdriver/plugins/platform/vendor/hardwareConcurrency/deviceMemory/screen 等17+项 → `account-browser-manager.js:128-172`
- **Canvas**：`HTMLCanvasElement.toDataURL` 随机5像素噪声 (每刷新变) → `:187-201`
- **WebGL**：**42参数** 完整欺骗 (WebGL 1.0 + 2.0) + **扩展全放行** (白名单太激进会破页) → `:206-312`
- **AudioContext**：createOscillator 确定性频率噪声 (Mulberry32, 基于 accountId 种子) + webkitAudioContext 兼容 → `:314-334`
- **WebRTC**：**RTCShield 隐形盾** — 真实实例 + 方法覆盖 (createOffer返回空SDP/setLocalDescription no-op), `instanceof RTCPeerConnection` 返回 true, 原型链完整不可检测 → `:336-392`
  - 旧方案教训：原型 setLocalDescription no-op 无效 (ICE仍启动), RTCIceCandidate.candidate 只读 (赋值静默失败), 纯mock返回 `{}` 可被 instanceof 检测
- **会话隔离**：分区存储 + AES-256-CBC加密Cookie，账户间零交叉污染
- **SSL**：三层防御（全局flag + 事件preventDefault + 自动重试）
- **备份注入**：`did-finish-load` 事件兜底 executeJavaScript，确保 CDP 失效时页面重载仍可注入

### 已知缺口（按严重程度）
1. **RPA引擎几乎裸奔**：仅删webdriver+改languages → `rpa-engine.js:102-113`
2. **字体枚举零覆盖**
3. **contextIsolation: false + sandbox: false** → XSS即可拿Node.js权限

### CDP 注入铁律 + 教训集
- **禁止 `worldName`**：该参数导致 `Page.addScriptToEvaluateOnNewDocument` 静默失效
- **Page.enable 先行**：`sendCommand('Page.addScriptToEvaluateOnNewDocument')` 前必须先 `sendCommand('Page.enable')`
- **模板字面量正则陷阱**：反引号字符串内 `\d` / `\S` / `\.` 会被 JS 引擎吞掉反斜杠，必须双写 `\\d` / `\\S` / `\\.`
- **toDataURL 在 HTMLCanvasElement 上**：不是 CanvasRenderingContext2D，挂错对象→静默失效
- **RTCIceCandidate.candidate 只读**：Chromium 中该属性为 getter-only，赋值操作静默失败。SDP 擦写和 addEventListener 拦截均无效，唯一可靠方案是从源头禁用 ICE（RTCShield 实例方法覆盖）
- **WebGL 扩展白名单不宜过滤**：`getSupportedExtensions` 过滤得太激进会直接导致页面 WebGL 检测失败→一片空白。改为全放行，只伪装 `getParameter` 返回的42个参数
- **诊断必备**：`wc.on('console-message')` 转发 BrowserView 日志到主进程

---

## 5. 当前进度

### 已完成
- 3步发布 + 12平台编辑器 + RPA引擎零Playwright
- AI Hub 9面板 + 统一配置中心 + AiTaskContext全局调度
- 账户沙盒：BrowserView + CDP反指纹
- 多标签浏览器 + 地址栏 + 跨视图存活
- 侧边栏方案F + 弹窗防遮挡 + SSL自动恢复
- **PublishTask 跨视图状态保持**：currentStep/activeEditorTab/workbenchVideos/isDryRun → App.jsx
- **AI Hub 跨视图状态保持**：7面板 localStorage 持久化
- **反指纹装甲 v2 (2026-05-28 第二轮验证)**：
  - ✅ WebRTC RTCShield 隐形盾 (真实实例+方法覆盖, 原型链完整, browserleaks ✔No Leak)
  - ✅ Canvas 噪声修复 (toDataURL 挂 HTMLCanvasElement 而非 CanvasRenderingContext2D, 每次刷新 Signature 变化)
  - ✅ WebGL 42参数伪装 (扩展全放行不破页, 硬编码默认值兜底缺失指纹数据)
  - ✅ AudioContext Mulberry32 确定性噪声
  - ✅ TLS 指纹正常 (标准 Chrome, 不唯一)

### 下一轮
- **字体枚举覆盖**：注入伪装字体列表
- **RPA引擎指纹增强**：screen/canvas最低限度伪装
- **contextIsolation 加固**：评估开启后的兼容性影响
