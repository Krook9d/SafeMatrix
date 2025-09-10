from fastapi import APIRouter, Depends, Query
from opensearchpy import OpenSearch
from typing import Optional

from backend.core.dependencies import get_opensearch_client
from backend.crud import vulnerability as crud_vulnerability
from backend.crud.vulnerability import get_vulnerabilities
from backend.schemas.vulnerability import VulnerabilityCollection

router = APIRouter()

@router.get("/", response_model=VulnerabilityCollection)
async def list_vulnerabilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    search: Optional[str] = Query(None),
    severity: Optional[str] = Query(None, description="Severity filter: CRITICAL|HIGH|MEDIUM|LOW"),
    published: Optional[str] = Query(None, description="Published window: last7days|last30days|last90days"),
    client: OpenSearch = Depends(get_opensearch_client)
):
    """Get vulnerabilities with pagination, search and server-side filters applied across the full dataset."""
    result = get_vulnerabilities(
        client,
        skip=skip,
        limit=limit,
        search=search,
        severity=severity,
        published=published,
    )
    return VulnerabilityCollection(
        total=result["total"],
        vulnerabilities=result["vulnerabilities"],
        total_by_severity=result.get("total_by_severity", {}),
    )


@router.get("/{cve_id}")
async def get_vulnerability_detail(
    cve_id: str,
    client: OpenSearch = Depends(get_opensearch_client)
):
    """Get detailed information for a specific vulnerability."""
    from backend.crud.vulnerability import get_vulnerability_by_id
    
    vulnerability = get_vulnerability_by_id(client, cve_id)
    if not vulnerability:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    
    return vulnerability 