import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  Alert,
  Skeleton,
  Button,
  Pagination,
  Link,
} from '@mui/material';
import {
  Search,
  Security,
  Refresh,
  OpenInNew,
} from '@mui/icons-material';
import type { VulnerabilityCollection, Vulnerability } from '../services/api';
import { vulnerabilitiesAPI } from '../services/api';

const Vulnerabilities: React.FC = () => {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchVulnerabilities();
  }, [page, searchTerm]);

  const fetchVulnerabilities = async () => {
    try {
      setLoading(true);
      const skip = (page - 1) * itemsPerPage;
      const data = await vulnerabilitiesAPI.getAll(skip, itemsPerPage, searchTerm || undefined);
      setVulnerabilities(data.items);
      setTotal(data.total);
    } catch (err: any) {
      console.error('Error loading vulnerabilities:', err);
      setError('Error loading vulnerabilities');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity?: string) => {
    if (!severity) return 'default';
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatScore = (score?: number) => {
    if (!score) return 'N/A';
    return score.toFixed(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page when searching
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  if (loading && vulnerabilities.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Vulnerabilities
        </Typography>
        <Paper sx={{ p: 2 }}>
          {[...Array(10)].map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={60} sx={{ mb: 1 }} />
          ))}
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Vulnerabilities
        </Typography>
        <Alert severity="error" action={
          <Button onClick={fetchVulnerabilities} startIcon={<Refresh />}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Vulnerabilities ({total.toLocaleString()})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchVulnerabilities}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ 
        mb: 3, 
        p: 2, 
        position: 'sticky', 
        top: 0, 
        zIndex: 10,
        bgcolor: 'background.paper',
        boxShadow: 1
      }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by CVE ID or description..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>CVE ID</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>CVSS Score</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Published</TableCell>
              <TableCell>Affected Products</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vulnerabilities.map((vuln) => (
              <TableRow key={vuln.id} hover>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    fontFamily="monospace"
                    fontWeight="medium"
                    color="primary"
                  >
                    {vuln.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 400 }}>
                    {vuln.description.length > 150 
                      ? `${vuln.description.substring(0, 150)}...` 
                      : vuln.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {formatScore(vuln.score)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={vuln.severity || 'Unknown'}
                    color={getSeverityColor(vuln.severity)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(vuln.published_date).toLocaleDateString('en-US')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {vuln.configurations.length} product(s)
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {vulnerabilities.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No vulnerabilities found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? 'Try modifying your search term'
              : 'No vulnerabilities are currently in the database'
            }
          </Typography>
        </Paper>
      )}

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
        </Box>
      )}
    </Box>
  );
};

export default Vulnerabilities; 