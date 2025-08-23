-- This file is a template. Users should replace the placeholders with their actual Gmail credentials.
-- DO NOT commit your real credentials to Git!

UPDATE connector_configs SET config = '{"smtp_host": "smtp.gmail.com", "smtp_port": 587, "from_email": "YOUR_GMAIL_ADDRESS", "from_name": "SafeMatrix Security", "use_tls": true, "username": "YOUR_GMAIL_ADDRESS", "password": "YOUR_GMAIL_APP_PASSWORD"}' WHERE connector_type = 'EMAIL';