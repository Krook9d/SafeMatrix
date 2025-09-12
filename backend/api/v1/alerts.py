from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from opensearchpy import OpenSearch

from backend.core.dependencies import get_opensearch_client, get_current_user
from backend.schemas import user as schemas_user
from backend.schemas.alert import AlertList, Alert
from backend.crud import alert as crud_alert

router = APIRouter()


@router.get("/alerts/", response_model=AlertList)
def list_alerts(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    status: Optional[str] = Query(None, description="open|acknowledged|resolved"),
    host_id: Optional[str] = None,
    software: Optional[str] = None,
    cve_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: schemas_user.User = Depends(get_current_user),
):
    result = crud_alert.list_alerts(
        client,
        status=status,
        host_id=host_id,
        software=software,
        cve_id=cve_id,
        skip=skip,
        limit=limit,
    )
    return AlertList(**result)


@router.get("/alerts/{alert_id}", response_model=Alert)
def get_alert_by_id(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    alert_id: str,
    current_user: schemas_user.User = Depends(get_current_user),
):
    item = crud_alert.get_alert_by_id(client, alert_id=alert_id)
    if not item:
        raise HTTPException(status_code=404, detail="Alert not found")
    return Alert(**item)


@router.put("/alerts/{alert_id}/status")
def update_alert_status(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    alert_id: str,
    status: str = Query(..., description="open|acknowledged|resolved"),
    current_user: schemas_user.User = Depends(get_current_user),
):
    ok = crud_alert.update_alert_status(client, alert_id=alert_id, status=status)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}
