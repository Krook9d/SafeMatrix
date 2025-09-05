"""create_workflow_tables_v2

Revision ID: 9b87a2d0124f
Revises: 001_workflow_tables
Create Date: 2025-08-23 15:01:00.207802

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b87a2d0124f'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums with raw SQL to handle duplicates properly
    # Drop existing enums if they exist with wrong values
    op.execute("DROP TYPE IF EXISTS workflowstatus CASCADE;")
    op.execute("DROP TYPE IF EXISTS connectortype CASCADE;")
    op.execute("DROP TYPE IF EXISTS executionstatus CASCADE;")
    
    # Create enums with correct values matching Python enum names
    op.execute("CREATE TYPE workflowstatus AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');")
    op.execute("CREATE TYPE connectortype AS ENUM ('EMAIL', 'THEHIVE', 'SERVICENOW', 'JIRA');")
    op.execute("CREATE TYPE executionstatus AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');")
    
    # Create tables if they don't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS workflows (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status workflowstatus NOT NULL DEFAULT 'DRAFT',
            rules JSON NOT NULL,
            rule_logic VARCHAR(10) NOT NULL DEFAULT 'AND',
            actions JSON NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT true,
            trigger_on_ingest BOOLEAN NOT NULL DEFAULT true,
            trigger_on_schedule BOOLEAN NOT NULL DEFAULT false,
            schedule_cron VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            created_by VARCHAR(255) NOT NULL,
            updated_by VARCHAR(255)
        );
    """)
    
    op.execute("""
        CREATE TABLE IF NOT EXISTS connector_configs (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            connector_type connectortype NOT NULL,
            config JSON NOT NULL,
            credentials JSON,
            enabled BOOLEAN NOT NULL DEFAULT true,
            last_tested_at TIMESTAMP WITH TIME ZONE,
            test_status VARCHAR(50),
            test_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            created_by VARCHAR(255) NOT NULL
        );
    """)
    
    op.execute("""
        CREATE TABLE IF NOT EXISTS workflow_executions (
            id SERIAL PRIMARY KEY,
            workflow_id INTEGER NOT NULL REFERENCES workflows(id),
            trigger_type VARCHAR(50) NOT NULL,
            vulnerability_id VARCHAR(50),
            status executionstatus NOT NULL DEFAULT 'PENDING',
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            completed_at TIMESTAMP WITH TIME ZONE,
            rules_matched BOOLEAN NOT NULL DEFAULT false,
            actions_executed INTEGER NOT NULL DEFAULT 0,
            actions_failed INTEGER NOT NULL DEFAULT 0,
            execution_log JSON,
            error_message TEXT,
            idempotency_key VARCHAR(255)
        );
    """)
    
    op.execute("""
        CREATE TABLE IF NOT EXISTS action_logs (
            id SERIAL PRIMARY KEY,
            execution_id INTEGER NOT NULL REFERENCES workflow_executions(id),
            action_type VARCHAR(50) NOT NULL,
            action_config JSON NOT NULL,
            status executionstatus NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            completed_at TIMESTAMP WITH TIME ZONE,
            response_data JSON,
            error_message TEXT
        );
    """)
    
    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflows_id ON workflows(id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflows_name ON workflows(name);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_connector_configs_id ON connector_configs(id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_connector_configs_name ON connector_configs(name);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_executions_id ON workflow_executions(id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_executions_workflow_id ON workflow_executions(workflow_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_executions_vulnerability_id ON workflow_executions(vulnerability_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_executions_idempotency_key ON workflow_executions(idempotency_key);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_action_logs_id ON action_logs(id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_action_logs_execution_id ON action_logs(execution_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS action_logs CASCADE;")
    op.execute("DROP TABLE IF EXISTS workflow_executions CASCADE;")
    op.execute("DROP TABLE IF EXISTS connector_configs CASCADE;")
    op.execute("DROP TABLE IF EXISTS workflows CASCADE;")
    op.execute("DROP TYPE IF EXISTS executionstatus CASCADE;")
    op.execute("DROP TYPE IF EXISTS connectortype CASCADE;")
    op.execute("DROP TYPE IF EXISTS workflowstatus CASCADE;")