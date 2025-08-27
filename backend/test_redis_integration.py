#!/usr/bin/env python3

import asyncio
import json
from backend.core.config import get_settings
from backend.core.database import SessionLocal
from backend.core.workflow_engine import WorkflowEngine
from backend.core.task_queue import WorkflowQueue, celery_app
from backend.crud.workflow import get_workflows

async def test_redis_integration():
    """
    Test script to validate Redis integration with the workflow system.
    """
    print("=== Redis Integration Test for SafeMatrix Workflows ===\n")
    
    # Test 1: Redis Configuration
    print("1. Redis configuration test...")
    try:
        settings = get_settings()
        print(f"   ✓ Redis Host: {settings.REDIS_HOST}")
        print(f"   ✓ Redis Port: {settings.REDIS_PORT}")
        print(f"   ✓ Redis DB: {settings.REDIS_DB}")
    except Exception as e:
        print(f"   ✗ Configuration error: {e}")
        return False
    
    # Test 2: Celery Connection
    print("\n2. Celery connection test...")
    try:
        # Simple ping test
        i = celery_app.control.inspect()
        stats = i.stats()
        if stats:
            print(f"   ✓ Active workers: {list(stats.keys())}")
        else:
            print("   ⚠ No active workers (normal if not started yet)")
        
        # Broker test
        broker_url = celery_app.conf.broker_url
        print(f"   ✓ Broker URL: {broker_url}")
        
    except Exception as e:
        print(f"   ✗ Celery error: {e}")
    
    # Test 3: WorkflowQueue
    print("\n3. WorkflowQueue test...")
    try:
        queue = WorkflowQueue()
        print("   ✓ WorkflowQueue initialized")
        
        # Stats test (even if workers not active)
        stats = queue.get_queue_stats()
        print(f"   ✓ Stats retrieved: {stats}")
        
    except Exception as e:
        print(f"   ✗ WorkflowQueue error: {e}")
    
    # Test 4: WorkflowEngine with queue
    print("\n4. WorkflowEngine with queue test...")
    try:
        db = SessionLocal()
        try:
            engine = WorkflowEngine(db, use_queue=True)
            print("   ✓ WorkflowEngine with queue initialized")
            
            # Test with fake vulnerability data
            test_vuln_data = {
                "id": "CVE-2024-TEST",
                "baseScore": 7.5,
                "description": "Test vulnerability for Redis integration"
            }
            
            # Process test (should not execute if no active workflows)
            print("   ⚠ Testing process_vulnerability_ingest...")
            results = await engine.process_vulnerability_ingest(test_vuln_data, use_queue=True)
            print(f"   ✓ Results: {len(results)} workflows processed")
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"   ✗ WorkflowEngine error: {e}")
    
    # Test 5: Simple enqueue
    print("\n5. Task enqueue test...")
    try:
        queue = WorkflowQueue()
        
        # Test data
        test_data = {
            "id": "CVE-2024-REDIS-TEST",
            "baseScore": 9.0,
            "description": "High priority test for Redis queue"
        }
        
        # Note: This will fail if no workflow with ID 1, but tests the queue
        try:
            task_id = queue.enqueue_workflow(
                workflow_id=1,
                vulnerability_data=test_data,
                trigger_type="test",
                priority=9
            )
            print(f"   ✓ Task queued: {task_id}")
            
            # Check status
            status = queue.get_task_status(task_id)
            print(f"   ✓ Task status: {status['status']}")
            
        except Exception as e:
            print(f"   ⚠ Enqueue test failed (normal if no workflow): {e}")
            
    except Exception as e:
        print(f"   ✗ Enqueue test error: {e}")
    
    print("\n=== End of tests ===")
    print("\nNotes:")
    print("- Celery workers must be started separately")
    print("- Execution tests require active workflows in database")
    print("- To test completely, run: docker-compose up redis celery-worker")
    
    return True

if __name__ == "__main__":
    asyncio.run(test_redis_integration())