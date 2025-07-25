from fastapi import APIRouter, Depends, HTTPException
from opensearchpy import OpenSearch
from typing import List
from pydantic import BaseModel

from ...schemas import inventory as schemas_inventory
from ...schemas import host as schemas_host
from ...crud import inventory as crud_inventory
from ...crud import host as crud_host
from ...core.dependencies import get_opensearch_client

router = APIRouter()

class SoftwareItem(BaseModel):
    """Schema pour un élément logiciel dans la synchronisation"""
    software_name: str
    version: str
    vendor: str = ""
    install_date: str = ""

class InventorySyncRequest(BaseModel):
    """Schema pour la requête de synchronisation d'inventaire"""
    host_id: str
    software_list: List[SoftwareItem]

@router.post("/agents/register", response_model=schemas_host.Host, status_code=201)
def register_agent_host(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    host_in: schemas_host.HostCreate,
):
    """
    Register a new host from an agent or return existing host if already registered.
    This endpoint is designed for agent use and doesn't require authentication.
    Uses MAC address or hostname+IP to identify existing hosts.
    """
    try:
        # Use find_or_create_host to avoid duplicates
        created_host = crud_host.find_or_create_host(client=client, host_in=host_in)
        return created_host
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        )


@router.post("/agents/sync-inventory", status_code=200)
def sync_agent_inventory(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    sync_request: InventorySyncRequest,
):
    """
    Synchronise l'inventaire d'un host avec une nouvelle liste de logiciels.
    Ajoute les nouveaux, met à jour les versions changées, supprime les obsolètes.
    """
    try:
        # Convertir la requête en format attendu par la fonction CRUD
        software_list = [
            {
                "software_name": item.software_name,
                "version": item.version,
                "vendor": item.vendor,
                "install_date": item.install_date
            }
            for item in sync_request.software_list
        ]
        
        stats = crud_inventory.sync_host_inventory(
            client=client, 
            host_id=sync_request.host_id, 
            new_software_list=software_list
        )
        
        return {
            "message": "Inventory synchronized successfully",
            "statistics": stats
        }
    except ValueError as e:
        # Host not found
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Debug: Exception in inventory sync: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        )


@router.post("/agents/inventory", response_model=schemas_inventory.Inventory, status_code=201)
def submit_agent_inventory(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    inventory_in: schemas_inventory.InventoryCreate,
):
    """
    Submit inventory data from an agent.
    This endpoint is designed for agent use and doesn't require authentication.
    
    DEPRECATED: Use /agents/sync-inventory instead to avoid duplicates.
    """
    try:
        print(f"Debug: Received inventory submission: {inventory_in}")
        created_inventory = crud_inventory.create_inventory(client=client, inventory_in=inventory_in)
        print(f"Debug: Successfully created inventory: {created_inventory.get('_id', 'unknown')}")
        return created_inventory
    except ValueError as e:
        # This catches the error if the host_id is not found
        print(f"Debug: ValueError in inventory submission: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Debug: Exception in inventory submission: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        ) 