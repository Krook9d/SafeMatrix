import datetime
from typing import Optional, List, Dict, Any
from opensearchpy import OpenSearch

from backend.core.opensearch_client import INDEX_INVENTORIES

INDEX_ALERTS = "alerts"


def _alert_id(host_id: str, software_name: str, version: str, cve_id: str) -> str:
    # Deterministic ID to avoid duplicates
    import hashlib
    key = f"{host_id}|{software_name}|{version}|{cve_id}".encode()
    return hashlib.sha1(key).hexdigest()


def upsert_alert(
    client: OpenSearch,
    *,
    host_id: str,
    software_name: str,
    version: str,
    cve_id: str,
    severity: Optional[str] = None,
    score: Optional[float] = None,
    description: Optional[str] = None,
    url: Optional[str] = None,
    inventory_id: Optional[str] = None,
) -> dict:
    now = datetime.datetime.now(datetime.timezone.utc)
    _id = _alert_id(host_id, software_name, version, cve_id)
    body = {
        "host_id": host_id,
        "software_name": software_name,
        "version": version,
        "cve_id": cve_id,
        "severity": severity,
        "score": score,
        "status": "open",
        "inventory_id": inventory_id,
        "description": description,
        "url": url,
        "updated_at": now,
    }
    try:
        # Use update with upsert so we can guarantee created_at on first insert
        upsert_body = body.copy()
        upsert_body["created_at"] = now
        client.update(
            index=INDEX_ALERTS,
            id=_id,
            body={
                "doc": body,
                "doc_as_upsert": True,
                "upsert": upsert_body,
            },
            refresh=True,
        )
    except Exception:
        # Fallback index
        body["created_at"] = now
        client.index(index=INDEX_ALERTS, id=_id, body=body, refresh=True)
    body["_id"] = _id
    return body


