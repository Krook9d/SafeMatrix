import logging
from opensearchpy import OpenSearch
from opensearchpy.exceptions import RequestError

from .config import settings

client = OpenSearch(
    hosts=[{"host": settings.OPENSEARCH_HOST, "port": settings.OPENSEARCH_PORT}],
    # For local development, we disable SSL verification.
    # In production, you'd configure this with your certificates.
    use_ssl=False,
    verify_certs=False,
    ssl_assert_hostname=False,
    ssl_show_warn=False,
    connections_per_node=5,
)

INDEX_HOSTS = "hosts"
INDEX_INVENTORIES = "inventories"
INDEX_VULNERABILITIES = "vulnerabilities"


def create_indexes():
    """
    Creates the OpenSearch indexes if they don't already exist.
    """
    logging.basicConfig(level=logging.INFO)
    
    hosts_mapping = {
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
                    "version": {"type": "keyword"}
                }
            },
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
        }
    }

    inventories_mapping = {
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
                    "url": {"type": "keyword"}
                }
            },
            "created_at": {"type": "date"},
        }
    }
    
    vulnerabilities_mapping = {
        "properties": {
            "id": {"type": "keyword"},  # CVE-2021-12345
            "sourceIdentifier": {"type": "keyword"},
            "published": {"type": "date"},
            "lastModified": {"type": "date"},
            "vulnStatus": {"type": "keyword"},
            "descriptions": {
                "type": "nested",
                "properties": {
                    "lang": {"type": "keyword"},
                    "value": {"type": "text"}
                }
            },
            "metrics": {"type": "object"},  # Can be complex, storing as generic object
            "weaknesses": {"type": "object"},
            "configurations": {"type": "object"},
            "references": {"type": "object"},
            # Computed fields for easier aggregations
            "severity": {"type": "keyword"},
            "cvss_score": {"type": "float"}
        }
    }

    indices_to_create = {
        INDEX_HOSTS: hosts_mapping,
        INDEX_INVENTORIES: inventories_mapping,
        INDEX_VULNERABILITIES: vulnerabilities_mapping,
    }

    for index_name, mapping in indices_to_create.items():
        if not client.indices.exists(index=index_name):
            logging.info(f"Index '{index_name}' not found. Creating...")
            try:
                client.indices.create(
                    index=index_name,
                    body={"mappings": mapping}
                )
                logging.info(f"Index '{index_name}' created successfully.")
            except RequestError as e:
                logging.error(f"Error creating index '{index_name}': {e}")
        else:
            logging.info(f"Index '{index_name}' already exists.")


def get_opensearch_client():
    return client 