#!/usr/bin/env python3
"""
Script to fix workflow connector IDs to use the correct TheHive connector
"""
import logging
import sys
import os
import json

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

def fix_workflow_connector_ids():
    """Fix workflow connector IDs to use the correct TheHive connector"""
    
    logger.info("=== Fixing Workflow Connector IDs ===")
    
    db = SessionLocal()
    
    try:
        # Find the TheHive connector
        thehive_connector = db.query(ConnectorConfig).filter(
            ConnectorConfig.connector_type == "THEHIVE",
            ConnectorConfig.enabled == True
        ).first()
        
        if not thehive_connector:
            logger.error("No enabled TheHive connector found!")
            return
            
        logger.info(f"Found TheHive connector: ID {thehive_connector.id}, Name: {thehive_connector.name}")
        
        # Get all workflows
        workflows = get_workflows(db, enabled=True)
        
        updated_workflows = 0
        
        for workflow in workflows:
            logger.info(f"\nChecking workflow: {workflow.name} (ID: {workflow.id})")
            
            actions_updated = False
            updated_actions = []
            
            for i, action in enumerate(workflow.actions):
                if isinstance(action, dict) and action.get('type') == 'thehive':
                    config = action.get('config', {})
                    current_connector_id = config.get('connector_id')
                    
                    logger.info(f"  Action {i+1}: TheHive action with connector ID {current_connector_id}")
                    
                    if current_connector_id != thehive_connector.id:
                        # Update the connector ID
                        config['connector_id'] = thehive_connector.id
                        action['config'] = config
                        actions_updated = True
                        logger.info(f"    ✅ Updated connector ID from {current_connector_id} to {thehive_connector.id}")
                    else:
                        logger.info(f"    ✅ Connector ID already correct")
                
                updated_actions.append(action)
            
            if actions_updated:
                # Update the workflow in the database
                workflow.actions = updated_actions
                db.commit()
                updated_workflows += 1
                logger.info(f"  ✅ Workflow '{workflow.name}' updated successfully")
            else:
                logger.info(f"  ℹ️ Workflow '{workflow.name}' already has correct connector IDs")
        
        logger.info(f"\n=== Summary ===")
        logger.info(f"Updated {updated_workflows} workflows")
        logger.info(f"All workflows now use TheHive connector ID: {thehive_connector.id}")
        logger.info("✅ Workflow connector IDs fixed!")
                    
    except Exception as e:
        logger.error(f"Error fixing workflow connector IDs: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    fix_workflow_connector_ids()
