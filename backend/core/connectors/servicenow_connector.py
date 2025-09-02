import aiohttp
import base64
import ssl
import socket
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
            
            # Prepare authentication and headers
            auth = aiohttp.BasicAuth(self.config['username'], self.config['password'])
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'SafeMatrix/1.0 (+https://safematrix.local)'
            }
            
            # Send request to ServiceNow
            table = self.config.get('table', 'incident')
            url = f"{self.config['instance_url'].rstrip('/')}/api/now/table/{table}"
            
            # SSL and proxy handling
            verify_ssl = self.config.get('verify_ssl', True)
            ssl_context = None
            if not verify_ssl:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE

            timeout = aiohttp.ClientTimeout(total=30)
            connector = aiohttp.TCPConnector(ssl=ssl_context, family=socket.AF_INET)

            async with aiohttp.ClientSession(trust_env=True, timeout=timeout, connector=connector) as session:
                async with session.post(
                    url, 
                    json=incident_data, 
                    headers=headers,
                    auth=auth
                ) as response:
                    # Try parse JSON, else take text for logging
                    content_type = response.headers.get('Content-Type', '')
                    if 'application/json' in content_type.lower():
                        response_data = await response.json()
                    else:
                        response_text = await response.text()
                        response_data = {"raw": response_text}
                    
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
                        self.logger.error(f"ServiceNow API error: {response.status} - {response_data}")
                        return {
                            "success": False,
                            "error": f"ServiceNow API error: {response.status}",
                            "response_data": response_data
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
            # Prepare authentication and headers
            auth = aiohttp.BasicAuth(self.config['username'], self.config['password'])
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'SafeMatrix/1.0 (+https://safematrix.local)'
            }
            
            # Test with a simple query
            table = self.config.get('table', 'incident')
            url = f"{self.config['instance_url'].rstrip('/')}/api/now/table/{table}?sysparm_limit=1"
            
            verify_ssl = self.config.get('verify_ssl', True)
            ssl_context = None
            if not verify_ssl:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE

            timeout = aiohttp.ClientTimeout(total=15)
            connector = aiohttp.TCPConnector(ssl=ssl_context, family=socket.AF_INET)

            async with aiohttp.ClientSession(trust_env=True, timeout=timeout, connector=connector) as session:
                async with session.get(url, headers=headers, auth=auth) as response:
                    if response.status == 200:
                        return {
                            "success": True,
                            "message": "ServiceNow connection successful"
                        }
                    else:
                        text = await response.text()
                        return {
                            "success": False,
                            "message": f"ServiceNow connection failed: {response.status}",
                            "response_data": text
                        }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"ServiceNow connection test failed: {str(e)}"
            }