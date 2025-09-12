from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    host_id: str
    software_name: str
    version: str
    cve_id: str
    severity: Optional[str] = None
    score: Optional[float] = None
    status: str = Field(default="open", description="open|acknowledged|resolved")
    inventory_id: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None


class Alert(AlertBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class AlertUpdate(BaseModel):
    status: Optional[str] = None


class AlertList(BaseModel):
    total: int
    items: List[Alert]
