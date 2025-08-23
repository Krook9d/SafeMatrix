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
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  Fade,
  Grow,
} from '@mui/material';
import {
  ArrowBack,
  Refresh,
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { workflowAPI } from '../services/api';
import type { Workflow } from '../services/api';

// Mock execution type - you'll need to define this properly in your API
interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  trigger_type: 'manual' | 'schedule' | 'ingest';
  results?: any;
}

const WorkflowExecutions: React.FC = () => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();

  useEffect(() => {
    if (id) {
      fetchWorkflowAndExecutions();
    }
  }, [id]);

  const fetchWorkflowAndExecutions = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch workflow details
      const workflowData = await workflowAPI.getById(parseInt(id));
      setWorkflow(workflowData);
      
      // TODO: Implement executions API endpoint
      // For now, we'll show mock data
      const mockExecutions: WorkflowExecution[] = [
        {
          id: 1,
          workflow_id: parseInt(id),
          status: 'completed',
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date(Date.now() - 3500000).toISOString(),
          trigger_type: 'schedule',
        },
        {
          id: 2,
          workflow_id: parseInt(id),
          status: 'failed',
          started_at: new Date(Date.now() - 7200000).toISOString(),
          completed_at: new Date(Date.now() - 7100000).toISOString(),
          error_message: 'SMTP connection failed',
          trigger_type: 'manual',
        },
        {
          id: 3,
          workflow_id: parseInt(id),
          status: 'running',
          started_at: new Date(Date.now() - 300000).toISOString(),
          trigger_type: 'ingest',
        },
      ];
      
      setExecutions(mockExecutions);
    } catch (err: any) {
      console.error('Error loading workflow executions:', err);
      setError('Failed to load workflow executions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'info';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'failed':
        return <Error sx={{ fontSize: 16 }} />;
      case 'running':
        return <CircularProgress size={16} />;
      case 'pending':
        return <Schedule sx={{ fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Workflow Executions
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography>Loading executions...</Typography>
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
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <Button
                startIcon={<ArrowBack />}
                onClick={() => navigate('/workflows')}
                variant="outlined"
              >
                Back to Workflows
              </Button>
            </Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <PlayArrow />
              Workflow Executions
            </Typography>
            {workflow && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Execution history for "{workflow.name}"
              </Typography>
            )}
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchWorkflowAndExecutions}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={() => navigate(`/workflows/${id}/test`)}
              sx={{
                bgcolor: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark
                }
              }}
            >
              Test Workflow
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

      {/* Executions Table */}
      <Fade in timeout={1000}>
        <TableContainer component={Paper} sx={{ 
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden'
        }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 600 }}>Execution ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Trigger</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executions.map((execution, index) => (
                <Grow in timeout={1200 + index * 100} key={execution.id}>
                  <TableRow 
                    hover
                    sx={{ 
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="medium">
                        #{execution.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(execution.status)}
                        label={execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                        color={getStatusColor(execution.status)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={execution.trigger_type.charAt(0).toUpperCase() + execution.trigger_type.slice(1)}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(execution.started_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDuration(execution.started_at, execution.completed_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {execution.error_message ? (
                        <Typography variant="body2" color="error.main" sx={{ maxWidth: 200 }}>
                          {execution.error_message}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                </Grow>
              ))}
            </TableBody>
          </Table>
          
          {executions.length === 0 && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <PlayArrow sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                No executions found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                This workflow hasn't been executed yet
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={() => navigate(`/workflows/${id}/test`)}
              >
                Test Workflow
              </Button>
            </Box>
          )}
        </TableContainer>
      </Fade>
    </Box>
  );
};

export default WorkflowExecutions;