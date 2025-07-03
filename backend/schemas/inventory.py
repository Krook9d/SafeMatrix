from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class Vulnerability(BaseModel):
    """
    Schema for a single vulnerability.
    """
    cve_id: str = Field(..., examples=["CVE-2021-44228"])
    description: str = Field(..., examples=["Log4j remote code execution vulnerability"])
    score: float = Field(..., examples=[10.0])
    url: Optional[str] = Field(None, examples=["https://nvd.nist.gov/vuln/detail/CVE-2021-44228"])


class InventoryBase(BaseModel):
    """
    Base schema for an inventory item's properties.
    """
    host_id: str = Field(..., examples=["Kzhj0JcBSiq_i8keBQv_"])
    software_name: str = Field(..., examples=["Apache Log4j"])
    version: str = Field(..., examples=["2.14.1"])
    install_date: Optional[datetime] = None
    vulnerabilities: List[Vulnerability] = []


class InventoryCreate(InventoryBase):
    """
    Schema used for creating a new inventory item.
    """
    pass


class Inventory(InventoryBase):
    """
    Schema for an inventory item as it is stored and returned by the API.
    """
    id: str = Field(..., alias="_id", examples=["dKKStAMkSASiGZCPAN-I4Q"])
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True 