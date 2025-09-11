from fastapi import APIRouter, Depends, Query, HTTPException
from opensearchpy import OpenSearch
from typing import Optional

from backend.core.dependencies import get_opensearch_client
from backend.crud import vulnerability as crud_vulnerability
from backend.crud.vulnerability import get_vulnerabilities
from backend.schemas.vulnerability import VulnerabilityCollection, VulnerabilityCreate

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
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    
    return vulnerability


@router.post("/")
async def create_vulnerability(
    payload: VulnerabilityCreate,
    client: OpenSearch = Depends(get_opensearch_client)
):
    """Create a new vulnerability document manually, enforcing NVD-like structure.

    - Validates required fields (CVE-like id, English description, CVSS metrics).
    - Inserts into OpenSearch using the same enrichment path as NVD sync.
    - Returns the enriched stored document.
    """
    try:
        # Prepare document
        doc = payload.dict()
        # Default sourceIdentifier if missing
        if not doc.get("sourceIdentifier"):
            doc["sourceIdentifier"] = "manual"

        # Insert via bulk path for consistent enrichment and workflow trigger
        result = crud_vulnerability.bulk_insert_vulnerabilities(client, [doc], trigger_workflows=True)
        failed = result.get("failed") if isinstance(result, dict) else None
        if failed:
            # Extract first error and expose a readable message
            err = failed[0].get('index', {}).get('error', {}) if isinstance(failed, list) else {}
            reason = err.get('reason') or str(err)
            raise HTTPException(status_code=400, detail=f"Indexing error: {reason}")

        # Fetch back enriched
        from backend.crud.vulnerability import get_vulnerability_by_id
        enriched = get_vulnerability_by_id(client, payload.id)
        if not enriched:
            raise HTTPException(status_code=500, detail="Failed to retrieve created vulnerability")
        return enriched
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))