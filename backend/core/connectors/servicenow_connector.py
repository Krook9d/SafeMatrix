import aiohttp
import base64
from typing import Dict, Any
from .base import BaseConnector

class ServiceNowConnector(BaseConnector):
    """
    ServiceNow connector for creating incidents.
    """
    
    async def execute_action(self, action_config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create an incident in ServiceNow.
        """
        try:
            # Format vulnerability context for templates
            vuln_context = self.format_vulnerability_context(context.get("vulnerability_data", {}))
            
            # Render templates
            short_description = self.render_template(action_config.get("short_description", ""), vuln_context)
            description = self.render_template(action_config.get("description", ""), vuln_context)
            
            # Prepare incident data
            incident_data = {
                "short_description": short_description,
                "description": description,
                "priority": action_config.get("priority", 3),
                "category": action_config.get("category", "Security"),
                "subcategory": "Vulnerability",
                "u_cve_id": vuln_context['cve_id'],
                "u_cvss_score": str(vuln_context['cvss_score']),
                "u_severity": vuln_context['severity']
            }
            
            # Add assignment group if specified
            if action_config.get('assignment_group'):
                incident_data['assignment_group'] = action_config['assignment_group']
            
            # Prepare authentication
            auth_string = f"{self.config['username']}:{self.config['password']}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            
            headers = {
                'Authorization': f'Basic {auth_b64}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Send request to ServiceNow
            table = self.config.get('table', 'incident')
            url = f"{self.config['instance_url'].rstrip('/')}/api/now/table/{table}"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url, 
                    json=incident_data, 
                    headers=headers
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 201:
                        result = response_data.get('result', {})
                        return {
                            "success": True,
                            "message": f"Incident created successfully: {result.get('number')}",
                            "incident_id": result.get('sys_id'),
                            "incident_number": result.get('number'),
                            "response_data": response_data
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"ServiceNow API error: {response.status} - {response_data}"
                        }
            
        except Exception as e:
            self.logger.error(f"Failed to create ServiceNow incident: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test ServiceNow configuration.
        """
        try:
            # Prepare authentication
            auth_string = f"{self.config['username']}:{self.config['password']}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            
            headers = {
                'Authorization': f'Basic {auth_b64}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Test with a simple query
            table = self.config.get('table', 'incident')
            url = f"{self.config['instance_url'].rstrip('/')}/api/now/table/{table}?sysparm_limit=1"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return {
                            "success": True,
                            "message": "ServiceNow connection successful"
                        }
                    else:
                        return {
                            "success": False,
                            "message": f"ServiceNow connection failed: {response.status}"
                        }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"ServiceNow connection test failed: {str(e)}"
            }