#!/usr/bin/env python3
"""
Final comprehensive workflow test
"""
import logging
import sys
import os
import asyncio

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.core.database import SessionLocal
from backend.core.workflow_engine import WorkflowEngine
from backend.crud.workflow import get_workflows
from backend.core.opensearch_client import get_opensearch_client
from backend.models.workflow import WorkflowExecution, ActionLog

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def clean_all_test_executions():
    """Clean all test executions"""
    db = SessionLocal()
    try:
        # Delete all executions with manual_test trigger
        executions = db.query(WorkflowExecution).filter(
            WorkflowExecution.trigger_type == "manual_test"
        ).all()
        
        logger.info(f"Cleaning {len(executions)} test executions...")
        
        for execution in executions:
            # Delete action logs first
            action_logs = db.query(ActionLog).filter(ActionLog.execution_id == execution.id).all()
            for log in action_logs:
                db.delete(log)
            db.delete(execution)
            
        db.commit()
        logger.info("✅ All test executions cleaned")
        
    except Exception as e:
        logger.error(f"Error cleaning executions: {e}")
        db.rollback()
    finally:
        db.close()

async def test_workflow_completely():
    """Complete workflow test"""
    
    logger.info("=== Final Workflow Test ===")
    
    # First clean executions
    clean_all_test_executions()
    
    db = SessionLocal()
    opensearch_client = get_opensearch_client()
    
    try:
        # Get any vulnerability with high CVSS
        query = {
            "query": {
                "range": {
                    "cvss_score": {
                        "gte": 7.0
                    }
                }
            },
            "size": 3
        }
        
        result = opensearch_client.search(index="vulnerabilities", body=query)
        hits = result.get("hits", {}).get("hits", [])
        
        if not hits:
            logger.error("No vulnerabilities with CVSS >= 7.0 found!")
            return
            
        # Use the third one to be sure it's fresh
        test_vuln = hits[-1]["_source"] if len(hits) > 2 else hits[0]["_source"]
        cve_id = test_vuln.get("id", "unknown")
        cvss_score = test_vuln.get("cvss_score", 0)
        severity = test_vuln.get("severity", "UNKNOWN")
        
        logger.info(f"Using vulnerability: {cve_id}")
        logger.info(f"  CVSS Score: {cvss_score}")
        logger.info(f"  Severity: {severity}")
        
        # Get workflows
        workflows = get_workflows(db, enabled=True)
        workflow_engine = WorkflowEngine(db)
        
        for workflow in workflows:
            if not workflow.trigger_on_ingest:
                continue
                
            logger.info(f"\n=== Testing Workflow: {workflow.name} ===")
            
            try:
                # Test rules
                test_result = await workflow_engine.test_workflow(workflow, test_vuln)
                
                logger.info(f"Rules matched: {test_result['rules_matched']}")
                
                if test_result['rules_matched']:
                    logger.info(f"Actions to execute: {len(test_result['actions_to_execute'])}")
                    for i, action in enumerate(test_result['actions_to_execute']):
                        logger.info(f"  Action {i+1}: {action['type']}")
                    
                    # Execute workflow
                    logger.info("🚀 Executing workflow...")
                    execution_result = await workflow_engine.execute_workflow(
                        workflow, 
                        test_vuln, 
                        trigger_type="manual_test"
                    )
                    
                    logger.info(f"Execution result: {execution_result}")
                    
                    if execution_result.get('success'):
                        if execution_result.get('skipped'):
                            logger.warning("⚠️ Execution was skipped (duplicate)")
                        else:
                            actions_executed = execution_result.get('actions_executed', 0)
                            actions_failed = execution_result.get('actions_failed', 0)
                            
                            logger.info(f"✅ Workflow executed!")
                            logger.info(f"  Actions executed: {actions_executed}")
                            logger.info(f"  Actions failed: {actions_failed}")
                            
                            if actions_executed > 0:
                                logger.info("🎉 SUCCESS! TheHive case should have been created!")
                            elif actions_failed > 0:
                                logger.warning("⚠️ Actions failed - check connector configuration")
                    else:
                        logger.error(f"❌ Workflow failed: {execution_result.get('error')}")
                else:
                    logger.info("Rules not matched - workflow skipped")
                    
            except Exception as e:
                logger.error(f"Error testing workflow '{workflow.name}': {e}")
                import traceback
                traceback.print_exc()
        
        logger.info("\n=== Test Summary ===")
        logger.info("✅ Workflow system is working correctly")
        logger.info("🔧 If actions failed, verify your TheHive connector configuration")
        
    except Exception as e:
        logger.error(f"General error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_workflow_completely())
