import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  CloudSync,
  CheckCircle,
  Error as ErrorIcon,
  Cancel as CancelIcon,
  Schedule,
  TrendingUp,
  Storage,
  Timelapse,
  Update
} from '@mui/icons-material';
import { nvdSyncAPI } from '../services/api';
import type { NVDSyncStatus, NVDSyncHistoryEntry } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link as RouterLink } from 'react-router-dom';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';

const DataEnrichment: React.FC = () => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<NVDSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [history, setHistory] = useState<NVDSyncHistoryEntry[]>([]);

  const parseApiDate = useCallback((value?: string) => {
    if (!value) {
      return null;
    }
    const hasTimezone = /[zZ]|[+-]\d\d:\d\d$/.test(value);
    const isoString = hasTimezone ? value : `${value}Z`;
    const parsed = new Date(isoString);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const formatDateTime = useCallback((value?: string, fallback = 'N/A') => {
    const date = parseApiDate(value);
    return date ? date.toLocaleString() : fallback;
  }, [parseApiDate]);

  // Vérifier si l'utilisateur est admin
  if (user?.role !== 'admin') {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Access denied. This page is reserved for administrators.
        </Alert>
      </Container>
    );
  }

  const loadHistory = useCallback(async () => {
    try {
      const items = await nvdSyncAPI.getHistory(40);
      setHistory(items);
    } catch (err) {
      // Historique non critique : on log seulement
      console.error('Failed to load sync history', err);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await nvdSyncAPI.getStatus();
      setSyncStatus(status);
      setLastUpdate(new Date());
      loadHistory();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error fetching synchronization status');
    }
  }, [loadHistory]);

  // Charger le statut au montage
  useEffect(() => {
    fetchStatus();
    loadHistory();
  }, [fetchStatus, loadHistory]);

  // Polling automatique quand la synchronisation est en cours ou en monitoring
  useEffect(() => {
    if (syncStatus?.status === 'running' || syncStatus?.status === 'monitoring') {
      const interval = setInterval(() => {
        fetchStatus();
      }, 2000); // Mise à jour toutes les 2 secondes

      return () => clearInterval(interval);
    }
  }, [syncStatus?.status, fetchStatus]);

  // Démarrer la synchronisation (Full ou Continuous)
  const handleStartSync = async (mode: 'full' | 'continuous') => {
    setLoading(true);
    setError(null);
    try {
      await nvdSyncAPI.start(mode);
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error starting synchronization');
    } finally {
      setLoading(false);
    }
  };

  // Arrêter la synchronisation
  const handleStopSync = async () => {
    setLoading(true);
    setError(null);
    try {
      await nvdSyncAPI.stop();
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error stopping synchronization');
    } finally {
      setLoading(false);
    }
  };

  // Nettoyer le statut
  const handleClearStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      await nvdSyncAPI.clearStatus();
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error clearing status');
    } finally {
      setLoading(false);
    }
  };

  // Obtenir la couleur du statut
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running':
      case 'monitoring':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'stopped':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Obtenir l'icône du statut
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'running':
      case 'monitoring':
        return <CloudSync />;
      case 'completed':
        return <CheckCircle />;
      case 'failed':
        return <ErrorIcon />;
      case 'stopped':
        return <CancelIcon />;
      default:
        return <CloudSync />;
    }
  };
  
  // Vérifier si une synchronisation est active
  const isActive = syncStatus?.status === 'running' || syncStatus?.status === 'monitoring';

  // Formater la durée
  const formatDuration = (startTime?: string, endTime?: string) => {
    const start = parseApiDate(startTime);
    if (!start) {
      return 'N/A';
    }
    const end = parseApiDate(endTime) ?? new Date();
    const durationMs = Math.max(end.getTime() - start.getTime(), 0);
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const statusLabel = syncStatus?.status?.toUpperCase() || 'IDLE';
  const modeLabel = syncStatus?.mode === 'continuous' ? 'Continuous Mode' : 'Full Sync Mode';
  const totalCves = syncStatus?.total_cves?.toLocaleString() || 'N/A';
  const cycleCount = syncStatus?.cycle_count != null ? syncStatus.cycle_count.toLocaleString() : 'N/A';
  const lastCycleCves = syncStatus?.last_cycle_cves != null ? syncStatus.last_cycle_cves.toLocaleString() : 'N/A';
  const showHistoryCharts = history.length > 1;

  const lineChartData = useMemo(() => {
    if (!showHistoryCharts) return null;
    return history.map((point: NVDSyncHistoryEntry) => point.total_cves ?? 0);
  }, [history, showHistoryCharts]);

  const lineChartLabels = useMemo(() => {
    if (!showHistoryCharts) return null;
    return history.map((point: NVDSyncHistoryEntry) => {
      const parsed = parseApiDate(point.timestamp);
      return parsed ? parsed.toLocaleTimeString() : 'N/A';
    });
  }, [history, parseApiDate, showHistoryCharts]);

  const barChartData = useMemo(() => {
    if (!showHistoryCharts) return null;
    return history.map((point: NVDSyncHistoryEntry) => point.delta ?? 0);
  }, [history, showHistoryCharts]);

  const barChartLabels = lineChartLabels;

  return (
    <Box sx={{ flex: 1, bgcolor: 'grey.100', minHeight: '100%' }}>
      <Container
        maxWidth={false}
        disableGutters
        sx={{ py: 3, px: { xs: 2, sm: 3, lg: 4, xl: 5 } }}
      >
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Stack spacing={1.25}>
              <Breadcrumbs aria-label="breadcrumb">
                <Link component={RouterLink} underline="hover" color="inherit" to="/">
                  Dashboard
                </Link>
                <Typography color="text.primary">Data Enrichment</Typography>
              </Breadcrumbs>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Data Enrichment
                </Typography>
                <Chip
                  icon={getStatusIcon(syncStatus?.status)}
                  label={statusLabel}
                  color={getStatusColor(syncStatus?.status)}
                  sx={{ fontWeight: 600 }}
                />
                {syncStatus?.mode && (
                  <Chip
                    label={modeLabel}
                    variant="outlined"
                    color={syncStatus.mode === 'continuous' ? 'secondary' : 'primary'}
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Synchronize CVE records from the National Vulnerability Database and monitor continuous updates.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last update: {lastUpdate.toLocaleString()}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end" sx={{ rowGap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchStatus}
                disabled={loading}
                sx={{ textTransform: 'none' }}
              >
                Refresh status
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert
              severity="error"
              sx={{ borderRadius: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <Grid container spacing={{ xs: 2, lg: 2.5 }} sx={{ alignItems: 'stretch' }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">
                      CVEs Ingested
                    </Typography>
                    <Avatar variant="rounded" sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
                      <TrendingUp />
                    </Avatar>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {totalCves}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total CVE records synchronized
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">
                      Cycle Count
                    </Typography>
                    <Avatar variant="rounded" sx={{ bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                      <Storage />
                    </Avatar>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {cycleCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Continuous monitoring cycles executed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">
                      Last Cycle CVEs
                    </Typography>
                    <Avatar variant="rounded" sx={{ bgcolor: 'info.light', color: 'info.dark' }}>
                      <Update />
                    </Avatar>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {lastCycleCves}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Records processed in the most recent cycle
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">
                      Last Run Duration
                    </Typography>
                    <Avatar variant="rounded" sx={{ bgcolor: 'warning.light', color: 'warning.dark' }}>
                      <Timelapse />
                    </Avatar>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {formatDuration(syncStatus?.started_at, syncStatus?.completed_at)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Elapsed time for the latest execution
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={{ xs: 2, lg: 2.5 }} sx={{ alignItems: 'stretch' }}>
            <Grid item xs={12} md={8}>
              <Paper
                sx={{
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2.5,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Synchronization Control
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage the ingestion workflow and monitor the current run.
                  </Typography>
                </Box>

                {(syncStatus?.status === 'running' || syncStatus?.status === 'monitoring') && (
                  <Box>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {syncStatus.mode === 'continuous'
                        ? 'Continuous monitoring is active.'
                        : 'Full synchronization in progress.'}
                    </Typography>
                  </Box>
                )}

                <Stack spacing={1.25}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Current message
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {syncStatus?.message || 'No synchronization in progress.'}
                    </Typography>
                  </Box>
                  {syncStatus?.error && (
                    <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                      {syncStatus.error}
                    </Alert>
                  )}
                </Stack>

                <Divider />

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  flexWrap="wrap"
                  sx={{ rowGap: 1 }}
                >
                  {isActive ? (
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Stop />}
                      onClick={handleStopSync}
                      disabled={loading}
                      sx={{ textTransform: 'none' }}
                    >
                      Stop {syncStatus?.mode === 'continuous' ? 'Monitoring' : 'Sync'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                        onClick={() => handleStartSync('full')}
                        disabled={loading}
                        sx={{ textTransform: 'none' }}
                      >
                        Start Full Sync
                      </Button>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CloudSync />}
                        onClick={() => handleStartSync('continuous')}
                        disabled={loading}
                        sx={{ textTransform: 'none' }}
                      >
                        Start Continuous
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchStatus}
                    disabled={loading}
                    sx={{ textTransform: 'none' }}
                  >
                    Refresh status
                  </Button>
                  {syncStatus?.status && !['idle', 'running', 'monitoring'].includes(syncStatus.status) && (
                    <Button
                      variant="outlined"
                      color="info"
                      onClick={handleClearStatus}
                      disabled={loading}
                      sx={{ textTransform: 'none' }}
                    >
                      Clear status
                    </Button>
                  )}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Schedule color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Timeline
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Key timestamps for the latest synchronization.
                  </Typography>
                </Box>

                <Divider />

                <Stack spacing={1.25}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Started at
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDateTime(syncStatus?.started_at, 'Not started')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Completed at
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDateTime(syncStatus?.completed_at, 'Not completed')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Duration
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDuration(syncStatus?.started_at, syncStatus?.completed_at)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Last check
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDateTime(syncStatus?.last_check)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Next check
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDateTime(syncStatus?.next_check)}
                    </Typography>
                  </Box>
                </Stack>

                {syncStatus?.mode === 'continuous' && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Monitoring stats
                      </Typography>
                      <Stack spacing={1.25} sx={{ mt: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Cycle number
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {syncStatus.cycle_count != null ? `#${syncStatus.cycle_count}` : 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Last cycle CVEs
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {syncStatus.last_cycle_cves != null ? syncStatus.last_cycle_cves.toLocaleString() : 'N/A'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2.5}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  CVE Ingestion Trend
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Live trend of total CVEs collected during the current session.
                </Typography>
                {showHistoryCharts && lineChartData && lineChartLabels ? (
                  <LineChart
                    series={[{ data: lineChartData, label: 'Total CVEs', color: '#1d4ed8' }]}
                    xAxis={[{ scaleType: 'point', data: lineChartLabels }]}
                    height={280}
                    slotProps={{ legend: { hidden: true } }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Historical data will appear once the synchronization starts updating.
                  </Typography>
                )}
              </Box>
              <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', xl: 'block' }, mx: { xl: 1 }, my: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Recent Throughput
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  CVEs processed between refreshes (simulates monitoring cycles).
                </Typography>
                {showHistoryCharts && barChartData && barChartLabels ? (
                  <BarChart
                    series={[{ data: barChartData, color: '#0ea5e9', label: 'CVEs / interval' }]}
                    xAxis={[{ scaleType: 'band', data: barChartLabels }]}
                    height={280}
                    slotProps={{ legend: { hidden: true } }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Throughput metrics will populate as new data points are collected.
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Synchronization Modes
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Full synchronization
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Downloads the entire CVE catalog from NVD and stops once complete. Use it for initial setup or to rebuild the dataset.
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Continuous monitoring
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Keeps the sync job running and checks for new or updated CVEs every hour to keep your environment up to date.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Tip: The metrics above refresh automatically while a synchronization is active.
            </Typography>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};

export default DataEnrichment;

