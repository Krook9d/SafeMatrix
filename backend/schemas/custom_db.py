from typing import List, Optional, Dict
from pydantic import BaseModel, EmailStr, Field


class TeamMemberBase(BaseModel):
    email: EmailStr
    name: Optional[str] = Field(default=None)
    role: Optional[str] = Field(default=None, description="Function or responsibility")
    notes: Optional[str] = Field(default=None)


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None


class TeamMember(TeamMemberBase):
    id: int
    team_id: int

    class Config:
        from_attributes = True


class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    extra_data: Optional[Dict[str, str]] = Field(default=None, description="Additional metadata such as phone, schedule")


class TeamCreate(TeamBase):
    members: List[TeamMemberCreate] = Field(default_factory=list)


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    extra_data: Optional[Dict[str, str]] = None
    members: Optional[List[TeamMemberCreate]] = None


class Team(TeamBase):
    id: int
    members: List[TeamMember] = Field(default_factory=list)

    class Config:
        from_attributes = True

