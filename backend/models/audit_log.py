from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func

from .user import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user = Column(String, nullable=False)
    action = Column(String, nullable=False)  # LOGIN, CREATE, UPDATE, DELETE, VIEW, etc.
    resource = Column(String, nullable=False)  # AUTH, USER, WORKFLOW, etc.
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    success = Column(String, default="SUCCESS")  # SUCCESS, FAILED