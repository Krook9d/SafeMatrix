import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Divider,
  Grid,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert as MuiAlert,
  Avatar,
  Paper,
  Tooltip,
  IconButton,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { alertsAPI, hostsAPI, vulnerabilitiesAPI, workflowAPI, type AlertItem, type Workflow } from '../services/api';
import { 
  OpenInNew, 
  ArrowBack, 
  Computer, 
  BugReport, 
  Security, 
  Schedule,
  Assessment,
  Launch,
  CheckCircle,
  Assignment
} from '@mui/icons-material';

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  open: 'warning',
  acknowledged: 'info',
  resolved: 'success',
};

const AlertDetail: React.FC = () => {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [alert, setAlert] = useState<AlertItem | null>(null);
  const [host, setHost] = useState<any | null>(null);
  const [vuln, setVuln] = useState<any | null>(null);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<number | ''>('');
  const [execBusy, setExecBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [execMsg, setExecMsg] = useState<string | null>(null);

  const handleBack = () => {
    // Try to go back, otherwise go to alerts list
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/alerts');
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!alertId) return;
      setLoading(true);
      setError(null);
      try {
        const a = await alertsAPI.getById(alertId);
        setAlert(a);
        // parallel fetches
        const [h, v, wf] = await Promise.all([
          a.host_id ? hostsAPI.getById(a.host_id).catch(() => null) : Promise.resolve(null),
          a.cve_id ? vulnerabilitiesAPI.getById(a.cve_id).catch(() => null) : Promise.resolve(null),
          workflowAPI.getAll({ enabled: true }).catch(() => [] as Workflow[]),
        ]);
        setHost(h);
        setVuln(v);
        setWorkflows(wf || []);
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || 'Failed to load alert');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [alertId]);

  const handleExecute = async () => {
    if (!selectedWorkflow || !alert) return;
    setExecBusy(true);
    setExecMsg(null);
    try {
      await workflowAPI.execute(Number(selectedWorkflow), { vulnerability_id: alert.cve_id });
      setExecMsg('Workflow execution started');
    } catch (e: any) {
      setExecMsg(e?.response?.data?.detail || e?.message || 'Failed to start workflow');
    } finally {
      setExecBusy(false);
    }
  };

  const handleStatus = async (newStatus: 'open' | 'acknowledged' | 'resolved') => {
    if (!alert) return;
    setStatusBusy(true);
    try {
      await alertsAPI.updateStatus(alert._id, newStatus);
      setAlert({ ...alert, status: newStatus });
    } catch (e: any) {
      // ignore; UI will show toast on list page
    } finally {
      setStatusBusy(false);
    }
  };

  const description = useMemo(() => {
    return vuln?.descriptions?.find((d: any) => d.lang === 'en')?.value || vuln?.description || '';
  }, [vuln]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !alert) {
    return (
      <Box sx={{ p: 3 }}>
        <MuiAlert severity="error">{error || 'Alert not found'}</MuiAlert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Enhanced Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          mb: 4, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          color: 'white',
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', lg: 'center' }}>
            {/* Left section - Alert info */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
              <Avatar sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                width: 56, 
                height: 56,
                backdropFilter: 'blur(10px)'
              }}>
                <Security sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Security Alert
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9, mb: 1 }}>
                  {alert.software_name} {alert.version} • {alert.cve_id}
                </Typography>
                <Chip 
                  label={alert.status.toUpperCase()} 
                  sx={{ 
                    bgcolor: statusColors[alert.status] === 'warning' ? 'rgba(255,193,7,0.9)' :
                            statusColors[alert.status] === 'info' ? 'rgba(33,150,243,0.9)' :
                            'rgba(76,175,80,0.9)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }} 
                />
              </Box>
            </Stack>

            {/* Right section - Actions */}
            <Stack direction={{ xs: 'row', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button 
                variant="outlined" 
                startIcon={<ArrowBack />} 
                onClick={handleBack}
                sx={{ 
                  borderColor: 'rgba(255,255,255,0.5)',
                  color: 'white',
                  '&:hover': { 
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                startIcon={<CheckCircle />}
                disabled={statusBusy || alert.status !== 'open'} 
                onClick={() => handleStatus('acknowledged')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
              >
                Acknowledge
              </Button>
              <Button 
                variant="contained" 
                startIcon={<Assignment />}
                disabled={statusBusy || alert.status === 'resolved'} 
                onClick={() => handleStatus('resolved')}
                sx={{ 
                  bgcolor: 'rgba(76,175,80,0.8)',
                  '&:hover': { bgcolor: 'rgba(76,175,80,1)' }
                }}
              >
                Resolve
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Paper>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        
        {/* Alert Details */}
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={1} 
            sx={{ 
              borderRadius: 3, 
              height: '100%'
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                  <Security />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Alert Information
                </Typography>
              </Stack>
              
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Status
                  </Typography>
                  <Chip 
                    label={alert.status} 
                    color={statusColors[alert.status] || 'default'} 
                    sx={{ fontWeight: 500 }}
                  />
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Affected Software
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {alert.software_name} {alert.version}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    CVE Identifier
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {alert.cve_id}
                    </Typography>
                    {alert.url && (
                      <Tooltip title="View CVE details">
                        <IconButton 
                          size="small" 
                          component="a" 
                          href={alert.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Created At
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Schedule fontSize="small" color="action" />
                    <Typography variant="body1">
                      {alert.created_at ? new Date(alert.created_at).toLocaleString() : '-'}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Host Information */}
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={1} 
            sx={{ 
              borderRadius: 3, 
              height: '100%'
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                  <Computer />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Host Information
                </Typography>
              </Stack>
              
              {host ? (
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Hostname
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {host.hostname || host.name || host.id || alert.host_id}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      IP Address
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {host.ip_address || 'Not available'}
                    </Typography>
                  </Box>
                  
                  {host.os && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Operating System
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {host.os?.name} {host.os?.version}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Host ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                      {alert.host_id}
                    </Typography>
                  </Box>
                  
                  <Button 
                    variant="outlined" 
                    startIcon={<Launch />}
                    onClick={() => navigate(`/hosts/${encodeURIComponent(alert.host_id)}`)}
                    sx={{ mt: 1, alignSelf: 'flex-start' }}
                  >
                    View Host Details
                  </Button>
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Computer sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Host details not available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Vulnerability Details */}
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={1} 
            sx={{ 
              borderRadius: 3, 
              height: '100%'
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'error.main', width: 40, height: 40 }}>
                  <BugReport />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Vulnerability Details
                </Typography>
              </Stack>
              
              {vuln ? (
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      CVE ID
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {vuln.id}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      CVSS Score
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Assessment fontSize="small" color="action" />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {vuln.cvss_score ?? 'Not available'}
                      </Typography>
                    </Stack>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Description
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        bgcolor: 'grey.50', 
                        p: 2, 
                        borderRadius: 2,
                        lineHeight: 1.6,
                        maxHeight: '120px',
                        overflowY: 'auto'
                      }}
                    >
                      {description || 'No description available'}
                    </Typography>
                  </Box>
                  
                  <Button 
                    variant="outlined" 
                    startIcon={<Launch />}
                    onClick={() => navigate(`/vulnerabilities/${encodeURIComponent(vuln.id)}`)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    View Full Vulnerability
                  </Button>
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <BugReport sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Vulnerability details not available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Workflow Actions */}
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            elevation={1} 
            sx={{ 
              borderRadius: 3, 
              height: '100%'
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                  <Assignment />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Workflow Actions
                </Typography>
              </Stack>
              
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Execute Workflow
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    label="Choose workflow to execute"
                    value={selectedWorkflow}
                    onChange={(e) => setSelectedWorkflow(Number(e.target.value))}
                    variant="outlined"
                  >
                    <MenuItem value="">
                      <em>Select a workflow</em>
                    </MenuItem>
                    {workflows.filter(w => w.enabled).map((w) => (
                      <MenuItem key={w.id} value={w.id}>
                        {w.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                
                <Button 
                  variant="contained" 
                  startIcon={execBusy ? <CircularProgress size={16} /> : <Launch />}
                  disabled={!selectedWorkflow || execBusy} 
                  onClick={handleExecute}
                  size="large"
                  sx={{ 
                    py: 1.5,
                    bgcolor: 'success.main',
                    '&:hover': { bgcolor: 'success.dark' }
                  }}
                >
                  {execBusy ? 'Executing Workflow...' : 'Execute Workflow'}
                </Button>
                
                {execMsg && (
                  <MuiAlert 
                    severity={execMsg.includes('Failed') ? 'error' : 'success'}
                    sx={{ borderRadius: 2 }}
                  >
                    {execMsg}
                  </MuiAlert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AlertDetail;
