from typing import Dict, Any
from .base import BaseConnector
from .email_connector import EmailConnector
from .thehive_connector import TheHiveConnector
from .servicenow_connector import ServiceNowConnector
from .jira_connector import JiraConnector
from backend.schemas.workflow import ConnectorType

class ConnectorFactory:
    """
    Factory for creating connector instances.
    """
    
    _connectors = {
        ConnectorType.EMAIL: EmailConnector,
        ConnectorType.THEHIVE: TheHiveConnector,
        ConnectorType.SERVICENOW: ServiceNowConnector,
        ConnectorType.JIRA: JiraConnector,
    }
    
    @classmethod
    def create_connector(cls, connector_type: ConnectorType, config: Dict[str, Any]) -> BaseConnector:
        """
        Create a connector instance.
        
        Args:
            connector_type: Type of connector to create
            config: Connector configuration
            
        Returns:
            Connector instance
            
        Raises:
            ValueError: If connector type is not supported
        """
        connector_class = cls._connectors.get(connector_type)
        if not connector_class:
            raise ValueError(f"Unsupported connector type: {connector_type}")
        
        return connector_class(config)
    
    @classmethod
    def get_supported_types(cls) -> list:
        """
        Get list of supported connector types.
        """
        return list(cls._connectors.keys())