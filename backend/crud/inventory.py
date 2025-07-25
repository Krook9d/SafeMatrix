import datetime
from opensearchpy import OpenSearch, NotFoundError
from typing import Optional

from ..schemas.inventory import InventoryCreate
from ..core.opensearch_client import INDEX_INVENTORIES
from . import host as crud_host


def get_inventories(
    client: OpenSearch, *, host_id: Optional[str] = None, skip: int = 0, limit: int = 100
) -> list[dict]:
    """
    Get a list of inventory items from OpenSearch, with optional filtering and pagination.

    Args:
        client: The OpenSearch client instance.
        host_id: Optional host ID to filter the inventory items.
        skip: The number of items to skip.
        limit: The maximum number of items to return.

    Returns:
        A list of inventory documents.
    """
    query = {"match_all": {}}
    if host_id:
        query = {"term": {"host_id.keyword": host_id}}

    response = client.search(
        index=INDEX_INVENTORIES,
        body={
            "from": skip,
            "size": limit,
            "query": query
        }
    )
    
    hits = response.get("hits", {}).get("hits", [])
    results = []
    for hit in hits:
        doc = hit.get("_source", {})
        doc["_id"] = hit["_id"]
        results.append(doc)
        
    return results


def update_inventory(client: OpenSearch, *, inventory_id: str, inventory_in: InventoryCreate) -> dict | None:
    """
    Update an inventory item in OpenSearch.

    Args:
        client: The OpenSearch client instance.
        inventory_id: The ID of the inventory item to update.
        inventory_in: The new data for the item.

    Returns:
        The updated inventory document, or None if not found.
        
    Raises:
        ValueError: If the host_id provided does not exist.
    """
    # Verify the host still exists
    host_document = crud_host.get_host(client=client, host_id=inventory_in.host_id)
    if host_document is None:
        raise ValueError(f"Host with id '{inventory_in.host_id}' not found.")

    document = inventory_in.model_dump(mode="json")

    try:
        response = client.update(
            index=INDEX_INVENTORIES,
            id=inventory_id,
            body={"doc": document},
            refresh=True,
            _source=True
        )
        updated_doc = response.get("get", {}).get("_source", {})
        updated_doc["_id"] = response["_id"]
        return updated_doc
    except NotFoundError:
        return None


def delete_inventory(client: OpenSearch, *, inventory_id: str) -> bool:
    """
    Delete an inventory item from OpenSearch.

    Args:
        client: The OpenSearch client instance.
        inventory_id: The ID of the inventory item to delete.

    Returns:
        True if the item was deleted, False if it was not found.
    """
    try:
        client.delete(index=INDEX_INVENTORIES, id=inventory_id, refresh=True)
        return True
    except NotFoundError:
        return False


def create_inventory(client: OpenSearch, *, inventory_in: InventoryCreate) -> dict:
    """
    Create a new inventory item in OpenSearch, after verifying the host exists.

    Args:
        client: The OpenSearch client instance.
        inventory_in: The inventory data to create.

    Returns:
        The newly created inventory document from OpenSearch.
    
    Raises:
        ValueError: If the host_id provided does not exist.
    """
    # First, verify that the host exists
    host_document = crud_host.get_host(client=client, host_id=inventory_in.host_id)
    if host_document is None:
        raise ValueError(f"Host with id '{inventory_in.host_id}' not found.")

    now = datetime.datetime.now(datetime.timezone.utc)
    
    document = inventory_in.model_dump(mode="json")
    document["created_at"] = now
    
    response = client.index(
        index=INDEX_INVENTORIES,
        body=document,
        refresh=True
    )
    
    document["_id"] = response["_id"]
    return document 