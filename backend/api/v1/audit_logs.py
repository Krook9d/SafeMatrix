from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.dependencies import get_db, get_current_user, require_roles
from ...schemas.user import User
from ...crud.audit_log import get_audit_logs

router = APIRouter()

@router.get("/audit-logs")
async def get_audit_logs_endpoint(
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Retrieve audit logs from the backend (admin only)
    """
    try:
        logs, total = get_audit_logs(db, skip=offset, limit=limit)
        
        # Convert to dict format for API response
        logs_data = []
        for log in logs:
            logs_data.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "user": log.user,
                "action": log.action,
                "resource": log.resource,
                "details": log.details,
                "ip_address": log.ip_address,
                "success": log.success
            })
        
        return {
            "logs": logs_data,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving audit logs: {str(e)}")