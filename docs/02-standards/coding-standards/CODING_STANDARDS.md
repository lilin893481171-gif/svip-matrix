# Coding Standards

## 1. General Principles

### 1.1 Architecture Compliance
- All code MUST comply with the target architecture defined in `docs/01-architecture/TARGET_ARCHITECTURE.md`
- Module boundaries MUST be strictly respected
- Core services MUST NOT contain business logic
- Platform adapters MUST implement the standard interface

### 1.2 Code Quality
- Write clean, readable, and maintainable code
- Follow the Single Responsibility Principle
- Prefer composition over inheritance
- Favor immutability where possible
- Use meaningful names for variables, functions, and classes

## 2. Language-Specific Standards

### 2.1 JavaScript/Node.js Standards

#### 2.1.1 Syntax and Style
- Use modern ES6+ features (async/await, destructuring, arrow functions)
- Use `const` and `let` instead of `var`
- Use template literals for string interpolation
- Use object and array destructuring for cleaner code
- Use spread operator for object and array manipulation

#### 2.1.2 Module System
- Use ES modules (`import`/`export`) consistently
- Prefer named exports over default exports
- Organize imports in logical groups (external, core, modules, local)
- Use absolute imports when referencing core or module services

#### 2.1.3 Error Handling
- Always handle promises with `async/await` and `try/catch`
- Create custom error classes that extend the built-in Error class
- Provide meaningful error messages with context
- Log errors appropriately using the core logger

#### 2.1.4 Asynchronous Programming
- Use `async/await` instead of callbacks
- Avoid mixing `async/await` with `.then()/.catch()`
- Handle promise rejections properly
- Use `Promise.all()` for parallel operations when appropriate

### 2.2 File Structure and Naming

#### 2.2.1 Directory Structure
```
src/
├── core/
│   ├── ai/
│   ├── database/
│   ├── ipc/
│   ├── logger/
│   ├── config/
│   ├── event-bus/
│   └── security/
├── modules/
│   ├── accounts/
│   ├── publish/
│   ├── ai-hub/
│   ├── interaction/
│   ├── analytics/
│   ├── email/
│   ├── media/
│   └── settings/
├── platforms/
│   ├── xiaohongshu/
│   ├── douyin/
│   ├── bilibili/
│   ├── kuaishou/
│   └── base/
├── rpa/
│   ├── scheduler/
│   ├── executor/
│   ├── browser/
│   ├── state-machine/
│   └── scripts/
├── shared/
│   ├── ui/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── constants/
└── renderer/
```

#### 2.2.2 File Naming
- Use kebab-case for file names (e.g., `account-service.js`)
- Use PascalCase for class names (e.g., `AccountService`)
- Use camelCase for function and variable names (e.g., `getUserById`)
- Use UPPER_SNAKE_CASE for constants (e.g., `MAX_RETRY_COUNT`)

#### 2.2.3 Module Structure
Each module should follow this structure:
```
{module-name}/
├── index.js          # Module entry point
├── repository/       # Data access layer
│   └── {Module}Repository.js
├── service/          # Business logic layer
│   └── {Module}Service.js
├── dto/              # Data transfer objects
│   └── {Module}DTO.js
└── validator/        # Data validators
    └── {Module}Validator.js
```

## 3. Core Service Standards

### 3.1 Service Interface
All core services must follow a consistent interface pattern:

```javascript
export class CoreService {
  constructor() {
    // Initialize service
  }

  // Public API methods
  async initialize() {
    // Setup service
  }

  async cleanup() {
    // Cleanup resources
  }

  // Service-specific methods
  // ...
}
```

### 3.2 Dependency Injection
- Core services should be registered in the dependency container
- Services should receive dependencies through constructor injection
- Avoid circular dependencies between core services

### 3.3 Event Communication
- Use the core event bus for inter-service communication
- Follow the naming convention: `{domain}.{action}.{status}`
- Include relevant context data in event payloads

## 4. Module Standards

### 4.1 Module Interface
All modules must implement the standard module interface:

```javascript
export class ModuleInterface {
  // Module initialization
  async initialize(context) {}

  // Get module information
  getInfo() {
    return {
      name: '',
      version: '1.0.0',
      description: ''
    };
  }

  // Cleanup resources
  async cleanup() {}
}
```

