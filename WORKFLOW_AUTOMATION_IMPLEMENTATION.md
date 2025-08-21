# Workflow Automation System Implementation

## Overview

This document describes the comprehensive workflow automation system implemented for SafeMatrix, enabling automated responses to vulnerability discoveries through configurable rules and actions.

## Architecture

### Backend Components

#### 1. Database Models (`backend/models/workflow.py`)
- **Workflow**: Main workflow configuration with rules, actions, and triggers
- **WorkflowExecution**: Execution history and results
- **ActionLog**: Detailed action execution logs
- **ConnectorConfig**: External system integration configurations

#### 2. Rules Engine (`backend/core/rules_engine.py`)
- Evaluates vulnerability data against configurable rule conditions
- Supports multiple operators: equals, greater_than, contains, in, etc.
- Handles complex rule logic (AND/OR combinations)
- Normalizes vulnerability data for consistent evaluation

#### 3. Connectors (`backend/core/connectors/`)
- **BaseConnector**: Abstract base class for all connectors
- **EmailConnector**: SMTP email notifications
- **TheHiveConnector**: Security incident creation in TheHive
- **ServiceNowConnector**: Incident management in ServiceNow
- **ConnectorFactory**: Factory pattern for connector instantiation

#### 4. Workflow Engine (`backend/core/workflow_engine.py`)
- Orchestrates workflow execution
- Handles idempotency to prevent duplicate executions
- Manages action execution and error handling
- Provides testing capabilities without executing actions

#### 5. API Endpoints
- **Workflows API** (`backend/api/v1/workflows.py`): CRUD operations, testing, execution
- **Connectors API** (`backend/api/v1/connectors.py`): Connector management and testing

### Frontend Components

#### 1. Workflow Management (`frontend/src/pages/Workflows.tsx`)
- List all workflows with status indicators
- Quick actions menu (edit, test, view executions, delete)
- Status-based filtering and search capabilities

#### 2. Workflow Form (`frontend/src/pages/WorkflowForm.tsx`)
- Multi-step wizard for workflow creation/editing
- Rule configuration with field selection and operators
- Action setup with connector integration
- Template variables for dynamic content

#### 3. Connector Management (`frontend/src/pages/Connectors.tsx`)
- Connector configuration for external systems
- Connection testing capabilities
- Type-specific configuration forms

## Features

### Rule Configuration
- **Supported Fields**:
  - CVSS Score (numeric comparisons)
  - Severity levels (CRITICAL, HIGH, MEDIUM, LOW)
  - Affected products (text search)
  - CVE ID, description, dates
  - Product count

- **Operators**:
  - Equality: equals, not_equals
  - Numeric: greater_than, less_than, etc.
  - Text: contains, not_contains
  - List: in, not_in

### Action Types

#### Email Notifications
- SMTP configuration with TLS support
- Template variables for dynamic content
- Multiple recipients (TO, CC)
- HTML and plain text support

#### TheHive Integration
- Automatic case creation
- Configurable severity and TLP levels
- Custom tags and metadata
- CVE-specific custom fields

#### ServiceNow Integration
- Incident creation with priority levels
- Assignment group configuration
- Category and subcategory support
- Custom fields for vulnerability data

### Execution Features

#### Triggers
- **Vulnerability Ingest**: Automatic execution when new vulnerabilities are discovered
- **Scheduled**: Cron-based periodic execution
- **Manual**: On-demand execution for testing

#### Idempotency
- Prevents duplicate executions using hash-based keys
- Tracks execution history and results
- Handles concurrent execution scenarios

#### Error Handling
- Comprehensive logging at workflow and action levels
- Graceful failure handling with detailed error messages
- Retry mechanisms for transient failures

#### Testing
- Dry-run capability without executing actions
- Rule evaluation preview
- Action configuration validation

## Template System

### Available Variables
All actions support template variables for dynamic content:

```
{{cve_id}}              - CVE identifier
{{cvss_score}}          - CVSS base score
{{severity}}            - Severity level
{{description}}         - Vulnerability description
{{affected_products}}   - List of affected products
{{product_count}}       - Number of affected products
{{references}}          - Reference URLs
{{published_date}}      - Publication date
{{last_modified}}       - Last modification date
```

### Example Templates

#### Email Subject
```
Security Alert: {{cve_id}} - {{severity}} Vulnerability Detected
```

#### Email Body
```
A new {{severity}} vulnerability has been detected:

CVE ID: {{cve_id}}
CVSS Score: {{cvss_score}}
Description: {{description}}
Affected Products: {{affected_products}}

Please review and take appropriate action.
```

## Database Schema

