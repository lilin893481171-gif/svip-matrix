# ADR-003: Platform Adapter Interface Standardization

## Status
Accepted

## Context
YuMatrix Studio supports multiple content platforms (Xiaohongshu, Douyin, Bilibili, etc.) that require consistent integration patterns. The current platform implementations have inconsistent interfaces and varying levels of functionality, making it difficult to add new platforms or maintain existing ones.

## Decision
Standardize all platform adapters to implement a common interface:

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

Requirements for all platform adapters:
1. **Isolation**: Each adapter must be fully isolated with no shared state
2. **Interface Compliance**: Must implement all methods in the standard interface
3. **Error Handling**: Must normalize platform-specific errors into standard format
4. **Event Communication**: Must emit standardized events through the core event bus
5. **Security**: Must handle credentials securely and implement proper session management
6. **Lifecycle Management**: Must follow consistent initialization and cleanup patterns

## Consequences
Positive:
- Consistent integration pattern for all platforms
- Simplified process for adding new platforms
- Improved maintainability and testability of platform integrations
- Better error handling and user experience

Negative:
- Refactoring required for existing platform adapters
- Potential loss of platform-specific optimizations
- Need for comprehensive testing of all platform integrations

## Alternatives Considered
1. **Platform-Specific Interfaces**: Would lead to inconsistency and maintenance challenges
2. **Generic Adapter with Configuration**: Would be too abstract and difficult to maintain
3. **Direct Platform SDK Integration**: Would create tight coupling and vendor lock-in

## References
- docs/01-architecture/TARGET_ARCHITECTURE.md
- docs/02-standards/coding-standards/CODING_STANDARDS.md