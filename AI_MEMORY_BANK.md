# AI_MEMORY_BANK.md

> YuMatrix 记忆库 — 跨对话上下文。新对话开局必读。

---

## 1. 架构

```
src/main/
├── index.js                     # 主进程 + IPC + WebRTC全局 + DevTools禁用
├── account-browser-manager.js   # 会话容器 (BrowserView + CDP)
├── rpa-engine.js                # RPA入口 + TaskManager + IPC
├── rpa/
│   ├── script-manager.js          # 🆕 脚本管理器 (下载/校验/三级回退)
│   ├── browser-controller.js      #   BrowserView工厂 (独立_rpa分区)
│   ├── adapters/                  #   旧适配器类 (三级回退保底)
│   └── self-test.js               #   CDP持久化自检
├── sync/                          # 6平台数据采集器
├── data-engine.js / database.js # SQLite
└── platforms/                   # 6平台互动脚本
src/renderer/src/
├── App.jsx                      # 主组件 + Toast + 绑定弹窗
├── components/
│   ├── ToastContext.jsx          # 白底轻量 Toast (success/error/warning/info)
│   ├── PublishTask.jsx           # 发布台 (发布前校验 + isPublishing)
│   ├── shared/                   # 🆕 11个共享UI组件 (详见 §7)
│   │   ├── PlatformHeader.jsx    #  平台标识头
│   │   ├── CharInput.jsx         #  字符计数输入框
│   │   ├── CharTextarea.jsx      #  字符计数文本域
│   │   ├── CoverUpload.jsx       #  封面上传 (支持双封面)
│   │   ├── TagInput.jsx          #  话题输入 + 推荐标签
│   │   ├── MentionInput.jsx      #  @用户 + 位置选择
│   │   ├── SchedulePicker.jsx    #  定时发布选择器
│   │   ├── FirstComment.jsx      #  抢占首评 + 置顶
│   │   ├── VisibilityRadio.jsx   #  可见性单选组
│   │   ├── FooterActions.jsx     #  底部发布按钮 (isPublishing spinner)
│   │   └── LabeledField.jsx      #  标签-字段布局容器
│   └── AiHub/
│       ├── AiTaskContext.jsx     # AI调度 + 绑定守卫
│       └── AiHubView.jsx         # 12引擎面板
├── hooks/                        # 🆕 自定义 hooks
│   ├── useCharCounter.js         #  字符计数
│   ├── useScheduleState.js       #  定时发布 state 复用
│   ├── useDraftAutoSave.js       #  草稿自动保存
│   └── usePersistentState.js     #  localStorage 持久化
└── utils/                        # 🆕 工具函数
    ├── electron.js               #  getElectron 单例
    ├── platformHelpers.js        #  PLATFORM_COLORS + getBrand + 标签映射
    └── validation.js             #  6平台校验中心注册表
```

### 三引擎

| 引擎 | 驱动 | 用途 |
|------|------|------|
| RPA 发布 | Electron sendInputEvent + 脚本外置 | 视频发布 |
| 账户登录 | BrowserView + CDP | 扫码/密码登录 |
| 互动+同步 | Playwright chromium.launch | 评论/数据 |

### 🆕 发布队列系统 v2 (2026-06-04)

- **并发 3**：3 个不同平台同时发布，同平台互斥（`accountId|platform` key）
- **AbortController 真取消**：取消 → BrowserView 关闭 → 1.5s 后自动取下一个
- **暂停/恢复**：暂停只冻结队列调度，当前任务继续完成
- **localStorage 持久化**：`publish_history_v1`，7 天以上自动清理
- **IPC**: `execute-auto-publish` / `cancel-publish-task(historyId)` / `pause-task-queue` / `resume-task-queue` / `get-task-stats`
- **数据流**: App.jsx 单一监听 `task-progress-update` → `publishHistory` state → `PublishTask` (派生 syncTasks) + `PublishHistoryView` (展示)

