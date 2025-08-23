from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from datetime import datetime
from backend.schemas.workflow import ConnectorType, WorkflowStatus, ExecutionStatus

Base = declarative_base()

class RuleOperator(enum.Enum):
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

class Workflow(Base):
    __tablename__ = "workflows"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.DRAFT, nullable=False)
    
    # Rule configuration
    rules = Column(JSON, nullable=False)  # List of rule conditions
    rule_logic = Column(String(10), default="AND", nullable=False)  # AND/OR logic
    
    # Action configuration
    actions = Column(JSON, nullable=False)  # List of actions to execute
    
    # Execution settings
    enabled = Column(Boolean, default=True, nullable=False)
    trigger_on_ingest = Column(Boolean, default=True, nullable=False)
    trigger_on_schedule = Column(Boolean, default=False, nullable=False)
    schedule_cron = Column(String(100))  # Cron expression for scheduled execution
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String(255), nullable=False)
    updated_by = Column(String(255))
    
    # Relationships
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")

class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    
    # Execution context
    trigger_type = Column(String(50), nullable=False)  # "ingest", "schedule", "manual"
    vulnerability_id = Column(String(50), index=True)  # CVE ID that triggered this execution
    
    # Execution details
    status = Column(SQLEnum(ExecutionStatus), default=ExecutionStatus.PENDING, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    
    # Results
    rules_matched = Column(Boolean, default=False, nullable=False)
    actions_executed = Column(Integer, default=0, nullable=False)
    actions_failed = Column(Integer, default=0, nullable=False)
    
    # Logs and errors
    execution_log = Column(JSON)  # Detailed execution log
    error_message = Column(Text)
    
    # Idempotency
    idempotency_key = Column(String(255), index=True)  # Prevent duplicate executions
    
    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    action_logs = relationship("ActionLog", back_populates="execution", cascade="all, delete-orphan")

class ActionLog(Base):
    __tablename__ = "action_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("workflow_executions.id"), nullable=False, index=True)
    
    # Action details
    action_type = Column(String(50), nullable=False)  # email, thehive, servicenow
    action_config = Column(JSON, nullable=False)  # Action configuration used
    
    # Execution results
    status = Column(SQLEnum(ExecutionStatus), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    
    # Response data
    response_data = Column(JSON)  # Response from external system
    error_message = Column(Text)
    
    # Relationships
    execution = relationship("WorkflowExecution", back_populates="action_logs")

class ConnectorConfig(Base):
    __tablename__ = "connector_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    connector_type = Column(SQLEnum(ConnectorType), nullable=False)
    
    # Configuration
    config = Column(JSON, nullable=False)  # Connector-specific configuration
    credentials = Column(JSON)  # Encrypted credentials
    
    # Status
    enabled = Column(Boolean, default=True, nullable=False)
    last_tested_at = Column(DateTime(timezone=True))
    test_status = Column(String(50))  # "success", "failed", "pending"
    test_message = Column(Text)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String(255), nullable=False)