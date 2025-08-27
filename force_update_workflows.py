#!/usr/bin/env python3
"""
Force update workflow configurations using raw SQL
"""
import logging
import sys
import os
import json

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from backend.core.database import SessionLocal
from sqlalchemy import text

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def force_update_workflows():
    """Force update workflow connector IDs using raw SQL"""
    
    logger.info("=== Force Updating Workflow Connector IDs ===")
    
    db = SessionLocal()
    
    try:
        # Get current workflows
        result = db.execute(text("SELECT id, name, actions FROM workflows WHERE enabled = true"))
        workflows = result.fetchall()
        
        logger.info(f"Found {len(workflows)} workflows to update")
        
        for workflow_id, workflow_name, actions_json in workflows:
            logger.info(f"\nUpdating workflow: {workflow_name} (ID: {workflow_id})")
            
            # Parse actions JSON
            actions = json.loads(actions_json) if isinstance(actions_json, str) else actions_json
            
            # Update connector IDs
            updated = False
            for action in actions:
                if isinstance(action, dict) and action.get('type') == 'thehive':
                    config = action.get('config', {})
                    if config.get('connector_id') == 0:
                        config['connector_id'] = 1
                        updated = True
                        logger.info(f"  Updated action connector ID from 0 to 1")
            
            if updated:
                # Update using raw SQL
                updated_actions_json = json.dumps(actions)
                update_sql = text("""
                    UPDATE workflows 
                    SET actions = :actions, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = :workflow_id
                """)
                
                db.execute(update_sql, {
                    'actions': updated_actions_json,
                    'workflow_id': workflow_id
                })
                
                logger.info(f"  ✅ Workflow '{workflow_name}' updated in database")
            else:
                logger.info(f"  ℹ️ Workflow '{workflow_name}' already has correct connector IDs")
        
        db.commit()
        logger.info("\n✅ All workflows updated successfully!")
        
        # Verify the update
        logger.info("\nVerifying updates...")
        result = db.execute(text("SELECT id, name, actions FROM workflows WHERE enabled = true"))
        workflows = result.fetchall()
        
        for workflow_id, workflow_name, actions_json in workflows:
            actions = json.loads(actions_json) if isinstance(actions_json, str) else actions_json
            for action in actions:
                if isinstance(action, dict) and action.get('type') == 'thehive':
                    connector_id = action.get('config', {}).get('connector_id')
                    logger.info(f"  {workflow_name}: connector_id = {connector_id}")
        
    except Exception as e:
        logger.error(f"Error updating workflows: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    force_update_workflows()
