import logging
from typing import Dict, Any

from opensearchpy import OpenSearch
from opensearchpy.exceptions import RequestError, TransportError
from opensearchpy.connection.http_requests import RequestsHttpConnection
from requests.adapters import HTTPAdapter

from .config import settings

# -----------------------------------------------------------------------------
# Tunables (can be overridden via settings)
# -----------------------------------------------------------------------------

READ_TIMEOUT_S: int = getattr(settings, "OPENSEARCH_TIMEOUT", 60)
POOL_SIZE: int = getattr(settings, "OPENSEARCH_POOL_MAXSIZE", 25)  # both pool_connections and pool_maxsize
MAX_RETRIES: int = getattr(settings, "OPENSEARCH_MAX_RETRIES", 2)
RETRY_ON_TIMEOUT: bool = getattr(settings, "OPENSEARCH_RETRY_ON_TIMEOUT", True)
POOL_BLOCK: bool = getattr(settings, "OPENSEARCH_POOL_BLOCK", True)  # block instead of discarding when full

# -----------------------------------------------------------------------------
# Custom Requests-based connection that mounts an HTTPAdapter with larger pools
# -----------------------------------------------------------------------------

class PooledRequestsConnection(RequestsHttpConnection):
    """
    Requests-backed connection that mounts a tuned HTTPAdapter.
    """
    def __init__(self, *args, **kwargs):
        pool_connections = kwargs.pop("pool_connections", POOL_SIZE)
        pool_maxsize = kwargs.pop("pool_maxsize", POOL_SIZE)
        pool_block = kwargs.pop("pool_block", POOL_BLOCK)

        super().__init__(*args, **kwargs)

        adapter = HTTPAdapter(
            pool_connections=pool_connections,
            pool_maxsize=pool_maxsize,
            max_retries=0,        # transport-level retries are handled by OpenSearch Transport
            pool_block=pool_block
        )

        # Mount on both schemes
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Keep a reference for diagnostics
        self._pool_adapter = adapter

# -----------------------------------------------------------------------------
# OpenSearch client
# -----------------------------------------------------------------------------

client = OpenSearch(
    hosts=[{"host": settings.OPENSEARCH_HOST, "port": settings.OPENSEARCH_PORT}],
    connection_class=PooledRequestsConnection,   # use Requests + HTTPAdapter

    # Local dev without TLS
    use_ssl=False,
    verify_certs=False,
    ssl_assert_hostname=False,
    ssl_show_warn=False,

    # Tuning
    timeout=READ_TIMEOUT_S,          # default socket read timeout
    http_compress=True,              # compress payloads
    retry_on_timeout=RETRY_ON_TIMEOUT,
    max_retries=MAX_RETRIES,

    # Pass pool args down to the custom connection
    pool_connections=POOL_SIZE,
    pool_maxsize=POOL_SIZE,
    pool_block=POOL_BLOCK,
)

# -----------------------------------------------------------------------------
# Index names
# -----------------------------------------------------------------------------

INDEX_HOSTS = "hosts"
INDEX_INVENTORIES = "inventories"
INDEX_VULNERABILITIES = "vulnerabilities"

# -----------------------------------------------------------------------------
# Mappings
# -----------------------------------------------------------------------------

HOSTS_MAPPING: Dict[str, Any] = {
    "properties": {
        "hostname": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}}
        },
        "ip_address": {"type": "ip"},
        "mac_address": {"type": "keyword"},
        "os": {
            "properties": {
                "name": {"type": "keyword"},
                "version": {"type": "keyword"},
            }
        },
        "created_at": {"type": "date"},
        "updated_at": {"type": "date"},
    }
}

INVENTORIES_MAPPING: Dict[str, Any] = {
    "properties": {
        "host_id": {"type": "keyword"},
        "software_name": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}}
        },
        "version": {"type": "keyword"},
        "install_date": {"type": "date"},
        "vulnerabilities": {
            "type": "nested",
            "properties": {
                "cve_id": {"type": "keyword"},
                "description": {"type": "text"},
                "score": {"type": "float"},
                "url": {"type": "keyword"},
            },
        },
        "created_at": {"type": "date"},
    }
}

VULNERABILITIES_MAPPING: Dict[str, Any] = {
    "properties": {
        "id": {"type": "keyword"},  # e.g., CVE-2021-12345
        "sourceIdentifier": {"type": "keyword"},
        "published": {"type": "date"},
        "lastModified": {"type": "date"},
        "vulnStatus": {"type": "keyword"},
        "descriptions": {
            "type": "nested",
            "properties": {
                "lang": {"type": "keyword"},
                "value": {"type": "text"},
            },
        },
        "metrics": {"type": "object"},
        "weaknesses": {"type": "object"},
        "configurations": {"type": "object"},
        "references": {"type": "object"},
        "severity": {"type": "keyword"},
        "cvss_score": {"type": "float"},
    }
}

# -----------------------------------------------------------------------------
# Diagnostics (verify that the pool is correctly configured)
# -----------------------------------------------------------------------------

def _log_pool_diagnostics() -> None:
    try:
        conn = client.transport.get_connection()
        if isinstance(conn, PooledRequestsConnection):
            adapter = getattr(conn, "_pool_adapter", None)
            if adapter is not None:
                pm = getattr(adapter, "poolmanager", None)
                kw = getattr(pm, "connection_pool_kw", {}) if pm else {}
                logging.info(
                    "requests adapter: pool_connections=%s, pool_maxsize=%s, pool_block=%s",
                    getattr(adapter, "_pool_connections", "n/a"),
                    getattr(adapter, "_pool_maxsize", "n/a"),
                    kw.get("block", "n/a"),
                )
            else:
                logging.info("requests adapter: not available for diagnostics")
        else:
            logging.info("connection class in use: %s", conn.__class__.__name__)
    except Exception as e:
        logging.warning("pool diagnostics failed: %s", e)

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------

def _ensure_index(index_name: str, mapping: Dict[str, Any]) -> None:
    try:
        if not client.indices.exists(index=index_name, request_timeout=READ_TIMEOUT_S):
            logging.info("Index '%s' not found. Creating...", index_name)
            body = {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                },
                "mappings": mapping,
            }
            client.indices.create(
                index=index_name,
                body=body,
                request_timeout=READ_TIMEOUT_S,
            )
            logging.info("Index '%s' created successfully.", index_name)
        else:
            logging.info("Index '%s' already exists.", index_name)
    except RequestError as e:
        logging.error("Error creating index '%s' (RequestError): %s", index_name, e)
    except TransportError as e:
        logging.error("Transport error while ensuring index '%s': %s", index_name, e)

def create_indexes() -> None:
    if not logging.getLogger(__name__).handlers:
        logging.basicConfig(level=logging.INFO)

    _log_pool_diagnostics()

    indices_to_create = {
        INDEX_HOSTS: HOSTS_MAPPING,
        INDEX_INVENTORIES: INVENTORIES_MAPPING,
        INDEX_VULNERABILITIES: VULNERABILITIES_MAPPING,
    }
    for index_name, mapping in indices_to_create.items():
        _ensure_index(index_name, mapping)

def get_opensearch_client() -> OpenSearch:
    return client
