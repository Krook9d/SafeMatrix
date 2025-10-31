#!/usr/bin/env python3
import logging
import sys
import os
import time
from datetime import datetime, timedelta

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.core.nvd_service import NVDService
from backend.core.opensearch_client import get_opensearch_client
from backend.crud.vulnerability import bulk_insert_vulnerabilities, get_vulnerability_by_id
from backend.core.redis_client import get_redis_client

# Configure logging with better formatting
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BATCH_SIZE = 200
CHECK_INTERVAL_SECONDS = 3600  # Check every hour
LOOKBACK_DAYS = 7  # Check CVEs from the last 7 days

# Initialize Redis client for progress tracking
try:
    redis_client = get_redis_client()
    logger.info("Redis client initialized for progress tracking")
except Exception as e:
    logger.warning(f"Could not initialize Redis client: {e}. Progress tracking will be disabled.")
    redis_client = None


def should_stop_monitoring():
    """Check if we should stop the continuous monitoring."""
    if not redis_client:
        return False
    
    try:
        status = redis_client.get_sync_status()
        if status and status.get("status") == "stopped":
            return True
    except Exception as e:
        logger.warning(f"Error checking stop status: {e}")
    
    return False


def fetch_recent_vulnerabilities(days_back=LOOKBACK_DAYS):
    """
    Fetch vulnerabilities published or modified in the last N days.
    
    Args:
        days_back: Number of days to look back for CVEs
        
    Yields:
        CVE objects that are new or updated
    """
    nvd_service = NVDService()
    opensearch_client = get_opensearch_client()
    
    # Calculate the date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days_back)
    
    # Format dates for NVD API (ISO 8601 format)
    start_date_str = start_date.strftime('%Y-%m-%dT%H:%M:%S.000')
    end_date_str = end_date.strftime('%Y-%m-%dT%H:%M:%S.000')
    
    logger.info(f"Fetching CVEs modified between {start_date_str} and {end_date_str}")
    
    new_count = 0
    updated_count = 0
    skipped_count = 0
    
    try:
        # Fetch recent vulnerabilities from NVD
        for cve in nvd_service.sync_vulnerabilities_by_date(start_date_str, end_date_str):
            cve_id = cve.get('id')
            
            # Check if this CVE already exists in our database
            existing_cve = get_vulnerability_by_id(opensearch_client, cve_id)
            
            if existing_cve:
                # Check if it has been modified
                existing_modified = existing_cve.get('lastModified')
                new_modified = cve.get('lastModified')
                
                if new_modified and new_modified != existing_modified:
                    logger.info(f"CVE {cve_id} has been updated")
                    updated_count += 1
                    yield cve
                else:
                    skipped_count += 1
            else:
                logger.info(f"New CVE found: {cve_id}")
                new_count += 1
                yield cve
    
    except Exception as e:
        logger.error(f"Error fetching recent vulnerabilities: {e}")
        raise
    
    logger.info(f"Scan complete: {new_count} new, {updated_count} updated, {skipped_count} skipped")


