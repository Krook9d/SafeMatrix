import datetime
from opensearchpy import OpenSearch, NotFoundError
from typing import Optional

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


def find_host_by_mac_or_hostname_ip(client: OpenSearch, *, mac_address: Optional[str] = None, hostname: Optional[str] = None, ip_address: Optional[str] = None) -> dict | None:
    """
    Find an existing host by MAC address or by hostname + IP address combination.
    
    Args:
        client: The OpenSearch client instance.
        mac_address: MAC address to search for (preferred identifier)
        hostname: hostname to search for (used with ip_address as fallback)
        ip_address: IP address to search for (used with hostname as fallback)
    
    Returns:
        The host document if found, otherwise None.
    """
    print(f"Debug: find_host_by_mac_or_hostname_ip called with mac_address='{mac_address}', hostname='{hostname}', ip_address='{ip_address}'")
    
    # Build search query
    must_queries = []
    
    # Prefer MAC address as unique identifier if available
    if mac_address:
        must_queries.append({"term": {"mac_address": mac_address}})
        print(f"Debug: Using MAC address search")
    elif hostname and ip_address:
        # Fallback to hostname + IP combination
        # hostname is text type, so use match query
        must_queries.append({"match": {"hostname": hostname}})
        # ip_address is ip type, so use term query
        must_queries.append({"term": {"ip_address": str(ip_address)}})
        print(f"Debug: Using hostname+IP search")
    else:
        print(f"Debug: Not enough info to search, returning None")
        return None  # Not enough info to search
    
    try:
        # Debug: print the search query
        search_query = {
            "query": {
                "bool": {
                    "must": must_queries
                }
            },
            "size": 10  # Increase size to see more results for debugging
        }
        print(f"Debug: Searching for host with query: {search_query}")
        
        response = client.search(
            index=INDEX_HOSTS,
            body=search_query
        )
        
        hits = response.get("hits", {}).get("hits", [])
        print(f"Debug: Found {len(hits)} hosts")
        
        if hits:
            for i, hit in enumerate(hits):
                doc = hit.get("_source", {})
                print(f"Debug: Hit {i}: hostname='{doc.get('hostname')}' ip='{doc.get('ip_address')}' mac='{doc.get('mac_address')}' id='{hit['_id']}'")
            
            # Return the first match
            doc = hits[0].get("_source", {})
            doc["_id"] = hits[0]["_id"]
            print(f"Debug: Returning existing host: {doc['_id']}")
            return doc
        
        print("Debug: No existing host found")
        return None
    except Exception as e:
        # If search fails, return None to fallback to creation
        print(f"Debug: Search failed with error: {e}")
        return None


def find_or_create_host(client: OpenSearch, *, host_in: HostCreate) -> dict:
    """
    Find an existing host or create a new one if not found.
    
    Args:
        client: The OpenSearch client instance.
        host_in: The host data to find or create.
    
    Returns:
        The existing or newly created host document from OpenSearch.
    """
    # Try to find existing host
    existing_host = find_host_by_mac_or_hostname_ip(
        client=client,
        mac_address=host_in.mac_address,
        hostname=host_in.hostname,
        ip_address=str(host_in.ip_address)
    )
    
    if existing_host:
        # Update the existing host's updated_at timestamp and other fields
        now = datetime.datetime.now(datetime.timezone.utc)
        document = host_in.model_dump(mode="json")
        document["updated_at"] = now
        
        try:
            client.update(
                index=INDEX_HOSTS,
                id=existing_host["_id"],
                body={"doc": document},
                refresh=True
            )
            # Return the updated host with the same ID
            existing_host.update(document)
            return existing_host
        except Exception:
            # If update fails, return existing host as-is
            return existing_host
    
    # Host not found, create a new one
    return create_host(client=client, host_in=host_in)


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