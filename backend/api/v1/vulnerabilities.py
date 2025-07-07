from fastapi import APIRouter, Depends, Query
from opensearchpy import OpenSearch
from typing import Optional

from backend.core.dependencies import get_opensearch_client
from backend.crud import vulnerability as crud_vulnerability
from backend.schemas import vulnerability as schemas_vulnerability

router = APIRouter()

@router.get("/", response_model=schemas_vulnerability.VulnerabilityCollection)
def read_vulnerabilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    client: OpenSearch = Depends(get_opensearch_client),
):
    """
    Retrieve vulnerabilities with pagination and search.
    """
    result = crud_vulnerability.get_vulnerabilities(
        client=client, skip=skip, limit=limit, search=search
    )
    return result 