import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  CardActions,
  Divider,
  Switch,
  FormControlLabel,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add,
  Delete,
  ExpandMore,
  Save,
  ArrowBack,
  PlayArrow,
  Settings,
  Rule,
  NotificationImportant,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { workflowAPI, connectorAPI } from '../services/api';
import type { 
  WorkflowCreate, 
  Workflow, 
  RuleCondition, 
  WorkflowAction, 
  ConnectorConfig,
  RuleOperator,
  ConnectorType 
} from '../services/api';

const steps = ['Basic Information', 'Rules Configuration', 'Actions Setup', 'Review & Save'];

const ruleOperators: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'less_than_or_equal', label: 'Less Than or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
];

const ruleFields = [
  { value: 'cvss_score', label: 'CVSS Score', type: 'number' },
  { value: 'severity', label: 'Severity', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
  { value: 'products_text', label: 'Affected Products (text search)', type: 'text' },
  { value: 'product_count', label: 'Number of Affected Products', type: 'number' },
  { value: 'cve_id', label: 'CVE ID', type: 'text' },
  { value: 'description', label: 'Description', type: 'text' },
  { value: 'published_date', label: 'Published Date', type: 'date' },
];

const WorkflowForm: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isEdit = workflowId && workflowId !== 'new';

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);

  // Form state
  const [formData, setFormData] = useState<WorkflowCreate>({
    name: '',
    description: '',
    status: 'draft',
    rules: [{ field: 'cvss_score', operator: 'greater_than_or_equal', value: 7.0 }],
    rule_logic: 'AND',
    actions: [],
    enabled: true,
    trigger_on_ingest: true,
    trigger_on_schedule: false,
  });

  useEffect(() => {
    fetchConnectors();
    if (isEdit) {
      fetchWorkflow();
    }
  }, [isEdit, workflowId]);

  const fetchConnectors = async () => {
    try {
      const data = await connectorAPI.getAll({ enabled: true });
      setConnectors(data);
    } catch (err) {
      console.error('Error loading connectors:', err);
    }
  };

  const fetchWorkflow = async () => {
    if (!workflowId) return;
    
    try {
      setLoading(true);
      const workflow = await workflowAPI.getById(parseInt(workflowId));
      setFormData({
        name: workflow.name,
        description: workflow.description || '',
        status: workflow.status,
        rules: workflow.rules,
        rule_logic: workflow.rule_logic,
        actions: workflow.actions,
        enabled: workflow.enabled,
        trigger_on_ingest: workflow.trigger_on_ingest,
        trigger_on_schedule: workflow.trigger_on_schedule,
        schedule_cron: workflow.schedule_cron,
      });
    } catch (err: any) {
      console.error('Error loading workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isEdit && workflowId) {
        await workflowAPI.update(parseInt(workflowId), formData);
      } else {
        await workflowAPI.create(formData);
      }

      navigate('/workflows');
    } catch (err: any) {
      console.error('Error saving workflow:', err);
      setError('Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  const addRule = () => {
    setFormData({
      ...formData,
      rules: [...formData.rules, { field: 'cvss_score', operator: 'greater_than_or_equal', value: 7.0 }]
    });
  };

  const updateRule = (index: number, rule: RuleCondition) => {
    const newRules = [...formData.rules];
    newRules[index] = rule;
    setFormData({ ...formData, rules: newRules });
  };

  const removeRule = (index: number) => {
    const newRules = formData.rules.filter((_, i) => i !== index);
    setFormData({ ...formData, rules: newRules });
  };

  const addAction = (type: string) => {
    const newAction: WorkflowAction = {
      type,
      config: getDefaultActionConfig(type)
    };
    setFormData({
      ...formData,
      actions: [...formData.actions, newAction]
    });
  };

  const getDefaultActionConfig = (type: string): any => {
    switch (type) {
      case 'email':
        return {
          connector_id: 0,
          to: [],
          subject: 'Security Alert: {{cve_id}} - {{severity}} Vulnerability Detected',
          body: `A new {{severity}} vulnerability has been detected:

CVE ID: {{cve_id}}
CVSS Score: {{cvss_score}}
Description: {{description}}
Affected Products: {{affected_products}}

Please review and take appropriate action.`
        };
      case 'thehive':
        return {
          connector_id: 0,
          title: 'Security Vulnerability: {{cve_id}}',
          description: `Vulnerability Details:
- CVE ID: {{cve_id}}
- CVSS Score: {{cvss_score}}
- Severity: {{severity}}
- Description: {{description}}
- Affected Products: {{affected_products}}`,
          severity: 2,
          tlp: 2,
          tags: ['vulnerability', 'automated']
        };
      case 'servicenow':
        return {
          connector_id: 0,
          short_description: 'Vulnerability Alert: {{cve_id}}',
          description: `A {{severity}} vulnerability has been detected:

CVE ID: {{cve_id}}
CVSS Score: {{cvss_score}}
Description: {{description}}
Affected Products: {{affected_products}}`,
          priority: 3,
          category: 'Security'
        };
      default:
        return {};
    }
  };

  const updateAction = (index: number, action: WorkflowAction) => {
    const newActions = [...formData.actions];
    newActions[index] = action;
    setFormData({ ...formData, actions: newActions });
  };

  const removeAction = (index: number) => {
    const newActions = formData.actions.filter((_, i) => i !== index);
    setFormData({ ...formData, actions: newActions });
  };

  const renderBasicInfo = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings />
          Basic Information
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Workflow Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.trigger_on_ingest}
                  onChange={(e) => setFormData({ ...formData, trigger_on_ingest: e.target.checked })}
                />
              }
              label="Trigger on Vulnerability Ingest"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.trigger_on_schedule}
                  onChange={(e) => setFormData({ ...formData, trigger_on_schedule: e.target.checked })}
                />
              }
              label="Trigger on Schedule"
            />
          </Grid>
          {formData.trigger_on_schedule && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Cron Expression"
                value={formData.schedule_cron || ''}
                onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                placeholder="0 0 * * *"
                helperText="Cron expression for scheduled execution"
              />
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderRulesConfig = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Rule />
            Rules Configuration
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={addRule}
          >
            Add Rule
          </Button>
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Rule Logic</InputLabel>
          <Select
            value={formData.rule_logic}
            label="Rule Logic"
            onChange={(e) => setFormData({ ...formData, rule_logic: e.target.value })}
          >
            <MenuItem value="AND">AND (All rules must match)</MenuItem>
            <MenuItem value="OR">OR (Any rule can match)</MenuItem>
          </Select>
        </FormControl>

        {formData.rules.map((rule, index) => (
          <Card key={index} sx={{ mb: 2, border: 1, borderColor: 'divider' }}>
            <CardContent>
              <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
                <Typography variant="subtitle2">Rule {index + 1}</Typography>
                <IconButton
                  onClick={() => removeRule(index)}
                  color="error"
                  size="small"
                >
                  <Delete />
                </IconButton>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Field</InputLabel>
                    <Select
                      value={rule.field}
                      label="Field"
                      onChange={(e) => updateRule(index, { ...rule, field: e.target.value })}
                    >
                      {ruleFields.map((field) => (
                        <MenuItem key={field.value} value={field.value}>
                          {field.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={rule.operator}
                      label="Operator"
                      onChange={(e) => updateRule(index, { ...rule, operator: e.target.value as RuleOperator })}
                    >
                      {ruleOperators.map((op) => (
                        <MenuItem key={op.value} value={op.value}>
                          {op.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Value"
                    value={rule.value}
                    onChange={(e) => {
                      const field = ruleFields.find(f => f.value === rule.field);
                      let value: any = e.target.value;
                      if (field?.type === 'number') {
                        value = parseFloat(value) || 0;
                      }
                      updateRule(index, { ...rule, value });
                    }}
                    type={ruleFields.find(f => f.value === rule.field)?.type === 'number' ? 'number' : 'text'}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );

  const renderActionsSetup = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationImportant />
            Actions Setup
          </Typography>
          <Box>
            <Button
              variant="outlined"
              onClick={() => addAction('email')}
              sx={{ mr: 1 }}
            >
              Add Email
            </Button>
            <Button
              variant="outlined"
              onClick={() => addAction('thehive')}
              sx={{ mr: 1 }}
            >
              Add TheHive
            </Button>
            <Button
              variant="outlined"
              onClick={() => addAction('servicenow')}
            >
              Add ServiceNow
            </Button>
          </Box>
        </Box>

        {formData.actions.map((action, index) => (
          <Accordion key={index} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                <Typography>
                  {action.type.charAt(0).toUpperCase() + action.type.slice(1)} Action {index + 1}
                </Typography>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAction(index);
                  }}
                  color="error"
                  size="small"
                >
                  <Delete />
                </IconButton>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {renderActionConfig(action, index)}
            </AccordionDetails>
          </Accordion>
        ))}

        {formData.actions.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography color="text.secondary">
              No actions configured. Add an action to get started.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderActionConfig = (action: WorkflowAction, index: number) => {
    const actionConnectors = connectors.filter(c => c.connector_type === action.type);

    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Connector</InputLabel>
            <Select
              value={action.config.connector_id || ''}
              label="Connector"
              onChange={(e) => updateAction(index, {
                ...action,
                config: { ...action.config, connector_id: e.target.value as number }
              })}
            >
              {actionConnectors.map((connector) => (
                <MenuItem key={connector.id} value={connector.id}>
                  {connector.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {action.type === 'email' && (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="To (comma-separated emails)"
                value={Array.isArray(action.config.to) ? action.config.to.join(', ') : ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { 
                    ...action.config, 
                    to: e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                  }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={action.config.subject || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, subject: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Body"
                multiline
                rows={6}
                value={action.config.body || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, body: e.target.value }
                })}
              />
            </Grid>
          </>
        )}

        {action.type === 'thehive' && (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={action.config.title || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, title: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={4}
                value={action.config.description || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, description: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Severity (1-4)"
                type="number"
                inputProps={{ min: 1, max: 4 }}
                value={action.config.severity || 2}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, severity: parseInt(e.target.value) }
                })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="TLP (0-3)"
                type="number"
                inputProps={{ min: 0, max: 3 }}
                value={action.config.tlp || 2}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, tlp: parseInt(e.target.value) }
                })}
              />
            </Grid>
          </>
        )}

        {action.type === 'servicenow' && (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Short Description"
                value={action.config.short_description || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, short_description: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={4}
                value={action.config.description || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, description: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Priority (1-5)"
                type="number"
                inputProps={{ min: 1, max: 5 }}
                value={action.config.priority || 3}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, priority: parseInt(e.target.value) }
                })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Category"
                value={action.config.category || ''}
                onChange={(e) => updateAction(index, {
                  ...action,
                  config: { ...action.config, category: e.target.value }
                })}
              />
            </Grid>
          </>
        )}
      </Grid>
    );
  };

  const renderReview = () => (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Review & Save
        </Typography>
        
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight="bold">Basic Information</Typography>
          <Typography>Name: {formData.name}</Typography>
          <Typography>Status: {formData.status}</Typography>
          <Typography>Enabled: {formData.enabled ? 'Yes' : 'No'}</Typography>
        </Box>

        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight="bold">Rules ({formData.rules.length})</Typography>
          <Typography>Logic: {formData.rule_logic}</Typography>
          {formData.rules.map((rule, index) => (
            <Typography key={index} variant="body2">
              {index + 1}. {rule.field} {rule.operator} {rule.value}
            </Typography>
          ))}
        </Box>

        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight="bold">Actions ({formData.actions.length})</Typography>
          {formData.actions.map((action, index) => (
            <Typography key={index} variant="body2">
              {index + 1}. {action.type.charAt(0).toUpperCase() + action.type.slice(1)} Action
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderRulesConfig();
      case 2:
        return renderActionsSetup();
      case 3:
        return renderReview();
      default:
        return null;
    }
  };

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: 'none', 
      px: 3,
      py: 3,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 64px)',
      background: 'linear-gradient(135deg, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 1) 100%)'
    }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/workflows')}
            sx={{ mb: 2 }}
          >
            Back to Workflows
          </Button>
          <Typography variant="h4" sx={{ 
            fontWeight: 700,
            color: theme.palette.primary.main
          }}>
            {isEdit ? 'Edit Workflow' : 'Create New Workflow'}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Box flex={1} mb={3}>
        {renderStepContent()}
      </Box>

      {/* Navigation Buttons */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between">
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep(activeStep - 1)}
          >
            Back
          </Button>
          <Box>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={loading}
                startIcon={<Save />}
              >
                {loading ? 'Saving...' : (isEdit ? 'Update Workflow' : 'Create Workflow')}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => setActiveStep(activeStep + 1)}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default WorkflowForm;