### 🆕 RPA 脚本外置

6 平台发布脚本已拆为独立 ESM 模块，托管 GitHub。

```
resources/rpa-scripts/          # ASAR 内置 (出厂版本)
  manifest.json                 #   版本注册表 + SHA256
  xiaohongshu.mjs / douyin.mjs / kuaishou.mjs / bilibili.mjs / baijiahao.mjs / wechat-channels.mjs

userData/rpa-scripts/           # GitHub 下载缓存 (用户目录)
```

- **脚本接口**: `export const meta` + `export async function execute(api)`
- **api 注入**: interactions / task / wc / broadcast / sleep / VisionAgent
- **三级回退**: 远程下载 > ASAR 内置 > 旧适配器类
- **更新**: ScriptManager.init() → 后台 fetch manifest → diff 版本 → 下载 + SHA256 → 写入缓存
- **manifest URL**: `https://raw.githubusercontent.com/lilin893481171-git/svip-matrix/main/rpa-scripts/manifest.json`

### WebRTC 三层

| 层 | 位置 | 机制 |
|:---:|------|------|
| L1 | `index.js` | `app.commandLine.appendSwitch` default_public_interface_only |
| L2 | session | `setWebRTCIPHandlingPolicy` + CDP Network.setBlockedURLs |
| L3 | JS注入 | RTCShield 全API掩码 |

---

## 2. 开发铁律

### 会话容器
1. Map 键: `String(accountId)`
2. BrowserView 初始 offscreen: `(-10000, -10000, 1280, 800)` ← 必须给宽高防0x0加载
3. **禁止** `Emulation.setDeviceMetricsOverride`（白屏/错位）
4. 注入脚本: 禁止 Plugin.prototype / AudioContext typeof 守卫 / IIFE 包 try/catch
5. SSL 三层: `--ignore-certificate-errors` + 分区清理 + did-fail-load 重试
6. 关闭顺序: stop() → close() → debugger.detach() → removeBrowserView()
7. webContents 必须 `isDestroyed()` 守卫 + try-catch
8. 多标签只 detach 不 close；跨视图仅 detach
9. **attach 时设 zoomFactor** → `Math.min(1, containerWidth / 1280)` 自适应容器宽度
10. **ResizeObserver** 监听容器变化实时更新 bounds（侧边栏折叠/展开）
11. **🆕 RPA 独立分区**: `chrome_data_{accountId}_rpa`，不与账户浏览器共享，避免 SQLite WAL 竞争损坏 Cookie
12. **🆕 UA 动态读取**: `process.versions.chrome`，禁止硬编码版本号（Electron 39 = Chrome 132）
13. **🆕 禁止删除 Cookies-journal**：是 SQLite Cookie DB 的 WAL 日志，不是 SSL 文件
14. **🆕 webRequest hook 禁止 passBack**: `onBeforeSendHeaders` 必须 `callback({ cancel: false })` 原地修改，禁止 `callback({ requestHeaders })` — Cookie 由 Chromium 在此 hook 之后注入，passBack 会覆盖导致 401
15. **🆕 multipart 请求跳过**: `webRequest.onBeforeSendHeaders` 的 Content-Type 包含 `multipart/form-data` 时直接 skip，不要动 headers
16. **🆕 BrowserView 必须 `webSecurity: true`**: `webSecurity: false` 会使 Chromium 不发 `Origin`/`Referer` 头，小红书/头条等平台的 WAF 会将此判定为 CSRF 攻击 → 401 踢登录。RPA 走 CDP 硬注入不依赖 webSecurity，所以两边都得开 true

### RPA
11. 唯一交互入口: `native-interactions.js`
12. 适配器签名: `constructor(interactions, task, webContents)`

### UI / 安全
13. Preload 必须暴露 `send`
14. 状态提升: 跨视图存活 → App.jsx
15. `devTools: false` — 生产禁 DevTools
16. AI 任务入口守卫: `AiTaskContext.dispatchTask` 未绑定直接 return

