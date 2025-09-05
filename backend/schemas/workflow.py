from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class WorkflowStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DRAFT = "DRAFT"

class ConnectorType(str, Enum):
    EMAIL = "EMAIL"
    THEHIVE = "THEHIVE"
    SERVICENOW = "SERVICENOW"
    JIRA = "JIRA"

class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"

class RuleOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    GREATER_THAN = "greater_than"
    GREATER_THAN_OR_EQUAL = "greater_than_or_equal"
    LESS_THAN = "less_than"
    LESS_THAN_OR_EQUAL = "less_than_or_equal"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IN = "in"
    NOT_IN = "not_in"

class RuleCondition(BaseModel):
    field: str = Field(..., description="Field to evaluate (e.g., 'cvss_score', 'affected_products')")
    operator: RuleOperator = Field(..., description="Comparison operator")
    value: Union[str, int, float, List[str]] = Field(..., description="Value to compare against")
    
    class Config:
        use_enum_values = True

class EmailAction(BaseModel):
    connector_id: int = Field(..., description="Email connector configuration ID")
    to: List[str] = Field(..., description="Recipient email addresses")
    cc: Optional[List[str]] = Field(default=None, description="CC email addresses")
    subject: str = Field(..., description="Email subject template")
    body: str = Field(..., description="Email body template (supports variables)")
    
class TheHiveAction(BaseModel):
    connector_id: int = Field(..., description="TheHive connector configuration ID")
    title: str = Field(..., description="Case title template")
    description: str = Field(..., description="Case description template")
    severity: int = Field(default=2, ge=1, le=4, description="Case severity (1-4)")
    tlp: int = Field(default=2, ge=0, le=3, description="TLP level (0-3)")
    tags: Optional[List[str]] = Field(default=None, description="Case tags")

class ServiceNowAction(BaseModel):
    connector_id: int = Field(..., description="ServiceNow connector configuration ID")
    short_description: str = Field(..., description="Incident short description template")
    description: str = Field(..., description="Incident description template")
    priority: int = Field(default=3, ge=1, le=5, description="Incident priority (1-5)")
    category: Optional[str] = Field(default=None, description="Incident category")
    assignment_group: Optional[str] = Field(default=None, description="Assignment group")

class JiraAction(BaseModel):
    connector_id: int = Field(..., description="Jira connector configuration ID")
    title: Optional[str] = Field(default=None, description="Issue title template")
    project_key: Optional[str] = Field(default=None, description="Project key override")
    issue_type: str = Field(default="Task", description="Issue type")

class WorkflowAction(BaseModel):
    type: str = Field(..., description="Action type (email, thehive, servicenow, jira)")
    config: Union[EmailAction, TheHiveAction, ServiceNowAction, JiraAction] = Field(..., description="Action configuration")
    
    @validator('config', pre=True)
    def validate_config(cls, v, values):
        action_type = values.get('type')
        if action_type == 'email' and not isinstance(v, EmailAction):
            return EmailAction(**v)
        elif action_type == 'thehive' and not isinstance(v, TheHiveAction):
            return TheHiveAction(**v)
        elif action_type == 'servicenow' and not isinstance(v, ServiceNowAction):
            return ServiceNowAction(**v)
        elif action_type == 'jira' and not isinstance(v, JiraAction):
            return JiraAction(**v)
        return v

class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Workflow name")
    description: Optional[str] = Field(default=None, description="Workflow description")
    rules: List[RuleCondition] = Field(..., min_items=1, description="Rule conditions")
    rule_logic: str = Field(default="AND", pattern="^(AND|OR)$", description="Rule logic (AND/OR)")
    actions: List[WorkflowAction] = Field(..., min_items=1, description="Actions to execute")
    enabled: bool = Field(default=True, description="Whether workflow is enabled")
    trigger_on_ingest: bool = Field(default=True, description="Trigger on vulnerability ingest")
    trigger_on_schedule: bool = Field(default=False, description="Trigger on schedule")
    schedule_cron: Optional[str] = Field(default=None, description="Cron expression for scheduled execution")
    
    @validator('schedule_cron')
    def validate_cron(cls, v, values):
        if values.get('trigger_on_schedule') and not v:
            raise ValueError('schedule_cron is required when trigger_on_schedule is True')
        return v

