from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from ipaddress import IPv4Address


class HostOS(BaseModel):
    """
    Schema for the operating system of a host.
    """
    name: str
    version: str


class HostBase(BaseModel):
    """
    Base schema for a host's properties.
    """
    hostname: str = Field(..., examples=["my-windows-pc"])
    ip_address: IPv4Address = Field(..., examples=["192.168.1.10"])
    mac_address: Optional[str] = Field(None, examples=["00:1B:44:11:3A:B7"])
    os: HostOS


class HostCreate(HostBase):
    """
    Schema used for creating a new host.
    This schema is what the API will expect in the request body.
    """
    pass


class Host(HostBase):
    """
    Schema for a host as it is stored and returned by the API.
    Includes fields that are managed by the database.
    """
    id: str = Field(..., alias="_id", examples=["dKKStAMkSASiGZCPAN-I4Q"])
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True 