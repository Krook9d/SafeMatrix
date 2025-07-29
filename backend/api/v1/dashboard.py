from fastapi import APIRouter, Depends
from opensearchpy import OpenSearch
from typing import Dict, Any

from ...core.dependencies import get_opensearch_client, get_current_user
from ...schemas import user as schemas_user
from ...core.opensearch_client import INDEX_HOSTS, INDEX_INVENTORIES, INDEX_VULNERABILITIES

router = APIRouter()

@router.get("/dashboard/stats")
def get_dashboard_stats(
    client: OpenSearch = Depends(get_opensearch_client),
    current_user: schemas_user.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get dashboard statistics from OpenSearch data.
    """
    
    # Get total hosts count
    hosts_response = client.search(
        index=INDEX_HOSTS,
        body={
            "size": 0,
            "track_total_hits": True,
            "aggs": {
                "os_distribution": {
                    "terms": {
                        "field": "os.name",
                        "size": 10
                    }
                }
            }
        },
        params={"request_cache": True},
        request_timeout=20,
    )
    
    # Get total software count and host-software relationships
    inventories_response = client.search(
        index=INDEX_INVENTORIES,
        body={
            "size": 0,
            "track_total_hits": True,
            "aggs": {
                "unique_hosts": {
                    "cardinality": {
                        "field": "host_id"
                    }
                }
            }
        },
        params={"request_cache": True},
        request_timeout=20,
    )
    
    # ------------------------------------------------------------------
    # Vulnerabilities statistics
    # ------------------------------------------------------------------

    # Total vulnerabilities via _count
    total_vuln_response = client.count(
        index=INDEX_VULNERABILITIES,
        body={"query": {"match_all": {}}},
        params={"request_cache": True},
        request_timeout=20,
    )

    # Critical vulnerabilities via _count
    critical_vuln_response = client.count(
        index=INDEX_VULNERABILITIES,
        body={"query": {"term": {"severity": "CRITICAL"}}},
        params={"request_cache": True},
        request_timeout=20,
    )

    # Distribution by severity via filters aggregation
    sev_agg_body = {
        "size": 0,
        "track_total_hits": False,
        "stored_fields": [],
        "timeout": "20s",
        "aggs": {
            "by_sev": {
                "filters": {
                    "filters": {
                        "CRITICAL": {"term": {"severity": "CRITICAL"}},
                        "HIGH": {"term": {"severity": "HIGH"}},
                        "MEDIUM": {"term": {"severity": "MEDIUM"}},
                        "LOW": {"term": {"severity": "LOW"}},
                        "NONE": {"term": {"severity": "NONE"}},
                    }
                }
            }
        },
    }
    sev_agg_response = client.search(
        index=INDEX_VULNERABILITIES,
        body=sev_agg_body,
        params={"request_cache": True},
        request_timeout=30,
    )

    # Recent vulnerabilities (minimal _source)
    recent_body = {
        "size": 10,
        "sort": [{"published": {"order": "desc"}}],
        "_source": [
            "id",
            "severity",
            "cvss_score",
            "descriptions.value",
            "descriptions.lang",
            "published",
        ],
    }
    recent_response = client.search(
        index=INDEX_VULNERABILITIES,
        body=recent_body,
        params={"request_cache": True},
        request_timeout=20,
    )
    
    # Extract data from responses
    total_hosts = hosts_response.get("hits", {}).get("total", {}).get("value", 0)
    total_software = inventories_response.get("hits", {}).get("total", {}).get("value", 0)
    total_vulnerabilities = total_vuln_response.get("count", 0)
    critical_vulnerabilities = critical_vuln_response.get("count", 0)

    # OS distribution
    os_buckets = hosts_response.get("aggregations", {}).get("os_distribution", {}).get("buckets", [])
    hosts_by_os = {bucket["key"]: bucket["doc_count"] for bucket in os_buckets}

    # Severity distribution
    sev_buckets = sev_agg_response.get("aggregations", {}).get("by_sev", {}).get("buckets", {})
    vulnerabilities_by_severity = {k: v.get("doc_count", 0) for k, v in sev_buckets.items()}

    # Recent vulnerabilities
    recent_vulnerabilities = []
    hits = recent_response.get("hits", {}).get("hits", [])
    for hit in hits:
        vuln = hit.get("_source", {})
        descriptions = vuln.get("descriptions", [])
        desc = None
        for d in descriptions:
            if d.get("lang") == "en":
                desc = d.get("value")
                break
        if desc is None and descriptions:
            desc = descriptions[0].get("value")
        recent_vulnerabilities.append({
            "cve_id": vuln.get("id", ""),
            "severity": vuln.get("severity") or "UNKNOWN",
            "cvss_score": vuln.get("cvss_score"),
            "description": desc or "",
            "published_date": vuln.get("published"),
        })
    
    return {
        "total_hosts": total_hosts,
        "total_software": total_software,
        "total_vulnerabilities": total_vulnerabilities,
        "critical_vulnerabilities": critical_vulnerabilities,
        "hosts_by_os": hosts_by_os,
        "vulnerabilities_by_severity": vulnerabilities_by_severity,
        "recent_vulnerabilities": recent_vulnerabilities
    } 