def list_alerts(
    client: OpenSearch,
    *,
    status: Optional[str] = None,
    host_id: Optional[str] = None,
    software: Optional[str] = None,
    cve_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    must: List[Dict[str, Any]] = []
    if status:
        must.append({"term": {"status.keyword": status}})
    if host_id:
        must.append({"term": {"host_id.keyword": host_id}})
    if software:
        must.append({"term": {"software_name.keyword": software}})
    if cve_id:
        must.append({"term": {"cve_id.keyword": cve_id}})

    query: Dict[str, Any]
    if must:
        query = {"bool": {"must": must}}
    else:
        query = {"match_all": {}}

    try:
        res = client.search(
            index=INDEX_ALERTS,
            body={
                "query": query,
                "sort": [{"created_at": {"order": "desc"}}],
            },
            from_=skip,
            size=limit,
            track_total_hits=True,
        )
        total = res.get("hits", {}).get("total", {}).get("value", 0)
        items = []
        now = datetime.datetime.now(datetime.timezone.utc)
        for h in res.get("hits", {}).get("hits", []):
            src = h.get("_source", {})
            # Ensure required fields for schema
            if "created_at" not in src:
                src["created_at"] = now
            if "updated_at" not in src:
                src["updated_at"] = src.get("created_at", now)
            src["_id"] = h.get("_id")
            items.append(src)
        return {"total": int(total), "items": items}
    except Exception:
        return {"total": 0, "items": []}


def update_alert_status(client: OpenSearch, *, alert_id: str, status: str) -> bool:
    try:
        client.update(index=INDEX_ALERTS, id=alert_id, body={"doc": {"status": status, "updated_at": datetime.datetime.now(datetime.timezone.utc)}}, refresh=True)
        return True
    except Exception:
        return False


def generate_alerts_for_inventory_item(client: OpenSearch, inventory_doc: dict) -> int:
    """
    Given an inventory document with embedded vulnerabilities array,
    ensure alerts entries exist for each vulnerability.
    Returns count of upserted alerts.
    """
    host_id = inventory_doc.get("host_id")
    software_name = inventory_doc.get("software_name")
    version = inventory_doc.get("version")
    vulns = inventory_doc.get("vulnerabilities") or []
    count = 0
    for v in vulns:
        upsert_alert(
            client,
            host_id=host_id,
            software_name=software_name,
            version=version,
            cve_id=v.get("cve_id"),
            severity=None,
            score=v.get("score"),
            description=v.get("description"),
            url=v.get("url"),
            inventory_id=inventory_doc.get("_id"),
        )
        count += 1
    return count


def generate_alerts_for_vulnerability(client: OpenSearch, vuln_doc: dict) -> int:
    """
    Given a vulnerability document, scan inventories to find matches similar to inventory sync matching
    and create alerts. This is a heuristic approach to avoid missing alerts when vulns are ingested.
    """
    from backend.utils.cpe_utils import parse_cpe
    from backend.utils.version_utils import in_version_range

    configs = vuln_doc.get("configurations", []) or []
    if not configs:
        return 0
    # For each CPE match, collect parsed entries and product/vendor tokens
    tokens: set[str] = set()
    parsed_cpes: list[dict] = []
    cve_id = vuln_doc.get("id")
    for cfg in configs:
        for node in (cfg.get("nodes") or []):
            for cpe in (node.get("cpeMatch") or []):
                if not cpe.get("vulnerable", False):
                    continue
                crit = cpe.get("criteria") or ""
                parsed = parse_cpe(crit)
                if not parsed:
                    continue
                parsed_cpes.append({
                    "vendor": (parsed.get("vendor") or "").lower(),
                    "product": (parsed.get("product") or "").lower(),
                    "version": parsed.get("version"),
                    "start_incl": cpe.get("versionStartIncluding"),
                    "start_excl": cpe.get("versionStartExcluding"),
                    "end_incl": cpe.get("versionEndIncluding"),
                    "end_excl": cpe.get("versionEndExcluding"),
                })
                if parsed.get("product"):
                    tokens.add((parsed.get("product") or "").lower())
                if parsed.get("vendor"):
                    tokens.add((parsed.get("vendor") or "").lower())
    if not tokens:
        return 0

    # Query inventories by case-insensitive name match
    # Use should: wildcard on keyword (case_insensitive) and match_phrase on text
    created = 0
    for tok in list(tokens)[:20]:  # limit breadth
        try:
            query_body = {
                "query": {
                    "bool": {
                        "should": [
                            {"wildcard": {"software_name.keyword": {"value": f"*{tok}*", "case_insensitive": True}}},
                            {"match_phrase": {"software_name": tok}},
                        ],
                        "minimum_should_match": 1,
                    }
                },
                "size": 500,
            }
            res = client.search(index=INDEX_INVENTORIES, body=query_body)
            for h in res.get("hits", {}).get("hits", []):
                src = h.get("_source", {})
                src["_id"] = h.get("_id")
                inv_version = src.get("version")
                matched = False

                # Check against each parsed CPE
                for pc in parsed_cpes:
                    # Prefer exact version match when CPE specifies a fixed version and no bounds are provided
                    fixed_version = pc.get("version")
                    has_bounds = any([pc.get("start_incl"), pc.get("start_excl"), pc.get("end_incl"), pc.get("end_excl")])
                    if fixed_version and not has_bounds:
                        if str(inv_version) == str(fixed_version):
                            matched = True
                            break
                    # Otherwise, use range bounds
                    if in_version_range(
                        inv_version,
                        start_incl=pc.get("start_incl"),
                        start_excl=pc.get("start_excl"),
                        end_incl=pc.get("end_incl"),
                        end_excl=pc.get("end_excl"),
                    ):
                        matched = True
                        break

                if matched:
                    upsert_alert(
                        client,
                        host_id=src.get("host_id"),
                        software_name=src.get("software_name"),
                        version=inv_version,
                        cve_id=cve_id,
                        severity=vuln_doc.get("severity"),
                        score=vuln_doc.get("cvss_score"),
                        description=None,
                        url=(vuln_doc.get("references") or [{}])[0].get("url"),
                        inventory_id=src.get("_id"),
                    )
                    created += 1
        except Exception:
            continue
    return created
