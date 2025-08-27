#!/usr/bin/env python3
"""
Test script to verify that the workflow system is working correctly.
"""
import logging
import sys
import os
import asyncio
from datetime import datetime

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.core.database import SessionLocal
from backend.core.workflow_engine import WorkflowEngine
from backend.crud.workflow import get_workflows
from backend.core.opensearch_client import get_opensearch_client
from backend.crud.vulnerability import get_vulnerability_by_id

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_workflow_system():
    """Test the workflow system with a real vulnerability"""
    
    logger.info("=== SafeMatrix Workflow System Test ===")
    
    # Connect to database
    db = SessionLocal()
    opensearch_client = get_opensearch_client()
    
    try:
        # 1. Check active workflows
        logger.info("1. Checking active workflows...")
        workflows = get_workflows(db, enabled=True)
        
        if not workflows:
            logger.warning("No active workflows found!")
            return
            
        logger.info(f"Found {len(workflows)} active workflows:")
        for workflow in workflows:
            logger.info(f"  - {workflow.name} (ID: {workflow.id}) - Status: {workflow.status}")
            logger.info(f"    Trigger on ingest: {workflow.trigger_on_ingest}")
            logger.info(f"    Enabled: {workflow.enabled}")
        
        # 2. Get a test vulnerability
        logger.info("\n2. Searching for test vulnerability...")
        
        # Try to find a vulnerability with high CVSS score
        query = {
            "query": {
                "range": {
                    "cvss_score": {
                        "gte": 7.0
                    }
                }
            },
            "size": 1
        }
        
        result = opensearch_client.search(index="vulnerabilities", body=query)
        hits = result.get("hits", {}).get("hits", [])
        
        if not hits:
            logger.warning("No vulnerability with CVSS score >= 7.0 found!")
            # Try with any vulnerability
            query = {"query": {"match_all": {}}, "size": 1}
            result = opensearch_client.search(index="vulnerabilities", body=query)
            hits = result.get("hits", {}).get("hits", [])
            
        if not hits:
            logger.error("No vulnerability found in OpenSearch!")
            return
            
        test_vuln = hits[0]["_source"]
        cve_id = test_vuln.get("id", "unknown")
        cvss_score = test_vuln.get("cvss_score", 0)
        severity = test_vuln.get("severity", "UNKNOWN")
        
        logger.info(f"Test vulnerability: {cve_id}")
        logger.info(f"  CVSS Score: {cvss_score}")
        logger.info(f"  Severity: {severity}")
        
        # 3. Test each workflow
        workflow_engine = WorkflowEngine(db)
        
        for workflow in workflows:
            if not workflow.trigger_on_ingest:
                logger.info(f"\n3. Skipping workflow '{workflow.name}' - no ingest trigger")
                continue
                
            logger.info(f"\n3. Testing workflow '{workflow.name}'...")
            
            try:
                # First test rules without executing actions
                test_result = await workflow_engine.test_workflow(workflow, test_vuln)
                
                logger.info(f"  Rules matched: {test_result['rules_matched']}")
                if test_result['rules_matched']:
                    logger.info(f"  Actions to execute: {len(test_result['actions_to_execute'])}")
                    for i, action in enumerate(test_result['actions_to_execute']):
                        logger.info(f"    Action {i+1}: {action['type']}")
                else:
                    logger.info(f"  Rules not matched - workflow will not be executed")
                    continue
                
                # Ask for confirmation before real execution
                response = input(f"\nActually execute workflow '{workflow.name}' ? (y/N): ")
                if response.lower() == 'y':
                    logger.info(f"Executing workflow '{workflow.name}'...")
                    execution_result = await workflow_engine.execute_workflow(
                        workflow, 
                        test_vuln, 
                        trigger_type="manual_test"
                    )
                    
                    logger.info(f"  Result: {execution_result}")
                    if execution_result.get('success'):
                        logger.info(f"  ✅ Workflow executed successfully!")
                        logger.info(f"  Actions executed: {execution_result.get('actions_executed', 0)}")
                        logger.info(f"  Actions failed: {execution_result.get('actions_failed', 0)}")
                    else:
                        logger.error(f"  ❌ Workflow failed: {execution_result.get('error')}")
                else:
                    logger.info("  Execution cancelled by user")
                    
            except Exception as e:
                logger.error(f"Error testing workflow '{workflow.name}': {e}")
                import traceback
                traceback.print_exc()
        
        logger.info("\n=== Test completed ===")
        
    except Exception as e:
        logger.error(f"General error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_workflow_system())