def run_continuous_monitoring():
    """
    Main function to run continuous NVD monitoring.
    Checks for new/updated CVEs periodically and never stops unless requested.
    """
    logger.info("Starting NVD continuous monitoring...")
    
    if redis_client:
        redis_client.set_sync_status({
            "status": "monitoring",
            "mode": "continuous",
            "started_at": datetime.utcnow().isoformat(),
            "message": "Continuous monitoring active",
            "last_check": None,
            "check_interval_seconds": CHECK_INTERVAL_SECONDS
        })
    
    opensearch_client = get_opensearch_client()
    cycle_count = 0
    
    while True:
        cycle_count += 1
        
        # Check if we should stop
        if should_stop_monitoring():
            logger.info("Stop signal received. Ending continuous monitoring.")
            if redis_client:
                redis_client.set_sync_status({
                    "status": "stopped",
                    "mode": "continuous",
                    "message": "Continuous monitoring stopped by user",
                    "stopped_at": datetime.utcnow().isoformat()
                })
            break
        
        logger.info(f"=== Monitoring cycle {cycle_count} started ===")
        
        try:
            check_start_time = datetime.utcnow()
            vulnerabilities_batch = []
            total_processed = 0
            
            # Fetch recent vulnerabilities
            for cve in fetch_recent_vulnerabilities(LOOKBACK_DAYS):
                vulnerabilities_batch.append(cve)
                total_processed += 1
                
                # Update Redis counter if available
                if redis_client:
                    try:
                        redis_client.increment_cve_count(1)
                    except Exception as e:
                        logger.warning(f"Could not update Redis counter: {e}")
                
                # Insert batch when full
                if len(vulnerabilities_batch) >= BATCH_SIZE:
                    logger.info(f"Inserting batch of {len(vulnerabilities_batch)} vulnerabilities...")
                    bulk_insert_vulnerabilities(opensearch_client, vulnerabilities_batch)
                    vulnerabilities_batch = []
            
            # Insert any remaining vulnerabilities
            if vulnerabilities_batch:
                logger.info(f"Inserting final batch of {len(vulnerabilities_batch)} vulnerabilities...")
                bulk_insert_vulnerabilities(opensearch_client, vulnerabilities_batch)
            
            check_end_time = datetime.utcnow()
            check_duration = (check_end_time - check_start_time).total_seconds()
            
            logger.info(f"Monitoring cycle {cycle_count} completed in {check_duration:.2f}s. Found {total_processed} new/updated CVEs.")
            
            # Update status in Redis
            if redis_client:
                current_total = redis_client.get_cve_count()
                redis_client.set_sync_status({
                    "status": "monitoring",
                    "mode": "continuous",
                    "started_at": redis_client.get_sync_status().get("started_at"),
                    "last_check": check_end_time.isoformat(),
                    "next_check": (check_end_time + timedelta(seconds=CHECK_INTERVAL_SECONDS)).isoformat(),
                    "total_cves": current_total,
                    "cycle_count": cycle_count,
                    "last_cycle_cves": total_processed,
                    "check_interval_seconds": CHECK_INTERVAL_SECONDS,
                    "message": f"Active - Last check: {check_end_time.strftime('%H:%M:%S')}, found {total_processed} CVE(s)"
                })
            
        except Exception as e:
            logger.error(f"Error during monitoring cycle {cycle_count}: {e}")
            if redis_client:
                redis_client.set_sync_status({
                    "status": "monitoring",
                    "mode": "continuous",
                    "error": str(e),
                    "last_error_at": datetime.utcnow().isoformat(),
                    "message": f"Monitoring active (last cycle had errors)"
                })
        
        # Wait before next check
        logger.info(f"Waiting {CHECK_INTERVAL_SECONDS} seconds before next check...")
        
        # Sleep in small intervals to allow for quick stop response
        sleep_elapsed = 0
        while sleep_elapsed < CHECK_INTERVAL_SECONDS:
            if should_stop_monitoring():
                logger.info("Stop signal received during wait period.")
                if redis_client:
                    redis_client.set_sync_status({
                        "status": "stopped",
                        "mode": "continuous",
                        "message": "Continuous monitoring stopped by user",
                        "stopped_at": datetime.utcnow().isoformat()
                    })
                return
            time.sleep(10)  # Check every 10 seconds
            sleep_elapsed += 10


if __name__ == "__main__":
    logger.info("SafeMatrix NVD Continuous Monitoring Script")
    
    try:
        run_continuous_monitoring()
    except KeyboardInterrupt:
        logger.info("Monitoring interrupted by user (Ctrl+C)")
        if redis_client:
            redis_client.set_sync_status({
                "status": "stopped",
                "mode": "continuous",
                "message": "Continuous monitoring stopped",
                "stopped_at": datetime.utcnow().isoformat()
            })
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error in continuous monitoring: {e}")
        if redis_client:
            redis_client.set_sync_status({
                "status": "failed",
                "mode": "continuous",
                "error": str(e),
                "message": "Continuous monitoring failed",
                "failed_at": datetime.utcnow().isoformat()
            })
        sys.exit(1)

