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
    level: str = "",
    date: str = "",
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Retrieve server logs from the backend log file (admin only)
    Supports filtering by log level and date
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
        
        # Parse and filter logs
        filtered_logs = []
        for line in lines:
            # Parse the log line
            # Format: timestamp - logger - level - message
            parts = line.strip().split(' - ', 3)
            if len(parts) >= 4:
                timestamp, logger, level_value, message = parts
                
                # Apply filters
                if level and level != level_value:
                    continue
                    
                if date:
                    # Handle both date-only and datetime filtering
                    # If date includes time (has space), check exact match up to minutes
                    if ' ' in date:
                        # Format: YYYY-MM-DD HH:MM
                        filter_datetime = date.split('.')[0]  # Remove milliseconds if present
                        if not timestamp.startswith(filter_datetime):
                            continue
                    else:
                        # Date-only filter: YYYY-MM-DD
                        if not timestamp.startswith(date):
                            continue
                    
                filtered_logs.append({
                    "timestamp": timestamp,
                    "logger": logger,
                    "level": level_value,
                    "message": message
                })
        
        # Reverse the lines to show newest first
        filtered_logs = filtered_logs[::-1]
        total = len(filtered_logs)
        
        # Apply pagination
        start = offset
        end = offset + limit
        paginated_logs = filtered_logs[start:end]
        
        # Convert to the expected format
        logs_data = []
        for i, log_entry in enumerate(paginated_logs):
            logs_data.append({
                "id": total - offset - i,
                "timestamp": log_entry["timestamp"],
                "user": log_entry["logger"],
                "action": log_entry["level"],
                "resource": "",
                "details": log_entry["message"],
                "ip_address": "",
                "success": "INFO" if log_entry["level"] == "INFO" else log_entry["level"]
            })
        
        return {
            "logs": logs_data,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving server logs: {str(e)}")