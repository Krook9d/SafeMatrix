from fastapi import APIRouter, Depends
from opensearchpy import OpenSearch
from typing import Dict, Any

from ...core.dependencies import get_opensearch_client, get_current_user
from ...schemas import user as schemas_user
from ...core.opensearch_client import INDEX_HOSTS, INDEX_INVENTORIES, INDEX_VULNERABILITIES

router = APIRouter()


@router.get("/dashboard/summary")
def get_dashboard_summary(
    client: OpenSearch = Depends(get_opensearch_client),
    current_user: schemas_user.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return quick dashboard statistics."""
    
    hosts_response = client.search(
        index=INDEX_HOSTS,
        body={
            "size": 0,
            "aggs": {
                "os_distribution": {
                    "terms": {
                        "field": "os.name",
                        "size": 10
                    }
                }
            }
        }
    )

    total_hosts = client.count(index=INDEX_HOSTS)["count"]
    total_software = client.count(index=INDEX_INVENTORIES)["count"]
    total_vulnerabilities = client.count(index=INDEX_VULNERABILITIES)["count"]
    critical_vulnerabilities = client.count(
        index=INDEX_VULNERABILITIES,
        body={"query": {"term": {"severity": "CRITICAL"}}},
    )["count"]

    os_buckets = hosts_response.get("aggregations", {}).get("os_distribution", {}).get("buckets", [])
    hosts_by_os = {bucket["key"]: bucket["doc_count"] for bucket in os_buckets}

    return {
        "total_hosts": total_hosts,
        "total_software": total_software,
        "total_vulnerabilities": total_vulnerabilities,
        "critical_vulnerabilities": critical_vulnerabilities,
        "hosts_by_os": hosts_by_os,
    }


@router.get("/dashboard/vulnerabilities")
def get_vulnerability_stats(
    client: OpenSearch = Depends(get_opensearch_client),
    current_user: schemas_user.User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return vulnerability charts and recent items."""

    response = client.search(
        index=INDEX_VULNERABILITIES,
        body={
            "size": 10,
            "sort": [{"published": {"order": "desc"}}],
            "aggs": {
                "severity_distribution": {
                    "terms": {
                        "field": "severity",
                        "missing": "UNKNOWN",
                        "size": 5,
                    }
                }
            },
        },
    )

    severity_buckets = (
        response.get("aggregations", {})
        .get("severity_distribution", {})
        .get("buckets", [])
    )
    vulnerabilities_by_severity = {
        bucket["key"]: bucket["doc_count"] for bucket in severity_buckets
    }

    recent_vulnerabilities = []
    for hit in response.get("hits", {}).get("hits", []):
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
        recent_vulnerabilities.append(
            {
                "cve_id": vuln.get("id", ""),
                "description": vuln.get("descriptions", [{}])[0].get("value", "")
                if vuln.get("descriptions")
                else "",
                "cvss_score": cvss_score,
                "severity": severity,
                "published_date": vuln.get("published", ""),
                "reference_urls": vuln.get("reference_urls", []),
            }
        )

    return {
        "vulnerabilities_by_severity": vulnerabilities_by_severity,
        "recent_vulnerabilities": recent_vulnerabilities,
    }

