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
                        "field": "os.name.keyword",
                        "size": 10
                    }
                }
            }
        }
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
        }
    )
    
    # Get vulnerabilities statistics
    vulnerabilities_response = client.search(
        index=INDEX_VULNERABILITIES,
        body={
            "size": 10,  # Get recent vulnerabilities
            "track_total_hits": True,
            "sort": [
                {
                    "published": {
                        "order": "desc"
                    }
                }
            ],
            "aggs": {
                "severity_distribution": {
                    "terms": {
                        "field": "severity.keyword",
                        "size": 5
                    }
                },
                "critical_vulnerabilities": {
                    "filter": {
                        "term": {
                            "severity.keyword": "CRITICAL"
                        }
                    }
                }
            }
        }
    )
    
    # Extract data from responses
    total_hosts = hosts_response.get("hits", {}).get("total", {}).get("value", 0)
    total_software = inventories_response.get("hits", {}).get("total", {}).get("value", 0)
    total_vulnerabilities = vulnerabilities_response.get("hits", {}).get("total", {}).get("value", 0)
    critical_vulnerabilities = vulnerabilities_response.get("aggregations", {}).get("critical_vulnerabilities", {}).get("doc_count", 0)
    
    # OS distribution
    os_buckets = hosts_response.get("aggregations", {}).get("os_distribution", {}).get("buckets", [])
    hosts_by_os = {bucket["key"]: bucket["doc_count"] for bucket in os_buckets}
    
    # Severity distribution
    severity_buckets = vulnerabilities_response.get("aggregations", {}).get("severity_distribution", {}).get("buckets", [])
    vulnerabilities_by_severity = {bucket["key"]: bucket["doc_count"] for bucket in severity_buckets}
    
    # Recent vulnerabilities
    recent_vulnerabilities = []
    hits = vulnerabilities_response.get("hits", {}).get("hits", [])
    for hit in hits:
        vuln = hit.get("_source", {})
        recent_vulnerabilities.append({
            "cve_id": vuln.get("id", ""),
            "description": vuln.get("descriptions", [{}])[0].get("value", "") if vuln.get("descriptions") else "",
            "cvss_score": vuln.get("cvss_score", 0.0),
            "severity": vuln.get("severity", "UNKNOWN"),
            "published_date": vuln.get("published", ""),
            "reference_urls": vuln.get("reference_urls", [])
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