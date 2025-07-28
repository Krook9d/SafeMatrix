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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Search,
  Security,
  Refresh,
  OpenInNew,
  FilterList,
} from '@mui/icons-material';
import type { VulnerabilityCollection, Vulnerability } from '../services/api';
import { vulnerabilitiesAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Vulnerabilities: React.FC = () => {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const itemsPerPage = 100;
  const navigate = useNavigate();

  useEffect(() => {
    fetchVulnerabilities();
  }, [page, searchTerm, severityFilter, dateFilter]);

  const fetchVulnerabilities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const skip = (page - 1) * itemsPerPage;
      const response = await vulnerabilitiesAPI.getAll({
        search: searchTerm || undefined,
        skip: skip,
        limit: itemsPerPage
      });
      
      // Apply client-side filtering for now (can be moved to backend later)
      let filteredVulns = response.vulnerabilities;
      
      if (severityFilter) {
        filteredVulns = filteredVulns.filter(vuln => {
          const severity = getSeverityLabel(vuln.score);
          return severity.toLowerCase() === severityFilter.toLowerCase();
        });
      }
      
      if (dateFilter) {
        const filterDate = new Date();
        switch (dateFilter) {
          case 'last7days':
            filterDate.setDate(filterDate.getDate() - 7);
            break;
          case 'last30days':
            filterDate.setDate(filterDate.getDate() - 30);
            break;
          case 'last90days':
            filterDate.setDate(filterDate.getDate() - 90);
            break;
        }
        
        if (dateFilter !== 'all') {
          filteredVulns = filteredVulns.filter(vuln => {
            if (!vuln.published_date) return false;
            const publishedDate = new Date(vuln.published_date);
            return publishedDate >= filterDate;
          });
        }
      }
      
      setVulnerabilities(filteredVulns);
      setTotal(response.total);
    } catch (err: any) {
      console.error('Error loading vulnerabilities:', err);
      setError('Failed to load vulnerabilities');
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

  const getSeverityColorFromScore = (score?: number) => {
    if (!score) return 'default';
    if (score >= 9.0) return 'error';
    if (score >= 7.0) return 'warning';
    if (score >= 4.0) return 'info';
    return 'success';
  };

  const getSeverityLabel = (score?: number) => {
    if (!score) return 'Unknown';
    if (score >= 9.0) return 'Critical';
    if (score >= 7.0) return 'High';
    if (score >= 4.0) return 'Medium';
    return 'Low';
  };

  const formatScore = (score?: number) => {
    if (!score) return 'N/A';
    return score.toFixed(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  const submitSearch = () => {
    setSearchTerm(searchInput);
    setPage(1); // Reset to first page when searching
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handleRowClick = (cveId: string) => {
    navigate(`/vulnerabilities/${cveId}`);
  };

  const handleSeverityFilterChange = (event: SelectChangeEvent<string>) => {
    setSeverityFilter(event.target.value);
    setPage(1);
  };

  const handleDateFilterChange = (event: SelectChangeEvent<string>) => {
    setDateFilter(event.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSeverityFilter('');
    setDateFilter('');
    setSearchTerm('');
    setSearchInput('');
    setPage(1);
  };

  if (loading && vulnerabilities.length === 0) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
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
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
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
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
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
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by CVE ID or description..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <Button variant="contained" onClick={submitSearch}>Search</Button>
          </Box>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={handleSeverityFilterChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Published</InputLabel>
              <Select
                value={dateFilter}
                label="Published"
                onChange={handleDateFilterChange}
              >
                <MenuItem value="">All time</MenuItem>
                <MenuItem value="last7days">Last 7 days</MenuItem>
                <MenuItem value="last30days">Last 30 days</MenuItem>
                <MenuItem value="last90days">Last 90 days</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={clearFilters}
              disabled={!severityFilter && !dateFilter && !searchTerm && !searchInput}
            >
              Clear Filters
            </Button>
          </Box>
        </Box>
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
              <TableCell>References</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(vulnerabilities || []).map((vuln) => {
              const description = vuln.descriptions?.find(d => d.lang === 'en')?.value || 
                                 vuln.descriptions?.[0]?.value || 
                                 vuln.description || 
                                 'No description available';
              
              const baseScore = vuln.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                               vuln.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
                               vuln.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ||
                               vuln.score;

              return (
                <TableRow 
                  key={vuln.id} 
                  hover
                  onClick={() => handleRowClick(vuln.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="subtitle2" color="primary" fontWeight="medium">
                      {vuln.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 400,
                      }}
                    >
                      {description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {baseScore ? (
                      <Chip
                        label={`${baseScore.toFixed(1)} ${getSeverityLabel(baseScore)}`}
                        color={getSeverityColorFromScore(baseScore) as any}
                        size="small"
                      />
                    ) : (
                      <Chip label="No Score" variant="outlined" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {vuln.published ? 
                        new Date(vuln.published).toLocaleDateString() : 
                        (vuln.published_date ? new Date(vuln.published_date).toLocaleDateString() : 'Unknown')
                      }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {vuln.references?.length || 0}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
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