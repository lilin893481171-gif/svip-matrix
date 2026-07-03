# Compliance Checker API Specification

## 1. Overview

The Compliance Checker API provides programmatic access to compliance validation services, analysis results, and reporting capabilities. This specification defines the RESTful interface for interacting with the compliance checker system.

## 2. API Endpoints

### 2.1 Analysis Services

#### POST /api/v1/analyze
**Description**: Initiate a compliance analysis
**Request Body**:
```json
{
  "target": {
    "type": "repository|files|branch",
    "location": "https://github.com/user/repo",
    "branch": "main",
    "files": ["src/main.js", "src/utils.js"]
  },
  "categories": ["code-quality", "architecture", "security"],
  "policies": ["policy-1", "policy-2"],
  "options": {
    "incremental": true,
    "fail_fast": false
  }
}
```
**Response**:
```json
{
  "analysis_id": "analysis-12345",
  "status": "started",
  "estimated_completion": "2026-07-03T10:30:00Z"
}
```

#### GET /api/v1/analyze/{analysis_id}
**Description**: Retrieve analysis status and results
**Response**:
```json
{
  "analysis_id": "analysis-12345",
  "status": "completed",
  "started_at": "2026-07-03T10:15:00Z",
  "completed_at": "2026-07-03T10:25:00Z",
  "target": {
    "type": "repository",
    "location": "https://github.com/user/repo",
    "branch": "main"
  },
  "summary": {
    "compliance_score": 87.5,
    "total_violations": 23,
    "critical_violations": 1,
    "high_violations": 5,
    "medium_violations": 10,
    "low_violations": 7
  },
  "categories": [
    {
      "name": "code-quality",
      "compliance_score": 92.0,
      "violations": 8
    },
    {
      "name": "architecture",
      "compliance_score": 82.5,
      "violations": 10
    },
    {
      "name": "security",
      "compliance_score": 88.0,
      "violations": 5
    }
  ]
}
```

#### GET /api/v1/analyze/{analysis_id}/violations
**Description**: Retrieve detailed violation information
**Parameters**:
- `category` (optional): Filter by category
- `severity` (optional): Filter by severity (critical, high, medium, low)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50)
**Response**:
```json
{
  "violations": [
    {
      "id": "violation-1",
      "category": "code-quality",
      "severity": "high",
      "rule": "no-console",
      "message": "Unexpected console statement",
      "location": {
        "file": "src/main.js",
        "line": 10,
        "column": 5
      },
      "policy": "policy-1",
      "remediation": {
        "description": "Remove console statement or use proper logging",
        "url": "https://eslint.org/docs/rules/no-console"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 23,
    "pages": 1
  }
}
```

### 2.2 Policy Management

#### GET /api/v1/policies
**Description**: Retrieve all compliance policies
**Parameters**: 
- `category` (optional): Filter by policy category
- `enabled` (optional): Filter by enabled status
**Response**: 
```json
{
  "policies": [
    {
      "id": "policy-1",
      "name": "Code Quality Standards",
      "category": "code-quality",
      "description": "Enforces coding standards and best practices",
      "enabled": true,
      "severity": "medium",
      "created_at": "2026-07-03T10:00:00Z",
      "updated_at": "2026-07-03T10:00:00Z"
    }
  ]
}
```

#### GET /api/v1/policies/{id}
**Description**: Retrieve a specific policy
**Response**:
```json
{
  "id": "policy-1",
  "name": "Code Quality Standards",
  "category": "code-quality",
  "description": "Enforces coding standards and best practices",
  "rules": [
    {
      "id": "rule-1",
      "type": "eslint",
      "config": {
        "rules": {
          "no-console": "warn",
          "no-var": "error"
        }
      }
    }
  ],
  "severity": "medium",
  "enabled": true,
  "created_at": "2026-07-03T10:00:00Z",
  "updated_at": "2026-07-03T10:00:00Z"
}
```

### 2.3 Compliance Monitoring

#### GET /api/v1/compliance
**Description**: Get overall compliance status
**Parameters**:
- `timeframe` (optional): Time period for compliance data (default: 30d)
- `repository` (optional): Filter by repository
**Response**:
```json
{
  "compliance_score": 91.2,
  "total_violations": 45,
  "critical_violations": 2,
  "high_violations": 8,
  "medium_violations": 15,
  "low_violations": 20,
  "trend": "improving",
  "timestamp": "2026-07-03T10:00:00Z"
}
```

#### GET /api/v1/compliance/history
**Description**: Get compliance history
**Parameters**:
- `start_date`: Start date for history (ISO 8601)
- `end_date`: End date for history (ISO 8601)
- `repository` (optional): Filter by repository
**Response**:
```json
{
  "history": [
    {
      "date": "2026-07-01",
      "compliance_score": 88.5,
      "violations": 52
    },
    {
      "date": "2026-07-02",
      "compliance_score": 90.1,
      "violations": 48
    },
    {
      "date": "2026-07-03",
      "compliance_score": 91.2,
      "violations": 45
    }
  ]
}
```

