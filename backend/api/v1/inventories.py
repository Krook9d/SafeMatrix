from fastapi import APIRouter, Depends, HTTPException
from opensearchpy import OpenSearch
from typing import List, Optional

from ...schemas import inventory as schemas_inventory
from ...schemas import user as schemas_user
from ...crud import inventory as crud_inventory
from ...core.dependencies import get_opensearch_client, get_current_user

router = APIRouter()


@router.get("/inventories/", response_model=List[schemas_inventory.Inventory])
def list_inventories(
    client: OpenSearch = Depends(get_opensearch_client),
    host_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: schemas_user.User = Depends(get_current_user),
):
    """
    Retrieve a list of inventory items, optionally filtered by host_id.
    """
    inventories = crud_inventory.get_inventories(
        client=client, host_id=host_id, skip=skip, limit=limit
    )
    return inventories


@router.put("/inventories/{inventory_id}", response_model=schemas_inventory.Inventory)
def update_existing_inventory(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    inventory_id: str,
    inventory_in: schemas_inventory.InventoryCreate,
    current_user: schemas_user.User = Depends(get_current_user),
):
    """
    Update an inventory item by its ID.
    """
    try:
        updated_inventory = crud_inventory.update_inventory(
            client=client, inventory_id=inventory_id, inventory_in=inventory_in
        )
        if updated_inventory is None:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        return updated_inventory
    except ValueError as e:
        # This catches the error if the host_id is not found
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/inventories/{inventory_id}", status_code=204)
def delete_existing_inventory(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    inventory_id: str,
    current_user: schemas_user.User = Depends(get_current_user), # Protect endpoint
):
    """
    Delete an inventory item by its ID.
    """
    deleted = crud_inventory.delete_inventory(client=client, inventory_id=inventory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    # No content to return on successful deletion
    return None


@router.post("/inventories/", response_model=schemas_inventory.Inventory, status_code=201)
def create_new_inventory(
    *,
    client: OpenSearch = Depends(get_opensearch_client),
    inventory_in: schemas_inventory.InventoryCreate,
    current_user: schemas_user.User = Depends(get_current_user),
):
    """
    Create a new inventory item for a host.
    """
    try:
        created_inventory = crud_inventory.create_inventory(client=client, inventory_in=inventory_in)
        return created_inventory
    except ValueError as e:
        # This catches the error if the host_id is not found
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {e}"
        ) 