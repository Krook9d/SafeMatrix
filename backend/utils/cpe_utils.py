"""
Utility functions for parsing CPE (Common Platform Enumeration) data.
"""

from typing import List, Dict, Any

def extract_affected_products(configurations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract affected products from vulnerability configurations.
    
    Args:
        configurations: List of vulnerability configuration objects
        
    Returns:
        List of affected product dictionaries
    """
    products = []
    seen = set()
    
    for config in configurations:
        nodes = config.get("nodes", [])
        for node in nodes:
            cpe_matches = node.get("cpeMatch", [])
            for cpe in cpe_matches:
                if cpe.get("vulnerable", False):
                    criteria = cpe.get("criteria", "")
                    if criteria.startswith("cpe:"):
                        parsed = parse_cpe(criteria)
                        if parsed:
                            # Build version range if available
                            version_range = parsed.get("version")
                            if (cpe.get("versionStartIncluding") or cpe.get("versionEndIncluding") or 
                                cpe.get("versionStartExcluding") or cpe.get("versionEndExcluding")):
                                ranges = []
                                if cpe.get("versionStartIncluding"):
                                    ranges.append(f">= {cpe['versionStartIncluding']}")
                                if cpe.get("versionStartExcluding"):
                                    ranges.append(f"> {cpe['versionStartExcluding']}")
                                if cpe.get("versionEndIncluding"):
                                    ranges.append(f"<= {cpe['versionEndIncluding']}")
                                if cpe.get("versionEndExcluding"):
                                    ranges.append(f"< {cpe['versionEndExcluding']}")
                                version_range = ", ".join(ranges)
                            
                            product_key = f"{parsed['vendor']}:{parsed['product']}:{version_range or 'any'}"
                            if product_key not in seen:
                                seen.add(product_key)
                                product_info = {
                                    "vendor": parsed["vendor"],
                                    "product": parsed["product"],
                                    "version": version_range
                                }
                                products.append(product_info)
    
    return products

def parse_cpe(cpe_string: str) -> Dict[str, str]:
    """
    Parse CPE criteria string to extract vendor, product, and version information.
    
    CPE format: cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
    
    Args:
        cpe_string: CPE criteria string
        
    Returns:
        Dictionary with vendor, product, and version information
    """
    try:
        if not cpe_string or not isinstance(cpe_string, str):
            return None
        
        parts = cpe_string.split(":")
        if len(parts) < 6 or parts[0] != "cpe":
            return None
        
        vendor = parts[3] if parts[3] not in ("*", "-") else "Unknown"
        product = parts[4] if parts[4] not in ("*", "-") else "Unknown"
        version = parts[5] if parts[5] not in ("*", "-") else None
        
        # Clean up underscores and decode URI components
        vendor = vendor.replace("_", " ").title()
        product = product.replace("_", " ").title()
        if version:
            version = version.replace("_", " ")
        
        return {
            "vendor": vendor,
            "product": product,
            "version": version
        }
        
    except Exception:
        return None