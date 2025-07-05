import logging

from .core.nvd_service import NVDService
from .core.opensearch_client import get_opensearch_client
from .crud.vulnerability import bulk_insert_vulnerabilities

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BATCH_SIZE = 200

def run_sync():
    """
    Main function to run the synchronization process.
    """
    logger.info("Starting NVD vulnerability synchronization process...")
    
    nvd_service = NVDService()
    opensearch_client = get_opensearch_client()
    
    vulnerabilities_batch = []
    
    # The sync_all_vulnerabilities method is a generator
    for cve in nvd_service.sync_all_vulnerabilities():
        vulnerabilities_batch.append(cve)
        
        # Once the batch is full, insert it into OpenSearch
        if len(vulnerabilities_batch) >= BATCH_SIZE:
            logger.info(f"Inserting batch of {len(vulnerabilities_batch)} vulnerabilities...")
            bulk_insert_vulnerabilities(opensearch_client, vulnerabilities_batch)
            vulnerabilities_batch = []  # Reset the batch

    # Insert any remaining vulnerabilities in the last batch
    if vulnerabilities_batch:
        logger.info(f"Inserting final batch of {len(vulnerabilities_batch)} vulnerabilities...")
        bulk_insert_vulnerabilities(opensearch_client, vulnerabilities_batch)

    logger.info("NVD vulnerability synchronization process finished.")


if __name__ == "__main__":
    run_sync() 