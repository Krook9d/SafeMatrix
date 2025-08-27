import logging
from typing import Dict, Any
from celery import Celery

# Import with fallback for different contexts (Docker vs local)
try:
    from backend.core.config import get_settings
except ImportError:
    from core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Configuration Celery
celery_app = Celery(
    "safematrix_workflows",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/1"
)

# Configuration Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_reject_on_worker_lost=True,
    result_expires=3600,  # 1 heure
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    broker_connection_retry_on_startup=True
)

@celery_app.task(bind=True, name="workflow.execute")
def execute_workflow_task(
    self,
    workflow_id: int,
    vulnerability_data: Dict[str, Any],
    trigger_type: str = "queue"
):
    """
    Celery task to execute a workflow asynchronously.
    
    Args:
        workflow_id: ID of the workflow to execute
        vulnerability_data: Vulnerability data
        trigger_type: Type of trigger
    """
    # Import with fallback for different contexts
    try:
        from backend.core.database import SessionLocal
        from backend.core.workflow_engine import WorkflowEngine
        from backend.crud.workflow import get_workflow
    except ImportError:
        from core.database import SessionLocal
        from core.workflow_engine import WorkflowEngine
        from crud.workflow import get_workflow
    import asyncio
    
    try:
        logger.info(f"Executing workflow task {workflow_id} for CVE {vulnerability_data.get('id', 'unknown')}")
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Get the workflow
            workflow = get_workflow(db, workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")
            
            # Create engine and execute workflow
            engine = WorkflowEngine(db)
            
            # Execute asynchronously
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                result = loop.run_until_complete(
                    engine.execute_workflow(workflow, vulnerability_data, trigger_type)
                )
                
                logger.info(f"Workflow {workflow_id} executed successfully: {result}")
                return result
                
            finally:
                loop.close()
                
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Error executing workflow {workflow_id}: {exc}")
        # Automatic retry configured via task_max_retries
        raise self.retry(exc=exc, countdown=60, max_retries=3)

@celery_app.task(bind=True, name="workflow.process_vulnerability_batch")
def process_vulnerability_batch_task(self, vulnerabilities_data: list):
    """
    Task to process a batch of vulnerabilities.
    
    Args:
        vulnerabilities_data: List of vulnerability data
    """
    # Import with fallback for different contexts
    try:
        from backend.core.database import SessionLocal
        from backend.core.workflow_engine import WorkflowEngine
    except ImportError:
        from core.database import SessionLocal
        from core.workflow_engine import WorkflowEngine
    import asyncio
    
    try:
        logger.info(f"Processing batch of {len(vulnerabilities_data)} vulnerabilities")
        
        db = SessionLocal()
        try:
            engine = WorkflowEngine(db)
            
            # Process each vulnerability
            results = []
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                for vuln_data in vulnerabilities_data:
                    try:
                        result = loop.run_until_complete(
                            engine.process_vulnerability_ingest(vuln_data)
                        )
                        results.extend(result)
                    except Exception as e:
                        logger.error(f"Error processing {vuln_data.get('id')}: {e}")
                        results.append({
                            "vulnerability_id": vuln_data.get('id', 'unknown'),
                            "success": False,
                            "error": str(e)
                        })
                
                logger.info(f"Batch processed: {len(results)} results")
                return results
                
            finally:
                loop.close()
                
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Error processing batch: {exc}")
        raise self.retry(exc=exc, countdown=120, max_retries=2)

class WorkflowQueue:
    """
    Workflow queue management service.
    """
    
    def __init__(self):
        if celery_app is None:
            self.celery = get_celery_app()
        else:
            self.celery = celery_app
    
    def enqueue_workflow(
        self,
        workflow_id: int,
        vulnerability_data: Dict[str, Any],
        trigger_type: str = "queue",
        priority: int = 5
    ) -> str:
        """
        Add a workflow to the execution queue.
        
        Args:
            workflow_id: Workflow ID
            vulnerability_data: Vulnerability data
            trigger_type: Trigger type
            priority: Priority (0-9, 9 = high priority)
            
        Returns:
            Task ID
        """
        task = execute_workflow_task.apply_async(
            args=[workflow_id, vulnerability_data, trigger_type],
            priority=priority,
            queue='workflows'
        )
        
        logger.info(f"Workflow {workflow_id} added to queue with task ID: {task.id}")
        return task.id
    
    def enqueue_vulnerability_batch(
        self,
        vulnerabilities_data: list,
        priority: int = 3
    ) -> str:
        """
        Add a batch of vulnerabilities to process.
        
        Args:
            vulnerabilities_data: List of vulnerabilities
            priority: Priority
            
        Returns:
            Task ID
        """
        task = process_vulnerability_batch_task.apply_async(
            args=[vulnerabilities_data],
            priority=priority,
            queue='batch_processing'
        )
        
        logger.info(f"Batch of {len(vulnerabilities_data)} vulnerabilities added with task ID: {task.id}")
        return task.id
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get task status.
        
        Args:
            task_id: Task ID
            
        Returns:
            Task status
        """
        app = self.celery or get_celery_app()
        result = app.AsyncResult(task_id)
        
        return {
            "task_id": task_id,
            "status": result.status,
            "result": result.result if result.ready() else None,
            "traceback": result.traceback if result.failed() else None
        }
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a task.
        
        Args:
            task_id: Task ID
            
        Returns:
            True if successfully cancelled
        """
        try:
            app = self.celery or get_celery_app()
            app.control.revoke(task_id, terminate=True)
            logger.info(f"Task {task_id} cancelled")
            return True
        except Exception as e:
            logger.error(f"Error cancelling task {task_id}: {e}")
            return False
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get queue statistics.
        
        Returns:
            Queue statistics
        """
        try:
            app = self.celery or get_celery_app()
            inspect = app.control.inspect()
            
            active_tasks = inspect.active()
            scheduled_tasks = inspect.scheduled()
            reserved_tasks = inspect.reserved()
            
            return {
                "active": active_tasks or {},
                "scheduled": scheduled_tasks or {},
                "reserved": reserved_tasks or {},
                "workers": list((active_tasks or {}).keys())
            }
        except Exception as e:
            logger.error(f"Error retrieving stats: {e}")
            return {"error": str(e)}