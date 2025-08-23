from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.core.dependencies import get_db, get_current_user
from backend.schemas import user as schemas_user
from backend.schemas.workflow import (
    Workflow, WorkflowCreate, WorkflowUpdate, WorkflowExecution,
    WorkflowTestRequest, WorkflowTestResult, WorkflowStatus, ExecutionStatus
)
from backend.crud import workflow as crud_workflow
from backend.core.workflow_engine import WorkflowEngine
from backend.crud.vulnerability import get_vulnerability_by_id
from backend.core.dependencies import get_opensearch_client
from opensearchpy import OpenSearch

router = APIRouter()

@router.post("/", response_model=Workflow)
async def create_workflow(
    *,
    db: Session = Depends(get_db),
    workflow_in: WorkflowCreate,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Create a new workflow."""
    try:
        print(f"Debug: Creating workflow with data: {workflow_in}")
        print(f"Debug: Workflow name: {workflow_in.name}")
        print(f"Debug: Workflow status: {workflow_in.status}")
        print(f"Debug: Workflow rules: {workflow_in.rules}")
        print(f"Debug: Workflow actions: {workflow_in.actions}")
        
        workflow = crud_workflow.create_workflow(
            db=db, 
            workflow=workflow_in, 
            created_by=current_user.username
        )
        return workflow
    except Exception as e:
        print(f"Debug: Exception in create_workflow: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        )

@router.get("/", response_model=List[Workflow])
async def list_workflows(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[WorkflowStatus] = Query(None),
    enabled: Optional[bool] = Query(None),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """List workflows with optional filtering."""
    workflows = crud_workflow.get_workflows(
        db=db, 
        skip=skip, 
        limit=limit, 
        status=status, 
        enabled=enabled
    )
    return workflows

@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Get a workflow by ID."""
    workflow = crud_workflow.get_workflow(db=db, workflow_id=workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: int,
    *,
    db: Session = Depends(get_db),
    workflow_in: WorkflowUpdate,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Update a workflow."""
    workflow = crud_workflow.update_workflow(
        db=db, 
        workflow_id=workflow_id, 
        workflow_update=workflow_in,
        updated_by=current_user.username
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Delete a workflow."""
    success = crud_workflow.delete_workflow(db=db, workflow_id=workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Workflow deleted successfully"}

@router.post("/{workflow_id}/test", response_model=WorkflowTestResult)
async def test_workflow(
    workflow_id: int,
    *,
    db: Session = Depends(get_db),
    opensearch_client: OpenSearch = Depends(get_opensearch_client),
    test_request: WorkflowTestRequest,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Test a workflow against a specific vulnerability."""
    # Get workflow
    workflow = crud_workflow.get_workflow(db=db, workflow_id=workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get vulnerability data
    vulnerability_data = get_vulnerability_by_id(opensearch_client, test_request.vulnerability_id)
    if not vulnerability_data:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    
    # Test workflow
    engine = WorkflowEngine(db)
    result = await engine.test_workflow(workflow, vulnerability_data)
    
    return WorkflowTestResult(**result)

@router.post("/{workflow_id}/test-custom")
async def test_workflow_with_custom_data(
    workflow_id: int,
    *,
    db: Session = Depends(get_db),
    test_data: dict,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Test a workflow with custom vulnerability data."""
    # Get workflow
    workflow = crud_workflow.get_workflow(db=db, workflow_id=workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Test workflow with custom data
    engine = WorkflowEngine(db)
    result = await engine.test_workflow_with_custom_data(workflow, test_data)
    
    return result

@router.post("/{workflow_id}/execute")
async def execute_workflow_manually(
    workflow_id: int,
    *,
    db: Session = Depends(get_db),
    opensearch_client: OpenSearch = Depends(get_opensearch_client),
    test_request: WorkflowTestRequest,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Manually execute a workflow against a specific vulnerability."""
    # Get workflow
    workflow = crud_workflow.get_workflow(db=db, workflow_id=workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get vulnerability data
    vulnerability_data = get_vulnerability_by_id(opensearch_client, test_request.vulnerability_id)
    if not vulnerability_data:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    
    # Execute workflow
    engine = WorkflowEngine(db)
    result = await engine.execute_workflow(workflow, vulnerability_data, trigger_type="manual")
    
    return result

@router.get("/{workflow_id}/executions", response_model=List[WorkflowExecution])
async def get_workflow_executions(
    workflow_id: int,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    status: Optional[ExecutionStatus] = Query(None),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Get executions for a specific workflow."""
    # Verify workflow exists
    workflow = crud_workflow.get_workflow(db=db, workflow_id=workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    executions = crud_workflow.get_workflow_executions(
        db=db,
        workflow_id=workflow_id,
        status=status,
        skip=skip,
        limit=limit
    )
    return executions

@router.get("/executions/", response_model=List[WorkflowExecution])
async def list_all_executions(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    workflow_id: Optional[int] = Query(None),
    vulnerability_id: Optional[str] = Query(None),
    status: Optional[ExecutionStatus] = Query(None),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """List all workflow executions with optional filtering."""
    executions = crud_workflow.get_workflow_executions(
        db=db,
        workflow_id=workflow_id,
        vulnerability_id=vulnerability_id,
        status=status,
        skip=skip,
        limit=limit
    )
    return executions

@router.get("/executions/{execution_id}")
async def get_execution_details(
    execution_id: int,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Get detailed information about a workflow execution."""
    execution = crud_workflow.get_workflow_execution(db=db, execution_id=execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    action_logs = crud_workflow.get_execution_action_logs(db=db, execution_id=execution_id)
    
    return {
        "execution": execution,
        "action_logs": action_logs
    }

@router.get("/stats/")
async def get_workflow_statistics(
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Get workflow statistics."""
    stats = crud_workflow.get_workflow_stats(db=db)
    return stats