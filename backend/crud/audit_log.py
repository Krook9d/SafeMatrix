from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from ..models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    user: str,
    action: str,
    resource: str,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: str = "SUCCESS"
) -> AuditLog:
    """Create a new audit log entry."""
    audit_log = AuditLog(
        user=user,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def get_audit_logs(
    db: Session,
    skip: int = 0,
    limit: int = 100
) -> tuple[List[AuditLog], int]:
    """Get audit logs with pagination."""
    total = db.query(AuditLog).count()
    logs = (
        db.query(AuditLog)
        .order_by(desc(AuditLog.timestamp))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return logs, total


def get_audit_logs_by_user(
    db: Session,
    user: str,
    skip: int = 0,
    limit: int = 100
) -> List[AuditLog]:
    """Get audit logs for a specific user."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.user == user)
        .order_by(desc(AuditLog.timestamp))
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_audit_logs_by_action(
    db: Session,
    action: str,
    skip: int = 0,
    limit: int = 100
) -> List[AuditLog]:
    """Get audit logs for a specific action."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.action == action)
        .order_by(desc(AuditLog.timestamp))
        .offset(skip)
        .limit(limit)
        .all()
    )