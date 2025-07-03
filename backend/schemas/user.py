import datetime
from pydantic import BaseModel

# Shared properties
class UserBase(BaseModel):
    username: str
    role: str | None = "user"

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to return to client
class User(UserBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True 