### 🆕 平台面板组件规范
17. 所有平台面板使用 `components/shared/` 共享组件，禁止内联重复实现
18. 每个面板导出 `validate[PlatformName](config)` 函数，返回 `{ valid, errors }`
19. 面板接受 `isPublishing` prop，透传给 `FooterActions`
20. 定时发布统一用 `useScheduleState(cfg, set)` hook
21. 平台特有交互（如购物车挂载、音效设定、头条同步）保留内联
22. 校验中心入口: `utils/validation.js` → `validatePlatform(config, platformName)`
23. PublishTask `handlePublish` 必须先调用 `validatePlatform` 再发布

---

## 3. 命名规范

| 禁止 (旧) | 使用 (新) |
|-----------|----------|
| 装甲/装甲中心 | Matrix Shield |
| 反指纹装甲 | 会话环境配置 |
| `buildAntiFingerprintScript` | `buildSessionEnvironmentScript` |
| `ghostMove` | `humanMouseMove` |
| 沙盒 | 会话容器 |
| 洗白 | 会话初始化 |
| 窃听 | 数据采集 |
| 僵尸进程 | 遗留进程 |
| 黑卡 CK / 夺舍 | Cookie 导入 |

---

## 4. 会话环境注入 (19域)

navigator(17) / Screen(6) / Canvas toDataURL / WebGL(42参数) / WebGL Image Hash / AudioContext / WebRTC IP / 字体枚举 / MediaDevices / Permissions / chrome.runtime / toString防检测 / 指纹漂移 / contextIsolation / 会话隔离 / SSL / 备份注入

已知缺口: 主窗口 sandbox:false (Renderer 有 Node 权限，Electron 架构限制无法改变)
✅ Canvas toBlob/getImageData/toDataURL — 2026-06-08 已修复 (alpha 通道 ±1 噪声)
✅ Permissions.PermissionStatus — 2026-06-08 已修复 (原型链补全 + addEventListener)
✅ Screen 物理分辨率 — 2026-06-08 已修复 (BrowserView 视口 1920x1080 对齐 spoofed screen)
✅ Windows/macOS 跨平台兼容 — 2026-06-08 已修复 (7 文件: package.json dev 脚本 / AppLauncherWidget / scan+launch IPC / tls-proxy-launcher CA / electron-builder glob / native-interactions PowerShell 守卫 / before-quit 平台清理)

---

## 5. CDP 注入教训

| # | 教训 | 严重度 |
|---|------|:---:|
| 1 | 禁止 `worldName` → addScriptToEvaluateOnNewDocument 静默失效 | 🔴 |
| 2 | `Page.enable` 先行于 addScript | 🔴 |
| 3 | 模板字面量内 `\d`/`\S` 必须双写 `\\d`/`\\S` | 🟡 |
| 4 | 禁止 `Object.defineProperties` 批量 → 逐属性独立 try/catch | 🔴 |
| 5 | `toString.toString()` 套娃 → `makeNative` 包裹自身 | 🔴 |
| 6 | 影子属性截不住 C++ 事件 → 原生 setter 先遣 | 🔴 |
| 7 | `appendSwitch` 不校验 flag → 拼写错误静默失效 | 🔴 |
| 8 | CDP `Emulation.setWebRtcIPHandlingPolicy` 不存在 | 🟡 |
| 9 | `session.webRequest.onBeforeSendHeaders` 禁止显式 `callback({ requestHeaders })` — Cookie 由 Chromium 网络栈在 hook 之后附加，passBack 会清掉未写入的 Cookie 导致 401/跳登录。正确做法：原地修改 `details.requestHeaders` 后 `callback({ cancel: false })`，且 multipart 上传请求直接跳过 | 🔴 |
| 10 | `DOM.setFileInputFiles` CDP 硬注入被小红书 Web-Shield 检测为机器行为 — 无 blur/focus 时序伴随文件出现。修复: CDP 注入前 `window.dispatchEvent(blur)` + `document.hasFocus→false` + 0.9-2.7s 浏览延时；注入后恢复 focus。CDP 触发的 change 事件 isTrusted:true (引擎内部)，无需伪造 | 🔴 |
| 11 | JS 猴子补丁 `HTMLInputElement.prototype.click` 无法截获 React 合成事件 / `<label>` 关联 / 事件委托触发的文件对话框 → 原生 OS 文件框弹出卡死 RPA。修复: 使用 CDP `Page.setInterceptFileChooserDialog` 在 Chromium 浏览器层拦截文件对话框，通过 `Page.fileChooserOpened` 事件获取 `backendNodeId` 后用 `DOM.setFileInputFiles` 注入。注意: CDP 拦截路径用 `backendNodeId`，DOM 遍历路径用 `nodeId`，不能混用。safeUpload 策略顺序: CDP拦截 > 直注 > JS补丁+CDP保底 | 🔴 |

