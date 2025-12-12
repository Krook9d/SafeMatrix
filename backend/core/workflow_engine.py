import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Import from backend module (when running from project root)
from backend.models.workflow import Workflow, WorkflowExecution, ActionLog, ConnectorConfig, ExecutionStatus, WorkflowStatus
from backend.models.custom_db import TeamMember
from backend.core.rules_engine import RulesEngine
from backend.core.connectors.factory import ConnectorFactory
from backend.schemas.workflow import RuleCondition, WorkflowAction
from backend.core.task_queue import WorkflowQueue
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
    
    def _resolve_connector_id(self, action_type: str, provided_connector_id: int = None) -> int:
        """
        Resolve the connector ID for an action type.
        If provided_connector_id is valid, use it. Otherwise, find the first enabled connector of the required type.
        """
        # If a connector ID is provided and it's not 0, try to use it
        if provided_connector_id and provided_connector_id != 0:
            connector = self.db.query(ConnectorConfig).filter(
                ConnectorConfig.id == provided_connector_id,
                ConnectorConfig.enabled == True
            ).first()
            if connector:
                return provided_connector_id
        
        # Map action types to connector types
        action_to_connector_map = {
            "thehive": "THEHIVE",
            "email": "EMAIL",
            "servicenow": "SERVICENOW",
            "jira": "JIRA"
        }
        
        connector_type = action_to_connector_map.get(action_type.lower())
        if not connector_type:
            raise ValueError(f"Unknown action type: {action_type}")
        
        # Find the first enabled connector of the required type
        connector = self.db.query(ConnectorConfig).filter(
            ConnectorConfig.connector_type == connector_type,
            ConnectorConfig.enabled == True
        ).first()
        
        if not connector:
            raise ValueError(f"No enabled connector found for type: {connector_type}")
        
        logger.info(f"Auto-resolved connector ID {connector.id} for action type '{action_type}'")
        return connector.id

    def _expand_email_recipients(self, action_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge team members into the email recipient lists.
        """
        to_emails = list(action_config.get("to") or [])
        cc_emails = list(action_config.get("cc") or [])
        team_ids = action_config.get("team_ids") or []
        cc_team_ids = action_config.get("cc_team_ids") or []

        if team_ids:
            members = self.db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).all()
            to_emails.extend([m.email for m in members])

        if cc_team_ids:
            members = self.db.query(TeamMember).filter(TeamMember.team_id.in_(cc_team_ids)).all()
            cc_emails.extend([m.email for m in members])

        # Deduplicate while preserving order
        def _unique(seq):
            seen = set()
            ordered = []
            for item in seq:
                if item not in seen:
                    seen.add(item)
                    ordered.append(item)
            return ordered

        action_config["to"] = _unique(to_emails)
        action_config["cc"] = _unique(cc_emails)
        return action_config

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
        # Prepare action payload (may be enriched for email teams)
        action_payload = action.config.dict()
        if action.type == "email":
            action_payload = self._expand_email_recipients(action_payload)

        # Create action log
        action_log = ActionLog(
            execution_id=execution_id,
            action_type=action.type,
            action_config=action_payload,
            status=ExecutionStatus.RUNNING
        )
        
        self.db.add(action_log)
        self.db.commit()
        
        try:
            # Resolve connector ID dynamically
            resolved_connector_id = self._resolve_connector_id(
                action.type, 
                getattr(action.config, 'connector_id', None)
            )
            
            # Get connector configuration
            connector_config = self.db.query(ConnectorConfig).filter(
                ConnectorConfig.id == resolved_connector_id
            ).first()

            if not connector_config or not connector_config.enabled:
                raise ValueError(f"Connector {resolved_connector_id} not found or disabled")

            # Create connector instance with secrets merged from vault
            from backend.core.vault import merge_credentials_into_config
            merged_cfg = merge_credentials_into_config(
                str(connector_config.connector_type),
                connector_config.config,
                connector_config.credentials,
            )
            connector = ConnectorFactory.create_connector(
                connector_config.connector_type,
                merged_cfg,
            )

            # Execute action
            context = {
                "vulnerability_data": vulnerability_data,
                "execution_id": execution_id
            }

            result = await connector.execute_action(action_payload, context)

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

    async def test_workflow_with_custom_data(
        self,
        workflow: Workflow,
        test_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Test a workflow with custom data and actually execute actions.

        Returns a summary including per-action results. Does not create DB execution records.
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

            if not rules_result.get("matched", False):
                return {
                    "success": True,
                    "execution_id": f"test-{int(datetime.utcnow().timestamp())}",
                    "rules_matched": False,
                    "matched_rules": rules_result.get("matched_rules", []),
                    "actions_executed": 0,
                    "results": []
                }

            # Execute actions without persisting logs
            action_results: List[Dict[str, Any]] = []
            actions_executed = 0

            for i, action_dict in enumerate(workflow.actions):
                try:
                    action = WorkflowAction(**action_dict) if isinstance(action_dict, dict) else action_dict

                    # Resolve connector and build merged config
                    resolved_connector_id = self._resolve_connector_id(
                        action.type,
                        getattr(action.config, 'connector_id', None)
                    )
                    connector_config = self.db.query(ConnectorConfig).filter(
                        ConnectorConfig.id == resolved_connector_id
                    ).first()
                    if not connector_config or not connector_config.enabled:
                        raise ValueError(f"Connector {resolved_connector_id} not found or disabled")

                    from backend.core.vault import merge_credentials_into_config
                    merged_cfg = merge_credentials_into_config(
                        str(connector_config.connector_type),
                        connector_config.config,
                        connector_config.credentials,
                    )
                    connector = ConnectorFactory.create_connector(
                        connector_config.connector_type,
                        merged_cfg,
                    )

                    context = {"vulnerability_data": test_data, "execution_id": 0}
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
                        "action_type": getattr(action_dict, 'type', 'unknown'),
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