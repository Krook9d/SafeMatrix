import logging
import asyncio
import aiohttp
import json
import base64
from typing import Dict, Any, Optional
from .base import BaseConnector

logger = logging.getLogger(__name__)

class JiraConnector(BaseConnector):
    """
    Jira Cloud connector for creating issues when vulnerabilities are detected.
    Uses email + API token authentication (Basic Auth).
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.url = config.get("url", "").rstrip("/")
        self.email = config.get("email", "")
        self.api_token = config.get("api_token", "")
        self.project_key = config.get("project_key", "VULN")
        self.issue_type = config.get("issue_type", "Task")
        
        if not all([self.url, self.email, self.api_token]):
            raise ValueError("Jira connector requires url, email, and api_token")
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to Jira by checking project access."""
        try:
            headers = self._get_auth_headers()
            
            async with aiohttp.ClientSession() as session:
                # Test connection by fetching project info
                project_url = f"{self.url}/rest/api/3/project/{self.project_key}"
                async with session.get(project_url, headers=headers) as response:
                    if response.status == 200:
                        project_data = await response.json()
                        return {
                            "success": True,
                            "message": f"Successfully connected to Jira project: {project_data.get('name', self.project_key)}"
                        }
                    elif response.status == 404:
                        return {
                            "success": False,
                            "message": f"Project '{self.project_key}' not found or no access"
                        }
                    else:
                        error_text = await response.text()
                        return {
                            "success": False,
                            "message": f"HTTP {response.status}: {error_text}"
                        }
                        
        except Exception as e:
            logger.error(f"Jira connection test failed: {e}")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}"
            }
    
    async def execute_action(self, action_config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Jira action (create issue)."""
        try:
            vulnerability_data = context.get("vulnerability_data", {})
            
            # Extract title from action config, with fallback
            title = action_config.get("title", f"Vulnerability: {vulnerability_data.get('id', 'Unknown')}")
            
            # Replace template variables in title
            title = self._replace_template_variables(title, vulnerability_data)
            
            # Create Jira issue
            result = await self.create_issue(
                title=title,
                vulnerability_data=vulnerability_data,
                project_key=action_config.get("project_key", self.project_key),
                issue_type=action_config.get("issue_type", self.issue_type)
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing Jira action: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_issue(
        self, 
        title: str, 
        vulnerability_data: Dict[str, Any],
        project_key: Optional[str] = None,
        issue_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a Jira issue for a vulnerability."""
        try:
            project = project_key or self.project_key
            issue_type_name = issue_type or self.issue_type
            
            # Map CVSS score to Jira priority
            cvss_score = vulnerability_data.get("baseScore", 0)
            if isinstance(cvss_score, str):
                try:
                    cvss_score = float(cvss_score)
                except (ValueError, TypeError):
                    cvss_score = 0
            
            priority = self._map_cvss_to_priority(cvss_score)
            
            # Create rich ADF description
            description = self._create_adf_description(vulnerability_data)
            
            # Prepare issue data
            issue_data = {
                "fields": {
                    "project": {"key": project},
                    "summary": title,
                    "description": description,
                    "issuetype": {"name": issue_type_name},
                    "priority": {"name": priority},
                    "labels": ["vulnerability", "safematrix"]
                }
            }
            
            headers = self._get_auth_headers()
            headers["Content-Type"] = "application/json"
            
            async with aiohttp.ClientSession() as session:
                create_url = f"{self.url}/rest/api/3/issue"
                async with session.post(
                    create_url, 
                    headers=headers, 
                    data=json.dumps(issue_data)
                ) as response:
                    response_text = await response.text()
                    
                    if response.status == 201:
                        response_data = json.loads(response_text)
                        issue_key = response_data.get("key")
                        issue_url = f"{self.url}/browse/{issue_key}"
                        
                        logger.info(f"Successfully created Jira issue: {issue_key}")
                        return {
                            "success": True,
                            "message": f"Created Jira issue: {issue_key}",
                            "details": {
                                "issue_key": issue_key,
                                "issue_url": issue_url,
                                "priority": priority,
                                "cvss_score": cvss_score
                            }
                        }
                    else:
                        logger.error(f"Failed to create Jira issue: HTTP {response.status} - {response_text}")
                        return {
                            "success": False,
                            "error": f"Failed to create issue: HTTP {response.status} - {response_text}"
                        }
                        
        except Exception as e:
            logger.error(f"Error creating Jira issue: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers for Jira API."""
        auth_string = f"{self.email}:{self.api_token}"
        auth_bytes = base64.b64encode(auth_string.encode()).decode()
        
        return {
            "Authorization": f"Basic {auth_bytes}",
            "Accept": "application/json"
        }
    
    def _map_cvss_to_priority(self, cvss_score: float) -> str:
        """Map CVSS score to Jira priority."""
        if cvss_score >= 9.0:
            return "Highest"
        elif cvss_score >= 7.0:
            return "High"  
        elif cvss_score >= 4.0:
            return "Medium"
        else:
            return "Low"
    
    def _create_adf_description(self, vulnerability_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create Atlassian Document Format description."""
        cve_id = vulnerability_data.get("id", "N/A")
        cvss_score = vulnerability_data.get("baseScore", 0)
        
        # Extract host information
        host_info = vulnerability_data.get("host", {})
        host_name = host_info.get("name", "N/A")
        host_ip = host_info.get("ip", "N/A") 
        host_os = host_info.get("os", "N/A")
        
        # Extract software information
        software_info = vulnerability_data.get("software", {})
        software_name = software_info.get("name", "N/A")
        software_version = software_info.get("version", "N/A")
        
        # Generate NVD link
        nvd_link = f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id != "N/A" else "N/A"
        
        # SafeMatrix vulnerability ID
        safematrix_id = vulnerability_data.get("vuln_id", "N/A")
        
        # Determine severity level
        severity_level = "Critical" if cvss_score >= 9.0 else "High" if cvss_score >= 7.0 else "Medium" if cvss_score >= 4.0 else "Low"
        
        # Create structured ADF document
        return {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "A vulnerability has been detected and automatically reported by SafeMatrix.",
                            "marks": [{"type": "strong"}]
                        }
                    ]
                },
                {
                    "type": "table",
                    "attrs": {
                        "isNumberColumnEnabled": False,
                        "layout": "default"
                    },
                    "content": [
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableHeader",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Field"}]}]
                                },
                                {
                                    "type": "tableHeader", 
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Value"}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "CVE ID", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1}, 
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": str(cve_id)}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "CVSS Score", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{cvss_score} ({severity_level})"}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow", 
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Host Name", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": str(host_name)}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell", 
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Host IP", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": str(host_ip)}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Operating System", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell", 
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": str(host_os)}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Software", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{software_name} {software_version}".strip()}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "NVD Link", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": nvd_link, "marks": [{"type": "link", "attrs": {"href": nvd_link}}] if nvd_link != "N/A" else []}]}]
                                }
                            ]
                        },
                        {
                            "type": "tableRow",
                            "content": [
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "SafeMatrix ID", "marks": [{"type": "strong"}]}]}]
                                },
                                {
                                    "type": "tableCell",
                                    "attrs": {"colspan": 1, "rowspan": 1},
                                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": str(safematrix_id)}]}]
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "This issue was automatically created by SafeMatrix vulnerability management system.",
                            "marks": [{"type": "em"}]
                        }
                    ]
                }
            ]
        }
    
    def _replace_template_variables(self, template: str, vulnerability_data: Dict[str, Any]) -> str:
        """Replace template variables in strings."""
        replacements = {
            "{{cve_id}}": vulnerability_data.get("id", "Unknown"),
            "{{cvss_score}}": str(vulnerability_data.get("baseScore", "0")),
            "{{host_name}}": vulnerability_data.get("host", {}).get("name", "Unknown"),
            "{{host_ip}}": vulnerability_data.get("host", {}).get("ip", "Unknown"),
            "{{software_name}}": vulnerability_data.get("software", {}).get("name", "Unknown"),
            "{{software_version}}": vulnerability_data.get("software", {}).get("version", "Unknown"),
            "{{vuln_id}}": vulnerability_data.get("vuln_id", "Unknown")
        }
        
        result = template
        for placeholder, value in replacements.items():
            result = result.replace(placeholder, str(value))
        
        return result