---

## 6. 交付历史

| 轮次 | 交付 |
|:---:|------|
| v2~v6.2 | WebRTC 三层 / Canvas 噪声 / WebGL 42参数 / AudioContext / 字体枚举 / 仿生学交互 / CDP 持久化自检 |
| P1 | 合规清洗 — 15严重词+22高危词清零, 4函数重命名 |
| P2 | 术语规范 — 11组清洗 |
| P3 | 架构清理 — rpa-engine(1007→217行) + data-sync(720→26行) |
| P4 | 跳过 — 单机桌面工具无需多用户 |
| P5 | ✅ Toast通知 + 包改名 yumatrix-studio v2.0 + BrowserView自适应 + DevTools禁用 |
| **Phase A+B** | ✅ 基础建设 — 11共享组件 + 4 hooks + 2 utils (electron.js, platformHelpers.js) |
| **Phase C1-C2** | ✅ BaijiahaoPanel(258→152行) + WechatChannelsPanel(387→149行) 重构 |
| **Phase C3-C6** | ✅ DouyinPanel(370→254行) + XiaohongshuPanel(380→222行) + KuaishouPanel(364→245行) + BilibiliPanel(391→244行) 重构 |
| **Phase D** | ✅ `utils/validation.js` 校验中心注册表 + PublishTask 发布前阻断 |
| **Phase E** | ✅ 6面板 isPublishing 全线贯通 + FooterActions spinner + handlePublish finally 重置 |
| **Phase F** | ✅ RPA 脚本外置 — 6 ESM 脚本 + ScriptManager + GitHub 自动更新 |
| **Phase G** | ✅ AI 文案规则统一 — 标题/标签限制三层对齐 + 全局禁时间戳 + 预览滚动 |
| **Phase H** | ✅ Cookie 安全修复 — 删除 Cookies-journal 清理 + RPA 独立分区 + UA 动态版本 |

---

## 7. 未完结断点

| ID | 内容 | 优先级 |
|:---:|------|:---:|
| **I** | ✅ 小红书上传跳登录 — 根因: `webSecurity: false` 导致 BrowserView 不发 `Origin`/`Referer` 头，上传 API 判定为 CSRF → 401。修复: `webSecurity: true`（RPA 用 CDP 硬注入不依赖 webSecurity）。诊断流程排除了: CDP debugger、反指纹脚本、入网嗅探、webRequest hook、Cookie。见铁律 #16 | ✅ |
| **L** | ✅ 小红书 RPA 全链路重构 — CSS 选择器→文案定位。`native-interactions.js` 新增 14 方法（AXTree/L3），`xiaohongshu.mjs` v3。回退链: AX → CSS → flexibleClick | ✅ |
| **M** | ✅ 发布队列系统重构 — 并发 3 + 同平台互斥 + AbortController 真取消 + 暂停/恢复。`rpa-engine.js` v2，`PublishHistoryView` 全量重写（封面/耗时/失败原因/取消按钮），`App.jsx` localStorage 持久化。 | ✅ |
| **J** | ❌ dryRun 已删除 (2026-06-06) — Cookie 复制与账户浏览器互斥，空视频跳过上传后无法触发后续 UI。手动发布即最佳验证。 | ❌ |
| **K** | 🟡 GitHub push rpa-scripts/ + manifest.json → 验证自动更新 | 🟡 |

