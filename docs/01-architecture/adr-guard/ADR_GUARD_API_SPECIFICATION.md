# ADR Guard API Specification

## 1. Overview

The ADR Guard API provides programmatic access to ADR validation, monitoring, and management capabilities. This specification defines the RESTful interface for interacting with the ADR guard system.

## 2. API Endpoints

### 2.1 ADR Management

#### GET /api/v1/adrs
**Description**: Retrieve all ADRs
**Parameters**: 
- `status` (optional): Filter by ADR status (proposed, accepted, superseded, deprecated, rejected)
- `category` (optional): Filter by ADR category
- `author` (optional): Filter by ADR author
- `limit` (optional): Results per page (default: 50)
- `page` (optional): Page number (default: 1)
**Response**: 
```json
{
  "adrs": [
    {
      "id": "adr-001",
      "title": "Core Architecture Layer Implementation",
      "status": "accepted",
      "category": "core-architecture",
      "author": "John Doe",
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

#### GET /api/v1/adrs/{id}
**Description**: Retrieve a specific ADR
**Response**:
```json
{
  "id": "adr-001",
  "title": "Core Architecture Layer Implementation",
  "status": "accepted",
  "category": "core-architecture",
  "author": "John Doe",
  "content": "# ADR-001: Core Architecture Layer Implementation\n\n## Status\nAccepted\n\n## Context\n...",
  "metadata": {
    "deciders": ["Jane Smith", "Bob Johnson"],
    "date": "2026-07-01",
    "tags": ["architecture", "core"]
  },
  "relationships": {
    "supersedes": [],
    "superseded_by": [],
    "related": []
  },
  "implementation": {
    "status": "completed",
    "progress": 100,
    "tracking_issues": []
  },
  "created_at": "2026-07-01T10:00:00Z",
  "updated_at": "2026-07-01T10:00:00Z"
}
```

#### POST /api/v1/adrs
**Description**: Create a new ADR
**Request Body**:
```json
{
  "title": "New Database Implementation Strategy",
  "category": "data-management",
  "content": "# ADR-XXX: New Database Implementation Strategy\n\n## Status\nProposed\n\n## Context\n...",
  "author": "Alice Brown"
}
```
**Response**: 201 Created with ADR object

#### PUT /api/v1/adrs/{id}
**Description**: Update an existing ADR
**Request Body**: ADR object with updated fields
**Response**: 200 OK with updated ADR object

#### DELETE /api/v1/adrs/{id}
**Description**: Delete an ADR
**Response**: 204 No Content

### 2.2 ADR Validation

#### POST /api/v1/validate
**Description**: Validate ADR format and content
**Request Body**:
```json
{
  "adr": {
    "title": "Database Implementation Strategy",
    "content": "# ADR-XXX: Database Implementation Strategy\n\n## Status\nProposed\n\n## Context\n...",
    "metadata": {
      "author": "Alice Brown",
      "date": "2026-07-03"
    }
  },
  "rules": ["format", "content", "metadata"]
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
      "rule": "format",
      "passed": true,
      "details": "ADR format is valid"
    },
    {
      "rule": "content",
      "passed": true,
      "details": "ADR content meets quality standards"
    },
    {
      "rule": "metadata",
      "passed": true,
      "details": "ADR metadata is complete"
    }
  ],
  "suggestions": [
    "Consider adding more context about current database limitations"
  ],
  "timestamp": "2026-07-03T10:15:00Z"
}
```

#### GET /api/v1/validate/{validation_id}
**Description**: Retrieve validation results
**Response**: Validation result object

### 2.3 ADR Monitoring

#### GET /api/v1/monitoring
**Description**: Get ADR compliance and monitoring status
**Parameters**:
- `timeframe` (optional): Time period for monitoring data (default: 30d)
**Response**:
```json
{
  "compliance_score": 94.2,
  "total_adrs": 25,
  "implemented_adrs": 22,
  "pending_adrs": 2,
  "rejected_adrs": 1,
  "trend": "improving",
  "violations": 3,
  "timestamp": "2026-07-03T10:00:00Z"
}
```

#### GET /api/v1/monitoring/history
**Description**: Get ADR monitoring history
**Parameters**:
- `start_date`: Start date for history (ISO 8601)
- `end_date`: End date for history (ISO 8601)
**Response**:
```json
{
  "history": [
    {
      "date": "2026-07-01",
      "compliance_score": 91.5,
      "total_adrs": 24,
      "implemented_adrs": 20
    },
    {
      "date": "2026-07-02",
      "compliance_score": 93.1,
      "total_adrs": 25,
      "implemented_adrs": 21
    },
    {
      "date": "2026-07-03",
      "compliance_score": 94.2,
      "total_adrs": 25,
      "implemented_adrs": 22
    }
  ]
}
```

### 2.4 ADR Analysis

#### GET /api/v1/analysis
**Description**: Get ADR analysis and insights
**Parameters**:
- `category` (optional): Filter by ADR category
- `timeframe` (optional): Time period for analysis (default: 90d)
**Response**:
```json
{
  "insights": [
    {
      "type": "trend",
      "title": "Increasing Focus on Security ADRs",
      "description": "Security-related ADRs have increased by 40% in the last quarter",
      "data": {
        "current_period": 8,
        "previous_period": 5
      }
    },
    {
      "type": "pattern",
      "title": "Common Implementation Delays",
      "description": "Core architecture ADRs take an average of 14 days to implement",
      "data": {
        "average_days": 14,
        "category": "core-architecture"
      }
    }
  ]
}
```

#### POST /api/v1/analysis/generate
**Description**: Generate detailed ADR analysis report
**Request Body**:
```json
{
  "type": "compliance",
  "start_date": "2026-06-01",
  "end_date": "2026-06-30"
}
```
**Response**: 202 Accepted with analysis job ID

### 2.5 Configuration

#### GET /api/v1/config
**Description**: Get ADR guard configuration
**Response**:
```json
{
  "version": "1.0.0",
  "enabled": true,
  "validation_level": "strict",
  "notification_channels": ["slack", "email"],
  "review_reminder_days": 30
}
```

#### PUT /api/v1/config
**Description**: Update ADR guard configuration
**Request Body**: Configuration object with updated fields
**Response**: 200 OK with updated configuration

## 3. WebSocket API

### 3.1 Real-time Updates

#### Connection Endpoint: ws://localhost:8080/api/v1/ws
**Description**: WebSocket connection for real-time updates

**Events**:
- `adr_created`: New ADR created
- `adr_updated`: ADR updated
- `validation_started`: ADR validation initiated
- `validation_completed`: ADR validation completed
- `implementation_updated`: ADR implementation status changed
- `compliance_update`: ADR compliance score updated

**Example Message**:
```json
{
  "event": "validation_completed",
  "data": {
    "validation_id": "val-12345",
    "adr_id": "adr-001",
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
- `adr:read`: Read ADR information
- `adr:write`: Create, update, delete ADRs
- `validate:execute`: Execute ADR validation
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
    "code": "ADR_NOT_FOUND",
    "message": "The requested ADR could not be found",
    "details": {
      "adr_id": "adr-999"
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

### 8.2 ADR Status Values
- `proposed`: ADR under development and review
- `accepted`: ADR approved and ready for implementation
- `superseded`: ADR replaced by newer decision
- `deprecated`: ADR no longer recommended
- `rejected`: ADR not approved for implementation

### 8.3 ADR Categories
- `core-architecture`: Fundamental architectural decisions
- `module-design`: Component and module structure
- `data-management`: Data storage and processing
- `security`: Security controls and compliance
- `process`: Development and operational processes
- `technology`: Technology stack and tool selection

### 8.4 Validation Rules
- `format`: ADR template and structure compliance
- `content`: ADR content quality and completeness
- `metadata`: ADR metadata accuracy and completeness
- `references`: ADR cross-reference validity
- `implementation`: ADR implementation tracking