### Workflows Table
```sql
CREATE TABLE workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status workflow_status NOT NULL DEFAULT 'draft',
    rules JSON NOT NULL,
    rule_logic VARCHAR(10) NOT NULL DEFAULT 'AND',
    actions JSON NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    trigger_on_ingest BOOLEAN NOT NULL DEFAULT true,
    trigger_on_schedule BOOLEAN NOT NULL DEFAULT false,
    schedule_cron VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255)
);
```

### Workflow Executions Table
```sql
CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id),
    trigger_type VARCHAR(50) NOT NULL,
    vulnerability_id VARCHAR(50),
    status execution_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    rules_matched BOOLEAN NOT NULL DEFAULT false,
    actions_executed INTEGER NOT NULL DEFAULT 0,
    actions_failed INTEGER NOT NULL DEFAULT 0,
    execution_log JSON,
    error_message TEXT,
    idempotency_key VARCHAR(255)
);
```

## Integration Points

### Vulnerability Sync Integration
The workflow engine is integrated into the NVD synchronization process:

```python
# In sync_nvd.py
workflow_engine = WorkflowEngine(db)
for vulnerability_data in vulnerabilities_batch:
    asyncio.create_task(
        workflow_engine.process_vulnerability_ingest(vulnerability_data)
    )
```

### API Integration
Workflows are triggered through the main FastAPI application with proper authentication and authorization.

## Security Considerations

### Authentication & Authorization
- All API endpoints require JWT authentication
- User-based access control for workflow management
- Audit logging for all workflow operations

### Credential Management
- Connector credentials stored securely in database
- Password fields masked in UI
- Connection testing without exposing credentials

### Input Validation
- Comprehensive validation of rule conditions
- Template injection prevention
- SQL injection protection through ORM

## Performance Optimizations

### Batch Processing
- Vulnerability processing in configurable batches
- Asynchronous action execution
- Connection pooling for external systems

### Caching
- Connector configuration caching
- Rule evaluation optimization
- Database query optimization with indexes

### Monitoring
- Execution statistics and success rates
- Performance metrics for rule evaluation
- Action execution timing and failure rates

## Deployment

### Database Migrations
```bash
# Run Alembic migrations
alembic upgrade head
```

### Environment Variables
```bash
# Required for workflow functionality
DATABASE_URL=postgresql://user:pass@host:port/db
OPENSEARCH_HOST=localhost
OPENSEARCH_PORT=9200
SECRET_KEY=your-secret-key
```

### Dependencies
```bash
# Additional Python packages required
pip install aiohttp smtplib
```

## Usage Examples

### Example Workflow: Critical Vulnerability Alert
```json
{
  "name": "Critical Vulnerability Alert",
  "rules": [
    {
      "field": "cvss_score",
      "operator": "greater_than_or_equal",
      "value": 9.0
    }
  ],
  "rule_logic": "AND",
  "actions": [
    {
      "type": "email",
      "config": {
        "connector_id": 1,
        "to": ["security-team@company.com"],
        "subject": "CRITICAL: {{cve_id}} - Immediate Action Required",
        "body": "Critical vulnerability detected: {{description}}"
      }
    },
    {
      "type": "thehive",
      "config": {
        "connector_id": 2,
        "title": "Critical Vulnerability: {{cve_id}}",
        "severity": 4,
        "tlp": 2
      }
    }
  ]
}
```

### Example Workflow: Product-Specific Monitoring
```json
{
  "name": "Apache Product Vulnerabilities",
  "rules": [
    {
      "field": "products_text",
      "operator": "contains",
      "value": "apache"
    },
    {
      "field": "cvss_score",
      "operator": "greater_than_or_equal",
      "value": 7.0
    }
  ],
  "rule_logic": "AND",
  "actions": [
    {
      "type": "servicenow",
      "config": {
        "connector_id": 3,
        "short_description": "Apache Vulnerability: {{cve_id}}",
        "priority": 2,
        "assignment_group": "Apache-Team"
      }
    }
  ]
}
```

## Future Enhancements

### Planned Features
1. **Advanced Scheduling**: More complex cron expressions and time-based rules
2. **Webhook Actions**: Generic HTTP webhook connector for custom integrations
3. **Slack Integration**: Direct Slack notifications and bot interactions
4. **JIRA Integration**: Automatic ticket creation and management
5. **Custom Scripts**: Python script execution for complex logic
6. **Workflow Templates**: Pre-built templates for common use cases
7. **Bulk Operations**: Mass workflow operations and imports
8. **Advanced Analytics**: Workflow performance analytics and optimization suggestions

### Technical Improvements
1. **Distributed Execution**: Redis-based task queue for scalability
2. **Advanced Caching**: Redis caching for improved performance
3. **Metrics Collection**: Prometheus metrics integration
4. **Health Monitoring**: Comprehensive health checks and monitoring
5. **Configuration Validation**: Advanced validation and testing tools

This implementation provides a robust, scalable, and user-friendly workflow automation system that significantly enhances SafeMatrix's vulnerability management capabilities.