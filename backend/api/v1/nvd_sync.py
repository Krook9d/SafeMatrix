from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any
import subprocess
import sys
import os
import logging
from datetime import datetime
from ...core.redis_client import get_redis_client
from ...core.dependencies import require_roles

logger = logging.getLogger(__name__)
router = APIRouter()


def run_sync_script():
    """
    Background task to run the NVD synchronization script.
    """
    redis_client = get_redis_client()
    
    try:
        # Update status to running
        redis_client.set_sync_status({
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "message": "NVD synchronization in progress..."
        })
        redis_client.reset_cve_count()
        
        # Get the project root directory (where sync_nvd.py is located)
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        project_root = os.path.dirname(backend_dir)
        sync_script_path = os.path.join(project_root, "sync_nvd.py")
        
        logger.info(f"Running sync script from: {sync_script_path}")
        
        # Run the sync script
        result = subprocess.run(
            [sys.executable, sync_script_path],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        if result.returncode == 0:
            cve_count = redis_client.get_cve_count()
            redis_client.set_sync_status({
                "status": "completed",
                "started_at": redis_client.get_sync_status().get("started_at"),
                "completed_at": datetime.utcnow().isoformat(),
                "total_cves": cve_count,
                "message": f"Successfully synchronized {cve_count} CVEs"
            })
            logger.info(f"Sync completed successfully. Total CVEs: {cve_count}")
        else:
            error_message = result.stderr or "Unknown error"
            redis_client.set_sync_status({
                "status": "failed",
                "started_at": redis_client.get_sync_status().get("started_at"),
                "completed_at": datetime.utcnow().isoformat(),
                "error": error_message,
                "message": "Synchronization failed"
            })
            logger.error(f"Sync failed: {error_message}")
            
    except subprocess.TimeoutExpired:
        redis_client.set_sync_status({
            "status": "failed",
            "error": "Script execution timed out after 1 hour",
            "message": "Synchronization timed out"
        })
        logger.error("Sync script timed out")
    except Exception as e:
        redis_client.set_sync_status({
            "status": "failed",
            "error": str(e),
            "message": f"Synchronization error: {str(e)}"
        })
        logger.error(f"Sync error: {e}")


@router.post("/start")
async def start_nvd_sync(
    background_tasks: BackgroundTasks,
    current_user = Depends(require_roles("admin"))
) -> Dict[str, Any]:
    """
    Start the NVD synchronization process in the background.
    Only accessible by admin users.
    """
    redis_client = get_redis_client()
    
    # Check if sync is already running
    current_status = redis_client.get_sync_status()
    if current_status and current_status.get("status") == "running":
        raise HTTPException(
            status_code=409,
            detail="A synchronization is already in progress"
        )
    
    # Check Redis health
    if not redis_client.health_check():
        raise HTTPException(
            status_code=503,
            detail="Redis is not available. Cannot start synchronization."
        )
    
    # Start the sync in background
    background_tasks.add_task(run_sync_script)
    
    return {
        "success": True,
        "message": "NVD synchronization started successfully",
        "status": "running"
    }


@router.get("/status")
async def get_nvd_sync_status() -> Dict[str, Any]:
    """
    Get the current status of NVD synchronization.
    Returns information about running, completed, or failed syncs.
    """
    redis_client = get_redis_client()
    
    status = redis_client.get_sync_status()
    cve_count = redis_client.get_cve_count()
    
    if not status:
        return {
            "status": "idle",
            "message": "No synchronization in progress",
            "total_cves": 0
        }
    
    # Add current CVE count to the status
    status["total_cves"] = cve_count
    
    return status


@router.post("/cancel")
async def cancel_nvd_sync(
    current_user = Depends(require_roles("admin"))
) -> Dict[str, Any]:
    """
    Cancel the current NVD synchronization.
    Note: This only updates the status. The actual process will continue until completion.
    """
    redis_client = get_redis_client()
    
    current_status = redis_client.get_sync_status()
    if not current_status or current_status.get("status") != "running":
        raise HTTPException(
            status_code=400,
            detail="No synchronization is currently running"
        )
    
    redis_client.set_sync_status({
        "status": "cancelled",
        "message": "Synchronization cancelled by user",
        "cancelled_at": datetime.utcnow().isoformat()
    })
    
    return {
        "success": True,
        "message": "Synchronization cancellation requested"
    }


@router.delete("/status")
async def clear_sync_status(
    current_user = Depends(require_roles("admin"))
) -> Dict[str, Any]:
    """
    Clear the synchronization status from Redis.
    Useful for cleaning up after a completed or failed sync.
    """
    redis_client = get_redis_client()
    redis_client.delete_sync_status()
    redis_client.reset_cve_count()
    
    return {
        "success": True,
        "message": "Synchronization status cleared"
    }

