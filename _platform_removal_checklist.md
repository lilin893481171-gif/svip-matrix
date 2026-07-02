# 平台移除清单

**生成时间**: 2026-06-30
**目标平台**: 小红书、抖音、快手、百家号、微信视频号、B站

---

## 📊 文件统计总览

| 平台 | RPA脚本 | 适配器 | 平台定义 | 同步逻辑 | UI组件 | 其他引用 |
|------|---------|--------|----------|----------|--------|----------|
| 小红书 | 2 | 1 | 1 | 1 | 多处 | 多处 |
| B站 | 1 | 1 | 0 | 1 | 多处 | 多处 |
| 抖音 | 1 | 1 | 1 | 1 | 多处 | 多处 |
| 快手 | 1 | 0 | 1 | 1 | 多处 | 多处 |
| 百家号 | 1 | 0 | 1 | 1 | 多处 | 多处 |
| 微信视频号 | 1 | 1 | 0 | 1 | 多处 | 多处 |

---

## 🗂️ 核心文件清单

### 1️⃣ RPA 脚本文件（resources/rpa-scripts/）

#### 小红书
- ✅ `resources/rpa-scripts/xiaohongshu.mjs` - **主脚本 v23**
- ⚠️ `resources/rpa-scripts/xiaohongshu-playwright.mjs` - Playwright 实验版本
- 📄 `resources/rpa-scripts/manifest.json` - 脚本清单配置

#### B站
- ✅ `resources/rpa-scripts/bilibili.mjs` - B站上传脚本

#### 抖音
- ✅ `resources/rpa-scripts/douyin.mjs` - 抖音发布脚本

#### 快手
- ✅ `resources/rpa-scripts/kuaishou.mjs` - 快手发布脚本

#### 百家号
- ✅ `resources/rpa-scripts/baijiahao.mjs` - 百家号发布脚本

#### 微信视频号
- ✅ `resources/rpa-scripts/wechat-channels.mjs` - 微信视频号脚本

---

### 2️⃣ RPA 适配器（src/main/rpa/adapters/）

- ✅ `src/main/rpa/adapters/xiaohongshu-adapter.js`
- ✅ `src/main/rpa/adapters/bilibili-adapter.js`
- ✅ `src/main/rpa/adapters/douyin-adapter.js`
- ⚠️ `src/main/rpa/adapters/wechat-channels-adapter.js`
- ❌ 快手/百家号无适配器（未实现）

---

### 3️⃣ 平台定义文件（src/main/platforms/）

- ✅ `src/main/platforms/xiaohongshu.js`
- ✅ `src/main/platforms/douyin.js`
- ✅ `src/main/platforms/kuaishou.js`
- ✅ `src/main/platforms/baijiahao.js`
- ✅ `src/main/platforms/weixin.js`
- ❌ B站无平台定义文件（直接使用适配器）

---

### 4️⃣ 数据同步逻辑（src/main/sync/）

- ✅ `src/main/sync/xiaohongshu.js`
- ✅ `src/main/sync/bilibili.js`
- ✅ `src/main/sync/douyin.js`
- ✅ `src/main/sync/kuaishou.js`
- ✅ `src/main/sync/baijiahao.js`
- ✅ `src/main/sync/wechat-channels.js`

---

### 5️⃣ 特殊功能模块

#### 小红书专用
- 🔧 `src/main/xhs-session-keeper.mjs` - Session 保活模块
- 📊 `resources/rpa-scripts/har_parser.py` - HAR 解析工具

---

## 🔗 引用关系分析

### 高频引用文件（需要重点处理）

#### 核心引擎文件
1. **src/main/index.js** - 主进程入口，注册所有平台
2. **src/main/rpa-engine.js** - RPA 引擎核心，脚本加载逻辑
3. **src/main/browser-manager.js** - 浏览器管理器，平台检测
4. **src/main/account-browser-manager.js** - 账号浏览器映射

#### 数据层
5. **src/main/data-engine.js** - 数据引擎，平台数据路由
6. **src/main/data-sync.js** - 数据同步总控
7. **src/main/session-store.js** - Session 存储

