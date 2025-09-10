from fastapi import APIRouter, Depends, HTTPException
from opensearchpy import OpenSearch
from typing import List, Optional

from ...schemas import inventory as schemas_inventory
from ...schemas import user as schemas_user
from ...crud import inventory as crud_inventory
from ...core.dependencies import get_opensearch_client, get_current_user
from ...crud.vulnerability import INDEX_VULNERABILITIES
from ...utils.cpe_utils import parse_cpe
from ...utils.version_utils import in_version_range

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


@router.get("/inventories/count")
def count_inventories_endpoint(
    client: OpenSearch = Depends(get_opensearch_client),
    host_id: Optional[str] = None,
    current_user: schemas_user.User = Depends(get_current_user),
):
    """
    Return the total count of inventories, optionally filtered by host_id.
    """
    total = crud_inventory.count_inventories(client=client, host_id=host_id)
    return {"count": total}


@router.get("/inventories/host-vulns")
def get_host_inventory_vulnerabilities(
    client: OpenSearch = Depends(get_opensearch_client),
    host_id: Optional[str] = None,
    current_user: schemas_user.User = Depends(get_current_user),
):
    """
    For a given host_id, return vulnerability matches for each inventory item.
    Response format: [{"_id": str, "software_name": str, "version": str, "cves": [str]}]
    """
    if not host_id:
        return []

    # Fetch up to 2000 inventory items for the host
    inventories = crud_inventory.get_inventories(client=client, host_id=host_id, skip=0, limit=2000)

    results = []
    for item in inventories:
        name = (item.get("software_name") or "").lower()
        version = item.get("version")
        cve_ids: set[str] = set()

        # Heuristic product token: try last word first (often most specific), then first
        tokens = [t for t in name.replace("\n", " ").split() if t]
        if not tokens:
            results.append({"_id": item.get("_id"), "software_name": item.get("software_name"), "version": version, "cves": []})
            continue
        candidate_tokens = []
        if len(tokens) >= 1:
            candidate_tokens.append(tokens[-1])
            candidate_tokens.append(tokens[0])
        # Deduplicate
        candidate_tokens = list(dict.fromkeys(candidate_tokens))

        # Query vulnerabilities by token in configurations criteria (wildcard match)
        for tok in candidate_tokens:
            try:
                query = {
                    "query": {
                        "query_string": {
                            "query": f"configurations.nodes.cpeMatch.criteria:*{tok}*",
                            "default_operator": "AND"
                        }
                    },
                    "size": 200
                }
                res = client.search(index=INDEX_VULNERABILITIES, body=query)
                hits = res.get("hits", {}).get("hits", [])
                for h in hits:
                    src = h.get("_source", {})
                    configs = src.get("configurations", []) or []
                    # Walk nodes -> cpeMatch and check version ranges when product matches token
                    for cfg in configs:
                        for node in cfg.get("nodes", []) or []:
                            for cpe in node.get("cpeMatch", []) or []:
                                if not cpe.get("vulnerable", False):
                                    continue
                                criteria = cpe.get("criteria") or ""
                                parsed = parse_cpe(criteria)
                                if not parsed:
                                    continue
                                product = (parsed.get("product") or "").lower().replace(" ", "")
                                vendor = (parsed.get("vendor") or "").lower().replace(" ", "")
                                # Basic match: token is substring of vendor or product
                                if tok not in product and tok not in vendor:
                                    continue
                                # Check version constraints
                                if in_version_range(
                                    version,
                                    start_incl=cpe.get("versionStartIncluding"),
                                    start_excl=cpe.get("versionStartExcluding"),
                                    end_incl=cpe.get("versionEndIncluding"),
                                    end_excl=cpe.get("versionEndExcluding"),
                                ):
                                    cve_id = src.get("id")
                                    if cve_id:
                                        cve_ids.add(cve_id)
            except Exception:
                # Ignore errors per token to keep endpoint resilient
                continue

        results.append({
            "_id": item.get("_id"),
            "software_name": item.get("software_name"),
            "version": version,
            "cves": sorted(cve_ids)
        })

    return results


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


@router.get("/inventory/software-summary")
def get_software_summary(
    client: OpenSearch = Depends(get_opensearch_client),
    current_user: schemas_user.User = Depends(get_current_user),
):
    """
    Get aggregated software summary with installation counts, versions, and vulnerabilities.
    """
    from ...core.opensearch_client import INDEX_INVENTORIES
    
    try:
        response = client.search(
            index=INDEX_INVENTORIES,
            body={
                "size": 0,
                "aggs": {
                    "software_aggregation": {
                        "terms": {
                            "field": "software_name.keyword",
                            "size": 1000
                        },
                        "aggs": {
                            "unique_versions": {
                                "cardinality": {
                                    "field": "version.keyword"
                                }
                            },
                            "latest_version": {
                                "top_hits": {
                                    "sort": [{"created_at": {"order": "desc"}}],
                                    "size": 1,
                                    "_source": ["version"]
                                }
                            },
                            "unique_hosts": {
                                "cardinality": {
                                    "field": "host_id.keyword"
                                }
                            },
                            "vulnerability_count": {
                                "sum": {
                                    "script": {
                                        "source": "if (params._source.vulnerabilities != null) { return params._source.vulnerabilities.size(); } else { return 0; }"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        )
        
        software_summary = []
        buckets = response.get("aggregations", {}).get("software_aggregation", {}).get("buckets", [])
        
        for bucket in buckets:
            software_name = bucket["key"]
            total_installations = bucket["doc_count"]
            unique_versions = bucket["unique_versions"]["value"]
            unique_hosts = bucket["unique_hosts"]["value"]
            vulnerability_count = int(bucket["vulnerability_count"]["value"])
            
            # Get latest version
            latest_hit = bucket["latest_version"]["hits"]["hits"]
            latest_version = latest_hit[0]["_source"]["version"] if latest_hit else "Unknown"
            
            software_summary.append({
                "software_name": software_name,
                "total_installations": total_installations,
                "unique_versions": unique_versions,
                "latest_version": latest_version,
                "hosts_count": unique_hosts,
                "vulnerability_count": vulnerability_count
            })
        
        # Sort by total installations (most used software first)
        software_summary.sort(key=lambda x: x["total_installations"], reverse=True)
        
        return software_summary
        
    except Exception as e:
        # If the index does not exist or other error, return empty list
        return [] 