### 4.2 Service Layer
- Business logic should be encapsulated in service classes
- Services should be stateless where possible
- Services should use repositories for data access
- Services should validate input data using validators

### 4.3 Repository Layer
- Repositories should handle all database operations
- Repositories should return domain entities or DTOs
- Repositories should not contain business logic
- Repositories should handle transactions when necessary

### 4.4 Data Transfer Objects (DTOs)
- Use DTOs for data transfer between layers
- DTOs should be validated before processing
- DTOs should be immutable where possible
- DTOs should be clearly documented

## 5. Platform Adapter Standards

### 5.1 Adapter Interface
All platform adapters must implement the standard interface:

```javascript
export class PlatformAdapter {
  async login() {}
  async logout() {}
  async publish(content) {}
  async uploadMedia(file) {}
  async fetchStatistics(query) {}
  async refreshSession() {}
}
```

### 5.2 Isolation Requirements
- Platform adapters must be fully isolated
- No shared state between different platform adapters
- No direct access to other modules or core services except allowed ones
- All communication should go through the event bus

### 5.3 Error Handling
- Platform-specific errors should be normalized
- Errors should include platform identification
- Retryable errors should be clearly marked
- Error messages should be informative but not expose sensitive data

## 6. RPA Standards

### 6.1 Task Management
- All RPA tasks should follow the standard task lifecycle
- Tasks should be queued and processed by the scheduler
- Task state should be persisted and trackable
- Failed tasks should support retry mechanisms

### 6.2 Browser Automation
- Browser sessions should be isolated per task
- Browser state should not leak between tasks
- Browser automation should be deterministic
- Browser resources should be properly cleaned up

### 6.3 Script Execution
- Platform scripts should be versioned
- Scripts should be tested and validated
- Script errors should be handled gracefully
- Script execution should be monitored and logged

## 7. AI Standards

### 7.1 Provider Interface
All AI providers must implement the standard interface:

```javascript
export class AIProvider {
  async generate(prompt) {}
  async stream(prompt) {}
  async embed(input) {}
}
```

### 7.2 Prompt Management
- Prompts should be versioned and documented
- Prompt templates should be reusable
- Prompt engineering should follow best practices
- Sensitive data should be handled securely in prompts

### 7.3 Response Handling
- AI responses should be validated and sanitized
- Streaming responses should be handled properly
- Tool calling should be implemented securely
- Response caching should be used appropriately

## 8. Security Standards

### 8.1 Data Protection
- Sensitive data should be encrypted at rest
- Credentials should never be hardcoded
- Access tokens should be refreshed automatically
- Data should be sanitized before storage

### 8.2 Communication Security
- IPC communication should be validated
- Event payloads should be sanitized
- External API calls should use HTTPS
- Authentication should be properly implemented

### 8.3 Code Security
- Input validation should be performed on all external data
- Output encoding should be used to prevent injection attacks
- Dependencies should be regularly updated
- Security scanning should be part of the CI/CD pipeline

## 9. Performance Standards

### 9.1 Resource Management
- Resources should be properly managed and released
- Memory leaks should be prevented
- Database connections should be pooled
- File handles should be closed properly

### 9.2 Caching Strategy
- Appropriate caching should be implemented
- Cache invalidation should be handled correctly
- Cache size should be monitored
- Distributed caching should be considered for scalability

### 9.3 Concurrency
- Asynchronous operations should be used appropriately
- Thread safety should be ensured where necessary
- Locking mechanisms should be used sparingly
- Performance bottlenecks should be identified and addressed

## 10. Documentation Standards

### 10.1 Code Documentation
- All public APIs should be documented
- Complex logic should be explained with comments
- TODO comments should include issue references
- Deprecated code should be clearly marked

### 10.2 API Documentation
- REST APIs should follow OpenAPI specification
- GraphQL schemas should be well-documented
- Examples should be provided for all endpoints
- Error responses should be documented

### 10.3 Architecture Documentation
- Architecture decisions should be recorded as ADRs
- Module interactions should be documented
- Data flow should be clearly explained
- Deployment procedures should be documented