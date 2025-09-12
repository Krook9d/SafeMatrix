import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
} from '@mui/material';
import { Refresh, CheckCircle, DoneAll, OpenInNew } from '@mui/icons-material';
import { alertsAPI } from '../services/api';
import type { AlertItem, AlertListResponse, AlertStatus } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
// Use native Date formatting to avoid extra dependency

const statusColors: Record<AlertStatus, 'default' | 'success' | 'warning' | 'info'> = {
  open: 'warning',
  acknowledged: 'info',
  resolved: 'success',
};

const AlertsPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState(0);

  // Filters and pagination
  const [status, setStatus] = useState<AlertStatus | ''>('');
  const [hostId, setHostId] = useState('');
  const [software, setSoftware] = useState('');
  const [cveId, setCveId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { skip: (page - 1) * pageSize, limit: pageSize };
      if (status) params.status = status;
      if (hostId.trim()) params.host_id = hostId.trim();
      if (software.trim()) params.software = software.trim();
      if (cveId.trim()) params.cve_id = cveId.trim();
      const res: AlertListResponse = await alertsAPI.list(params);
      setAlerts(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, pageSize]);

  const handleUpdateStatus = async (id: string, newStatus: AlertStatus) => {
    try {
      await alertsAPI.updateStatus(id, newStatus);
      // Optimistic update
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, status: newStatus } : a)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">Alerts</Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchAlerts}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as AlertStatus | '');
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="acknowledged">Acknowledged</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </TextField>
            <TextField label="Host ID" value={hostId} onChange={(e) => setHostId(e.target.value)} />
            <TextField label="Software" value={software} onChange={(e) => setSoftware(e.target.value)} />
            <TextField label="CVE ID" value={cveId} onChange={(e) => setCveId(e.target.value)} />
            <Button variant="contained" onClick={() => { setPage(1); fetchAlerts(); }}>Filter</Button>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Paper sx={{ p: 2, mb: 2, color: 'error.main' }}>
          <Typography variant="body2">{error}</Typography>
        </Paper>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Host</TableCell>
                      <TableCell>Software</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>CVE</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow key={a._id} hover>
                        <TableCell>
                          <Chip label={a.status} color={statusColors[a.status] || 'default'} size="small" />
                        </TableCell>
                        <TableCell>{a.host_id}</TableCell>
                        <TableCell>{a.software_name}</TableCell>
                        <TableCell>{a.version}</TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2">{a.cve_id}</Typography>
                            {a.url && (
                              <Tooltip title="Open reference">
                                <IconButton size="small" component="a" href={a.url} target="_blank" rel="noopener noreferrer">
                                  <OpenInNew fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>{a.score ?? '-'}</TableCell>
                        <TableCell>{a.created_at ? new Date(a.created_at).toLocaleString() : '-'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Acknowledge">
                            <span>
                              <IconButton size="small" onClick={() => handleUpdateStatus(a._id, 'acknowledged')} disabled={a.status !== 'open'}>
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Resolve">
                            <span>
                              <IconButton size="small" onClick={() => handleUpdateStatus(a._id, 'resolved')} disabled={a.status === 'resolved'}>
                                <DoneAll fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {alerts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                            No alerts found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {total} total alerts
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    select
                    size="small"
                    label="Page size"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    sx={{ width: 140 }}
                  >
                    {[10, 25, 50, 100].map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </TextField>
                  <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                </Stack>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AlertsPage;
