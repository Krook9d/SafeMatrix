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
                        "size": 5,
                        "script": {
                            "lang": "painless",
                            "source": """
                                def sev = null;
                                if (doc.containsKey('severity') && !doc['severity'].empty) {
                                    sev = doc['severity'].value;
                                } else if (params._source.containsKey('metrics')) {
                                    def m = params._source.metrics;
                                    if (m.containsKey('cvssMetricV31')) {
                                        sev = m.cvssMetricV31[0].cvssData.baseSeverity;
                                    } else if (m.containsKey('cvssMetricV30')) {
                                        sev = m.cvssMetricV30[0].cvssData.baseSeverity;
                                    } else if (m.containsKey('cvssMetricV2')) {
                                        double score = m.cvssMetricV2[0].cvssData.baseScore;
                                        if (score >= 9) sev = 'CRITICAL';
                                        else if (score >= 7) sev = 'HIGH';
                                        else if (score >= 4) sev = 'MEDIUM';
                                        else sev = 'LOW';
                                    }
                                }
                                if (sev == null) sev = 'UNKNOWN';
                                return sev;
                            """
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
    
    # OS distribution
    os_buckets = hosts_response.get("aggregations", {}).get("os_distribution", {}).get("buckets", [])
    hosts_by_os = {bucket["key"]: bucket["doc_count"] for bucket in os_buckets}
    
    # Severity distribution
    severity_buckets = vulnerabilities_response.get("aggregations", {}).get("severity_distribution", {}).get("buckets", [])
    vulnerabilities_by_severity = {bucket["key"]: bucket["doc_count"] for bucket in severity_buckets}
    critical_vulnerabilities = next((b["doc_count"] for b in severity_buckets if b["key"] == "CRITICAL"), 0)
    
    # Recent vulnerabilities
    recent_vulnerabilities = []
    hits = vulnerabilities_response.get("hits", {}).get("hits", [])
    for hit in hits:
        vuln = hit.get("_source", {})
        metrics = vuln.get("metrics", {})
        cvss_score = vuln.get("cvss_score")
        severity = vuln.get("severity")
        if severity is None or cvss_score is None:
            if metrics.get("cvssMetricV31"):
                data = metrics["cvssMetricV31"][0].get("cvssData", {})
                cvss_score = cvss_score or data.get("baseScore")
                severity = severity or data.get("baseSeverity")
            elif metrics.get("cvssMetricV30"):
                data = metrics["cvssMetricV30"][0].get("cvssData", {})
                cvss_score = cvss_score or data.get("baseScore")
                severity = severity or data.get("baseSeverity")
            elif metrics.get("cvssMetricV2"):
                data = metrics["cvssMetricV2"][0].get("cvssData", {})
                cvss_score = cvss_score or data.get("baseScore")
                if severity is None and cvss_score is not None:
                    if cvss_score >= 9:
                        severity = "CRITICAL"
                    elif cvss_score >= 7:
                        severity = "HIGH"
                    elif cvss_score >= 4:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
            if severity is None:
                severity = "UNKNOWN"
        if cvss_score is None:
            cvss_score = 0.0
        recent_vulnerabilities.append({
            "cve_id": vuln.get("id", ""),
            "description": vuln.get("descriptions", [{}])[0].get("value", "") if vuln.get("descriptions") else "",
            "cvss_score": cvss_score,
            "severity": severity,
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