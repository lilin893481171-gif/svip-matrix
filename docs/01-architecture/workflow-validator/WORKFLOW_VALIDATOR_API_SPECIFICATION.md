# Workflow Validator API Specification

## 1. Overview

The Workflow Validator API provides programmatic access to workflow validation, monitoring, and management capabilities. This specification defines the RESTful interface for interacting with the workflow validator system.

## 2. API Endpoints

### 2.1 Workflow Management

#### GET /api/v1/workflows
**Description**: Retrieve all workflows
**Parameters**: 
- `status` (optional): Filter by workflow status (defined, active, suspended, deprecated, archived)
- `category` (optional): Filter by workflow category
- `author` (optional): Filter by workflow author
- `limit` (optional): Results per page (default: 50)
- `page` (optional): Page number (default: 1)
**Response**: 
```json
{
  "workflows": [
    {
      "id": "wf-001",
      "name": "Feature Development Workflow",
      "status": "active",
      "category": "feature-development",
      "author": "John Doe",
      "version": "1.0.0",
      "created_at": "2026-07-01T10:00:00Z",
      "updated_at": "2026-07-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "pages": 1
  }
}
```

#### GET /api/v1/workflows/{id}
**Description**: Retrieve a specific workflow
**Response**:
```json
{
  "id": "wf-001",
  "name": "Feature Development Workflow",
  "status": "active",
  "category": "feature-development",
  "author": "John Doe",
  "version": "1.0.0",
  "definition": {
    "steps": [
      {
        "name": "Create Feature Branch",
        "type": "git",
        "command": "git checkout -b feature/{feature_name}"
      },
      {
        "name": "Implement Feature",
        "type": "development",
        "description": "Implement the feature according to specifications"
      }
    ],
    "gates": [
      {
        "name": "Code Review",
        "type": "approval",
        "required_approvals": 2
      }
    ]
  },
  "metadata": {
    "tags": ["development", "feature"],
    "estimated_duration": "2 days",
    "complexity": "medium"
  },
  "performance": {
    "average_completion_time": "1.5 days",
    "success_rate": 95.2,
    "bottlenecks": []
  },
  "created_at": "2026-07-01T10:00:00Z",
  "updated_at": "2026-07-01T10:00:00Z"
}
```

#### POST /api/v1/workflows
**Description**: Create a new workflow
**Request Body**:
```json
{
  "name": "Bug Fix Workflow",
  "category": "bug-fixing",
  "definition": {
    "steps": [
      {
        "name": "Create Hotfix Branch",
        "type": "git",
        "command": "git checkout -b hotfix/{issue_id}"
      }
    ]
  },
  "author": "Jane Smith"
}
```
**Response**: 201 Created with workflow object

#### PUT /api/v1/workflows/{id}
**Description**: Update an existing workflow
**Request Body**: Workflow object with updated fields
**Response**: 200 OK with updated workflow object

#### DELETE /api/v1/workflows/{id}
**Description**: Delete a workflow
**Response**: 204 No Content

### 2.2 Workflow Validation

#### POST /api/v1/validate
**Description**: Validate workflow execution or definition
**Request Body**:
```json
{
  "workflow_id": "wf-001",
  "execution": {
    "branch": "feature/new-feature",
    "steps_completed": ["Create Feature Branch"],
    "current_step": "Implement Feature",
    "repository": "yu-matrix/studio"
  },
  "rules": ["process", "branch", "commit"]
}
```
**Response**:
```json
{
  "validation_id": "val-12345",
  "status": "completed",
  "passed": true,
  "results": [
    {
      "rule": "process",
      "passed": true,
      "details": "Workflow process is being followed correctly"
    },
    {
      "rule": "branch",
      "passed": true,
      "details": "Branch naming follows conventions"
    },
    {
      "rule": "commit",
      "passed": true,
      "details": "Commit messages meet standards"
    }
  ],
  "suggestions": [
    "Consider adding more detailed commit messages"
  ],
  "timestamp": "2026-07-03T10:15:00Z"
}
```

#### GET /api/v1/validate/{validation_id}
**Description**: Retrieve validation results
**Response**: Validation result object

### 2.3 Workflow Monitoring

#### GET /api/v1/monitoring
**Description**: Get workflow compliance and monitoring status
**Parameters**:
- `timeframe` (optional): Time period for monitoring data (default: 30d)
**Response**:
```json
{
  "compliance_score": 92.8,
  "total_executions": 125,
  "successful_executions": 116,
  "failed_executions": 9,
  "trend": "improving",
  "violations": 12,
  "timestamp": "2026-07-03T10:00:00Z"
}
```

