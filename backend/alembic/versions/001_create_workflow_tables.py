"""Create workflow tables

Revision ID: 001_workflow_tables
Revises: 
Create Date: 2025-01-21 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_workflow_tables'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create enum types
    workflow_status_enum = postgresql.ENUM('active', 'inactive', 'draft', name='workflowstatus')
    workflow_status_enum.create(op.get_bind())
    
    connector_type_enum = postgresql.ENUM('email', 'thehive', 'servicenow', name='connectortype')
    connector_type_enum.create(op.get_bind())
    
    execution_status_enum = postgresql.ENUM('pending', 'running', 'success', 'failed', 'skipped', name='executionstatus')
    execution_status_enum.create(op.get_bind())
    
    # Create workflows table
    op.create_table('workflows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', workflow_status_enum, nullable=False),
        sa.Column('rules', sa.JSON(), nullable=False),
        sa.Column('rule_logic', sa.String(length=10), nullable=False),
        sa.Column('actions', sa.JSON(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('trigger_on_ingest', sa.Boolean(), nullable=False),
        sa.Column('trigger_on_schedule', sa.Boolean(), nullable=False),
        sa.Column('schedule_cron', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False),
        sa.Column('updated_by', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflows_id'), 'workflows', ['id'], unique=False)
    op.create_index(op.f('ix_workflows_name'), 'workflows', ['name'], unique=False)
    
    # Create workflow_executions table
    op.create_table('workflow_executions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workflow_id', sa.Integer(), nullable=False),
        sa.Column('trigger_type', sa.String(length=50), nullable=False),
        sa.Column('vulnerability_id', sa.String(length=50), nullable=True),
        sa.Column('status', execution_status_enum, nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rules_matched', sa.Boolean(), nullable=False),
        sa.Column('actions_executed', sa.Integer(), nullable=False),
        sa.Column('actions_failed', sa.Integer(), nullable=False),
        sa.Column('execution_log', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('idempotency_key', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_executions_id'), 'workflow_executions', ['id'], unique=False)
    op.create_index(op.f('ix_workflow_executions_workflow_id'), 'workflow_executions', ['workflow_id'], unique=False)
    op.create_index(op.f('ix_workflow_executions_vulnerability_id'), 'workflow_executions', ['vulnerability_id'], unique=False)
    op.create_index(op.f('ix_workflow_executions_idempotency_key'), 'workflow_executions', ['idempotency_key'], unique=False)
    
    # Create action_logs table
    op.create_table('action_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('execution_id', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(length=50), nullable=False),
        sa.Column('action_config', sa.JSON(), nullable=False),
        sa.Column('status', execution_status_enum, nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('response_data', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['execution_id'], ['workflow_executions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_action_logs_id'), 'action_logs', ['id'], unique=False)
    op.create_index(op.f('ix_action_logs_execution_id'), 'action_logs', ['execution_id'], unique=False)
    
    # Create connector_configs table
    op.create_table('connector_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('connector_type', connector_type_enum, nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('credentials', sa.JSON(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('last_tested_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('test_status', sa.String(length=50), nullable=True),
        sa.Column('test_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_connector_configs_id'), 'connector_configs', ['id'], unique=False)
    op.create_index(op.f('ix_connector_configs_name'), 'connector_configs', ['name'], unique=False)

def downgrade():
    # Drop tables
    op.drop_table('connector_configs')
    op.drop_table('action_logs')
    op.drop_table('workflow_executions')
    op.drop_table('workflows')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS executionstatus')
    op.execute('DROP TYPE IF EXISTS connectortype')
    op.execute('DROP TYPE IF EXISTS workflowstatus')