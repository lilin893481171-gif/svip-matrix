# Automated Compliance Checks

## 1. Code Quality Enforcement

### 1.1 ESLint Rules Configuration
```javascript
module.exports = {
  extends: ['eslint:recommended'],
  rules: {
    // Architecture enforcement
    'no-restricted-imports': ['error', {
      patterns: [
        // Prevent direct renderer to database access
        {
          group: ['src/core/database/**'],
          message: 'Renderer cannot directly access database. Use IPC instead.'
        },
        // Prevent cross-module imports
        {
          group: ['src/modules/*/service/*'],
          message: 'Modules cannot directly import other module services. Use events or IPC.'
        }
      ]
    }],
    
    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Best practices
    'no-console': 'warn',
    'no-var': 'error',
    'prefer-const': 'error'
  }
};
```

### 1.2 Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 1.3 TypeScript Configuration (for future migration)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    
    // Module resolution
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/core/*": ["src/core/*"],
      "@/modules/*": ["src/modules/*"],
      "@/platforms/*": ["src/platforms/*"]
    }
  }
}
```

## 2. Architecture Dependency Checking

### 2.1 Dependency Cruiser Configuration
```javascript
module.exports = {
  forbidden: [
    // Prevent renderer from accessing database directly
    {
      name: 'renderer-to-database',
      from: { path: 'src/renderer' },
      to: { path: 'src/core/database' },
      message: 'Renderer cannot directly access database. Use IPC instead.'
    },
    
    // Prevent modules from importing each other's services
    {
      name: 'module-isolation',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!\\1)[^/]+/service/' },
      message: 'Modules cannot directly import other module services. Use events or IPC.'
    },
    
    // Prevent core from importing modules
    {
      name: 'core-purity',
      from: { path: 'src/core' },
      to: { path: 'src/modules' },
      message: 'Core services cannot depend on business modules.'
    },
    
    // Prevent platform adapters from importing modules
    {
      name: 'platform-isolation',
      from: { path: 'src/platforms' },
      to: { path: 'src/modules' },
      message: 'Platform adapters cannot directly import business modules.'
    }
  ],
  
  options: {
    doNotFollow: {
      dependencyTypes: [
        'npm',
        'npm-dev',
        'npm-optional',
        'npm-peer',
        'npm-bundled',
        'npm-no-pkg'
      ]
    }
  }
};
```

### 2.2 Package.json Scripts
```json
{
  "scripts": {
    "lint": "eslint src/ --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src/ --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write src/**/*.{js,jsx,ts,tsx,json,css,md}",
    "format:check": "prettier --check src/**/*.{js,jsx,ts,tsx,json,css,md}",
    "arch:check": "dependency-cruiser --validate .dependency-cruiser.js src/",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "security:audit": "npm audit",
    "governance:check": "npm run lint && npm run arch:check && npm run security:audit"
  }
}
```

## 3. Security Scanning

### 3.1 Snyk Configuration
```json
{
  "ignore": [
    {
      "id": "SNYK-JS-LODASH-1018905",
      "reason": "Vulnerability affects only server-side usage",
      "expires": "2027-01-01"
    }
  ],
  "packageManager": "npm",
  "options": {
    "dev": true,
    "strictOutOfSync": false
  }
}
```

### 3.2 Security Headers for Electron
```javascript
// In main process
const { app, BrowserWindow } = require('electron');

app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Disable node integration in webviews
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    
    // Security headers
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
  });
});
```

## 4. Test Coverage Enforcement

### 4.1 Jest Configuration
```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/main.js',
    '!src/preload.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html']
};
```

### 4.2 CI Pipeline Configuration
```yaml
name: Governance Checks

on: [push, pull_request]

jobs:
  governance-checks:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Code Quality Checks
      run: |
        npm run lint
        npm run format:check
        
    - name: Architecture Compliance
      run: npm run arch:check
      
    - name: Security Audit
      run: npm run security:audit
      
    - name: Test Coverage
      run: npm run test:coverage
      
    - name: Governance Summary
      run: npm run governance:check
```

## 5. Git Hooks Configuration

### 5.1 Husky Pre-commit Hook
```javascript
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit governance checks..."
npm run lint:fix
npm run format
npm run arch:check

# If any check fails, prevent commit
if [ $? -ne 0 ]; then
  echo "❌ Governance checks failed. Please fix issues before committing."
  exit 1
fi

echo "✅ All governance checks passed!"
exit 0
```

### 5.2 Commitlint Configuration
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
        'arch'  // Architecture changes
      ]
    ],
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'module',
        'platform',
        'rpa',
        'ai',
        'ui',
        'test',
        'docs',
        'config'
      ]
    ]
  }
};
```

## 6. IDE Integration

### 6.1 VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.workingDirectories": ["./src"]
}
```

### 6.2 ESLint Plugin Recommendations
- ESLint extension for real-time feedback
- Prettier extension for automatic formatting
- Dependency Cruiser extension for architecture visualization
- Snyk extension for security vulnerability detection

## 7. Monitoring and Reporting

### 7.1 Compliance Dashboard Configuration
```javascript
// compliance-dashboard.js
const complianceMetrics = {
  codeQuality: {
    eslintViolations: 0,
    formattingIssues: 0
  },
  architecture: {
    dependencyViolations: 0,
    circularDependencies: 0
  },
  security: {
    vulnerabilities: 0,
    highSeverity: 0
  },
  testing: {
    coveragePercentage: 0,
    failingTests: 0
  }
};

module.exports = { complianceMetrics };
```

### 7.2 Automated Reporting
```javascript
// compliance-report.js
const generateComplianceReport = () => {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      overallCompliance: 'PASS', // or 'FAIL' or 'WARN'
      criticalIssues: 0,
      highPriorityIssues: 2,
      mediumPriorityIssues: 5
    },
    details: {
      // Detailed breakdown of each check
    }
  };
};

module.exports = { generateComplianceReport };
```

## 8. Exception Handling

### 8.1 Exception Request Template
```markdown
# Governance Exception Request

## Request Details
- **Requester**: [Name]
- **Date**: [Date]
- **Component**: [Module/Component affected]

## Violation Details
- **Check Type**: [e.g., Architecture, Security, Code Quality]
- **Violation**: [Description of the violation]
- **File/Location**: [Path to affected files]

## Justification
[Explanation of why the exception is needed and why compliance is not feasible]

## Mitigation Plan
[Steps to minimize risk and plan for future compliance]

## Approval
- **Architecture Board**: [ ]
- **Security Team**: [ ]
- **Quality Engineering**: [ ]
```

### 8.2 Exception Tracking
```javascript
// exception-tracker.js
const exceptions = [
  {
    id: 'EX-001',
    type: 'architecture',
    component: 'src/modules/publish',
    reason: 'Temporary workaround for platform integration',
    expires: '2026-12-31',
    approvedBy: 'Architecture Board'
  }
];

module.exports = { exceptions };
```