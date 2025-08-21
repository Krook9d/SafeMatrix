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
  Alert,
  Fab,
  Tooltip,
  Menu,
  MenuItem,
  useTheme,
  alpha,
  Fade,
  Grow,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  MoreVert,
  Refresh,
  Settings,
  Timeline,
  CheckCircle,
  Error,
  Pause,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { workflowAPI } from '../services/api';
import type { Workflow, WorkflowStatus } from '../services/api';

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workflowAPI.getAll();
      setWorkflows(data);
    } catch (err: any) {
      console.error('Error loading workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowToDelete) return;
    
    try {
      await workflowAPI.delete(workflowToDelete.id);
      setWorkflows(workflows.filter(w => w.id !== workflowToDelete.id));
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    } catch (err: any) {
      console.error('Error deleting workflow:', err);
      setError('Failed to delete workflow');
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, workflow: Workflow) => {
    setMenuAnchor(event.currentTarget);
    setSelectedWorkflow(workflow);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedWorkflow(null);
  };

  const getStatusColor = (status: WorkflowStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'draft':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: WorkflowStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'inactive':
        return <Pause sx={{ fontSize: 16 }} />;
      case 'draft':
        return <Edit sx={{ fontSize: 16 }} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Automation Workflows
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography>Loading workflows...</Typography>
        </Paper>
      </Box>
    );
  }

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
              Automation Workflows
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Create and manage automated responses to vulnerability discoveries
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchWorkflows}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/workflows/new')}
              sx={{
                bgcolor: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark
                }
              }}
            >
              Create Workflow
            </Button>
          </Box>
        </Box>
      </Fade>

      {error && (
        <Fade in timeout={800}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        </Fade>
      )}

      {/* Workflows Table */}
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
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Rules</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Triggers</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Updated</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workflows.map((workflow, index) => (
                <Grow in timeout={1200 + index * 100} key={workflow.id}>
                  <TableRow 
                    hover
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                      }
                    }}
                    onClick={() => navigate(`/workflows/${workflow.id}`)}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {workflow.name}
                        </Typography>
                        {workflow.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {workflow.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(workflow.status)}
                        label={workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                        color={getStatusColor(workflow.status)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${workflow.rules.length} rule${workflow.rules.length !== 1 ? 's' : ''}`}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${workflow.actions.length} action${workflow.actions.length !== 1 ? 's' : ''}`}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        {workflow.trigger_on_ingest && (
                          <Chip label="Ingest" size="small" color="primary" variant="outlined" />
                        )}
                        {workflow.trigger_on_schedule && (
                          <Chip label="Schedule" size="small" color="secondary" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(workflow.updated_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuClick(e, workflow);
                        }}
                        size="small"
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                </Grow>
              ))}
            </TableBody>
          </Table>
          
          {workflows.length === 0 && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Settings sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                No workflows found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Create your first automation workflow to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/workflows/new')}
              >
                Create Workflow
              </Button>
            </Box>
          )}
        </TableContainer>
      </Fade>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedWorkflow) {
            navigate(`/workflows/${selectedWorkflow.id}/edit`);
          }
          handleMenuClose();
        }}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedWorkflow) {
            navigate(`/workflows/${selectedWorkflow.id}/executions`);
          }
          handleMenuClose();
        }}>
          <Timeline sx={{ mr: 1 }} />
          View Executions
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedWorkflow) {
            navigate(`/workflows/${selectedWorkflow.id}/test`);
          }
          handleMenuClose();
        }}>
          <PlayArrow sx={{ mr: 1 }} />
          Test Workflow
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setWorkflowToDelete(selectedWorkflow);
            setDeleteDialogOpen(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Workflow</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the workflow "{workflowToDelete?.name}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteWorkflow} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Tooltip title="Create New Workflow">
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => navigate('/workflows/new')}
        >
          <Add />
        </Fab>
      </Tooltip>
    </Box>
  );
};

export default Workflows;