#### GET /api/v1/monitoring/history
**Description**: Get workflow monitoring history
**Parameters**:
- `start_date`: Start date for history (ISO 8601)
- `end_date`: End date for history (ISO 8601)
**Response**:
```json
{
  "history": [
    {
      "date": "2026-07-01",
      "compliance_score": 90.5,
      "total_executions": 42,
      "successful_executions": 38
    },
    {
      "date": "2026-07-02",
      "compliance_score": 91.8,
      "total_executions": 83,
      "successful_executions": 78
    },
    {
      "date": "2026-07-03",
      "compliance_score": 92.8,
      "total_executions": 125,
      "successful_executions": 116
    }
  ]
}
```

### 2.4 Workflow Analysis

#### GET /api/v1/analysis
**Description**: Get workflow analysis and insights
**Parameters**:
- `category` (optional): Filter by workflow category
- `timeframe` (optional): Time period for analysis (default: 90d)
**Response**:
```json
{
  "insights": [
    {
      "type": "bottleneck",
      "title": "Code Review Bottleneck",
      "description": "Code review step taking average of 2.3 days to complete",
      "data": {
        "step": "Code Review",
        "average_duration": "2.3 days",
        "threshold": "1 day"
      }
    },
    {
      "type": "efficiency",
      "title": "Feature Branch Lifespan",
      "description": "Average feature branch lifespan decreased by 15%",
      "data": {
        "current_average": "3.2 days",
        "previous_average": "3.8 days"
      }
    }
  ]
}
```

#### POST /api/v1/analysis/generate
**Description**: Generate detailed workflow analysis report
**Request Body**:
```json
{
  "type": "performance",
  "start_date": "2026-06-01",
  "end_date": "2026-06-30"
}
```
**Response**: 202 Accepted with analysis job ID

### 2.5 Configuration

#### GET /api/v1/config
**Description**: Get workflow validator configuration
**Response**:
```json
{
  "version": "1.0.0",
  "enabled": true,
  "validation_level": "strict",
  "notification_channels": ["slack", "email"],
  "review_reminder_hours": 24
}
```

#### PUT /api/v1/config
**Description**: Update workflow validator configuration
**Request Body**: Configuration object with updated fields
**Response**: 200 OK with updated configuration

## 3. WebSocket API

### 3.1 Real-time Updates

#### Connection Endpoint: ws://localhost:8080/api/v1/ws
**Description**: WebSocket connection for real-time updates

**Events**:
- `workflow_created`: New workflow created
- `workflow_updated`: Workflow updated
- `validation_started`: Workflow validation initiated
- `validation_completed`: Workflow validation completed
- `execution_started`: Workflow execution started
- `execution_completed`: Workflow execution completed
- `compliance_update`: Workflow compliance score updated

**Example Message**:
```json
{
  "event": "validation_completed",
  "data": {
    "validation_id": "val-12345",
    "workflow_id": "wf-001",
    "execution_id": "exec-67890",
    "status": "completed",
    "passed": true,
    "violation_count": 0
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
- `workflow:read`: Read workflow information
- `workflow:write`: Create, update, delete workflows
- `validate:execute`: Execute workflow validation
- `monitoring:read`: Read monitoring data
- `analysis:read`: Read analysis insights
- `analysis:generate`: Generate analysis reports
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
    "code": "WORKFLOW_NOT_FOUND",
    "message": "The requested workflow could not be found",
    "details": {
      "workflow_id": "wf-999"
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

### 8.2 Workflow Status Values
- `defined`: Workflow template created and validated
- `active`: Workflow currently in use
- `suspended`: Workflow temporarily paused
- `deprecated`: Workflow no longer recommended
- `archived`: Workflow retired and stored for reference

### 8.3 Workflow Categories
- `feature-development`: New feature implementation processes
- `bug-fixing`: Issue resolution and bug fixing workflows
- `code-review`: Peer review and approval processes
- `release-management`: Versioning and deployment workflows
- `hotfix`: Emergency fix and deployment processes

### 8.4 Validation Rules
- `process`: Workflow process compliance
- `branch`: Branch naming and management
- `commit`: Commit message standards
- `review`: Code review process
- `testing`: Testing requirements compliance