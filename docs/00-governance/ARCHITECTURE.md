📘 03_TARGET_ARCHITECTURE.md（V1）
1. 项目愿景（Vision）

YuMatrix Studio 是一个：

AI + RPA 驱动的多平台内容运营与自动化生产平台

它不是一个 Electron 应用，而是一个运行在 Electron 之上的“桌面级操作系统”。

核心能力：

AI 内容生产（文本 / 图像 / 视频）
多平台发布（小红书 / 抖音 / B站等）
自动化 RPA 执行
多账号管理
数据分析与增长系统
邮件与消息系统
2. 架构原则（Architecture Principles）
2.1 分层优先于技术

禁止按 Electron 结构设计代码。

正确方式：

Application Layer
Business Layer
Core Layer
Infrastructure Layer
2.2 Core 永远稳定

core 只能包含：

ai
database
ipc
config
logger
event-bus
security

❌ 不允许业务代码进入 core

2.3 所有业务必须模块化

业务必须进入：

modules/

例如：

accounts
publish
ai-hub
interaction
analytics
email
2.4 平台必须插件化

所有平台必须：

platforms/

且必须实现统一接口：

PlatformAdapter
2.5 RPA 必须独立运行

RPA 不允许依赖 UI：

UI 只能发送任务
RPA 自己调度执行
状态通过 event-bus 回传
3. 总体架构（Architecture Overview）
                ┌──────────────┐
                │   Renderer   │
                └──────┬───────┘
                       │ IPC
                       ▼
                ┌──────────────┐
                │     Core     │
                │ (Stable API) │
                └──────┬───────┘
                       │
      ┌───────────────┼───────────────┐
      ▼               ▼               ▼
  Modules        Platforms          RPA Engine
      │               │               │
      └───────────────┼───────────────┘
                      ▼
                Infrastructure
4. 目标目录结构（Target Structure）
src/
│
├── app/                      # Electron 启动入口
│
├── core/                     # 核心系统（稳定层）
│   ├── ai/
│   ├── database/
│   ├── ipc/
│   ├── logger/
│   ├── config/
│   ├── event-bus/
│   └── security/
│
├── modules/                  # 业务模块
│   ├── accounts/
│   ├── publish/
│   ├── ai-hub/
│   ├── interaction/
│   ├── analytics/
│   ├── email/
│   ├── media/
│   └── settings/
│
├── platforms/               # 平台插件系统
│   ├── xiaohongshu/
│   ├── douyin/
│   ├── bilibili/
│   ├── kuaishou/
│   └── base/
│
├── rpa/                     # 自动化引擎
│   ├── scheduler/
│   ├── executor/
│   ├── browser/
│   ├── state-machine/
│   └── scripts/
│
├── shared/                  # 共享代码
│   ├── ui/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── constants/
│
└── renderer/                # UI 层（React）
5. 数据流规范（Data Flow）

所有数据必须遵守：

UI
 ↓
IPC
 ↓
Module Service
 ↓
Repository
 ↓
Database

❌ 禁止：

Renderer 直接访问 DB
Platform 直接调用 UI
RPA 直接操作 React state
6. AI 架构（AI Architecture）

AI 必须统一入口：

AI Hub
  ↓
AI Router
  ↓
Provider Layer
  ↓
Model APIs

支持：

OpenAI
Claude
DeepSeek
Gemini

统一接口：

AIProvider.generate()
7. RPA 架构（RPA Architecture）
Task Queue
   ↓
Scheduler
   ↓
Executor
   ↓
Browser Engine
   ↓
Platform Script
   ↓
Result Handler

状态机：

PENDING
RUNNING
SUCCESS
FAILED
CANCELLED
8. Platform 插件规范

每个平台必须实现：

interface PlatformAdapter {
  login()
  publish()
  upload()
  fetchStats()
}

禁止：

直接访问 core DB
直接调用 renderer
平台之间互相依赖
9. IPC 规范

所有通信必须：

Renderer → IPC → Core Service

禁止：

Renderer 直接调用 Node API
Renderer 访问 file system
10. 安全原则

必须：

IPC 白名单
数据加密存储
Browser session isolation
RPA sandbox execution
11. 日志与错误系统

统一：

Logger.info()
Logger.warn()
Logger.error()

所有模块必须接入 core logger。

12. 开发原则（最重要）
❌ 禁止
跨模块引用
UI 访问数据库
RPA 控制 UI
AI 直接操作平台
随意新增目录
✅ 必须
所有功能模块化
所有依赖单向
所有业务通过 Core
所有扩展通过插件
13. Sprint Roadmap（总规划）
Sprint 0  工程整理
Sprint 1  Core 重构
Sprint 2  Database 重构
Sprint 3  IPC 重构
Sprint 4  Platform SDK
Sprint 5  RPA Engine
Sprint 6  AI Hub
Sprint 7  Modules 重构
Sprint 8  Renderer 重构
Sprint 9  测试体系
Sprint 10 性能优化
Sprint 11 插件生态
Sprint 12 发布系统