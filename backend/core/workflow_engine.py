import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

try:
    # Try importing from backend module (when running from project root)
    from backend.models.workflow import Workflow, WorkflowExecution, ActionLog, ConnectorConfig, ExecutionStatus, WorkflowStatus
    from backend.core.rules_engine import RulesEngine
    from backend.core.connectors.factory import ConnectorFactory
    from backend.schemas.workflow import RuleCondition, WorkflowAction
    from backend.core.task_queue import WorkflowQueue
except ImportError:
    # Fall back to local imports (when running from backend directory)
    from models.workflow import Workflow, WorkflowExecution, ActionLog, ConnectorConfig, ExecutionStatus, WorkflowStatus
    from .rules_engine import RulesEngine
    from .connectors.factory import ConnectorFactory
    from schemas.workflow import RuleCondition, WorkflowAction
    from .task_queue import WorkflowQueue
import hashlib
import json

logger = logging.getLogger(__name__)

class WorkflowEngine:
    """
    Main workflow execution engine.
    """
    
    def __init__(self, db: Session, use_queue: bool = True):
        self.db = db
        self.rules_engine = RulesEngine()
        self.use_queue = use_queue
        self.queue = WorkflowQueue() if use_queue else None
    
    async def process_vulnerability_ingest(self, vulnerability_data: Dict[str, Any], use_queue: bool = None) -> List[Dict[str, Any]]:
        """
        Process vulnerability ingest and trigger matching workflows.
        
        Args:
            vulnerability_data: Vulnerability data from NVD
            use_queue: Override instance queue setting
            
        Returns:
            List of execution results or task IDs if queued
        """
        try:
            cve_id = vulnerability_data.get("id", "unknown")
            logger.info(f"Processing vulnerability ingest for {cve_id}")
            
            # Get active workflows that trigger on ingest
            workflows = self.db.query(Workflow).filter(
                and_(
                    Workflow.status == WorkflowStatus.ACTIVE,
                    Workflow.enabled == True,
                    Workflow.trigger_on_ingest == True
                )
            ).all()
            
            logger.info(f"Found {len(workflows)} active workflows for ingest trigger")
            for workflow in workflows:
                logger.info(f"Workflow {workflow.id} '{workflow.name}' - Status: {workflow.status}, Enabled: {workflow.enabled}")
            
            should_use_queue = use_queue if use_queue is not None else self.use_queue
            
            if should_use_queue and self.queue:
                # Queue workflows for asynchronous execution
                execution_results = []
                for workflow in workflows:
                    try:
                        # Determine priority based on CVSS score
                        cvss_score = vulnerability_data.get("baseScore", 0)
                        priority = min(9, max(1, int(cvss_score)))
                        
                        task_id = self.queue.enqueue_workflow(
                            workflow_id=workflow.id,
                            vulnerability_data=vulnerability_data,
                            trigger_type="ingest",
                            priority=priority
                        )
                        
                        execution_results.append({
                            "workflow_id": workflow.id,
                            "task_id": task_id,
                            "queued": True,
                            "priority": priority
                        })
                        
                    except Exception as e:
                        logger.error(f"Error queuing workflow {workflow.id} for {cve_id}: {e}")
                        execution_results.append({
                            "workflow_id": workflow.id,
                            "success": False,
                            "error": str(e)
                        })
                
                return execution_results
            else:
                # Execute workflows synchronously (legacy mode)
                execution_results = []
                
                for workflow in workflows:
                    try:
                        result = await self.execute_workflow(
                            workflow,
                            vulnerability_data,
                            trigger_type="ingest"
                        )
                        execution_results.append(result)
                        
                    except Exception as e:
                        logger.error(f"Error executing workflow {workflow.id} for {cve_id}: {e}")
                        execution_results.append({
                            "workflow_id": workflow.id,
                            "success": False,
                            "error": str(e)
                        })
                
                return execution_results
            
        except Exception as e:
            logger.error(f"Error processing vulnerability ingest: {e}")
            return []
    
    async def execute_workflow(
        self, 
        workflow: Workflow, 
        vulnerability_data: Dict[str, Any], 
        trigger_type: str = "manual"
    ) -> Dict[str, Any]:
        """
        Execute a single workflow against vulnerability data.
        
        Args:
            workflow: Workflow to execute
            vulnerability_data: Vulnerability data
            trigger_type: Type of trigger (ingest, schedule, manual)
            
        Returns:
            Execution result
        """
        cve_id = vulnerability_data.get("id", "unknown")
        
        # Create idempotency key to prevent duplicate executions
        idempotency_data = {
            "workflow_id": workflow.id,
            "cve_id": cve_id,
            "trigger_type": trigger_type
        }
        idempotency_key = hashlib.md5(json.dumps(idempotency_data, sort_keys=True).encode()).hexdigest()
        
        # Check for existing execution with same idempotency key
        existing_execution = self.db.query(WorkflowExecution).filter(
            WorkflowExecution.idempotency_key == idempotency_key
        ).first()
        
        if existing_execution:
            logger.info(f"Skipping duplicate execution for workflow {workflow.id}, CVE {cve_id}")
            return {
                "workflow_id": workflow.id,
                "execution_id": existing_execution.id,
                "success": True,
                "skipped": True,
                "message": "Execution already exists"
            }
        
        # Create execution record
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            trigger_type=trigger_type,
            vulnerability_id=cve_id,
            status=ExecutionStatus.RUNNING,
            idempotency_key=idempotency_key,
            execution_log={"started": datetime.utcnow().isoformat()}
        )
        
        self.db.add(execution)
        self.db.commit()
        
        try:
            logger.info(f"Executing workflow {workflow.id} for CVE {cve_id}")
            
            # Convert rules from dict to RuleCondition objects
            rule_conditions = []
            for rule_dict in workflow.rules:
                rule_conditions.append(RuleCondition(**rule_dict))
            
            # Evaluate rules
            rules_result = self.rules_engine.evaluate_workflow(
                rule_conditions,
                workflow.rule_logic,
                vulnerability_data
            )
            
            execution.rules_matched = rules_result["matched"]
            execution.execution_log["rules_evaluation"] = rules_result
            
            if not rules_result["matched"]:
                logger.info(f"Rules not matched for workflow {workflow.id}, CVE {cve_id}")
                execution.status = ExecutionStatus.SKIPPED
                execution.completed_at = datetime.utcnow()
                self.db.commit()
                
                return {
                    "workflow_id": workflow.id,
                    "execution_id": execution.id,
                    "success": True,
                    "rules_matched": False,
                    "message": "Rules not matched"
                }
            
            # Execute actions
            actions_executed = 0
            actions_failed = 0
            
            for action_dict in workflow.actions:
                try:
                    # Convert dict to WorkflowAction if needed
                    if isinstance(action_dict, dict):
                        action = WorkflowAction(**action_dict)
                    else:
                        action = action_dict
                        
                    action_result = await self.execute_action(
                        action, 
                        vulnerability_data, 
                        execution.id
                    )
                    
                    if action_result.get("success", False):
                        actions_executed += 1
                    else:
                        actions_failed += 1
                        
                except Exception as e:
                    logger.error(f"Error executing action: {e}")
                    actions_failed += 1
            
            # Update execution status
            execution.actions_executed = actions_executed
            execution.actions_failed = actions_failed
            execution.status = ExecutionStatus.SUCCESS if actions_failed == 0 else ExecutionStatus.FAILED
            execution.completed_at = datetime.utcnow()
            
            self.db.commit()
            
            return {
                "workflow_id": workflow.id,
                "execution_id": execution.id,
                "success": True,
                "rules_matched": True,
                "actions_executed": actions_executed,
                "actions_failed": actions_failed
            }
            
        except Exception as e:
            logger.error(f"Error executing workflow {workflow.id}: {e}")
            
            execution.status = ExecutionStatus.FAILED
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            
            return {
                "workflow_id": workflow.id,
                "execution_id": execution.id,
                "success": False,
                "error": str(e)
            }
    
    async def execute_action(
        self, 
        action: WorkflowAction, 
        vulnerability_data: Dict[str, Any], 
        execution_id: int
    ) -> Dict[str, Any]:
        """
        Execute a single action.
        
        Args:
            action: Action to execute
            vulnerability_data: Vulnerability data
            execution_id: Execution ID for logging
            
        Returns:
            Action execution result
        """
        # Create action log
        action_log = ActionLog(
            execution_id=execution_id,
            action_type=action.type,
            action_config=action.config.dict(),
            status=ExecutionStatus.RUNNING
        )
        
        self.db.add(action_log)
        self.db.commit()
        
        try:
            # Get connector configuration
            connector_config = self.db.query(ConnectorConfig).filter(
                ConnectorConfig.id == action.config.connector_id
            ).first()
            
            if not connector_config or not connector_config.enabled:
                raise ValueError(f"Connector {action.config.connector_id} not found or disabled")
            
            # Create connector instance
            connector = ConnectorFactory.create_connector(
                connector_config.connector_type,
                connector_config.config
            )
            
            # Execute action
            context = {
                "vulnerability_data": vulnerability_data,
                "execution_id": execution_id
            }
            
            result = await connector.execute_action(action.config.dict(), context)
            
            # Update action log
            action_log.status = ExecutionStatus.SUCCESS if result.get("success") else ExecutionStatus.FAILED
            action_log.response_data = result
            action_log.completed_at = datetime.utcnow()
            
            if not result.get("success"):
                action_log.error_message = result.get("error", "Unknown error")
            
            self.db.commit()
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing action: {e}")
            
            action_log.status = ExecutionStatus.FAILED
            action_log.error_message = str(e)
            action_log.completed_at = datetime.utcnow()
            self.db.commit()
            
            return {
                "success": False,
                "error": str(e)
            }
    
    async def test_workflow(
        self, 
        workflow: Workflow, 
        vulnerability_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Test a workflow without executing actions.
        
        Args:
            workflow: Workflow to test
            vulnerability_data: Vulnerability data to test against
            
        Returns:
            Test results
        """
        try:
            # Convert rules from dict to RuleCondition objects
            rule_conditions = []
            for rule_dict in workflow.rules:
                rule_conditions.append(RuleCondition(**rule_dict))
            
            # Evaluate rules
            rules_result = self.rules_engine.evaluate_workflow(
                rule_conditions,
                workflow.rule_logic,
                vulnerability_data
            )
            
            # Prepare actions that would be executed
            actions_to_execute = []
            if rules_result["matched"]:
                for action_dict in workflow.actions:
                    if isinstance(action_dict, dict):
                        actions_to_execute.append({
                            "type": action_dict.get("type", "unknown"),
                            "config": action_dict.get("config", {})
                        })
                    else:
                        actions_to_execute.append({
                            "type": action_dict.type,
                            "config": action_dict.config.dict()
                        })
            
            return {
                "rules_matched": rules_result["matched"],
                "matched_rules": rules_result.get("matched_rules", []),
                "actions_to_execute": actions_to_execute,
                "test_log": {
                    "rules_evaluation": rules_result,
                    "normalized_data": rules_result.get("normalized_data", {})
                }
            }
            
        except Exception as e:
            logger.error(f"Error testing workflow: {e}")
            return {
                "rules_matched": False,
                "matched_rules": [],
                "actions_to_execute": [],
                "error": str(e)
            }
    
    async def test_workflow_with_custom_data(
        self, 
        workflow: Workflow, 
        test_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Test a workflow with custom data and actually execute actions.
        
        Args:
            workflow: Workflow to test
            test_data: Custom test data
            
        Returns:
            Test execution results
        """
        try:
            logger.info(f"Testing workflow {workflow.id} with custom data")
            
            # Convert rules from dict to RuleCondition objects
            rule_conditions = []
            for rule_dict in workflow.rules:
                rule_conditions.append(RuleCondition(**rule_dict))
            
            # Evaluate rules
            rules_result = self.rules_engine.evaluate_workflow(
                rule_conditions,
                workflow.rule_logic,
                test_data
            )
            
            logger.info(f"Rules evaluation result: {rules_result}")
            logger.info(f"Test data: {test_data}")
            
            if not rules_result["matched"]:
                logger.info("Rules not matched - no actions will be executed")
                return {
                    "success": True,
                    "rules_matched": False,
                    "matched_rules": rules_result.get("matched_rules", []),
                    "actions_executed": 0,
                    "results": [],
                    "message": "Rules not matched - no actions executed"
                }
            
            # Execute actions for real
            action_results = []
            actions_executed = 0
            
            logger.info(f"Rules matched! Executing {len(workflow.actions)} actions")
            
            # Convert actions from dict to WorkflowAction objects if needed
            actions_to_execute = []
            for action_dict in workflow.actions:
                if isinstance(action_dict, dict):
                    actions_to_execute.append(WorkflowAction(**action_dict))
                else:
                    actions_to_execute.append(action_dict)
            
            for i, action in enumerate(actions_to_execute):
                try:
                    logger.info(f"Executing test action {i}: {action.type}")
                    
                    # Get connector configuration
                    connector_config = self.db.query(ConnectorConfig).filter(
                        ConnectorConfig.id == action.config.connector_id
                    ).first()
                    
                    if not connector_config or not connector_config.enabled:
                        action_results.append({
                            "action_type": action.type,
                            "action_index": i,
                            "success": False,
                            "message": f"Connector {action.config.connector_id} not found or disabled"
                        })
                        continue
                    
                    # Create connector instance
                    connector = ConnectorFactory.create_connector(
                        connector_config.connector_type,
                        connector_config.config
                    )
                    
                    # Execute action with test data
                    context = {
                        "vulnerability_data": test_data,
                        "execution_id": f"test-{datetime.utcnow().timestamp()}"
                    }
                    
                    result = await connector.execute_action(action.config.dict(), context)
                    
                    action_results.append({
                        "action_type": action.type,
                        "action_index": i,
                        "success": result.get("success", False),
                        "message": result.get("message", "Action executed"),
                        "details": result.get("details", {})
                    })
                    
                    if result.get("success", False):
                        actions_executed += 1
                        
                except Exception as e:
                    logger.error(f"Error executing test action {i}: {e}")
                    action_results.append({
                        "action_type": action.type,
                        "action_index": i,
                        "success": False,
                        "message": f"Error: {str(e)}"
                    })
            
            return {
                "success": True,
                "execution_id": f"test-{int(datetime.utcnow().timestamp())}",
                "rules_matched": True,
                "matched_rules": rules_result.get("matched_rules", []),
                "actions_executed": actions_executed,
                "results": action_results
            }
            
        except Exception as e:
            logger.error(f"Error testing workflow with custom data: {e}")
            return {
                "success": False,
                "error": str(e),
                "rules_matched": False,
                "actions_executed": 0,
                "results": []
            }