#### UI 组件
8. **src/renderer/src/App.jsx** - 路由配置，平台视图
9. **src/renderer/src/components/AccountManagerView.jsx** - 账号管理 UI
10. **src/renderer/src/components/ProtocolAggregator.jsx** - 协议聚合器

---

## 🏗️ 构建产物（可安全删除）

### dist/ 目录
- `dist/win-unpacked/resources/rpa-scripts/*.mjs`
- `dist/win-unpacked/resources/app.asar.unpacked/resources/rpa-scripts/*.mjs`

### out/ 目录
- `out/main/xiaohongshu-*.js`
- `out/main/douyin-*.js`
- `out/main/kuaishou-*.js`
- `out/main/baijiahao-*.js`
- `out/main/weixin-*.js`

---

## 🧪 测试/调试文件（建议归档）

### 根目录测试脚本
- `test-xhs-publish.js`
- `simulate `test-publish.js`
- `verify-xhs-script.cjs`
- `test-v20-script.cjs`
- `final-verification.cjs`
- `update-xhs-selectors.cjs`
- `verify-xhs-fix.cjs`

### _archive_trash/ 归档文件
- `xiaohongshu-api.mjs`
- `debug-xiaohongshu.cjs`
- `fix-xiaohongshu-publish.cjs`
- 多个历史修复脚本

---

## ⚠️ 风险评估

### 高风险区域

#### 1. 主进程入口（src/main/index.js）
- **风险**: 平台注册逻辑可能硬编码
- **建议**: 需要逐行检查平台初始化代码

#### 2. RPA 引擎（src/main/rpa-engine.js）
- **风险**: 脚本加载器可能依赖平台标识
- **建议**: 抽象平台无关的脚本执行框架

#### 3. 浏览器管理器（src/main/browser-manager.js）
- **风险**: 平台检测逻辑耦合
- **建议**: 重构为插件式平台注册表

#### 4. 数据引擎（src/main/data-engine.js）
- **风险**: 数据路由可能硬编码平台名
- **建议**: 改为配置驱动

---

## 🎯 移除策略建议

### 方案 A：激进移除（不推荐）
- 直接删除所有平台文件
- 批量注释掉引用代码
- **风险**: 破坏核心架构，难以维护

### 方案 B：渐进式重构（推荐）
1. **Phase 1**: 创建平台注册表抽象层
2. **Phase 2**: 迁移现有平台到插件架构
3. **Phase 3**: 移除不需要的平台插件
4. **Phase 4**: 清理遗留代码

### 方案 C：隔离保留（折中）
- 将平台代码移至 `src/main/platforms-legacy/`
- 标记为废弃但保留引用
- 新架构重新实现

---

## 📋 推荐行动步骤

### Step 1: 备份当前状态
```bash
git add .
git commit -m "chore: 平台移除前备份"
git checkout -b feature/platform-cleanup
```

### Step 2: 清理构建产物
- 删除 `dist/` 和 `out/` 目录中的平台文件
- 清理测试脚本到 `_archive_trash/`

### Step 3: 设计新架构
- 定义平台插件接口
- 设计平台注册表
- 规划数据流抽象

### Step 4: 实施重构
- 先实现框架
- 再逐步迁移（或移除）平台

---

## 💡 重构方向建议

### 插件式架构
```javascript
// src/main/platforms/PlatformInterface.js
class
  async publish(content) { throw new Error('Not implemented') }
  async getAccountInfo() { throw new Error('Not implemented') }
  async syncData() { throw new Error('Not implemented') }
}

// src/main/PlatformRegistry.js
class PlatformRegistry {
  static platforms = new Map()

  static register(name, platform) {
    this.platforms.set(name, platform)
  }

  static get(name) {
    return this.platforms.get(name)
  }
}
```

### 配置驱动
```json
// config/platforms.json
{
  "enabled": ["youtube", "tiktok"],
  "disabled": ["xiaohongshu", "bilibili"]
}
```

---

## ✅ 决策点

**请选择移除策略**:

- [ ] **方案 A**: 直接删除所有平台文件
- [ ] **方案 B**: 先重构架构，再移除平台（推荐）
- [ ] **方案 C**: 隔离保留，重新实现
- [ ] **自定义**: 需要讨论具体方案

**下一步行动**:
1. 确认移除策略
2. 创建功能分支
3. 开始执行清理/重构
