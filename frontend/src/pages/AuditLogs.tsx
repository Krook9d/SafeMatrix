import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Grid
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';

interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  details: string;
  ip_address: string;
  success?: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const { user } = useAuth();

  const fetchLogs = async (offset: number = 0, limit: number = 25) => {
    try {
      setLoading(true);
      let url = `/api/v1/audit-logs?offset=${offset}&limit=${limit}`;
      if (levelFilter) {
        url += `&level=${levelFilter}`;
      }
      if (dateFilter) {
        url += `&date=${dateFilter}`;
      }
      const response = await apiClient.get<AuditLogsResponse>(url);
      setLogs(response.data.logs);
      setTotal(response.data.total);
      setError(null);
    } catch (error) {
      console.error('Erreur lors du chargement des logs:', error);
      setError('Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page * rowsPerPage, rowsPerPage);
  }, [page, rowsPerPage, levelFilter, dateFilter]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleLevelFilterChange = (event: any) => {
    setLevelFilter(event.target.value);
    setPage(0);
  };

  const handleDateFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateTimeValue = event.target.value;
    // Convert datetime-local format to our log format for filtering
    const formattedDate = dateTimeValue.replace('T', ' ');
    setDateFilter(formattedDate);
    setPage(0);
  };

  const clearFilters = () => {
    setLevelFilter('');
    setDateFilter('');
    setPage(0);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INFO': return 'info';
      case 'WARNING': return 'warning';
      case 'ERROR': return 'error';
      case 'CRITICAL': return 'error';
      case 'DEBUG': return 'default';
      case 'LOGIN': return 'info';
      case 'CREATE': return 'success';
      case 'UPDATE': return 'warning';
      case 'DELETE': return 'error';
      case 'VIEW': return 'default';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    // Handle format like '2025-09-04 17:59:16,245' by converting to ISO format
    const isoTimestamp = timestamp.replace(' ', 'T').replace(',', '.') + 'Z';
    return new Date(isoTimestamp).toLocaleString('en-US');
  };

  if (user?.role !== 'admin') {
    return (
      <Box p={3}>
        <Alert severity="error">
          Access denied. This page is reserved for administrators.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" component="h1" gutterBottom>
        Server Logs
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Backend server logs and system activity
      </Typography>

      {/* Filters Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel>Log Level</InputLabel>
              <Select
                value={levelFilter}
                label="Log Level"
                onChange={handleLevelFilterChange}
              >
                <MenuItem value="">
                  <em>All Levels</em>
                </MenuItem>
                <MenuItem value="INFO">INFO</MenuItem>
                <MenuItem value="WARNING">WARNING</MenuItem>
                <MenuItem value="ERROR">ERROR</MenuItem>
                <MenuItem value="CRITICAL">CRITICAL</MenuItem>
                <MenuItem value="DEBUG">DEBUG</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              size="small"
              label="Filter by Date & Time"
              type="datetime-local"
              value={dateFilter}
              onChange={handleDateFilterChange}
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                step: 60, // Allow minute precision
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="outlined"
              onClick={clearFilters}
              fullWidth
              size="small"
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date/Time</TableCell>
                <TableCell>Logger</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTimestamp(log.timestamp)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {log.user}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={log.action}
                      color={getActionColor(log.action) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.resource || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.details}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Rows per page:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
        />
      </Paper>
    </Box>
  );
};

export default AuditLogs;