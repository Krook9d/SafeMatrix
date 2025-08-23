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
    try:
        print(f"Debug: Received connector data: {connector_in}")
        print(f"Debug: Connector type: {connector_in.connector_type}")
        print(f"Debug: Config: {connector_in.config}")
        
        connector = crud_workflow.create_connector_config(
            db=db,
            connector=connector_in,
            created_by=current_user.username
        )
        return connector
    except Exception as e:
        print(f"Debug: Exception in create_connector: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        )

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
        print(f"Debug: Testing connector {connector_id} of type {connector_config.connector_type}")
        print(f"Debug: Config: {connector_config.config}")
        
        # Create connector instance and test
        try:
            connector = ConnectorFactory.create_connector(
                connector_config.connector_type,
                connector_config.config
            )
            print(f"Debug: Created connector instance: {connector}")
        except Exception as e:
            print(f"Debug: Failed to create connector: {e}")
            raise
        
        try:
            result = await connector.test_connection()
            print(f"Debug: Test result: {result}")
        except Exception as e:
            print(f"Debug: Failed to test connection: {e}")
            raise
        
        # Update test status in database
        test_status = "success" if result.get("success") else "failed"
        test_message = result.get("message", "")
        print(f"Debug: Test status: {test_status}, message: {test_message}")
        
        crud_workflow.update_connector_test_status(
            db=db,
            connector_id=connector_id,
            test_status=test_status,
            test_message=test_message
        )
        
        return ConnectorTestResult(**result)
        
    except Exception as e:
        print(f"Debug: Exception in test_connector: {e}")
        import traceback
        traceback.print_exc()
        
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