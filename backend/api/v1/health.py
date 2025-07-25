from fastapi import APIRouter, Depends
from opensearchpy import OpenSearch

from ...core.opensearch_client import get_opensearch_client

router = APIRouter()

@router.get("/health/opensearch", tags=["health"])
def opensearch_health(client: OpenSearch = Depends(get_opensearch_client)):
    """
    Checks the health of the OpenSearch cluster.
    """
    if client.ping():
        return {"status": "ok", "cluster_info": client.info()}
    else:
        return {"status": "error", "message": "Could not connect to OpenSearch"} 