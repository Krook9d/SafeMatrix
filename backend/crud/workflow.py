from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional, Dict, Any
from datetime import datetime

from backend.models.workflow import (
    Workflow, WorkflowExecution, ActionLog, ConnectorConfig,
    WorkflowStatus, ExecutionStatus, ConnectorType
)
from backend.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, ConnectorConfigCreate, ConnectorConfigUpdate
)

# Workflow CRUD operations
def _normalize_workflow_actions(actions: List[Any]) -> List[Dict[str, Any]]:
    """
    Normalize workflow actions to ensure they use connector_id: 0 for auto-resolution.
    This makes workflows portable across different installations.
    """
    normalized_actions = []
    
    for action in actions:
        action_dict = action.dict() if hasattr(action, 'dict') else action
        
        # Ensure config exists and set connector_id to 0 for auto-resolution
        if 'config' not in action_dict:
            action_dict['config'] = {}
        
        action_dict['config']['connector_id'] = 0
        normalized_actions.append(action_dict)
    
    return normalized_actions

def create_workflow(db: Session, workflow: WorkflowCreate, created_by: str) -> Workflow:
    """Create a new workflow."""
    db_workflow = Workflow(
        name=workflow.name,
        description=workflow.description,
        status=workflow.status,
        rules=[rule.dict() for rule in workflow.rules],
        rule_logic=workflow.rule_logic,
        actions=_normalize_workflow_actions(workflow.actions),
        enabled=workflow.enabled,
        trigger_on_ingest=workflow.trigger_on_ingest,
        trigger_on_schedule=workflow.trigger_on_schedule,
        schedule_cron=workflow.schedule_cron,
        created_by=created_by
    )
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

def get_workflow(db: Session, workflow_id: int) -> Optional[Workflow]:
    """Get a workflow by ID."""
    return db.query(Workflow).filter(Workflow.id == workflow_id).first()

def get_workflows(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    status: Optional[WorkflowStatus] = None,
    enabled: Optional[bool] = None
) -> List[Workflow]:
    """Get workflows with optional filtering."""
    query = db.query(Workflow)
    
    if status is not None:
        query = query.filter(Workflow.status == status)
    
    if enabled is not None:
        query = query.filter(Workflow.enabled == enabled)
    
    return query.order_by(desc(Workflow.updated_at)).offset(skip).limit(limit).all()

def update_workflow(
    db: Session, 
    workflow_id: int, 
    workflow_update: WorkflowUpdate,
    updated_by: str
) -> Optional[Workflow]:
    """Update a workflow."""
    db_workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not db_workflow:
        return None
    
    update_data = workflow_update.dict(exclude_unset=True)
    
    # Handle nested objects
    if 'rules' in update_data:
        update_data['rules'] = [rule.dict() for rule in workflow_update.rules]
    if 'actions' in update_data:
        update_data['actions'] = _normalize_workflow_actions(workflow_update.actions)
    
    update_data['updated_by'] = updated_by
    update_data['updated_at'] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(db_workflow, field, value)
    
    db.commit()
    db.refresh(db_workflow)
    return db_workflow

def delete_workflow(db: Session, workflow_id: int) -> bool:
    """Delete a workflow."""
    db_workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not db_workflow:
        return False
    
    db.delete(db_workflow)
    db.commit()
    return True

# Workflow Execution CRUD operations
def get_workflow_executions(
    db: Session,
    workflow_id: Optional[int] = None,
    vulnerability_id: Optional[str] = None,
    status: Optional[ExecutionStatus] = None,
    skip: int = 0,
    limit: int = 100
) -> List[WorkflowExecution]:
    """Get workflow executions with optional filtering."""
    query = db.query(WorkflowExecution)
    
    if workflow_id is not None:
        query = query.filter(WorkflowExecution.workflow_id == workflow_id)
    
    if vulnerability_id is not None:
        query = query.filter(WorkflowExecution.vulnerability_id == vulnerability_id)
    
    if status is not None:
        query = query.filter(WorkflowExecution.status == status)
    
    return query.order_by(desc(WorkflowExecution.started_at)).offset(skip).limit(limit).all()

