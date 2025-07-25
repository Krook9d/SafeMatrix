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
        query = {"term": {"host_id": host_id}}

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


def sync_host_inventory(client: OpenSearch, *, host_id: str, new_software_list: list[dict]) -> dict:
    """
    Synchronise l'inventaire d'un host avec une nouvelle liste de logiciels.
    
    Args:
        client: The OpenSearch client instance.
        host_id: L'ID du host dont on synchronise l'inventaire
        new_software_list: Liste des nouveaux logiciels détectés
                          Format: [{"software_name": str, "version": str, "vendor": str, "install_date": str}, ...]
    
    Returns:
        Statistiques de la synchronisation
    """
    from . import host as crud_host
    
    # Vérifier que le host existe
    host_document = crud_host.get_host(client=client, host_id=host_id)
    if host_document is None:
        raise ValueError(f"Host with id '{host_id}' not found.")
    
    print(f"Debug: Starting inventory sync for host {host_id} with {len(new_software_list)} software items")
    
    # 1. Récupérer l'inventaire existant pour ce host
    existing_inventory = get_inventories(client=client, host_id=host_id, skip=0, limit=10000)
    
    # Créer un dictionnaire pour un accès rapide par nom de logiciel
    existing_software = {item["software_name"]: item for item in existing_inventory}
    new_software = {item["software_name"]: item for item in new_software_list}
    
    stats = {
        "added": 0,
        "updated": 0, 
        "removed": 0,
        "unchanged": 0
    }
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # 2. Traiter les nouveaux logiciels
    for software_name, software_data in new_software.items():
        if software_name in existing_software:
            existing_item = existing_software[software_name]
            # Comparer les versions
            if existing_item["version"] != software_data.get("version", ""):
                # Mettre à jour la version
                print(f"Debug: Updating {software_name}: {existing_item['version']} -> {software_data.get('version', '')}")
                
                update_data = {
                    "version": software_data.get("version", ""),
                    "updated_at": now
                }
                
                try:
                    client.update(
                        index=INDEX_INVENTORIES,
                        id=existing_item["_id"],
                        body={"doc": update_data},
                        refresh=True
                    )
                    stats["updated"] += 1
                except Exception as e:
                    print(f"Debug: Failed to update {software_name}: {e}")
            else:
                stats["unchanged"] += 1
        else:
            # Nouveau logiciel à ajouter
            print(f"Debug: Adding new software: {software_name}")
            
            inventory_data = {
                "host_id": host_id,
                "software_name": software_name,
                "version": software_data.get("version", ""),
                "install_date": None,  # L'agent Windows n'a pas cette info pour l'instant
                "vulnerabilities": [],
                "created_at": now
            }
            
            try:
                client.index(
                    index=INDEX_INVENTORIES,
                    body=inventory_data,
                    refresh=True
                )
                stats["added"] += 1
            except Exception as e:
                print(f"Debug: Failed to add {software_name}: {e}")
    
    # 3. Supprimer les logiciels qui ne sont plus présents
    for software_name, existing_item in existing_software.items():
        if software_name not in new_software:
            print(f"Debug: Removing obsolete software: {software_name}")
            
            try:
                client.delete(
                    index=INDEX_INVENTORIES,
                    id=existing_item["_id"],
                    refresh=True
                )
                stats["removed"] += 1
            except Exception as e:
                print(f"Debug: Failed to remove {software_name}: {e}")
    
    print(f"Debug: Sync completed - Added: {stats['added']}, Updated: {stats['updated']}, Removed: {stats['removed']}, Unchanged: {stats['unchanged']}")
    return stats 