# 04_MODULE_SPEC (V1)

## 1. 模块规范总览

### 1.1 模块目录结构
```
src/modules/
├── {module-name}/
│   ├── index.js          # 模块入口和服务类
│   ├── repository/       # 数据访问层
│   │   └── {Module}Repository.js
│   ├── service/          # 业务逻辑层
│   │   └── {Module}Service.js
│   ├── dto/              # 数据传输对象
│   │   └── {Module}DTO.js
│   ├── validator/        # 数据验证器
│   │   └── {Module}Validator.js
│   └── types/            # 模块特定类型定义
│       └── index.js
```

### 1.2 模块接口规范
所有模块必须实现以下接口：

```javascript
export class ModuleInterface {
  // 模块初始化
  async initialize(context) {}
  
  // 获取模块信息
  getInfo() {
    return {
      name: '',
      version: '1.0.0',
      description: ''
    };
  }
  
  // 清理资源
  async cleanup() {}
}
```

## 2. 核心模块规范

### 2.1 Accounts 模块

#### 2.1.1 目录结构
```
src/modules/accounts/
├── index.js
├── repository/
│   └── AccountRepository.js
├── service/
│   └── AccountService.js
├── dto/
│   ├── CreateAccountDTO.js
│   ├── UpdateAccountDTO.js
│   └── AccountStatsDTO.js
└── validator/
    └── AccountValidator.js
```

#### 2.1.2 核心接口
```javascript
// AccountService.js
class AccountService {
  // 账号管理
  async createAccount(data) {}
  async getAccountById(id) {}
  async updateAccount(id, data) {}
  async deleteAccount(id) {}
  async getAllAccounts() {}
  
  // 账号状态
  async updateAccountStatus(id, status) {}
  async checkAccountStatus(id) {}
  
  // 账号统计
  async getAccountStats(id) {}
  async syncAccountStats(id, platform) {}
  
  // 账号分组
  async updateAccountGroup(id, group) {}
  
  // 账号别名
  async updateAccountAlias(id, alias) {}
}
```

### 2.2 Publish 模块

#### 2.2.1 目录结构
```
src/modules/publish/
├── index.js
├── repository/
│   └── PublishRepository.js
├── service/
│   └── PublishService.js
├── dto/
│   ├── CreateVideoDTO.js
│   ├── UpdateVideoDTO.js
│   └── PublishTaskDTO.js
└── validator/
    └── PublishValidator.js
```

#### 2.2.2 核心接口
```javascript
// PublishService.js
class PublishService {
  // 视频管理
  async createVideo(data) {}
  async getVideoById(id) {}
  async updateVideo(id, data) {}
  async deleteVideo(id) {}
  async getVideosByAccountId(accountId) {}
  
  // 发布任务
  async createPublishTask(data) {}
  async getPublishTaskById(id) {}
  async updatePublishTask(id, data) {}
  async deletePublishTask(id) {}
  async executePublishTask(taskId) {}
  
  // 发布统计
  async getPublishStats(accountId) {}
  async getVideoMetrics(videoId) {}
  
  // 任务队列
  async getTaskQueue() {}
  async pauseTaskQueue() {}
  async resumeTaskQueue() {}
}
```

### 2.3 Analytics 模块

#### 2.3.1 目录结构
```
src/modules/analytics/
├── index.js
├── repository/
│   └── AnalyticsRepository.js
├── service/
│   └── AnalyticsService.js
├── dto/
│   ├── MessageDTO.js
│   ├── StatsDTO.js
│   └── ReportDTO.js
└── validator/
    └── AnalyticsValidator.js
```

#### 2.3.2 核心接口
```javascript
// AnalyticsService.js
class AnalyticsService {
  // 消息管理
  async getMessages() {}
  async getMessageById(id) {}
  async createMessage(data) {}
  async updateMessage(id, data) {}
  async deleteMessage(id) {}
  
  // 统计数据
  async getPlatformStats() {}
  async getAccountStats(accountId) {}
  async getDailyStats(date) {}
  
  // 报表生成
  async generateReport(options) {}
  async exportReport(format) {}
  
  // 实时监控
  async getRealTimeData() {}
  async subscribeToUpdates(callback) {}
}
```

### 2.4 Media 模块

#### 2.4.1 目录结构
```
src/modules/media/
├── index.js
├── repository/
│   └── MediaRepository.js
├── service/
│   └── MediaService.js
├── dto/
│   ├── UploadMediaDTO.js
│   ├── MediaFileDTO.js
│   └── CoverDTO.js
└── validator/
    └── MediaValidator.js
```

#### 2.4.2 核心接口
```javascript
// MediaService.js
class MediaService {
  // 媒体文件管理
  async uploadMedia(file, options) {}
  async getMediaById(id) {}
  async deleteMedia(id) {}
  async getMediaList(filters) {}
  
  // 封面管理
  async saveCover(data) {}
  async getCoverById(id) {}
  async deleteCover(id) {}
  
  // 媒体处理
  async processMedia(fileId, operations) {}
  async generateThumbnail(fileId) {}
  
  // 存储管理
  async getStorageStats() {}
  async cleanupOldFiles() {}
}
```

### 2.5 Settings 模块

