import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
from .base import BaseConnector

class EmailConnector(BaseConnector):
    """
    Email connector for sending notifications.
    """
    
    async def execute_action(self, action_config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send email notification.
        """
        try:
            # Format vulnerability context for templates
            vuln_context = self.format_vulnerability_context(context.get("vulnerability_data", {}))
            
            # Render templates
            subject = self.render_template(action_config.get("subject", ""), vuln_context)
            body = self.render_template(action_config.get("body", ""), vuln_context)
            
            # Prepare email
            msg = MIMEMultipart()
            msg['From'] = f"{self.config.get('from_name', '')} <{self.config['from_email']}>"
            msg['Subject'] = subject
            
            # Recipients
            to_emails = action_config.get("to", [])
            cc_emails = action_config.get("cc", []) or []  # Handle None case
            
            msg['To'] = ", ".join(to_emails)
            if cc_emails:
                msg['Cc'] = ", ".join(cc_emails)
            
            # Add body
            msg.attach(MIMEText(body, 'html' if '<' in body else 'plain'))
            
            # Send email
            context_manager = ssl.create_default_context()
            
            smtp_host = self._resolve_host(self.config['smtp_host'])
            with smtplib.SMTP(smtp_host, self.config['smtp_port']) as server:
                if self.config.get('use_tls', True):
                    server.starttls(context=context_manager)
                
                if self.config.get('username') and self.config.get('password'):
                    server.login(self.config['username'], self.config['password'])
                
                # Send to all recipients
                all_recipients = to_emails + cc_emails
                server.sendmail(self.config['from_email'], all_recipients, msg.as_string())
            
            return {
                "success": True,
                "message": f"Email sent to {len(all_recipients)} recipients",
                "recipients": all_recipients,
                "subject": subject
            }
            
        except Exception as e:
            self.logger.error(f"Failed to send email: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test email configuration by sending a test email.
        """
        try:
            # Prepare test email
            msg = MIMEMultipart()
            msg['From'] = f"{self.config.get('from_name', 'SafeMatrix')} <{self.config['from_email']}>"
            msg['To'] = "test@example.com"
            msg['Subject'] = "Test Email from SafeMatrix"
            
            # Add body
            body = """
            This is a test email from SafeMatrix.
            
            If you receive this email, your email connector is working correctly!
            
            ---
            SafeMatrix Security Team
            """
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            context_manager = ssl.create_default_context()
            
            smtp_host = self._resolve_host(self.config['smtp_host'])
            with smtplib.SMTP(smtp_host, self.config['smtp_port']) as server:
                if self.config.get('use_tls', False):
                    server.starttls(context=context_manager)
                
                if self.config.get('username') and self.config.get('password'):
                    server.login(self.config['username'], self.config['password'])
                
                # Send the email
                server.send_message(msg)
            
            return {
                "success": True,
                "message": "Test email sent successfully to test@example.com"
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Email test failed: {str(e)}"
            }
    
    def _resolve_host(self, configured_host: str) -> str:
        """
        Resolve host for Docker environment compatibility.
        Convert localhost/127.0.0.1 references to host.docker.internal when running in Docker.
        """
        import os
        
        # Check if we're running in a Docker environment
        is_docker = (
            os.path.exists('/.dockerenv') or
            os.environ.get('DOCKER_CONTAINER') == 'true' or
            os.environ.get('PYTHONPATH') == '/app'
        )
        
        if is_docker:
            if configured_host in ('localhost', '127.0.0.1'):
                resolved_host = 'host.docker.internal'
                self.logger.info(f"Docker environment detected, resolved host from {configured_host} to {resolved_host}")
                return resolved_host
        
        return configured_host