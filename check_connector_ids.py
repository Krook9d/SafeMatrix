#!/usr/bin/env python3
"""
Script to check connector IDs and workflow configurations
"""
import logging
import sys
import os

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.core.database import SessionLocal
from backend.models.workflow import ConnectorConfig, Workflow
from backend.crud.workflow import get_workflows

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_connectors_and_workflows():
    """Check connector IDs and workflow configurations"""
    
    logger.info("=== Checking Connectors and Workflow Configurations ===")
    
    db = SessionLocal()
    
    try:
        # 1. List all connectors
        logger.info("\n1. Available Connectors:")
        connectors = db.query(ConnectorConfig).all()
        
        if not connectors:
            logger.warning("No connectors found!")
            return
            
        for connector in connectors:
            logger.info(f"  - ID: {connector.id}")
            logger.info(f"    Name: {connector.name}")
            logger.info(f"    Type: {connector.connector_type}")
            logger.info(f"    Enabled: {connector.enabled}")
            logger.info(f"    Test Status: {connector.test_status}")
            logger.info("")
        
        # 2. Check workflows and their connector references
        logger.info("2. Workflow Configurations:")
        workflows = get_workflows(db, enabled=True)
        
        for workflow in workflows:
            logger.info(f"  - Workflow: {workflow.name} (ID: {workflow.id})")
            logger.info(f"    Status: {workflow.status}")
            logger.info(f"    Enabled: {workflow.enabled}")
            logger.info(f"    Actions:")
            
            for i, action in enumerate(workflow.actions):
                logger.info(f"      Action {i+1}: {action}")
                if isinstance(action, dict):
                    action_type = action.get('type', 'unknown')
                    config = action.get('config', {})
                    connector_id = config.get('connector_id', 'not specified')
                    logger.info(f"        Type: {action_type}")
                    logger.info(f"        Connector ID: {connector_id}")
                    
                    # Check if connector exists
                    if connector_id != 'not specified':
                        connector = db.query(ConnectorConfig).filter(ConnectorConfig.id == connector_id).first()
                        if connector:
                            logger.info(f"        ✅ Connector found: {connector.name} ({connector.connector_type})")
                        else:
                            logger.error(f"        ❌ Connector ID {connector_id} not found!")
            logger.info("")
                    
    except Exception as e:
        logger.error(f"Error checking configurations: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_connectors_and_workflows()
