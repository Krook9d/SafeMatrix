from sqlalchemy.orm import Session
from fastapi import Request
from typing import Optional
from ..crud.audit_log import create_audit_log
from ..schemas.user import User


class AuditLogger:
    """Utility class for audit logging"""
    
    @staticmethod
    def log_action(
        db: Session,
        user: str,
        action: str,
        resource: str,
        details: Optional[str] = None,
        request: Optional[Request] = None,
        success: str = "SUCCESS"
    ):
        """Log an audit action"""
        ip_address = None
        user_agent = None
        
        if request:
            # Try to get real IP from various headers
            ip_address = (
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
                request.headers.get("X-Real-IP") or
                request.client.host if request.client else None
            )
            user_agent = request.headers.get("User-Agent")
        
        return create_audit_log(
            db=db,
            user=user,
            action=action,
            resource=resource,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success
        )
    
    @staticmethod
    def log_login(db: Session, user: str, request: Optional[Request] = None, success: bool = True):
        """Log a login attempt"""
        return AuditLogger.log_action(
            db, user, "LOGIN", "AUTH", 
            f"{'Successful' if success else 'Failed'} login attempt",
            request, "SUCCESS" if success else "FAILED"
        )
    
    @staticmethod
    def log_logout(db: Session, user: str, request: Optional[Request] = None):
        """Log a logout"""
        return AuditLogger.log_action(
            db, user, "LOGOUT", "AUTH", "User logged out", request
        )
    
    @staticmethod
    def log_create(db: Session, user: str, resource: str, details: str, request: Optional[Request] = None):
        """Log a create operation"""
        return AuditLogger.log_action(
            db, user, "CREATE", resource, details, request
        )
    
    @staticmethod
    def log_update(db: Session, user: str, resource: str, details: str, request: Optional[Request] = None):
        """Log an update operation"""
        return AuditLogger.log_action(
            db, user, "UPDATE", resource, details, request
        )
    
    @staticmethod
    def log_delete(db: Session, user: str, resource: str, details: str, request: Optional[Request] = None):
        """Log a delete operation"""
        return AuditLogger.log_action(
            db, user, "DELETE", resource, details, request
        )
    
    @staticmethod
    def log_view(db: Session, user: str, resource: str, details: str, request: Optional[Request] = None):
        """Log a view operation"""
        return AuditLogger.log_action(
            db, user, "VIEW", resource, details, request
        )