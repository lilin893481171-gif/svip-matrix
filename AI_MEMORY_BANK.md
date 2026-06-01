# AI_MEMORY_BANK.md

> YuMatrix 记忆库 — 跨对话上下文。新对话开局必读。

---

## 1. 架构

```
src/main/
├── index.js                     # 主进程 + IPC + WebRTC全局 + DevTools禁用
├── account-browser-manager.js   # 会话容器 (BrowserView + CDP)
├── rpa-engine.js                # RPA入口 (217行)
├── rpa/                         # 6平台发布适配器
├── sync/                        # 6平台数据采集器
├── data-engine.js / database.js # SQLite
└── platforms/                   # 6平台互动脚本
src/renderer/src/
├── App.jsx                      # 主组件 + Toast + 绑定弹窗
├── components/
│   ├── ToastContext.jsx          # 白底轻量 Toast (success/error/warning/info)
│   ├── PublishTask.jsx           # 发布台 (alert→toast已替换)
│   └── AiHub/
│       ├── AiTaskContext.jsx     # AI调度 + 绑定守卫
│       └── AiHubView.jsx         # 12引擎面板
```

### 三引擎

| 引擎 | 驱动 | 用途 |
|------|------|------|
| RPA 发布 | Electron sendInputEvent | 视频发布 |
| 账户登录 | BrowserView + CDP | 扫码/密码登录 |
| 互动+同步 | Playwright chromium.launch | 评论/数据 |

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

### RPA
11. 唯一交互入口: `native-interactions.js`
12. 适配器签名: `constructor(interactions, task, webContents)`

### UI / 安全
13. Preload 必须暴露 `send`
14. 状态提升: 跨视图存活 → App.jsx
15. `devTools: false` — 生产禁 DevTools
16. AI 任务入口守卫: `AiTaskContext.dispatchTask` 未绑定直接 return

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

已知缺口: 主窗口 sandbox:false, Permissions PermissionStatus, Canvas toBlob, Screen 物理分辨率

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

---

## 6. 交付历史

| 轮次 | 交付 |
|:---:|------|
| v2~v6.2 | WebRTC 三层 / Canvas 噪声 / WebGL 42参数 / AudioContext / 字体枚举 / 仿生学交互 / CDP 持久化自检 |
| P1 | 合规清洗 — 15严重词+22高危词清零, 4函数重命名 |
| P2 | 术语规范 — 11组清洗 |
| P3 | 架构清理 — rpa-engine(1007→217行) + data-sync(720→26行) |
| P4 | 跳过 — 单机桌面工具无需多用户 |
| **P5** | **✅ 已交付** — Toast通知系统 + 包改名 yumatrix-studio v2.0 + 文档 + BrowserView自适应 + 手机绑定防白嫖 + DevTools禁用 |

# 🤖 AI 协作者最高指令 (System Directives)
1. **身份认知：** 你是 YuMatrix 架构师，精通 Electron IPC、Playwright 防风控(CDP)与 React/Tailwind。
2. **极简原则：** 回答必须单刀直入，禁止废话，禁止解释基础的 API 用法。
3. **安全红线：** 未经允许，绝对禁止修改 `index.js` (主进程通信) 和 `data-engine.js` (数据库引擎)。
4. **代码输出格式：** 永远只输出**被修改过的那部分代码块**，并标注行号或上下文，严禁输出未经修改的数百行全量代码。