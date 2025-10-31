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


def run_sync_script(mode: str = "full"):
    """
    Background task to run the NVD synchronization script.
    
    Args:
        mode: "full" for complete sync, "continuous" for continuous monitoring
    """
    redis_client = get_redis_client()
    
    try:
        # Update status to running
        if mode == "continuous":
            redis_client.set_sync_status({
                "status": "monitoring",
                "mode": "continuous",
                "started_at": datetime.utcnow().isoformat(),
                "message": "Starting continuous monitoring..."
            })
        else:
            redis_client.set_sync_status({
                "status": "running",
                "mode": "full",
                "started_at": datetime.utcnow().isoformat(),
                "message": "NVD synchronization in progress..."
            })
        
        redis_client.reset_cve_count()
        
        # Get the project root directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        project_root = os.path.dirname(backend_dir)
        
        # Select the appropriate script
        if mode == "continuous":
            script_path = os.path.join(project_root, "continuous_nvd_monitor.py")
        else:
            script_path = os.path.join(project_root, "sync_nvd.py")
        
        logger.info(f"Running {mode} sync script from: {script_path}")
        
        # Run the sync script
        if mode == "continuous":
            # For continuous monitoring, start it as a detached process
            # It will run indefinitely until stopped
            subprocess.Popen(
                [sys.executable, script_path],
                cwd=project_root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
            logger.info(f"Continuous monitoring started in background")
        else:
            # For full sync, wait for completion
            result = subprocess.run(
                [sys.executable, script_path],
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )
            
            if result.returncode == 0:
                cve_count = redis_client.get_cve_count()
                redis_client.set_sync_status({
                    "status": "completed",
                    "mode": "full",
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
                    "mode": "full",
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
    mode: str = "full",
    current_user = Depends(require_roles("admin"))
) -> Dict[str, Any]:
    """
    Start the NVD synchronization process in the background.
    Only accessible by admin users.
    
    Args:
        mode: "full" for complete sync (default), "continuous" for continuous monitoring
    """
    redis_client = get_redis_client()
    
    # Validate mode
    if mode not in ["full", "continuous"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid mode. Must be 'full' or 'continuous'"
        )
    
    # Check if sync is already running
    current_status = redis_client.get_sync_status()
    if current_status:
        status = current_status.get("status")
        if status in ["running", "monitoring"]:
            raise HTTPException(
                status_code=409,
                detail=f"A synchronization is already in progress (status: {status})"
            )
    
    # Check Redis health
    if not redis_client.health_check():
        raise HTTPException(
            status_code=503,
            detail="Redis is not available. Cannot start synchronization."
        )
    
    # Start the sync in background
    background_tasks.add_task(run_sync_script, mode=mode)
    
    return {
        "success": True,
        "message": f"NVD {mode} synchronization started successfully",
        "status": "running" if mode == "full" else "monitoring",
        "mode": mode
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


@router.post("/stop")
async def stop_nvd_sync(
    current_user = Depends(require_roles("admin"))
) -> Dict[str, Any]:
    """
    Stop the current NVD synchronization or continuous monitoring.
    For continuous monitoring, this signals the process to stop gracefully.
    """
    redis_client = get_redis_client()
    
    current_status = redis_client.get_sync_status()
    if not current_status:
        raise HTTPException(
            status_code=400,
            detail="No synchronization or monitoring is currently active"
        )
    
    status = current_status.get("status")
    mode = current_status.get("mode", "full")
    
    if status not in ["running", "monitoring"]:
        raise HTTPException(
            status_code=400,
            detail=f"No active synchronization to stop (current status: {status})"
        )
    
    # Set status to signal the script to stop
    redis_client.set_sync_status({
        "status": "stopped",
        "mode": mode,
        "message": f"{mode.capitalize()} synchronization stopped by user",
        "stopped_at": datetime.utcnow().isoformat(),
        "started_at": current_status.get("started_at")
    })
    
    return {
        "success": True,
        "message": f"{mode.capitalize()} synchronization stop requested"
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