def get_workflow_execution(db: Session, execution_id: int) -> Optional[WorkflowExecution]:
    """Get a workflow execution by ID."""
    return db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()

def get_execution_action_logs(db: Session, execution_id: int) -> List[ActionLog]:
    """Get action logs for an execution."""
    return db.query(ActionLog).filter(ActionLog.execution_id == execution_id).order_by(ActionLog.started_at).all()

# Connector Configuration CRUD operations
def create_connector_config(
    db: Session, 
    connector: ConnectorConfigCreate, 
    created_by: str
) -> ConnectorConfig:
    """Create a new connector configuration."""
    db_connector = ConnectorConfig(
        name=connector.name,
        connector_type=connector.connector_type,
        config=connector.config.dict(),
        enabled=connector.enabled,
        created_by=created_by
    )
    db.add(db_connector)
    db.commit()
    db.refresh(db_connector)
    return db_connector

def get_connector_config(db: Session, connector_id: int) -> Optional[ConnectorConfig]:
    """Get a connector configuration by ID."""
    return db.query(ConnectorConfig).filter(ConnectorConfig.id == connector_id).first()

def get_connector_configs(
    db: Session,
    connector_type: Optional[ConnectorType] = None,
    enabled: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> List[ConnectorConfig]:
    """Get connector configurations with optional filtering."""
    query = db.query(ConnectorConfig)
    
    if connector_type is not None:
        query = query.filter(ConnectorConfig.connector_type == connector_type)
    
    if enabled is not None:
        query = query.filter(ConnectorConfig.enabled == enabled)
    
    return query.order_by(desc(ConnectorConfig.updated_at)).offset(skip).limit(limit).all()

def update_connector_config(
    db: Session,
    connector_id: int,
    connector_update: ConnectorConfigUpdate
) -> Optional[ConnectorConfig]:
    """Update a connector configuration."""
    db_connector = db.query(ConnectorConfig).filter(ConnectorConfig.id == connector_id).first()
    if not db_connector:
        return None
    
    update_data = connector_update.dict(exclude_unset=True)
    
    if 'config' in update_data:
        update_data['config'] = connector_update.config.dict()
    
    update_data['updated_at'] = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(db_connector, field, value)
    
    db.commit()
    db.refresh(db_connector)
    return db_connector

def delete_connector_config(db: Session, connector_id: int) -> bool:
    """Delete a connector configuration."""
    db_connector = db.query(ConnectorConfig).filter(ConnectorConfig.id == connector_id).first()
    if not db_connector:
        return False
    
    db.delete(db_connector)
    db.commit()
    return True

def update_connector_test_status(
    db: Session,
    connector_id: int,
    test_status: str,
    test_message: str
) -> Optional[ConnectorConfig]:
    """Update connector test status."""
    db_connector = db.query(ConnectorConfig).filter(ConnectorConfig.id == connector_id).first()
    if not db_connector:
        return None
    
    db_connector.last_tested_at = datetime.utcnow()
    db_connector.test_status = test_status
    db_connector.test_message = test_message
    
    db.commit()
    db.refresh(db_connector)
    return db_connector

# Statistics and reporting
def get_workflow_stats(db: Session) -> Dict[str, Any]:
    """Get workflow statistics."""
    total_workflows = db.query(Workflow).count()
    active_workflows = db.query(Workflow).filter(Workflow.status == WorkflowStatus.ACTIVE).count()
    enabled_workflows = db.query(Workflow).filter(Workflow.enabled == True).count()
    
    total_executions = db.query(WorkflowExecution).count()
    successful_executions = db.query(WorkflowExecution).filter(WorkflowExecution.status == ExecutionStatus.SUCCESS).count()
    failed_executions = db.query(WorkflowExecution).filter(WorkflowExecution.status == ExecutionStatus.FAILED).count()
    
    return {
        "total_workflows": total_workflows,
        "active_workflows": active_workflows,
        "enabled_workflows": enabled_workflows,
        "total_executions": total_executions,
        "successful_executions": successful_executions,
        "failed_executions": failed_executions,
        "success_rate": (successful_executions / total_executions * 100) if total_executions > 0 else 0
    }