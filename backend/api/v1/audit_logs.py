from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime, timedelta

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
    day: str = "",
    start: str = "",
    end: str = "",
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    """
    Retrieve server logs from the backend log file (admin only)
    Supports filtering by log level and date
    """
    try:
        log_dir = "logs"

        # Determine which log files to read
        log_files: List[str] = []

        def add_file_for_date(d: datetime):
            filename = os.path.join(log_dir, f"backend_{d.strftime('%Y-%m-%d')}.log")
            if os.path.exists(filename):
                log_files.append(filename)

        # Priority of filters:
        # 1) Range filter if start & end provided
        # 2) Day filter if day provided
        # 3) Legacy 'date' filter or default to today
        start_dt: Optional[datetime] = None
        end_dt: Optional[datetime] = None

        if start and end:
            # Expect format 'YYYY-MM-DD HH:MM' (minutes precision)
            try:
                start_dt = datetime.strptime(start, "%Y-%m-%d %H:%M")
                end_dt = datetime.strptime(end, "%Y-%m-%d %H:%M")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start/end datetime format. Use 'YYYY-MM-DD HH:MM'.")
            if end_dt < start_dt:
                raise HTTPException(status_code=400, detail="'end' must be after 'start'.")
            # Add files for all days in range
            day_cursor = start_dt.date()
            while day_cursor <= end_dt.date():
                add_file_for_date(datetime.combine(day_cursor, datetime.min.time()))
                day_cursor += timedelta(days=1)
        elif day:
            # Expect format 'YYYY-MM-DD'
            try:
                day_dt = datetime.strptime(day, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid day format. Use 'YYYY-MM-DD'.")
            add_file_for_date(day_dt)
        else:
            # Legacy: date filter may be provided; we still default to today file
            add_file_for_date(datetime.now())

        if not log_files:
            return {
                "logs": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }

        # Read all relevant log files
        lines: List[str] = []
        for lf in log_files:
            try:
                with open(lf, 'r', encoding='utf-8') as f:
                    lines.extend(f.readlines())
            except Exception:
                # Ignore files that can't be read
                continue
        
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
                    
                # New filters
                if start_dt and end_dt:
                    try:
                        ts = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S,%f")
                    except ValueError:
                        # If parsing fails, skip the line
                        continue
                    if not (start_dt <= ts <= end_dt):
                        continue
                elif day:
                    # Keep only logs whose timestamp starts with the given day
                    if not timestamp.startswith(day):
                        continue
                elif date:
                    # Backwards-compat: same behavior as before
                    if ' ' in date:
                        filter_datetime = date.split('.')[0]
                        if not timestamp.startswith(filter_datetime):
                            continue
                    else:
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