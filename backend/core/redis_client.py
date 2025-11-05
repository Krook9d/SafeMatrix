import redis
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from .config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client for managing application state and caching."""
    
    STATUS_KEY = "nvd_sync:status"
    CVE_COUNT_KEY = "nvd_sync:cve_count"
    HISTORY_KEY = "nvd_sync:history"

    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    
    def set_sync_status(self, status: Dict[str, Any], expire: Optional[int] = None) -> bool:
        """
        Set the NVD sync status in Redis.
        
        Args:
            status: Dictionary containing sync status information
            expire: Optional expiration time in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            key = self.STATUS_KEY
            value = json.dumps(status)
            if expire:
                self.redis_client.setex(key, expire, value)
            else:
                self.redis_client.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Error setting sync status: {e}")
            return False
    
    def get_sync_status(self) -> Optional[Dict[str, Any]]:
        """
        Get the current NVD sync status from Redis.
        
        Returns:
            Dictionary with sync status or None if not found
        """
        try:
            key = self.STATUS_KEY
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return None
    
    def delete_sync_status(self) -> bool:
        """Delete the sync status from Redis."""
        try:
            key = self.STATUS_KEY
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting sync status: {e}")
            return False
    
    def increment_cve_count(self, amount: int = 1) -> int:
        """
        Increment the CVE count for the current sync.
        
        Args:
            amount: Amount to increment by (default: 1)
            
        Returns:
            New count value
        """
        try:
            key = self.CVE_COUNT_KEY
            return self.redis_client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Error incrementing CVE count: {e}")
            return 0
    
    def get_cve_count(self) -> int:
        """Get the current CVE count for the sync."""
        try:
            key = self.CVE_COUNT_KEY
            count = self.redis_client.get(key)
            return int(count) if count else 0
        except Exception as e:
            logger.error(f"Error getting CVE count: {e}")
            return 0
    
    def reset_cve_count(self) -> bool:
        """Reset the CVE count to 0."""
        try:
            key = self.CVE_COUNT_KEY
            self.redis_client.set(key, 0)
            return True
        except Exception as e:
            logger.error(f"Error resetting CVE count: {e}")
            return False

    def get_latest_history_entry(self) -> Optional[Dict[str, Any]]:
        try:
            raw = self.redis_client.lindex(self.HISTORY_KEY, 0)
            if raw:
                return json.loads(raw)
            return None
        except Exception as e:
            logger.error(f"Error reading latest sync history entry: {e}")
            return None

    def append_sync_history(self, entry: Dict[str, Any], limit: int = 200) -> bool:
        try:
            data = entry.copy()
            timestamp = data.get("timestamp")
            if not timestamp:
                timestamp = datetime.utcnow().isoformat()
                data["timestamp"] = timestamp

            # Fetch last entry for delta calculation and dedupe
            last_entry = self.get_latest_history_entry()
            total_cves = data.get("total_cves")
            if total_cves is None and last_entry:
                data["total_cves"] = last_entry.get("total_cves", 0)
                total_cves = data["total_cves"]

            if last_entry and total_cves is not None:
                delta = max(total_cves - last_entry.get("total_cves", 0), 0)
            else:
                delta = 0
            data.setdefault("delta", delta)

            if last_entry:
                same_totals = total_cves == last_entry.get("total_cves")
                same_status = data.get("status") == last_entry.get("status")
                if same_totals and same_status:
                    last_entry.update({
                        "timestamp": data["timestamp"],
                        "message": data.get("message", last_entry.get("message")),
                        "mode": data.get("mode", last_entry.get("mode")),
                        "delta": data.get("delta", last_entry.get("delta", 0))
                    })
                    self.redis_client.lset(self.HISTORY_KEY, 0, json.dumps(last_entry))
                    return True

            self.redis_client.lpush(self.HISTORY_KEY, json.dumps(data))
            self.redis_client.ltrim(self.HISTORY_KEY, 0, limit - 1)
            return True
        except Exception as e:
            logger.error(f"Error appending sync history: {e}")
            return False

    def get_sync_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            raw_entries = self.redis_client.lrange(self.HISTORY_KEY, 0, limit - 1)
            history: List[Dict[str, Any]] = []
            for raw in raw_entries:
                try:
                    history.append(json.loads(raw))
                except json.JSONDecodeError:
                    continue
            return history
        except Exception as e:
            logger.error(f"Error getting sync history: {e}")
            return []

    def clear_sync_history(self) -> bool:
        try:
            self.redis_client.delete(self.HISTORY_KEY)
            return True
        except Exception as e:
            logger.error(f"Error clearing sync history: {e}")
            return False
    
    def health_check(self) -> bool:
        """Check if Redis is accessible."""
        try:
            self.redis_client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False


# Singleton instance
_redis_client: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """Get or create the Redis client singleton."""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client

