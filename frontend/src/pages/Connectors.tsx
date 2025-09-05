import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  useTheme,
  alpha,
  Fade,
  Grow,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Science,
  CheckCircle,
  Error,
  Settings,
} from '@mui/icons-material';
import { connectorAPI } from '../services/api';
import type { ConnectorConfig, ConnectorConfigCreate, ConnectorType } from '../services/api';
import TheHiveIcon from '../components/TheHiveIcon';
import EmailIcon from '../components/EmailIcon';
import ServiceNowIcon from '../components/ServiceNowIcon';
import JiraIcon from '../components/JiraIcon';

// Type for form data that allows empty connector type
interface ConnectorFormData {
  name: string;
  connector_type: ConnectorType | '';
  config: any;
  enabled: boolean;
}

const Connectors: React.FC = () => {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<ConnectorConfig | null>(null);
  const [testResults, setTestResults] = useState<{ [key: number]: any }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectorToDelete, setConnectorToDelete] = useState<ConnectorConfig | null>(null);
  
  const theme = useTheme();

  const [formData, setFormData] = useState<ConnectorFormData>({
    name: '',
    connector_type: '',
    config: {},
    enabled: true,
  });

  useEffect(() => {
    fetchConnectors();
  }, []);

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await connectorAPI.getAll();
      setConnectors(data);
    } catch (err: any) {
      console.error('Error loading connectors:', err);
      setError('Failed to load connectors');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Validate that connector type is selected
      if (!formData.connector_type) {
        setError('Please select a connector type');
        return;
      }

      // Convert form data to API format
      const apiData: ConnectorConfigCreate = {
        name: formData.name,
        connector_type: formData.connector_type as ConnectorType,
        config: formData.config,
        enabled: formData.enabled,
      };

      if (editingConnector) {
        await connectorAPI.update(editingConnector.id, apiData);
      } else {
        await connectorAPI.create(apiData);
      }
      
      setDialogOpen(false);
      setEditingConnector(null);
      resetForm();
      fetchConnectors();
    } catch (err: any) {
      console.error('Error saving connector:', err);
      setError('Failed to save connector');
    }
  };

  const handleEdit = (connector: ConnectorConfig) => {
    setEditingConnector(connector);
    setFormData({
      name: connector.name,
      connector_type: connector.connector_type,
      config: connector.config,
      enabled: connector.enabled,
    });
    setDialogOpen(true);
  };

  const handleDelete = (connector: ConnectorConfig) => {
    setConnectorToDelete(connector);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!connectorToDelete) return;

    try {
      await connectorAPI.delete(connectorToDelete.id);
      setConnectors(connectors.filter(c => c.id !== connectorToDelete.id));
      setDeleteDialogOpen(false);
      setConnectorToDelete(null);
    } catch (err: any) {
      console.error('Error deleting connector:', err);
      setError('Failed to delete connector');
    }
  };

  const handleTest = async (connectorId: number) => {
    try {
      const result = await connectorAPI.test(connectorId);
      setTestResults({ ...testResults, [connectorId]: result });
    } catch (err: any) {
      console.error('Error testing connector:', err);
      setTestResults({ 
        ...testResults, 
        [connectorId]: { success: false, message: 'Test failed' } 
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      connector_type: '',
      config: {},
      enabled: true,
    });
  };

  const getConnectorIcon = (type: ConnectorType) => {
    switch (type) {
      case 'EMAIL':
        return <EmailIcon width={24} height={24} />;
      case 'THEHIVE':
        return <TheHiveIcon width={24} height={24} />;
      case 'SERVICENOW':
        return <ServiceNowIcon width={24} height={24} />;
      case 'JIRA':
        return <JiraIcon width={24} height={24} />;
      default:
        return <Settings />;
    }
  };

  const renderConfigForm = () => {
    if (!formData.connector_type) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Please select a connector type to configure its settings.
        </Typography>
      );
    }

    switch (formData.connector_type) {
      case 'EMAIL':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SMTP Host"
                value={formData.config.smtp_host || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, smtp_host: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SMTP Port"
                type="number"
                value={formData.config.smtp_port || 587}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, smtp_port: parseInt(e.target.value) }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                value={formData.config.username || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, username: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.config.password || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, password: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="From Email"
                value={formData.config.from_email || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, from_email: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.config.use_tls !== false}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, use_tls: e.target.checked }
                    })}
                  />
                }
                label="Use TLS"
              />
            </Grid>
          </Grid>
        );
      
      case 'THEHIVE':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="TheHive URL"
                value={formData.config.url || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, url: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Key"
                type="password"
                value={formData.config.api_key || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, api_key: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Organization (optional)"
                value={formData.config.organization || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, organization: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.config.verify_ssl !== false}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, verify_ssl: e.target.checked }
                    })}
                  />
                }
                label="Verify SSL"
              />
            </Grid>
          </Grid>
        );
      
      case 'SERVICENOW':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Instance URL"
                value={formData.config.instance_url || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, instance_url: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                value={formData.config.username || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, username: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.config.password || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, password: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Table Name"
                value={formData.config.table || 'incident'}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, table: e.target.value }
                })}
              />
            </Grid>
          </Grid>
        );
      
      case 'JIRA':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Jira URL"
                placeholder="https://company.atlassian.net"
                value={formData.config.url || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, url: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                value={formData.config.email || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, email: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="API Token"
                type="password"
                value={formData.config.api_token || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, api_token: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Issue Type (optional)"
                placeholder="Task"
                value={formData.config.issue_type || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, issue_type: e.target.value }
                })}
              />
            </Grid>
          </Grid>
        );
      
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
      <Fade in timeout={600}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <Settings />
              Connectors
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Manage external system integrations for workflow actions
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetForm();
              setEditingConnector(null);
              setDialogOpen(true);
            }}
          >
            Add Connector
          </Button>
        </Box>
      </Fade>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Connectors Table */}
      <Fade in timeout={1000}>
        <TableContainer component={Paper} sx={{ 
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden'
        }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Tested</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {connectors.map((connector, index) => (
                <Grow in timeout={1200 + index * 100} key={connector.id}>
                  <TableRow hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        {getConnectorIcon(connector.connector_type)}
                        <Typography variant="subtitle2" fontWeight="medium">
                          {connector.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={connector.connector_type.charAt(0).toUpperCase() + connector.connector_type.slice(1)}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          icon={connector.enabled ? <CheckCircle /> : <Error />}
                          label={connector.enabled ? 'Enabled' : 'Disabled'}
                          color={connector.enabled ? 'success' : 'default'}
                          size="small"
                        />
                        {testResults[connector.id] && (
                          <Chip
                            icon={testResults[connector.id].success ? <CheckCircle /> : <Error />}
                            label={testResults[connector.id].success ? 'Test OK' : 'Test Failed'}
                            color={testResults[connector.id].success ? 'success' : 'error'}
                            size="small"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {connector.last_tested_at ? 
                          new Date(connector.last_tested_at).toLocaleDateString() : 
                          'Never'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <IconButton
                          size="small"
                          onClick={() => handleTest(connector.id)}
                          color="primary"
                        >
                          <Science />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(connector.id)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(connector)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                </Grow>
              ))}
            </TableBody>
          </Table>
          
          {connectors.length === 0 && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Settings sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom>
                No connectors configured
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Add your first connector to enable workflow actions
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  resetForm();
                  setEditingConnector(null);
                  setDialogOpen(true);
                }}
              >
                Add Connector
              </Button>
            </Box>
          )}
        </TableContainer>
      </Fade>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingConnector ? 'Edit Connector' : 'Add New Connector'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Connector Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth sx={{ minWidth: 220 }}>
                <InputLabel>Connector Type</InputLabel>
                <Select
                  value={formData.connector_type}
                  label="Connector Type"
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    connector_type: e.target.value as ConnectorType,
                    config: {} // Reset config when type changes
                  })}
                  fullWidth
                  sx={{ '& .MuiSelect-select': { whiteSpace: 'normal', textOverflow: 'unset' } }}
                  MenuProps={{ PaperProps: { sx: { maxWidth: 'none' } } }}
                >
                  <MenuItem value="EMAIL">Email</MenuItem>
                  <MenuItem value="THEHIVE">TheHive</MenuItem>
                  <MenuItem value="SERVICENOW">ServiceNow</MenuItem>
                  <MenuItem value="JIRA">Jira</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
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
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Configuration
              </Typography>
              {renderConfigForm()}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingConnector ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Connector</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the connector "{connectorToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Connectors;