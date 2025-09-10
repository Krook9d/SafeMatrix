import datetime
from opensearchpy import OpenSearch, NotFoundError
from typing import Optional

from ..schemas.inventory import InventoryCreate
from ..core.opensearch_client import INDEX_INVENTORIES
from . import host as crud_host
from ..crud.vulnerability import INDEX_VULNERABILITIES
from ..utils.cpe_utils import parse_cpe
from ..utils.version_utils import in_version_range


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


def count_inventories(client: OpenSearch, *, host_id: Optional[str] = None) -> int:
    """
    Count inventory items in OpenSearch, optionally filtered by host_id.

    Args:
        client: The OpenSearch client instance.
        host_id: Optional host ID to filter the inventory items.

    Returns:
        The total count of inventory documents matching the query.
    """
    query = {"match_all": {}}
    if host_id:
        query = {"term": {"host_id": host_id}}

    response = client.count(
        index=INDEX_INVENTORIES,
        body={
            "query": query
        }
    )
    return int(response.get("count", 0))


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
    
    # Simple in-memory cache for this sync run: token -> list of vulnerability _source docs
    search_cache: dict[str, list[dict]] = {}

    def _normalize_name(s: str) -> str:
        import re
        s = s.lower()
        # replace non-alphanumeric by underscore
        s = re.sub(r"[^a-z0-9]+", "_", s)
        # collapse underscores
        s = re.sub(r"_+", "_", s).strip("_")
        return s

    def _split_tokens(s: str) -> list[str]:
        return [t for t in _normalize_name(s).split("_") if t]

    def _is_numeric(tok: str) -> bool:
        return tok.isdigit()

    def _product_candidates(software_name: str) -> list[str]:
        """Return ordered list of normalized product candidates based on software name.
        Includes full normalized name and versionless variant if trailing numeric token exists.
        """
        norm_full = _normalize_name(software_name)
        tokens = _split_tokens(software_name)
        cands = [norm_full]
        # If last token is numeric (likely version), also add versionless candidate
        if tokens and _is_numeric(tokens[-1]):
            versionless = "_".join(tokens[:-1])
            if versionless:
                cands.append(versionless)
        # Deduplicate while preserving order
        seen = set()
        ordered = []
        for c in cands:
            if c and c not in seen:
                seen.add(c)
                ordered.append(c)
        return ordered

    def _find_vulnerabilities_for(software_name: str, version: str, vendor: str | None = None) -> list[dict]:
        """
        Find matching CVEs for a given software name and version using vulnerabilities index.
        Returns a list of simplified vulnerability dicts: {cve_id, description, score, url}
        """
        if not software_name:
            return []

        candidates = _product_candidates(software_name)
        if not candidates:
            return []

        vendor_norm = _normalize_name(vendor or "") if vendor else None
        cve_ids: set[str] = set()
        vulns: dict[str, dict] = {}
        for cand in candidates:
            try:
                # Use cache to avoid re-querying same token
                cached = search_cache.get(cand)
                if cached is None:
                    query = {
                        "query": {
                            "query_string": {
                                # Narrow by product candidate
                                "query": f"configurations.nodes.cpeMatch.criteria:*:{cand}:*",
                                "default_operator": "AND"
                            }
                        },
                        "size": 100
                    }
                    res = client.search(index=INDEX_VULNERABILITIES, body=query)
                    hits = [h.get("_source", {}) for h in res.get("hits", {}).get("hits", [])]
                    search_cache[cand] = hits
                else:
                    hits = cached
                for src in hits:
                    configs = src.get("configurations", []) or []
                    for cfg in configs:
                        for node in cfg.get("nodes", []) or []:
                            for cpe in node.get("cpeMatch", []) or []:
                                if not cpe.get("vulnerable", False):
                                    continue
                                criteria = cpe.get("criteria") or ""
                                parsed = parse_cpe(criteria)
                                if not parsed:
                                    continue
                                product_norm = _normalize_name(parsed.get("product") or "")
                                parsed_vendor_norm = _normalize_name(parsed.get("vendor") or "")
                                # Strict equality with one of our candidates (including versionless)
                                if product_norm not in candidates:
                                    continue
                                # If we have a vendor from agent, require vendor equality too
                                if vendor_norm and vendor_norm != parsed_vendor_norm:
                                    continue
                                if in_version_range(
                                    version,
                                    start_incl=cpe.get("versionStartIncluding"),
                                    start_excl=cpe.get("versionStartExcluding"),
                                    end_incl=cpe.get("versionEndIncluding"),
                                    end_excl=cpe.get("versionEndExcluding"),
                                ):
                                    cve_id = src.get("id")
                                    if cve_id and cve_id not in cve_ids:
                                        cve_ids.add(cve_id)
                                        # Build simplified vuln payload
                                        description = "No description available."
                                        descs = src.get("descriptions", []) or []
                                        if descs:
                                            eng = next((d.get("value") for d in descs if d.get("lang") == "en"), None)
                                            if eng:
                                                description = eng
                                        score = src.get("cvss_score")
                                        if score is None:
                                            # Try fallback to metrics v3.1
                                            m31 = src.get("metrics", {}).get("cvssMetricV31", [])
                                            if m31:
                                                score = m31[0].get("cvssData", {}).get("baseScore")
                                        url = None
                                        refs = src.get("references", []) or []
                                        if refs:
                                            url = refs[0].get("url")
                                        vulns[cve_id] = {
                                            "cve_id": cve_id,
                                            "description": description,
                                            "score": float(score) if isinstance(score, (int, float)) else 0.0,
                                            "url": url,
                                        }
            except Exception:
                continue

        return list(vulns.values())

    # 2. Traiter les nouveaux logiciels
    for software_name, software_data in new_software.items():
        if software_name in existing_software:
            existing_item = existing_software[software_name]
            # Comparer les versions
            if existing_item["version"] != software_data.get("version", ""):
                # Mettre à jour la version
                print(f"Debug: Updating {software_name}: {existing_item['version']} -> {software_data.get('version', '')}")
                
                # Recompute vulnerabilities on version change
                recomputed_vulns = _find_vulnerabilities_for(software_name, software_data.get("version", ""), software_data.get("vendor"))
                update_data = {
                    "version": software_data.get("version", ""),
                    "vulnerabilities": recomputed_vulns,
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
                # Backfill vulnerabilities if missing/empty
                try:
                    if not existing_item.get("vulnerabilities"):
                        backfill_vulns = _find_vulnerabilities_for(software_name, existing_item.get("version", ""))
                        client.update(
                            index=INDEX_INVENTORIES,
                            id=existing_item["_id"],
                            body={"doc": {"vulnerabilities": backfill_vulns, "updated_at": now}},
                            refresh=True
                        )
                except Exception as e:
                    print(f"Debug: Failed to backfill vulns for {software_name}: {e}")
                stats["unchanged"] += 1
        else:
            # Nouveau logiciel à ajouter
            print(f"Debug: Adding new software: {software_name}")
            
            computed_vulns = _find_vulnerabilities_for(software_name, software_data.get("version", ""), software_data.get("vendor"))
            inventory_data = {
                "host_id": host_id,
                "software_name": software_name,
                "version": software_data.get("version", ""),
                "install_date": None,  # L'agent Windows n'a pas cette info pour l'instant
                "vulnerabilities": computed_vulns,
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