import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  CloudSync,
  CheckCircle,
  Error as ErrorIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { nvdSyncAPI } from '../services/api';
import type { NVDSyncStatus } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DataEnrichment: React.FC = () => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<NVDSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Vérifier si l'utilisateur est admin
  if (user?.role !== 'admin') {
    return (
      <Box p={3}>
        <Alert severity="error">
          Access denied. This page is reserved for administrators.
        </Alert>
      </Box>
    );
  }

  // Fonction pour récupérer le statut
  const fetchStatus = async () => {
    try {
      const status = await nvdSyncAPI.getStatus();
      setSyncStatus(status);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error fetching synchronization status');
    }
  };

  // Charger le statut au montage
  useEffect(() => {
    fetchStatus();
  }, []);

  // Polling automatique quand la synchronisation est en cours ou en monitoring
  useEffect(() => {
    if (syncStatus?.status === 'running' || syncStatus?.status === 'monitoring') {
      const interval = setInterval(() => {
        fetchStatus();
      }, 2000); // Mise à jour toutes les 2 secondes

      return () => clearInterval(interval);
    }
  }, [syncStatus?.status]);

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
    if (!startTime) return 'N/A';
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" component="h1" gutterBottom>
        Data Enrichment
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Synchronize CVE data from the National Vulnerability Database (NVD)
      </Typography>

      {/* Erreurs */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Carte principale de statut */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">
                  NVD Synchronization
                </Typography>
                <Chip
                  icon={getStatusIcon(syncStatus?.status)}
                  label={syncStatus?.status?.toUpperCase() || 'IDLE'}
                  color={getStatusColor(syncStatus?.status)}
                  size="small"
                />
              </Box>

              <Divider />

              {(syncStatus?.status === 'running' || syncStatus?.status === 'monitoring') && (
                <Box>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {syncStatus.mode === 'continuous' 
                      ? 'Continuous monitoring active...' 
                      : 'Full synchronization in progress...'}
                  </Typography>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary">
                {syncStatus?.message || 'No synchronization in progress'}
              </Typography>
              
              {syncStatus?.mode === 'continuous' && syncStatus?.status === 'monitoring' && (
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Monitoring Details:</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Cycle #{syncStatus.cycle_count || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Last check: {syncStatus.last_check ? new Date(syncStatus.last_check).toLocaleTimeString() : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Next check: {syncStatus.next_check ? new Date(syncStatus.next_check).toLocaleTimeString() : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Last cycle CVEs: {syncStatus.last_cycle_cves || 0}
                  </Typography>
                </Box>
              )}

              {syncStatus?.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <strong>Error:</strong> {syncStatus.error}
                </Alert>
              )}

              <Box display="flex" gap={2} mt={2} flexWrap="wrap">
                {isActive ? (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<Stop />}
                    onClick={handleStopSync}
                    disabled={loading}
                  >
                    Stop {syncStatus?.mode === 'continuous' ? 'Monitoring' : 'Synchronization'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                      onClick={() => handleStartSync('full')}
                      disabled={loading}
                    >
                      Full Synchronization
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={loading ? <CircularProgress size={20} /> : <CloudSync />}
                      onClick={() => handleStartSync('continuous')}
                      disabled={loading}
                    >
                      Start Continuous Monitoring
                    </Button>
                  </>
                )}

                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchStatus}
                  disabled={loading}
                >
                  Refresh
                </Button>

                {syncStatus?.status && !['idle', 'running', 'monitoring'].includes(syncStatus.status) && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleClearStatus}
                    disabled={loading}
                  >
                    Clear Status
                  </Button>
                )}
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* KPI Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Typography variant="h6" color="white" gutterBottom>
                CVEs Ingested
              </Typography>
              <Typography variant="h2" color="white" sx={{ fontWeight: 'bold', mb: 2 }}>
                {syncStatus?.total_cves?.toLocaleString() || '0'}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Total CVE records synchronized
              </Typography>
              {(syncStatus?.status === 'running' || syncStatus?.status === 'monitoring') && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="rgba(255,255,255,0.8)">
                    Live update - Last refresh: {lastUpdate.toLocaleTimeString()}
                  </Typography>
                  {syncStatus?.mode === 'continuous' && (
                    <Typography variant="caption" color="rgba(255,255,255,0.8)" display="block">
                      Mode: Continuous Monitoring
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Informations supplémentaires */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Synchronization Details
            </Typography>
            <Grid container spacing={2} mt={1}>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Started At
                  </Typography>
                  <Typography variant="body1">
                    {syncStatus?.started_at
                      ? new Date(syncStatus.started_at).toLocaleString()
                      : 'N/A'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Completed At
                  </Typography>
                  <Typography variant="body1">
                    {syncStatus?.completed_at
                      ? new Date(syncStatus.completed_at).toLocaleString()
                      : 'N/A'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography variant="body1">
                    {formatDuration(syncStatus?.started_at, syncStatus?.completed_at)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                    {syncStatus?.status || 'Idle'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Informations d'aide */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2" gutterBottom>
              <strong>Two Synchronization Modes:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              • <strong>Full Synchronization:</strong> Downloads all CVE data from NVD and stops when complete. 
              Use this for the initial setup or to perform a complete refresh.
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 1 }}>
              • <strong>Continuous Monitoring:</strong> Stays active and checks for new/updated CVEs every hour. 
              This mode is designed to run continuously and keep your database up-to-date automatically.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              The counter above updates in real-time during synchronization.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DataEnrichment;

