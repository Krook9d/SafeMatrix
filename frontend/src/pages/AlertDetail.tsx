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
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { alertsAPI, hostsAPI, vulnerabilitiesAPI, workflowAPI, type AlertItem, type Workflow } from '../services/api';
import { OpenInNew, ArrowBack, Computer, BugReport, Security } from '@mui/icons-material';

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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent sx={{ py: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <Security sx={{ color: '#fff' }} />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Alert</Typography>
                <Typography variant="body2" color="text.secondary">{alert._id}</Typography>
              </Box>
              <Chip size="small" label={alert.status} color={statusColors[alert.status] || 'default'} sx={{ ml: 1 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" startIcon={<ArrowBack />} onClick={handleBack}>Back to Alerts</Button>
              <Button variant="contained" disabled={statusBusy || alert.status !== 'open'} onClick={() => handleStatus('acknowledged')}>Acknowledge</Button>
              <Button variant="contained" color="success" disabled={statusBusy || alert.status === 'resolved'} onClick={() => handleStatus('resolved')}>Resolve</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Security sx={{ color: '#fff' }} />
                </Avatar>
                <Typography variant="h6">Alert</Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Status:</Typography>
                  <Chip size="small" label={alert.status} color={statusColors[alert.status] || 'default'} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Software:</Typography>
                  <Typography variant="body2">{alert.software_name} {alert.version}</Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>CVE:</Typography>
                  <Typography variant="body2">{alert.cve_id}</Typography>
                </Stack>
                {alert.url && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Ref:</Typography>
                    <Button size="small" endIcon={<OpenInNew />} component="a" href={alert.url} target="_blank" rel="noopener noreferrer">Open</Button>
                  </Stack>
                )}
                <Stack direction="row" spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Created:</Typography>
                  <Typography variant="body2">{alert.created_at ? new Date(alert.created_at).toLocaleString() : '-'}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <Computer sx={{ color: '#fff' }} />
                </Avatar>
                <Typography variant="h6">Host</Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {host ? (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Host:</Typography>
                    <Typography variant="body2">{host.hostname || host.name || host.id || alert.host_id}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>IP:</Typography>
                    <Typography variant="body2">{host.ip_address || '-'}</Typography>
                  </Stack>
                  {host.os && (
                    <Stack direction="row" spacing={1}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>OS:</Typography>
                      <Typography variant="body2">{host.os?.name} {host.os?.version}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Host ID:</Typography>
                    <Typography variant="body2">{alert.host_id}</Typography>
                  </Stack>
                  <Button size="small" sx={{ mt: 1 }} variant="outlined" onClick={() => navigate(`/hosts/${encodeURIComponent(alert.host_id)}`)}>
                    Go to Host
                  </Button>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No host details found</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <BugReport sx={{ color: '#fff' }} />
                </Avatar>
                <Typography variant="h6">Vulnerability</Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {vuln ? (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>ID:</Typography>
                    <Typography variant="body2">{vuln.id}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Score:</Typography>
                    <Typography variant="body2">{vuln.cvss_score ?? '-'}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 1 }}>{description}</Typography>
                  <Button size="small" sx={{ mt: 1 }} variant="outlined" onClick={() => navigate(`/vulnerabilities/${encodeURIComponent(vuln.id)}`)}>View vulnerability</Button>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No vulnerability details</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Actions</Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  select
                  label="Choose workflow to execute"
                  value={selectedWorkflow}
                  onChange={(e) => setSelectedWorkflow(Number(e.target.value))}
                  sx={{ minWidth: 300 }}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {workflows.filter(w => w.enabled).map((w) => (
                    <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                  ))}
                </TextField>
                <Button variant="contained" disabled={!selectedWorkflow || execBusy} onClick={handleExecute}>
                  {execBusy ? 'Running...' : 'Execute on this alert'}
                </Button>
              </Stack>
              {execMsg && (
                <MuiAlert sx={{ mt: 2 }} severity={execMsg.includes('Failed') ? 'error' : 'success'}>{execMsg}</MuiAlert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AlertDetail;