## 8. Go TLS 代理 + CA 证书链 (2026-06-06)
### 架构终态
| 域 | 模式 | 原因 |
|---|---|---|
| `*.xiaohongshu.com` | passthrough | 主站 HTTP/2，relay 不支持 |
| `*.xhscdn.com` | bypass | CDN CORS 校验 Origin 头 |
| 其他域 | passthrough | 无需 JA3 伪装 |

**结论**: Go 代理当前无 MITM 流量。CA 已导入 Windows 信任存储 (`%APPDATA%/yumatrix-studio/tls-proxy-certs/`)，但无业务使用。

### 已知硬限制
- **HTTP/2**: uTLS Chrome 133 指纹自带 h2 ALPN → 服务器回二进制帧 → relay 不通
- **CORS**: CDN `Access-Control-Allow-Origin` 校验依赖 Origin 头完整性，MITM 破坏
- **relay**: 单方向完成即返回，`defer Close()` 走 TLS close_notify。禁止 `CloseWrite()` 绕过 TLS 协议

### WebGL/Canvas 指纹 (2026-06-06)
Canvas `toDataURL` 噪声、WebGL `readPixels` 噪声、WebGL 容量参数 — 全部永久移除（封面编辑器 WASM 需要原始像素）。覆盖约 40%。

---

## 9. RPA vNext — 文案定位架构
| 标签 | `#topicBtn` + 输入 `#tag` → Enter | 现有逻辑 | 低 |
| 发布按钮 | Shadow DOM `closed` 不可穿透 → `<xhs-publish-btn>` 自身 boxModel 推算坐标 + `humanClickAtCoordinates` | 关键难点 |

### 通用交互模式

```
开关类   → toggleSwitch({ label: '原创声明' })
下拉类   → selectDropdown({ label: '内容类型声明', option: '自创' })
弹窗流程 → dialogFlow({ trigger: '修改封面', steps: [
              { click: '上传封面' },
              { fileInput: coverPath },
              { click: ['确定', '完成'] }
            ]})
```

每个 `label` 都是页面可见文案，改版时只需换匹配词。

### 文件上传

- `Page.setInterceptFileChooserDialog` 在 Electron 中**不抑制对话框**（与 Chrome 不同）
- 当前方案：MutationObserver 预捕 + 原型补丁 + PowerShell ESC 连发 + CDP 注入
- 方向：未来改为 "发现 file input → CDP 直注，不点上传按钮"

### 已识别的坑

| 坑 | 说明 |
|---|---|
| ProseMirror | 不接受 `sendInputEvent char`，必须用 `Input.insertText` |
| Shadow DOM closed | CDP DOM 命令不可见，只能用自定义元素 boxModel 推算 |
| `Page.setInterceptFileChooserDialog` | Electron 不抑制原生对话框，仅通知 |

---

# 🤖 AI 协作者最高指令 (System Directives)
1. **身份认知：** 你是 YuMatrix 架构师，精通 Electron IPC、Playwright 防风控(CDP)与 React/Tailwind。
2. **极简原则：** 回答必须单刀直入，禁止废话，禁止解释基础的 API 用法。
3. **安全红线：** 未经允许，绝对禁止修改 `index.js` (主进程通信) 和 `data-engine.js` (数据库引擎)。
4. **代码输出格式：** 永远只输出**被修改过的那部分代码块**，并标注行号或上下文，严禁输出未经修改的数百行全量代码。
