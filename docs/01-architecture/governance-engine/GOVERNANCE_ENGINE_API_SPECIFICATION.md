# Governance Engine API Specification

## 1. Overview

The Governance Engine API provides programmatic access to governance policies, validation services, and compliance monitoring capabilities. This specification defines the RESTful interface for interacting with the governance engine.

## 2. API Endpoints

### 2.1 Policy Management

#### GET /api/v1/policies
**Description**: Retrieve all policies
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
  "enabled": true,
  "created_at": "2026-07-03T10:00:00Z",
  "updated_at": "2026-07-03T10:00:00Z"
}
```

#### POST /api/v1/policies
**Description**: Create a new policy
**Request Body**:
```json
{
  "name": "Security Policy",
  "category": "security",
  "description": "Enforces security best practices",
  "rules": [
    {
      "type": "snyk",
      "config": {
        "severity": "high"
      }
    }
  ],
  "enabled": true
}
```
**Response**: 201 Created with policy object

#### PUT /api/v1/policies/{id}
**Description**: Update an existing policy
**Request Body**: Policy object with updated fields
**Response**: 200 OK with updated policy object

#### DELETE /api/v1/policies/{id}
**Description**: Delete a policy
**Response**: 204 No Content

### 2.2 Validation Services

#### POST /api/v1/validate
**Description**: Validate code against specified policies
**Request Body**:
```json
{
  "policies": ["policy-1", "policy-2"],
  "files": [
    {
      "path": "src/main.js",
      "content": "console.log('Hello World');"
    }
  ],
  "context": {
    "branch": "feature/new-feature",
    "repository": "yu-matrix/studio"
  }
}
```
**Response**:
```json
{
  "validation_id": "val-12345",
  "status": "completed",
  "passed": false,
  "results": [
    {
      "policy_id": "policy-1",
      "policy_name": "Code Quality Standards",
      "passed": false,
      "violations": [
        {
          "rule_id": "rule-1",
          "message": "Unexpected console statement",
          "severity": "warning",
          "location": {
            "file": "src/main.js",
            "line": 1,
            "column": 1
          }
        }
      ]
    }
  ],
  "timestamp": "2026-07-03T10:15:00Z"
}
```

#### GET /api/v1/validate/{validation_id}
**Description**: Retrieve validation results
**Response**: Validation result object

### 2.3 Compliance Monitoring

#### GET /api/v1/compliance
**Description**: Get overall compliance status
**Parameters**:
- `timeframe` (optional): Time period for compliance data (default: 30d)
**Response**:
```json
{
  "compliance_score": 95.5,
  "total_violations": 12,
  "critical_violations": 0,
  "high_violations": 2,
  "medium_violations": 5,
  "low_violations": 5,
  "trend": "improving",
  "timestamp": "2026-07-03T10:00:00Z"
}
```

#### GET /api/v1/compliance/history
**Description**: Get compliance history
**Parameters**:
- `start_date`: Start date for history (ISO 8601)
- `end_date`: End date for history (ISO 8601)
**Response**:
```json
{
  "history": [
    {
      "date": "2026-07-01",
      "compliance_score": 92.3,
      "violations": 18
    },
    {
      "date": "2026-07-02",
      "compliance_score": 94.1,
      "violations": 15
    },
    {
      "date": "2026-07-03",
      "compliance_score": 95.5,
      "violations": 12
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
  "end_date": "2026-06-30"
}
```
**Response**: 202 Accepted with report generation job ID

### 2.5 Configuration

#### GET /api/v1/config
**Description**: Get engine configuration
**Response**:
```json
{
  "version": "1.0.0",
  "enabled": true,
  "enforcement_level": "strict",
  "notification_channels": ["slack", "email"],
  "scan_frequency": "realtime"
}
```

#### PUT /api/v1/config
**Description**: Update engine configuration
**Request Body**: Configuration object with updated fields
**Response**: 200 OK with updated configuration

## 3. WebSocket API

### 3.1 Real-time Updates

#### Connection Endpoint: ws://localhost:8080/api/v1/ws
**Description**: WebSocket connection for real-time updates

**Events**:
- `validation_started`: Validation process initiated
- `validation_completed`: Validation process completed
- `policy_violation`: New policy violation detected
- `compliance_update`: Compliance score updated

**Example Message**:
```json
{
  "event": "validation_completed",
  "data": {
    "validation_id": "val-12345",
    "status": "completed",
    "passed": false,
    "violation_count": 3
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
- `policy:read`: Read policy information
- `policy:write`: Create, update, delete policies
- `validate:execute`: Execute validation services
- `compliance:read`: Read compliance data
- `report:read`: Read reports
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
    "code": "POLICY_NOT_FOUND",
    "message": "The requested policy could not be found",
    "details": {
      "policy_id": "policy-999"
    }
  }
}
```

## 6. Rate Limiting

### 6.1 Limits
- **API Requests**: 1000 requests per hour per API key
- **Validation Requests**: 100 validations per hour per API key
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

### 8.2 Policy Rule Types
- `eslint`: ESLint-based code quality rules
- `dependency-cruiser`: Architecture dependency rules
- `snyk`: Security vulnerability rules
- `custom`: Custom validation rules

### 8.3 Severity Levels
- `critical`: Critical violations that must be fixed immediately
- `high`: High severity violations requiring prompt attention
- `medium`: Medium severity violations to be addressed soon
- `low`: Low severity violations for future improvement
- `info`: Informational messages