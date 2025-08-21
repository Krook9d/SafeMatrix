import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import re
from backend.schemas.workflow import RuleCondition, RuleOperator
from backend.utils.cpe_utils import extract_affected_products

logger = logging.getLogger(__name__)

class RulesEngine:
    """
    Rules engine for evaluating workflow conditions against vulnerability data.
    """
    
    def __init__(self):
        self.operators = {
            RuleOperator.EQUALS: self._equals,
            RuleOperator.NOT_EQUALS: self._not_equals,
            RuleOperator.GREATER_THAN: self._greater_than,
            RuleOperator.GREATER_THAN_OR_EQUAL: self._greater_than_or_equal,
            RuleOperator.LESS_THAN: self._less_than,
            RuleOperator.LESS_THAN_OR_EQUAL: self._less_than_or_equal,
            RuleOperator.CONTAINS: self._contains,
            RuleOperator.NOT_CONTAINS: self._not_contains,
            RuleOperator.IN: self._in,
            RuleOperator.NOT_IN: self._not_in,
        }
    
    def evaluate_workflow(
        self, 
        rules: List[RuleCondition], 
        rule_logic: str, 
        vulnerability_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate all rules for a workflow against vulnerability data.
        
        Args:
            rules: List of rule conditions
            rule_logic: "AND" or "OR" logic
            vulnerability_data: Vulnerability data to evaluate against
            
        Returns:
            Dict containing evaluation results
        """
        try:
            # Extract and normalize vulnerability data
            normalized_data = self._normalize_vulnerability_data(vulnerability_data)
            
            rule_results = []
            matched_rules = []
            
            # Evaluate each rule
            for rule in rules:
                try:
                    result = self._evaluate_rule(rule, normalized_data)
                    rule_results.append(result)
                    
                    if result:
                        matched_rules.append({
                            "field": rule.field,
                            "operator": rule.operator,
                            "value": rule.value,
                            "actual_value": normalized_data.get(rule.field)
                        })
                        
                except Exception as e:
                    logger.error(f"Error evaluating rule {rule.field} {rule.operator} {rule.value}: {e}")
                    rule_results.append(False)
            
            # Apply rule logic
            if rule_logic.upper() == "AND":
                overall_match = all(rule_results) if rule_results else False
            else:  # OR
                overall_match = any(rule_results) if rule_results else False
            
            return {
                "matched": overall_match,
                "rule_results": rule_results,
                "matched_rules": matched_rules,
                "normalized_data": normalized_data
            }
            
        except Exception as e:
            logger.error(f"Error evaluating workflow rules: {e}")
            return {
                "matched": False,
                "rule_results": [],
                "matched_rules": [],
                "error": str(e)
            }
    
    def _normalize_vulnerability_data(self, vulnerability_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize vulnerability data for rule evaluation.
        """
        normalized = {}
        
        # Basic fields
        normalized["cve_id"] = vulnerability_data.get("id", "")
        normalized["cvss_score"] = self._extract_cvss_score(vulnerability_data)
        normalized["severity"] = self._extract_severity(vulnerability_data)
        normalized["published_date"] = vulnerability_data.get("published", "")
        normalized["last_modified"] = vulnerability_data.get("lastModified", "")
        
        # Description
        descriptions = vulnerability_data.get("descriptions", [])
        english_desc = next((d["value"] for d in descriptions if d.get("lang") == "en"), "")
        normalized["description"] = english_desc
        
        # Affected products
        configurations = vulnerability_data.get("configurations", [])
        affected_products = extract_affected_products(configurations)
        
        # Create searchable product strings
        product_vendors = [p.get("vendor", "") for p in affected_products]
        product_names = [p.get("product", "") for p in affected_products]
        product_versions = [p.get("version", "") for p in affected_products if p.get("version")]
        
        normalized["affected_products"] = affected_products
        normalized["product_vendors"] = product_vendors
        normalized["product_names"] = product_names
        normalized["product_versions"] = product_versions
        normalized["product_count"] = len(affected_products)
        
        # Create combined searchable text
        all_products_text = " ".join([
            " ".join(product_vendors),
            " ".join(product_names),
            " ".join(product_versions)
        ]).lower()
        normalized["products_text"] = all_products_text
        
        # References
        references = vulnerability_data.get("references", [])
        normalized["reference_count"] = len(references)
        normalized["reference_urls"] = [ref.get("url", "") for ref in references]
        
        # Weaknesses
        weaknesses = vulnerability_data.get("weaknesses", [])
        normalized["weakness_count"] = len(weaknesses)
        
        return normalized
    
    def _extract_cvss_score(self, vulnerability_data: Dict[str, Any]) -> float:
        """Extract CVSS score from vulnerability data."""
        metrics = vulnerability_data.get("metrics", {})
        
        # Try CVSS v3.1 first
        if metrics.get("cvssMetricV31"):
            return metrics["cvssMetricV31"][0].get("cvssData", {}).get("baseScore", 0.0)
        
        # Try CVSS v3.0
        if metrics.get("cvssMetricV30"):
            return metrics["cvssMetricV30"][0].get("cvssData", {}).get("baseScore", 0.0)
        
        # Try CVSS v2
        if metrics.get("cvssMetricV2"):
            return metrics["cvssMetricV2"][0].get("cvssData", {}).get("baseScore", 0.0)
        
        # Fallback to legacy score field
        return vulnerability_data.get("score", 0.0)
    
    def _extract_severity(self, vulnerability_data: Dict[str, Any]) -> str:
        """Extract severity from vulnerability data."""
        metrics = vulnerability_data.get("metrics", {})
        
        # Try CVSS v3.1 first
        if metrics.get("cvssMetricV31"):
            return metrics["cvssMetricV31"][0].get("cvssData", {}).get("baseSeverity", "").upper()
        
        # Try CVSS v3.0
        if metrics.get("cvssMetricV30"):
            return metrics["cvssMetricV30"][0].get("cvssData", {}).get("baseSeverity", "").upper()
        
        # Fallback to legacy severity field or calculate from score
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
    
    def _evaluate_rule(self, rule: RuleCondition, normalized_data: Dict[str, Any]) -> bool:
        """
        Evaluate a single rule condition.
        """
        field_value = normalized_data.get(rule.field)
        operator_func = self.operators.get(rule.operator)
        
        if operator_func is None:
            logger.warning(f"Unknown operator: {rule.operator}")
            return False
        
        return operator_func(field_value, rule.value)
    
    # Operator implementations
    def _equals(self, field_value: Any, rule_value: Any) -> bool:
        if isinstance(field_value, str) and isinstance(rule_value, str):
            return field_value.lower() == rule_value.lower()
        return field_value == rule_value
    
    def _not_equals(self, field_value: Any, rule_value: Any) -> bool:
        return not self._equals(field_value, rule_value)
    
    def _greater_than(self, field_value: Any, rule_value: Any) -> bool:
        try:
            return float(field_value) > float(rule_value)
        except (ValueError, TypeError):
            return False
    
    def _greater_than_or_equal(self, field_value: Any, rule_value: Any) -> bool:
        try:
            return float(field_value) >= float(rule_value)
        except (ValueError, TypeError):
            return False
    
    def _less_than(self, field_value: Any, rule_value: Any) -> bool:
        try:
            return float(field_value) < float(rule_value)
        except (ValueError, TypeError):
            return False
    
    def _less_than_or_equal(self, field_value: Any, rule_value: Any) -> bool:
        try:
            return float(field_value) <= float(rule_value)
        except (ValueError, TypeError):
            return False
    
    def _contains(self, field_value: Any, rule_value: Any) -> bool:
        if field_value is None:
            return False
        
        field_str = str(field_value).lower()
        rule_str = str(rule_value).lower()
        
        # Handle list fields
        if isinstance(field_value, list):
            return any(rule_str in str(item).lower() for item in field_value)
        
        return rule_str in field_str
    
    def _not_contains(self, field_value: Any, rule_value: Any) -> bool:
        return not self._contains(field_value, rule_value)
    
    def _in(self, field_value: Any, rule_value: Any) -> bool:
        if not isinstance(rule_value, list):
            return False
        
        if isinstance(field_value, str):
            return field_value.lower() in [str(v).lower() for v in rule_value]
        
        return field_value in rule_value
    
    def _not_in(self, field_value: Any, rule_value: Any) -> bool:
        return not self._in(field_value, rule_value)

# Utility function to extract affected products (if not already available)
def extract_affected_products(configurations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract affected products from vulnerability configurations.
    This is a simplified version - you might want to use the existing cpeUtils.
    """
    products = []
    
    for config in configurations:
        nodes = config.get("nodes", [])
        for node in nodes:
            cpe_matches = node.get("cpeMatch", [])
            for cpe in cpe_matches:
                if cpe.get("vulnerable", False):
                    criteria = cpe.get("criteria", "")
                    if criteria.startswith("cpe:"):
                        parts = criteria.split(":")
                        if len(parts) >= 6:
                            vendor = parts[3] if parts[3] != "*" else "Unknown"
                            product = parts[4] if parts[4] != "*" else "Unknown"
                            version = parts[5] if parts[5] != "*" else None
                            
                            products.append({
                                "vendor": vendor.replace("_", " ").title(),
                                "product": product.replace("_", " ").title(),
                                "version": version.replace("_", " ") if version else None
                            })
    
    return products