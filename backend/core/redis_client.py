import redis
import json
import logging
from typing import Optional, Dict, Any
from .config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client for managing application state and caching."""
    
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
            key = "nvd_sync:status"
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
            key = "nvd_sync:status"
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
            key = "nvd_sync:status"
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
            key = "nvd_sync:cve_count"
            return self.redis_client.incrby(key, amount)
        except Exception as e:
            logger.error(f"Error incrementing CVE count: {e}")
            return 0
    
    def get_cve_count(self) -> int:
        """Get the current CVE count for the sync."""
        try:
            key = "nvd_sync:cve_count"
            count = self.redis_client.get(key)
            return int(count) if count else 0
        except Exception as e:
            logger.error(f"Error getting CVE count: {e}")
            return 0
    
    def reset_cve_count(self) -> bool:
        """Reset the CVE count to 0."""
        try:
            key = "nvd_sync:cve_count"
            self.redis_client.set(key, 0)
            return True
        except Exception as e:
            logger.error(f"Error resetting CVE count: {e}")
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

