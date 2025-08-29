import aiohttp
import json
from typing import Dict, Any
from .base import BaseConnector

class TheHiveConnector(BaseConnector):
    """
    TheHive connector for creating security incidents.
    """
    
    async def execute_action(self, action_config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a case in TheHive.
        """
        try:
            # Format vulnerability context for templates
            vuln_context = self.format_vulnerability_context(context.get("vulnerability_data", {}))
            
            # Render templates
            title = self.render_template(action_config.get("title", ""), vuln_context)
            description = self.render_template(action_config.get("description", ""), vuln_context)
            
            # Prepare case data
            case_data = {
                "title": title,
                "description": description,
                "severity": action_config.get("severity", 2),
                "tlp": action_config.get("tlp", 2),
                "tags": action_config.get("tags", []) + [f"cve:{vuln_context['cve_id']}"],
                "customFields": {
                    "cve_id": {"string": vuln_context['cve_id']},
                    "cvss_score": {"float": vuln_context['cvss_score']},
                    "severity": {"string": vuln_context['severity']}
                }
            }
            
            # Add organization if specified
            if self.config.get('organization'):
                case_data['organisation'] = self.config['organization']
            
            # Send request to TheHive
            headers = {
                'Authorization': f"Bearer {self.config['api_key']}",
                'Content-Type': 'application/json'
            }
            
            url = f"{self._resolve_url(self.config['url'])}/api/case"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=case_data,
                    headers=headers,
                    ssl=self.config.get('verify_ssl', True)
                ) as response:
                    response_data = await response.json()
                    
                    if response.status == 201:
                        return {
                            "success": True,
                            "message": f"Case created successfully: {response_data.get('_id')}",
                            "case_id": response_data.get('_id'),
                            "case_number": response_data.get('caseId'),
                            "response_data": response_data
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"TheHive API error: {response.status} - {response_data}"
                        }
            
        except Exception as e:
            self.logger.error(f"Failed to create TheHive case: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test TheHive configuration.
        """
        try:
            headers = {
                'Authorization': f"Bearer {self.config['api_key']}",
                'Content-Type': 'application/json'
            }
            
            url = f"{self._resolve_url(self.config['url'])}/api/status"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=headers,
                    ssl=self.config.get('verify_ssl', True)
                ) as response:
                    if response.status == 200:
                        return {
                            "success": True,
                            "message": "TheHive connection successful"
                        }
                    else:
                        return {
                            "success": False,
                            "message": f"TheHive connection failed: {response.status}"
                        }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"TheHive connection test failed: {str(e)}"
            }
    
    def _resolve_url(self, configured_url: str) -> str:
        """
        Resolve URL for Docker environment compatibility.
        Convert localhost/127.0.0.1 references to host.docker.internal when running in Docker.
        """
        import os
        
        # Check if we're running in a Docker environment (typical indicators)
        is_docker = (
            os.path.exists('/.dockerenv') or
            os.environ.get('DOCKER_CONTAINER') == 'true' or
            os.environ.get('PYTHONPATH') == '/app'  # Based on our compose.yml
        )
        
        if is_docker:
            url = configured_url.rstrip('/')
            # Replace localhost and 127.0.0.1 with host.docker.internal for Docker networking
            if '://localhost:' in url or '://127.0.0.1:' in url:
                url = url.replace('://localhost:', '://host.docker.internal:')
                url = url.replace('://127.0.0.1:', '://host.docker.internal:')
                self.logger.info(f"Docker environment detected, resolved URL from {configured_url} to {url}")
                return url
        
        return configured_url.rstrip('/')