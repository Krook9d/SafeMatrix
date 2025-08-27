#!/usr/bin/env python3
"""
Workflow Scheduler Service
Handles scheduled workflows and vulnerability ingest triggers
"""
import logging
import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any
import time
import schedule

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from backend.core.database import SessionLocal
from backend.core.workflow_engine import WorkflowEngine
from backend.models.workflow import Workflow, WorkflowStatus
from backend.core.opensearch_client import get_opensearch_client
from backend.crud.vulnerability import get_vulnerabilities_since
from sqlalchemy import and_

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WorkflowScheduler:
    """Service to handle workflow scheduling and triggers"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.workflow_engine = WorkflowEngine(self.db)
        self.opensearch_client = get_opensearch_client()
        self.running = False
        
    def start(self):
        """Start the workflow scheduler"""
        logger.info("Starting Workflow Scheduler...")
        self.running = True
        
        # Schedule periodic checks for cron workflows
        schedule.every(1).minutes.do(self._check_scheduled_workflows)
        
        # Schedule periodic checks for ingest workflows 
        schedule.every(30).seconds.do(self._check_ingest_workflows)
        
        logger.info("Workflow Scheduler started successfully!")
        
        try:
            while self.running:
                schedule.run_pending()
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Stopping Workflow Scheduler...")
            self.stop()
    
    def stop(self):
        """Stop the workflow scheduler"""
        self.running = False
        self.db.close()
        logger.info("Workflow Scheduler stopped")
    
    def _check_scheduled_workflows(self):
        """Check and execute scheduled workflows"""
        try:
            # Get active workflows with schedule trigger
            scheduled_workflows = self.db.query(Workflow).filter(
                and_(
                    Workflow.status == WorkflowStatus.ACTIVE,
                    Workflow.enabled == True,
                    Workflow.trigger_on_schedule == True,
                    Workflow.schedule_cron.isnot(None)
                )
            ).all()
            
            for workflow in scheduled_workflows:
                if self._should_execute_cron(workflow):
                    logger.info(f"Executing scheduled workflow: {workflow.name}")
                    asyncio.run(self._execute_workflow_on_all_vulnerabilities(workflow))
                    
        except Exception as e:
            logger.error(f"Error checking scheduled workflows: {e}")
    
    def _check_ingest_workflows(self):
        """Check for new vulnerabilities and trigger ingest workflows"""
        try:
            # Get active workflows with ingest trigger  
            ingest_workflows = self.db.query(Workflow).filter(
                and_(
                    Workflow.status == WorkflowStatus.ACTIVE,
                    Workflow.enabled == True,
                    Workflow.trigger_on_ingest == True
                )
            ).all()
            
            if not ingest_workflows:
                return
                
            # Get vulnerabilities added in the last 30 seconds
            since_time = datetime.utcnow() - timedelta(seconds=30)
            new_vulnerabilities = self._get_recent_vulnerabilities(since_time)
            
            if new_vulnerabilities:
                logger.info(f"Found {len(new_vulnerabilities)} new vulnerabilities, checking ingest workflows")
                
                for workflow in ingest_workflows:
                    for vuln in new_vulnerabilities:
                        asyncio.run(self._execute_workflow_on_vulnerability(workflow, vuln))
                        
        except Exception as e:
            logger.error(f"Error checking ingest workflows: {e}")
    
    def _should_execute_cron(self, workflow: Workflow) -> bool:
        """Check if a cron workflow should be executed now"""
        # This is a simplified cron check - you could use croniter library for more accuracy
        try:
            # For now, execute every hour workflows (you can enhance this)
            if workflow.schedule_cron and "0 * * * *" in workflow.schedule_cron:
                return datetime.utcnow().minute == 0
            return False
        except Exception:
            return False
    
    async def _execute_workflow_on_all_vulnerabilities(self, workflow: Workflow):
        """Execute workflow against all vulnerabilities in the database"""
        try:
            # Get all vulnerabilities (paginated)
            skip = 0
            limit = 100
            
            while True:
                vulnerabilities = self._get_vulnerabilities_page(skip, limit)
                if not vulnerabilities:
                    break
                    
                for vuln in vulnerabilities:
                    await self._execute_workflow_on_vulnerability(workflow, vuln)
                    
                skip += limit
                
        except Exception as e:
            logger.error(f"Error executing workflow on all vulnerabilities: {e}")
    
    async def _execute_workflow_on_vulnerability(self, workflow: Workflow, vulnerability_data: Dict[str, Any]):
        """Execute a workflow against a single vulnerability"""
        try:
            result = await self.workflow_engine.execute_workflow(
                workflow, 
                vulnerability_data, 
                trigger_type="schedule" if workflow.trigger_on_schedule else "ingest"
            )
            
            if result.get("rules_matched"):
                logger.info(f"Workflow '{workflow.name}' executed for {vulnerability_data.get('id', 'unknown')}")
                
        except Exception as e:
            logger.error(f"Error executing workflow on vulnerability: {e}")
    
    def _get_recent_vulnerabilities(self, since_time: datetime) -> List[Dict[str, Any]]:
        """Get vulnerabilities added since a specific time"""
        try:
            # Query OpenSearch for recent vulnerabilities
            query = {
                "query": {
                    "range": {
                        "lastModified": {
                            "gte": since_time.isoformat()
                        }
                    }
                },
                "size": 100
            }
            
            result = self.opensearch_client.search(index="vulnerabilities", body=query)
            return [hit["_source"] for hit in result.get("hits", {}).get("hits", [])]
            
        except Exception as e:
            logger.error(f"Error getting recent vulnerabilities: {e}")
            return []
    
    def _get_vulnerabilities_page(self, skip: int, limit: int) -> List[Dict[str, Any]]:
        """Get a page of vulnerabilities from OpenSearch"""
        try:
            query = {
                "query": {"match_all": {}},
                "from": skip,
                "size": limit
            }
            
            result = self.opensearch_client.search(index="vulnerabilities", body=query)
            return [hit["_source"] for hit in result.get("hits", {}).get("hits", [])]
            
        except Exception as e:
            logger.error(f"Error getting vulnerabilities page: {e}")
            return []

if __name__ == "__main__":
    scheduler = WorkflowScheduler()
    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.stop()