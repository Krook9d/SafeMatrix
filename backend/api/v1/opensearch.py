from fastapi import APIRouter, Depends, HTTPException, Body, Query
from opensearchpy import OpenSearch
from typing import Any, Dict

from ...core.dependencies import get_opensearch_client, get_current_user
from ...schemas import user as schemas_user

router = APIRouter()

@router.post("/query")
def execute_dsl_query(
    *,
    index: str = Query(..., description="OpenSearch index to query"),
    query: Dict[str, Any] = Body(...),
    client: OpenSearch = Depends(get_opensearch_client),
    current_user: schemas_user.User = Depends(get_current_user),
):
    """Execute a raw OpenSearch DSL query."""
    try:
        response = client.search(index=index, body=query)
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