#### 2.5.1 目录结构
```
src/modules/settings/
├── index.js
├── repository/
│   └── SettingsRepository.js
├── service/
│   └── SettingsService.js
├── dto/
│   ├── AppSettingsDTO.js
│   ├── UserSettingsDTO.js
│   └── SystemSettingsDTO.js
└── validator/
    └── SettingsValidator.js
```

#### 2.5.2 核心接口
```javascript
// SettingsService.js
class SettingsService {
  // 应用设置
  async getAppSettings() {}
  async updateAppSettings(data) {}
  
  // 用户设置
  async getUserSettings(userId) {}
  async updateUserSettings(userId, data) {}
  
  // 系统设置
  async getSystemSettings() {}
  async updateSystemSettings(data) {}
  
  // 设置验证
  async validateSettings(data) {}
  
  // 设置导出/导入
  async exportSettings() {}
  async importSettings(data) {}
}
```

### 2.6 Email 模块

#### 2.6.1 目录结构
```
src/modules/email/
├── index.js
├── repository/
│   └── EmailRepository.js
├── service/
│   └── EmailService.js
├── dto/
│   ├── EmailAccountDTO.js
│   ├── EmailMessageDTO.js
│   └── EmailDraftDTO.js
└── validator/
    └── EmailValidator.js
```

#### 2.6.2 核心接口
```javascript
// EmailService.js
class EmailService {
  // 邮箱账户管理
  async addEmailAccount(data) {}
  async getEmailAccountById(id) {}
  async updateEmailAccount(id, data) {}
  async deleteEmailAccount(id) {}
  async getAllEmailAccounts() {}
  
  // 邮件收发
  async fetchEmails(accountId, folder) {}
  async getEmailById(accountId, messageId) {}
  async sendEmail(data) {}
  async deleteEmail(accountId, messageId) {}
  
  // 邮件操作
  async markEmailAsRead(accountId, messageId) {}
  async markEmailAsUnread(accountId, messageId) {}
  async starEmail(accountId, messageId) {}
  
  // 草稿管理
  async createDraft(data) {}
  async updateDraft(id, data) {}
  async deleteDraft(id) {}
  async getDrafts(accountId) {}
  
  // 文件夹管理
  async getFolders(accountId) {}
  async createFolder(accountId, name) {}
}
```

## 3. 模块间通信规范

### 3.1 事件总线通信
```javascript
// 使用 core/event-bus 进行模块间通信
import eventBus from '@/core/event-bus';

// 发布事件
eventBus.emit('account:created', { accountId: 123 });

// 订阅事件
eventBus.on('account:created', (data) => {
  console.log('New account created:', data.accountId);
});
```

### 3.2 服务依赖注入
```javascript
// 通过 core/container 进行服务注入
import container from '@/core/container';

// 获取服务实例
const accountService = container.get('AccountService');
const publishService = container.get('PublishService');
```

## 4. 数据流规范

### 4.1 标准数据流
```
UI/IPC → Module Service → Repository → Database
    ↑         ↓              ↑
    └───── DTO/VO ←─────── Entity
```

### 4.2 错误处理
```javascript
// 统一错误处理
class ModuleError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// 业务异常
class BusinessError extends ModuleError {}
class ValidationError extends ModuleError {}
class NotFoundError extends ModuleError {}
```

## 5. 安全规范

### 5.1 数据验证
```javascript
// 使用 validator 进行数据验证
import { AccountValidator } from './validator/AccountValidator';

const validator = new AccountValidator();
const errors = validator.validate(accountData);
if (errors.length > 0) {
  throw new ValidationError('Invalid account data', errors);
}
```

### 5.2 权限控制
```javascript
// 权限检查
class AccountService {
  async updateAccount(userId, accountId, data) {
    // 检查用户是否有权限修改此账号
    if (!await this.hasPermission(userId, accountId)) {
      throw new PermissionError('Insufficient permissions');
    }
    
    // 执行更新操作
    return await this.repository.update(accountId, data);
  }
}
```

## 6. 性能规范

### 6.1 缓存策略
```javascript
// 使用 core/cache 进行数据缓存
import cache from '@/core/cache';

class AccountService {
  async getAccountById(id) {
    // 尝试从缓存获取
    const cached = await cache.get(`account:${id}`);
    if (cached) return cached;
    
    // 从数据库获取
    const account = await this.repository.findById(id);
    
    // 缓存结果
    await cache.set(`account:${id}`, account, 300); // 5分钟缓存
    
    return account;
  }
}
```

### 6.2 批量操作
```javascript
// 支持批量操作以提高性能
class AccountService {
  async batchUpdate(accounts) {
    return await this.repository.batchUpdate(accounts);
  }
  
  async batchDelete(accountIds) {
    return await this.repository.batchDelete(accountIds);
  }
}
```

## 7. 测试规范

### 7.1 单元测试
```javascript
// 每个模块必须包含单元测试
// tests/modules/accounts/
├── AccountService.test.js
├── AccountRepository.test.js
└── AccountValidator.test.js
```

### 7.2 集成测试
```javascript
// 集成测试确保模块间协作正常
// tests/integration/
├── account-publish.test.js
├── email-notification.test.js
└── analytics-report.test.js
```

## 8. 文档规范

### 8.1 API 文档
每个模块必须提供完整的 API 文档：
- 接口定义
- 参数说明
- 返回值格式
- 错误码说明

### 8.2 使用示例
提供典型使用场景的代码示例：
- 基本操作
- 高级功能
- 错误处理