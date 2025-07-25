import datetime
from opensearchpy import OpenSearch, NotFoundError

from ..schemas.host import HostCreate
from ..core.opensearch_client import INDEX_HOSTS


def get_hosts(client: OpenSearch, *, skip: int = 0, limit: int = 100) -> list[dict]:
    """
    Get a list of hosts from OpenSearch with pagination.

    Args:
        client: The OpenSearch client instance.
        skip: The number of hosts to skip.
        limit: The maximum number of hosts to return.

    Returns:
        A list of host documents.
    """
    response = client.search(
        index=INDEX_HOSTS,
        body={
            "from": skip,
            "size": limit,
            "query": {
                "match_all": {}
            }
        }
    )
    
    # Extract the documents from the 'hits' array in the response
    hits = response.get("hits", {}).get("hits", [])
    results = []
    for hit in hits:
        doc = hit.get("_source", {})
        doc["_id"] = hit["_id"]
        results.append(doc)
        
    return results


def get_host(client: OpenSearch, *, host_id: str) -> dict | None:
    """
    Get a host by its ID from OpenSearch.

    Args:
        client: The OpenSearch client instance.
        host_id: The ID of the host to retrieve.

    Returns:
        The host document if found, otherwise None.
    """
    try:
        response = client.get(index=INDEX_HOSTS, id=host_id)
        document = response.get("_source", {})
        document["_id"] = response["_id"]
        return document
    except NotFoundError:
        return None


def create_host(client: OpenSearch, *, host_in: HostCreate) -> dict:
    """
    Create a new host in OpenSearch.

    Args:
        client: The OpenSearch client instance.
        host_in: The host data to create.

    Returns:
        The newly created host document from OpenSearch.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Pydantic models need to be converted to dicts for OpenSearch
    # We also need to convert non-JSON-serializable types like IPv4Address
    document = host_in.model_dump(mode="json")

    document["created_at"] = now
    document["updated_at"] = now
    
    response = client.index(
        index=INDEX_HOSTS,
        body=document,
        refresh=True  # Make the document immediately searchable
    )
    
    # The original document we sent is what we want to return,
    # plus the `_id` that OpenSearch assigned to it.
    document["_id"] = response["_id"]

    return document


def update_host(client: OpenSearch, *, host_id: str, host_in: HostCreate) -> dict | None:
    """
    Update a host in OpenSearch.

    Args:
        client: The OpenSearch client instance.
        host_id: The ID of the host to update.
        host_in: The new data for the host.

    Returns:
        The updated host document, or None if the host was not found.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    document = host_in.model_dump(mode="json")
    document["updated_at"] = now

    try:
        response = client.update(
            index=INDEX_HOSTS,
            id=host_id,
            body={"doc": document, "doc_as_upsert": False},
            refresh=True,
            _source=True
        )
        updated_doc = response.get("get", {}).get("_source", {})
        updated_doc["_id"] = response["_id"]
        return updated_doc
    except NotFoundError:
        return None


def delete_host(client: OpenSearch, *, host_id: str) -> bool:
    """
    Delete a host from OpenSearch.

    Args:
        client: The OpenSearch client instance.
        host_id: The ID of the host to delete.

    Returns:
        True if the host was deleted, False otherwise.
    """
    try:
        client.delete(index=INDEX_HOSTS, id=host_id, refresh=True)
        return True
    except NotFoundError:
        return False 