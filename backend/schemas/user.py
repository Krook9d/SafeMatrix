import datetime
from pydantic import BaseModel
from enum import Enum

# Shared properties
class UserBase(BaseModel):
    class Role(str, Enum):
        admin = "admin"
        analyst = "analyst"
        viewer = "viewer"

    username: str
    role: Role | None = Role.viewer

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to receive for updates
class UserUpdateRole(BaseModel):
    role: UserBase.Role

# Properties to return to client
class User(UserBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True