class WorkflowCreate(WorkflowBase):
    status: WorkflowStatus = Field(default=WorkflowStatus.DRAFT, description="Workflow status")

class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[WorkflowStatus] = None
    rules: Optional[List[RuleCondition]] = None
    rule_logic: Optional[str] = Field(None, pattern="^(AND|OR)$")
    actions: Optional[List[WorkflowAction]] = None
    enabled: Optional[bool] = None
    trigger_on_ingest: Optional[bool] = None
    trigger_on_schedule: Optional[bool] = None
    schedule_cron: Optional[str] = None

class Workflow(WorkflowBase):
    id: int
    status: WorkflowStatus
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True
        use_enum_values = True

class WorkflowExecutionBase(BaseModel):
    trigger_type: str = Field(..., description="Trigger type (ingest, schedule, manual)")
    vulnerability_id: Optional[str] = Field(default=None, description="CVE ID that triggered execution")

class WorkflowExecutionCreate(WorkflowExecutionBase):
    workflow_id: int

class WorkflowExecution(WorkflowExecutionBase):
    id: int
    workflow_id: int
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    rules_matched: bool
    actions_executed: int
    actions_failed: int
    execution_log: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    idempotency_key: Optional[str] = None
    
    class Config:
        from_attributes = True
        use_enum_values = True

class ActionLogBase(BaseModel):
    action_type: str
    action_config: Dict[str, Any]

class ActionLog(ActionLogBase):
    id: int
    execution_id: int
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    response_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True
        use_enum_values = True

# Connector Configuration Schemas
class EmailConnectorConfig(BaseModel):
    smtp_host: str = Field(..., description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    use_tls: bool = Field(default=True, description="Use TLS encryption")
    username: Optional[str] = Field(default="", description="SMTP username")
    password: Optional[str] = Field(default="", description="SMTP password")
    from_email: str = Field(..., description="From email address")
    from_name: Optional[str] = Field(default=None, description="From name")

class TheHiveConnectorConfig(BaseModel):
    url: str = Field(..., description="TheHive instance URL")
    api_key: str = Field(..., description="TheHive API key")
    organization: Optional[str] = Field(default=None, description="Organization name")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")

class ServiceNowConnectorConfig(BaseModel):
    instance_url: str = Field(..., description="ServiceNow instance URL")
    username: str = Field(..., description="ServiceNow username")
    password: str = Field(..., description="ServiceNow password")
    table: str = Field(default="incident", description="ServiceNow table name")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates when connecting to ServiceNow")

class JiraConnectorConfig(BaseModel):
    url: str = Field(..., description="Jira Cloud instance URL")
    email: str = Field(..., description="Jira account email")
    api_token: str = Field(..., description="Jira API token")
    project_key: str = Field(..., description="Default project key")

class ConnectorConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Connector name")
    connector_type: ConnectorType = Field(..., description="Connector type")
    config: Union[EmailConnectorConfig, TheHiveConnectorConfig, ServiceNowConnectorConfig, JiraConnectorConfig] = Field(..., description="Connector configuration")
    enabled: bool = Field(default=True, description="Whether connector is enabled")

class ConnectorConfigCreate(ConnectorConfigBase):
    pass

class ConnectorConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    config: Optional[Union[EmailConnectorConfig, TheHiveConnectorConfig, ServiceNowConnectorConfig, JiraConnectorConfig]] = None
    enabled: Optional[bool] = None

class ConnectorConfig(ConnectorConfigBase):
    id: int
    last_tested_at: Optional[datetime] = None
    test_status: Optional[str] = None
    test_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str
    
    class Config:
        from_attributes = True
        use_enum_values = True

# Test and validation schemas
class WorkflowTestRequest(BaseModel):
    vulnerability_id: str = Field(..., description="CVE ID to test against")

class WorkflowTestResult(BaseModel):
    rules_matched: bool
    matched_rules: List[Dict[str, Any]]
    actions_to_execute: List[Dict[str, Any]]
    test_log: Dict[str, Any]

class ConnectorTestResult(BaseModel):
    success: bool
    message: str
    response_data: Optional[Dict[str, Any]] = None