from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.responses import StreamingResponse
from opensearchpy import OpenSearch
from opensearchpy.helpers import scan
from typing import Any, Dict, Generator, Iterable

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


@router.post("/export")
def export_query_results(
    *,
    index: str = Query(..., description="OpenSearch index or comma-separated indices"),
    query: Dict[str, Any] = Body(...),
    format: str = Query("csv", description="Export format: 'csv' or 'ndjson'"),
    client: OpenSearch = Depends(get_opensearch_client),
    current_user: schemas_user.User = Depends(get_current_user),
):
    """Stream export of a DSL query as CSV or NDJSON. Ideal for large datasets."""

    if format not in {"csv", "ndjson"}:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'ndjson'.")

    try:
        iterator = scan(client, index=index, query=query)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    def to_csv(rows: Iterable[Dict[str, Any]]) -> Generator[bytes, None, None]:
        # Determine columns from the first document with _source
        first_source = None
        first_row = None
        for first_row in rows:
            first_source = (first_row.get("_source") or {})
            break
        if first_row is None:
            # No data
            header = "_index,_id\n".encode("utf-8")
            yield header
            return

        preferred = [
            "hostname",
            "ip_address",
            "software_name",
            "version",
            "cve_id",
            "severity",
            "score",
            "updated_at",
            "created_at",
        ]
        keys = list(first_source.keys())
        ordered = []
        for k in preferred:
            if k in keys:
                ordered.append(k)
        for k in keys:
            if k not in ordered:
                ordered.append(k)
        columns = ordered[: 32]  # cap for very wide docs

        def esc(v: Any) -> str:
            if v is None:
                return ""
            s = v if isinstance(v, str) else json_dumps(v, ensure_ascii=False)
            if any(ch in s for ch in ["\n", ",", '"']):
                s = '"' + s.replace('"', '""') + '"'
            return s

        # write header
        header = ",".join(["_index", "_id", *columns]) + "\n"
        yield header.encode("utf-8")

        # write first row
        src = first_row.get("_source") or {}
        line = ",".join([esc(first_row.get("_index")), esc(first_row.get("_id")), *[esc(src.get(c)) for c in columns]]) + "\n"
        yield line.encode("utf-8")

        # write remaining rows
        for row in rows:
            src = row.get("_source") or {}
            line = ",".join([esc(row.get("_index")), esc(row.get("_id")), *[esc(src.get(c)) for c in columns]]) + "\n"
            yield line.encode("utf-8")

    def to_ndjson(rows: Iterable[Dict[str, Any]]) -> Generator[bytes, None, None]:
        for row in rows:
            yield (json_dumps(row, ensure_ascii=False) + "\n").encode("utf-8")

    # We need json dumps without importing stdlib at top as json; define here to avoid circular import confusion
    from json import dumps as json_dumps

    if format == "csv":
        filename = f"export_{index.replace(',', '_')}.csv"
        generator = to_csv(iterator)
        return StreamingResponse(generator, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
    else:
        filename = f"export_{index.replace(',', '_')}.ndjson"
        generator = to_ndjson(iterator)
        return StreamingResponse(generator, media_type="application/x-ndjson", headers={"Content-Disposition": f"attachment; filename={filename}"})
