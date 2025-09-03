import datetime
from sqlalchemy import Column, Integer, String, DateTime

from ..core.database import Base

class User(Base):
    """
    Database model for the User.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="viewer")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)