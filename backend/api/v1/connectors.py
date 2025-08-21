from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.core.dependencies import get_db, get_current_user
from backend.schemas import user as schemas_user
from backend.schemas.workflow import (
    ConnectorConfig, ConnectorConfigCreate, ConnectorConfigUpdate,
    ConnectorType, ConnectorTestResult
)
from backend.crud import workflow as crud_workflow
from backend.core.connectors.factory import ConnectorFactory

router = APIRouter()

@router.post("/", response_model=ConnectorConfig)
async def create_connector(
    *,
    db: Session = Depends(get_db),
    connector_in: ConnectorConfigCreate,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Create a new connector configuration."""
    connector = crud_workflow.create_connector_config(
        db=db,
        connector=connector_in,
        created_by=current_user.username
    )
    return connector

@router.get("/", response_model=List[ConnectorConfig])
async def list_connectors(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    connector_type: Optional[ConnectorType] = Query(None),
    enabled: Optional[bool] = Query(None),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """List connector configurations with optional filtering."""
    connectors = crud_workflow.get_connector_configs(
        db=db,
        connector_type=connector_type,
        enabled=enabled,
        skip=skip,
        limit=limit
    )
    return connectors

@router.get("/{connector_id}", response_model=ConnectorConfig)
async def get_connector(
    connector_id: int,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Get a connector configuration by ID."""
    connector = crud_workflow.get_connector_config(db=db, connector_id=connector_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    return connector

@router.put("/{connector_id}", response_model=ConnectorConfig)
async def update_connector(
    connector_id: int,
    *,
    db: Session = Depends(get_db),
    connector_in: ConnectorConfigUpdate,
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Update a connector configuration."""
    connector = crud_workflow.update_connector_config(
        db=db,
        connector_id=connector_id,
        connector_update=connector_in
    )
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    return connector

@router.delete("/{connector_id}")
async def delete_connector(
    connector_id: int,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Delete a connector configuration."""
    success = crud_workflow.delete_connector_config(db=db, connector_id=connector_id)
    if not success:
        raise HTTPException(status_code=404, detail="Connector not found")
    return {"message": "Connector deleted successfully"}

@router.post("/{connector_id}/test", response_model=ConnectorTestResult)
async def test_connector(
    connector_id: int,
    db: Session = Depends(get_db),
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Test a connector configuration."""
    # Get connector
    connector_config = crud_workflow.get_connector_config(db=db, connector_id=connector_id)
    if not connector_config:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    try:
        # Create connector instance and test
        connector = ConnectorFactory.create_connector(
            connector_config.connector_type,
            connector_config.config
        )
        
        result = await connector.test_connection()
        
        # Update test status in database
        test_status = "success" if result.get("success") else "failed"
        test_message = result.get("message", "")
        
        crud_workflow.update_connector_test_status(
            db=db,
            connector_id=connector_id,
            test_status=test_status,
            test_message=test_message
        )
        
        return ConnectorTestResult(**result)
        
    except Exception as e:
        # Update test status as failed
        crud_workflow.update_connector_test_status(
            db=db,
            connector_id=connector_id,
            test_status="failed",
            test_message=str(e)
        )
        
        return ConnectorTestResult(
            success=False,
            message=f"Test failed: {str(e)}"
        )

@router.get("/types/")
async def get_connector_types(
    current_user: schemas_user.User = Depends(get_current_user)
):
    """Get supported connector types."""
    return {
        "supported_types": ConnectorFactory.get_supported_types()
    }