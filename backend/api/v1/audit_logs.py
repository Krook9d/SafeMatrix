from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime

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
    Retrieve server logs from the backend log file (admin only)
    """
    try:
        log_dir = "logs"
        log_filename = f"{log_dir}/backend_{datetime.now().strftime('%Y-%m-%d')}.log"
        
        if not os.path.exists(log_filename):
            return {
                "logs": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        # Read the log file
        with open(log_filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Reverse the lines to show newest first
        lines = lines[::-1]
        total = len(lines)
        
        # Apply pagination
        start = offset
        end = offset + limit
        paginated_lines = lines[start:end]
        
        # Convert lines to log entries
        logs_data = []
        for i, line in enumerate(paginated_lines):
            # Parse the log line
            # Format: timestamp - logger - level - message
            parts = line.strip().split(' - ', 3)
            if len(parts) >= 4:
                timestamp, logger, level, message = parts
                logs_data.append({
                    "id": total - offset - i,
                    "timestamp": timestamp,
                    "user": logger,
                    "action": level,
                    "resource": "",
                    "details": message,
                    "ip_address": "",
                    "success": "INFO" if level == "INFO" else level
                })
            else:
                # If parsing fails, treat as plain text
                logs_data.append({
                    "id": total - offset - i,
                    "timestamp": datetime.now().isoformat(),
                    "user": "system",
                    "action": "LOG",
                    "resource": "",
                    "details": line.strip(),
                    "ip_address": "",
                    "success": "INFO"
                })
        
        return {
            "logs": logs_data,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving server logs: {str(e)}")