#### GET /api/v1/compliance/trends
**Description**: Get compliance trends by category
**Parameters**:
- `timeframe` (optional): Time period for trend data (default: 90d)
**Response**:
```json
{
  "trends": [
    {
      "category": "code-quality",
      "data": [
        {"date": "2026-05-01", "score": 85.2},
        {"date": "2026-06-01", "score": 88.7},
        {"date": "2026-07-01", "score": 92.1}
      ]
    },
    {
      "category": "architecture",
      "data": [
        {"date": "2026-05-01", "score": 82.3},
        {"date": "2026-06-01", "score": 85.9},
        {"date": "2026-07-01", "score": 88.4}
      ]
    }
  ]
}
```

### 2.4 Reporting

#### GET /api/v1/reports
**Description**: List available reports
**Response**:
```json
{
  "reports": [
    {
      "id": "report-1",
      "name": "Weekly Compliance Report",
      "type": "compliance",
      "generated_at": "2026-07-03T09:00:00Z",
      "period": "2026-06-26 to 2026-07-02"
    }
  ]
}
```

#### GET /api/v1/reports/{id}
**Description**: Retrieve a specific report
**Response**: Report content in JSON format

#### POST /api/v1/reports/generate
**Description**: Generate a new report
**Request Body**:
```json
{
  "type": "compliance",
  "start_date": "2026-06-01",
  "end_date": "2026-06-30",
  "format": "json|pdf|csv"
}
```
**Response**: 202 Accepted with report generation job ID

### 2.5 Configuration

#### GET /api/v1/config
**Description**: Get checker configuration
**Response**:
```json
{
  "version": "1.0.0",
  "enabled": true,
  "analysis_frequency": "realtime",
  "notification_channels": ["slack", "email"],
  "default_policies": ["code-quality", "architecture", "security"]
}
```

#### PUT /api/v1/config
**Description**: Update checker configuration
**Request Body**: Configuration object with updated fields
**Response**: 200 OK with updated configuration

## 3. WebSocket API

### 3.1 Real-time Updates

#### Connection Endpoint: ws://localhost:8080/api/v1/ws
**Description**: WebSocket connection for real-time updates

**Events**:
- `analysis_started`: Analysis process initiated
- `analysis_progress`: Analysis progress updates
- `analysis_completed`: Analysis process completed
- `violation_detected`: New violation detected
- `compliance_update`: Compliance score updated

**Example Message**:
```json
{
  "event": "analysis_completed",
  "data": {
    "analysis_id": "analysis-12345",
    "status": "completed",
    "compliance_score": 87.5,
    "violation_count": 23
  }
}
```

## 4. Authentication and Authorization

### 4.1 API Keys
All API requests require authentication via API key in the Authorization header:
```
Authorization: Bearer {api_key}
```

### 4.2 Permissions
- `analyze:execute`: Execute compliance analysis
- `policy:read`: Read policy information
- `compliance:read`: Read compliance data
- `report:read`: Read reports
- `report:generate`: Generate reports
- `config:read`: Read configuration
- `config:write`: Update configuration

## 5. Error Handling

### 5.1 HTTP Status Codes
- `200`: Success
- `201`: Created
- `202`: Accepted (for async operations)
- `204`: No Content
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

### 5.2 Error Response Format
```json
{
  "error": {
    "code": "ANALYSIS_NOT_FOUND",
    "message": "The requested analysis could not be found",
    "details": {
      "analysis_id": "analysis-999"
    }
  }
}
```

## 6. Rate Limiting

### 6.1 Limits
- **API Requests**: 1000 requests per hour per API key
- **Analysis Requests**: 50 analyses per hour per API key
- **WebSocket Connections**: 10 concurrent connections per API key

### 6.2 Response Headers
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

## 7. Versioning

The API uses semantic versioning in the URL path:
- `/api/v1/`: Current stable version
- Future versions will be added as needed (v2, v3, etc.)

## 8. Data Formats

### 8.1 Date/Time Format
All timestamps use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

### 8.2 Analysis Categories
- `code-quality`: Code style and best practices
- `architecture`: Architectural compliance and boundaries
- `security`: Security vulnerabilities and best practices
- `testing`: Test coverage and quality
- `documentation`: Documentation completeness and quality

### 8.3 Severity Levels
- `critical`: Critical violations that must be fixed immediately
- `high`: High severity violations requiring prompt attention
- `medium`: Medium severity violations to be addressed soon
- `low`: Low severity violations for future improvement
- `info`: Informational messages

### 8.4 Analysis Status Values
- `pending`: Analysis queued for processing
- `started`: Analysis in progress
- `completed`: Analysis finished successfully
- `failed`: Analysis failed to complete
- `cancelled`: Analysis was cancelled