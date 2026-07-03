# ARCHITECTURE.md (V2.0)

Version: 2.0  
Status: Active  
Milestone: M1 - Engineering Foundation  
Project: YuMatrix Studio  

---

# 1. Vision（项目愿景）

YuMatrix Studio 是一个：

> AI Native Automation Operating System（AI 原生自动化操作系统）

它不是：

- ❌ Electron 应用
- ❌ AI 工具集合
- ❌ RPA 脚本集合

它是：

> 一个运行在桌面端的“可编程操作系统层”

---

## 核心能力

- AI 内容生产（文本 / 图片 / 视频）
- 多平台内容发布（小红书 / 抖音 / B站等）
- RPA 自动化执行引擎
- 多账号系统
- 数据分析与增长系统
- 可扩展插件平台（Platform SDK）

---

# 2. Design Philosophy（设计哲学）

## 2.1 Separation of Concerns（关注点分离）

系统必须严格分层：

- UI 不处理业务逻辑  
- 业务不处理基础设施  
- 基础设施不处理业务规则  

---

## 2.2 Stability over Speed（稳定优先）

任何变更必须：

- 可回滚
- 可验证
- 不破坏现有功能

---

## 2.3 Plugin-First Architecture（插件优先）

所有扩展必须通过插件实现：

- Platform Plugin
- AI Provider Plugin
- RPA Script Plugin

禁止硬编码扩展逻辑

---

## 2.4 Deterministic Data Flow（确定性数据流）

数据流必须单向：

UI → IPC → Module → Core → Infrastructure

禁止反向调用

---

# 3. Core Principles（核心原则）

Core 层是整个系统的稳定内核：

## Core 包含：

- ai
- database
- ipc
- config
- logger
- event-bus
- security

## Core 禁止：

- ❌ 业务逻辑
- ❌ UI 依赖
- ❌ Platform 逻辑

Core = Stable Runtime Layer

---

# 4. System Overview（系统总览）

```

Renderer (UI Layer)
↓
IPC Gateway
↓
Modules Layer
↓
Core Layer
↓
Infrastructure

````

---

# 5. Architecture Layers（架构分层）

## 5.1 UI Layer (Renderer)

- React UI
- 仅负责展示与用户输入
- 不允许直接调用系统资源

---

## 5.2 Module Layer

业务模块：

- accounts
- publish
- ai-hub
- media
- analytics
- email
- settings
- workspace

特点：

- 独立演进
- 不允许跨模块调用
- 只能通过 Core 通信

---

## 5.3 Core Layer

系统基础能力：

- IPC
- Database
- AI Gateway
- Logger
- Event Bus
- Security

---

## 5.4 Platform Layer

所有外部平台：

- Xiaohongshu
- Douyin
- Bilibili
- TikTok (future)
- Instagram (future)

必须实现：

```ts
interface PlatformAdapter {
  initialize(): void
  login(): Promise<void>
  logout(): Promise<void>

  publish(content: any): Promise<void>
  uploadMedia(file: any): Promise<string>

  fetchStats(): Promise<any>
  checkSession(): Promise<boolean>

  getCapabilities(): string[]
}
````

---

## Capability-based Design（能力驱动）

禁止：

```js
if (platform === "xiaohongshu")
```

必须：

```js
if (adapter.supports("video-upload"))
```

---

# 6. RPA Layer（自动化引擎）

RPA 负责自动化执行：

## Pipeline：

Task Queue → Scheduler → Executor → Browser Engine → Script Runner

## Task States：

* PENDING
* RUNNING
* SUCCESS
* FAILED
* CANCELLED

---

# 7. AI Architecture

## AI Flow：

User → AI Hub → Router → Provider → Model API

支持：

* OpenAI
* Claude
* DeepSeek
* Gemini

---

## AI 原则：

* 统一入口（AI Hub）
* 不允许业务直接调用模型 API
* 所有 AI 请求必须可追踪

---

# 8. Engineering Governance（工程治理）

## 标准开发流程：

Architecture → Plan → Implementation → Review → Merge

---

## 职责划分：

* Architecture Owner → ChatGPT
* Implementation → Claude
* Product Decision → Project Owner

---

# 9. Module Rules（模块规则）

所有模块必须：

* 单一职责
* 不跨模块调用
* 不访问 UI
* 不直接访问数据库
* 只依赖 Core

---

# 10. Platform Rules（平台规则）

禁止：

* 平台之间互相调用
* 平台访问 Renderer
* 平台访问 Database

必须：

* 使用 PlatformAdapter
* 使用 Capability System
* 通过 Registry 管理

---

# 11. Data Flow（数据流）

标准数据流：

UI
↓
IPC
↓
Module
↓
Core
↓
Infrastructure

---

禁止：

* UI 直接访问 DB
* RPA 直接操作 UI
* Platform 直接调用 Module

---

# 12. Documentation Map

* ARCHITECTURE.md → 系统宪法
* MODULE_SPEC.md → 模块设计
* PLATFORM_SDK.md → 插件系统
* IPC_SPEC.md → 通信规范
* DATABASE_SPEC.md → 数据规范

---

# 13. Roadmap

## Milestones：

* M1: Engineering Foundation (current)
* M2: Platform SDK
* M3: AI Hub
* M4: RPA Engine
* M5: Workflow System
* M6: Cloud Sync
* M7: Plugin Marketplace

---

# 14. Final Rule（最高原则）

> If something is not in Architecture, it does not exist.

任何实现必须遵守本架构文档。
