#!/usr/bin/env python3
"""
Script to update existing vulnerabilities with pre-calculated severity and cvss_score fields.
This will significantly improve dashboard performance by removing the need for Painless scripts.
"""

import logging
import sys
import os
from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk, scan

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from core.opensearch_client import get_opensearch_client
from crud.vulnerability import INDEX_VULNERABILITIES

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_severity_and_score(vuln_data):
    """
    Calculate severity and CVSS score from metrics data.
    Returns (severity, cvss_score) tuple.
    """
    metrics = vuln_data.get("metrics", {})
    cvss_score = None
    severity = None
    
    # Try CVSSv3.1 first
    if metrics.get("cvssMetricV31"):
        cvss = metrics["cvssMetricV31"][0].get("cvssData", {})
        cvss_score = cvss.get("baseScore")
        severity = cvss.get("baseSeverity")
    # Then CVSSv3.0
    elif metrics.get("cvssMetricV30"):
        cvss = metrics["cvssMetricV30"][0].get("cvssData", {})
        cvss_score = cvss.get("baseScore")
        severity = cvss.get("baseSeverity")
    # Finally CVSSv2
    elif metrics.get("cvssMetricV2"):
        cvss = metrics["cvssMetricV2"][0].get("cvssData", {})
        cvss_score = cvss.get("baseScore")
        # Map CVSSv2 score to severity
        if cvss_score is not None:
            if cvss_score >= 9.0:
                severity = "CRITICAL"
            elif cvss_score >= 7.0:
                severity = "HIGH"
            elif cvss_score >= 4.0:
                severity = "MEDIUM"
            else:
                severity = "LOW"
    
    # Set defaults
    if cvss_score is None:
        cvss_score = 0.0
    if severity is None:
        severity = "UNKNOWN"
    
    return severity, cvss_score

def update_vulnerabilities_batch():
    """
    Update all vulnerabilities in the index with pre-calculated fields.
    """
    client = get_opensearch_client()
    
    # Check if index exists
    if not client.indices.exists(index=INDEX_VULNERABILITIES):
        logger.error(f"Index {INDEX_VULNERABILITIES} does not exist")
        return False
    
    logger.info("Starting vulnerabilities update...")
    
    # Scan all documents in the index
    query = {"query": {"match_all": {}}}
    
    actions = []
    processed = 0
    updated = 0
    
    try:
        # Use scan to efficiently iterate over all documents
        for doc in scan(client, query=query, index=INDEX_VULNERABILITIES, scroll='5m'):
            processed += 1
            source = doc['_source']
            doc_id = doc['_id']
            
            # Check if already has pre-calculated fields
            if 'severity' in source and 'cvss_score' in source:
                if processed % 1000 == 0:
                    logger.info(f"Processed {processed} documents, {updated} updated")
                continue
            
            # Calculate new fields
            severity, cvss_score = calculate_severity_and_score(source)
            
            # Prepare update action
            action = {
                "_op_type": "update",
                "_index": INDEX_VULNERABILITIES,
                "_id": doc_id,
                "doc": {
                    "severity": severity,
                    "cvss_score": cvss_score
                }
            }
            actions.append(action)
            updated += 1
            
            # Batch update every 1000 documents
            if len(actions) >= 1000:
                success, failed = bulk(client, actions, refresh=False, request_timeout=60)
                logger.info(f"Batch updated {success} documents, {len(failed)} failed")
                actions = []
            
            if processed % 1000 == 0:
                logger.info(f"Processed {processed} documents, {updated} updated")
        
        # Update remaining documents
        if actions:
            success, failed = bulk(client, actions, refresh=True, request_timeout=60)
            logger.info(f"Final batch updated {success} documents, {len(failed)} failed")
        
        logger.info(f"Completed! Processed {processed} documents, updated {updated} documents")
        return True
        
    except Exception as e:
        logger.error(f"Error during update: {e}")
        return False

def verify_update():
    """
    Verify that the update was successful by checking a sample of documents.
    """
    client = get_opensearch_client()
    
    # Get a sample of documents
    response = client.search(
        index=INDEX_VULNERABILITIES,
        body={
            "size": 10,
            "_source": ["id", "severity", "cvss_score", "metrics"],
            "query": {"match_all": {}}
        }
    )
    
    total_docs = response["hits"]["total"]["value"]
    sample_docs = response["hits"]["hits"]
    
    logger.info(f"Verification: Total documents in index: {total_docs}")
    
    with_fields = 0
    without_fields = 0
    
    for doc in sample_docs:
        source = doc["_source"]
        if "severity" in source and "cvss_score" in source:
            with_fields += 1
            logger.info(f"✓ {source['id']}: severity={source['severity']}, score={source['cvss_score']}")
        else:
            without_fields += 1
            logger.warning(f"✗ {source['id']}: Missing pre-calculated fields")
    
    logger.info(f"Sample verification: {with_fields}/{len(sample_docs)} documents have pre-calculated fields")
    return with_fields == len(sample_docs)

if __name__ == "__main__":
    logger.info("Starting vulnerability fields update script...")
    
    # Update vulnerabilities
    if update_vulnerabilities_batch():
        logger.info("Update completed successfully!")
        
        # Verify the update
        if verify_update():
            logger.info("✓ Verification passed! All sampled documents have pre-calculated fields.")
        else:
            logger.warning("⚠ Verification failed! Some documents may be missing fields.")
    else:
        logger.error("✗ Update failed!")
        sys.exit(1)
    
    logger.info("Script completed. You can now use the optimized dashboard queries!")