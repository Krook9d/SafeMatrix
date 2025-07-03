from fastapi import APIRouter, Depends, HTTPException
from opensearchpy import OpenSearch
from typing import List

import schemas.host
import crud.host
from core.dependencies import get_opensearch_client

router = APIRouter()


@router.get("/hosts/", response_model=List[schemas.host.Host])
def list_hosts(
    client: OpenSearch = Depends(get_opensearch_client),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve a list of hosts with pagination.
    """
    hosts = crud.host.get_hosts(client=client, skip=skip, limit=limit)
    return hosts


@router.get("/hosts/{host_id}", response_model=schemas.host.Host)
def read_host(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    host_id: str,
):
    """
    Get a single host by its ID.
    """
    host = crud.host.get_host(client=client, host_id=host_id)
    if host is None:
        raise HTTPException(status_code=404, detail="Host not found")
    return host


@router.put("/hosts/{host_id}", response_model=schemas.host.Host)
def update_existing_host(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    host_id: str,
    host_in: schemas.host.HostCreate,
):
    """
    Update a host by its ID.
    """
    updated_host = crud.host.update_host(client=client, host_id=host_id, host_in=host_in)
    if updated_host is None:
        raise HTTPException(status_code=404, detail="Host not found")
    return updated_host


@router.delete("/hosts/{host_id}", status_code=204)
def delete_existing_host(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    host_id: str,
):
    """
    Delete a host by its ID.
    """
    deleted = crud.host.delete_host(client=client, host_id=host_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Host not found")
    return None # 204 No Content response


@router.post("/hosts/", response_model=schemas.host.Host, status_code=201)
def create_new_host(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    host_in: schemas.host.HostCreate,
):
    """
    Create a new host in the system.
    """
    try:
        created_host = crud.host.create_host(client=client, host_in=host_in)
        return created_host
    except Exception as e:
        # In a real application, you'd want more specific exception handling
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        ) 