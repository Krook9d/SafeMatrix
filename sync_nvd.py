#!/usr/bin/env python3
import logging
import sys
import os
import asyncio

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.core.nvd_service import NVDService
from backend.core.opensearch_client import get_opensearch_client
from backend.crud.vulnerability import bulk_insert_vulnerabilities
from backend.core.redis_client import get_redis_client

# Configure logging with better formatting
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BATCH_SIZE = 200

# Initialize Redis client for progress tracking
try:
    redis_client = get_redis_client()
    logger.info("Redis client initialized for progress tracking")
except Exception as e:
    logger.warning(f"Could not initialize Redis client: {e}. Progress tracking will be disabled.")
    redis_client = None

def check_prerequisites():
    """
    Check that all prerequisites are in place before synchronization.
    Returns True if everything is ready, False otherwise.
    """
    logger.info("Checking prerequisites...")
    
    try:
        # Test OpenSearch connection
        client = get_opensearch_client()
        health = client.cluster.health()
        logger.info(f"OpenSearch cluster status: {health['status']}")
        
        # Test NVD API connection
        nvd_service = NVDService()
        test_data = nvd_service.fetch_vulnerabilities_page(start_index=0)
        if test_data:
            total_available = test_data.get('totalResults', 0)
            logger.info(f"NVD API accessible: {total_available} vulnerabilities available")
        else:
            logger.error("Unable to contact NVD API")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Prerequisites check failed: {e}")
        return False

def run_sync():
    """
    Main function to run the NVD synchronization process.
    Fetches all vulnerabilities and inserts them with pre-calculated severity and cvss_score fields.
    """
    logger.info("Starting NVD vulnerability synchronization process...")
    
    try:
        nvd_service = NVDService()
        opensearch_client = get_opensearch_client()
        
        vulnerabilities_batch = []
        total_processed = 0
        
        logger.info(f"Processing in batches of {BATCH_SIZE} vulnerabilities...")
        
        # The sync_all_vulnerabilities method is a memory-efficient generator
        for cve in nvd_service.sync_all_vulnerabilities():
            vulnerabilities_batch.append(cve)
            total_processed += 1
            
            # Update Redis counter if available
            if redis_client:
                try:
                    redis_client.increment_cve_count(1)
                except Exception as e:
                    logger.warning(f"Could not update Redis counter: {e}")
            
            # Insert batch when full to optimize performance
            if len(vulnerabilities_batch) >= BATCH_SIZE:
                logger.info(f"Inserting batch of {len(vulnerabilities_batch)} vulnerabilities (total: {total_processed})...")
                bulk_insert_vulnerabilities(opensearch_client, vulnerabilities_batch)
                
                vulnerabilities_batch = []  # Reset the batch
                
                # Progress logging every 1000 vulnerabilities
                if total_processed % 1000 == 0:
                    logger.info(f"Progress: {total_processed} vulnerabilities processed")

        # Insert any remaining vulnerabilities in the final batch
        if vulnerabilities_batch:
            logger.info(f"Inserting final batch of {len(vulnerabilities_batch)} vulnerabilities...")
            bulk_insert_vulnerabilities(opensearch_client, vulnerabilities_batch)
        
        logger.info(f"NVD synchronization completed successfully! Total: {total_processed} vulnerabilities")
        logger.info("All vulnerabilities have been enriched with severity and cvss_score for optimal performance!")
        
    except Exception as e:
        logger.error(f"Error during synchronization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    logger.info("SafeMatrix NVD Synchronization Script")
    
    if check_prerequisites():
        run_sync()
    else:
        logger.error("Prerequisites not satisfied, aborting synchronization")
        sys.exit(1) 