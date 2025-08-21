from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class BaseConnector(ABC):
    """
    Base class for all connectors.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logger.getChild(self.__class__.__name__)
    
    @abstractmethod
    async def execute_action(self, action_config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an action using this connector.
        
        Args:
            action_config: Action-specific configuration
            context: Execution context (vulnerability data, etc.)
            
        Returns:
            Dict containing execution results
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test the connector configuration.
        
        Returns:
            Dict containing test results
        """
        pass
    
    def render_template(self, template: str, context: Dict[str, Any]) -> str:
        """
        Render a template string with context variables.
        
        Args:
            template: Template string with {{variable}} placeholders
            context: Context variables
            
        Returns:
            Rendered string
        """
        try:
            import re
            
            def replace_var(match):
                var_name = match.group(1).strip()
                return str(context.get(var_name, f"{{{{{var_name}}}}}"))
            
            # Replace {{variable}} patterns
            rendered = re.sub(r'\{\{([^}]+)\}\}', replace_var, template)
            return rendered
            
        except Exception as e:
            self.logger.error(f"Error rendering template: {e}")
            return template
    
    def format_vulnerability_context(self, vulnerability_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format vulnerability data for template context.
        
        Args:
            vulnerability_data: Raw vulnerability data
            
        Returns:
            Formatted context for templates
        """
        # Extract basic information
        cve_id = vulnerability_data.get("id", "Unknown")
        
        # Extract CVSS score and severity
        cvss_score = self._extract_cvss_score(vulnerability_data)
        severity = self._extract_severity(vulnerability_data)
        
        # Extract description
        descriptions = vulnerability_data.get("descriptions", [])
        description = next((d["value"] for d in descriptions if d.get("lang") == "en"), "No description available")
        
        # Extract affected products
        from backend.core.rules_engine import extract_affected_products
        configurations = vulnerability_data.get("configurations", [])
        affected_products = extract_affected_products(configurations)
        
        # Format products for display
        products_list = []
        for product in affected_products[:10]:  # Limit to first 10
            product_str = f"{product.get('vendor', 'Unknown')} {product.get('product', 'Unknown')}"
            if product.get('version'):
                product_str += f" {product['version']}"
            products_list.append(product_str)
        
        products_text = "\n".join(products_list) if products_list else "No specific products identified"
        if len(affected_products) > 10:
            products_text += f"\n... and {len(affected_products) - 10} more products"
        
        # Extract references
        references = vulnerability_data.get("references", [])
        references_text = "\n".join([ref.get("url", "") for ref in references[:5]])
        if len(references) > 5:
            references_text += f"\n... and {len(references) - 5} more references"
        
        return {
            "cve_id": cve_id,
            "cvss_score": cvss_score,
            "severity": severity,
            "description": description,
            "affected_products": products_text,
            "product_count": len(affected_products),
            "references": references_text,
            "reference_count": len(references),
            "published_date": vulnerability_data.get("published", "Unknown"),
            "last_modified": vulnerability_data.get("lastModified", "Unknown")
        }
    
    def _extract_cvss_score(self, vulnerability_data: Dict[str, Any]) -> float:
        """Extract CVSS score from vulnerability data."""
        metrics = vulnerability_data.get("metrics", {})
        
        if metrics.get("cvssMetricV31"):
            return metrics["cvssMetricV31"][0].get("cvssData", {}).get("baseScore", 0.0)
        if metrics.get("cvssMetricV30"):
            return metrics["cvssMetricV30"][0].get("cvssData", {}).get("baseScore", 0.0)
        if metrics.get("cvssMetricV2"):
            return metrics["cvssMetricV2"][0].get("cvssData", {}).get("baseScore", 0.0)
        
        return vulnerability_data.get("score", 0.0)
    
    def _extract_severity(self, vulnerability_data: Dict[str, Any]) -> str:
        """Extract severity from vulnerability data."""
        metrics = vulnerability_data.get("metrics", {})
        
        if metrics.get("cvssMetricV31"):
            return metrics["cvssMetricV31"][0].get("cvssData", {}).get("baseSeverity", "UNKNOWN")
        if metrics.get("cvssMetricV30"):
            return metrics["cvssMetricV30"][0].get("cvssData", {}).get("baseSeverity", "UNKNOWN")
        
        severity = vulnerability_data.get("severity", "")
        if severity:
            return severity.upper()
        
        # Calculate from score
        score = self._extract_cvss_score(vulnerability_data)
        if score >= 9.0:
            return "CRITICAL"
        elif score >= 7.0:
            return "HIGH"
        elif score >= 4.0:
            return "MEDIUM"
        elif score > 0.0:
            return "LOW"
        else:
            return "UNKNOWN"