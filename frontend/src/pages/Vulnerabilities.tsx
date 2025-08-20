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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  Card,
  CardContent,
  Avatar,
  useTheme,
  alpha,
  Fade,
  Grow,
} from '@mui/material';
import {
  Search,
  Security,
  Refresh,
  FilterList,
  BugReport,
  Warning,
  CheckCircle,
  Shield,
  TrendingUp,
} from '@mui/icons-material';
import type { VulnerabilityCollection, Vulnerability } from '../services/api';
import { vulnerabilitiesAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './Vulnerabilities.css';

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
  const theme = useTheme();

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

  const getSeverityColorHex = (severity?: string) => {
    if (!severity) return '#9e9e9e';
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return '#d32f2f';
      case 'HIGH':
        return '#ed6c02';
      case 'MEDIUM':
        return '#0288d1';
      case 'LOW':
        return '#2e7d32';
      default:
        return '#9e9e9e';
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

  const getSeverityIcon = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return <BugReport sx={{ color: '#ffffff' }} />;
      case 'HIGH': return <Warning sx={{ color: '#ffffff' }} />;
      case 'MEDIUM': return <Security sx={{ color: '#ffffff' }} />;
      case 'LOW': return <CheckCircle sx={{ color: '#ffffff' }} />;
      default: return <Security sx={{ color: '#ffffff' }} />;
    }
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

  // Calculate stats
  const criticalCount = vulnerabilities.filter(v => {
    const score = v.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                  v.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
                  v.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ||
                  v.score;
    return score && score >= 9.0;
  }).length;

  const highCount = vulnerabilities.filter(v => {
    const score = v.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                  v.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
                  v.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ||
                  v.score;
    return score && score >= 7.0 && score < 9.0;
  }).length;

  if (loading && vulnerabilities.length === 0) {
    return (
      <Box className="vulnerabilities-container" sx={{ 
        width: '100%', 
        maxWidth: 'none', 
        px: 3,
        py: 3,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 64px)'
      }}>
        <Fade in timeout={400}>
          <Typography variant="h4" gutterBottom sx={{ 
            fontWeight: 700,
            color: theme.palette.error.main,
            mb: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Security />
            Vulnerabilities
          </Typography>
        </Fade>
        <Paper className="vulnerability-table-container" sx={{ p: 2 }}>
          {[...Array(10)].map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={60} className="skeleton-row" />
          ))}
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="vulnerabilities-container" sx={{ 
        width: '100%', 
        maxWidth: 'none', 
        px: 3,
        py: 3,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 64px)'
      }}>
        <Typography variant="h4" gutterBottom sx={{ 
          fontWeight: 700,
          color: theme.palette.error.main,
          mb: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Security />
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
    <Box className="vulnerabilities-container" sx={{ 
      width: '100%', 
      maxWidth: 'none', 
      px: 3,
      py: 3,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 64px)'
    }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" sx={{ 
            fontWeight: 700,
            color: theme.palette.error.main,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Security />
            Vulnerabilities ({total.toLocaleString()})
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchVulnerabilities}
            disabled={loading}
            className="filter-button"
            sx={{
              borderColor: theme.palette.error.main,
              color: theme.palette.error.main,
              '&:hover': {
                borderColor: theme.palette.error.dark,
                bgcolor: alpha(theme.palette.error.main, 0.05)
              }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Fade>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%', maxWidth: 'none' }}>
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={800}>
            <Card className="stats-card">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Total
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                      {total.toLocaleString()}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.primary.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <Shield />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1000}>
            <Card className="stats-card">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Critical
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
                      {criticalCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.error.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <BugReport />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1200}>
            <Card className="stats-card">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      High
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                      {highCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.warning.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <Warning />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1400}>
            <Card className="stats-card">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Current Page
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.info.main }}>
                      {vulnerabilities.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.info.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <TrendingUp />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Fade in timeout={1600}>
        <Paper className="search-container" sx={{ 
          mb: 3, 
          p: 3, 
          position: 'sticky', 
          top: 0, 
          zIndex: 10
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
              <Button 
                variant="contained" 
                onClick={submitSearch}
                className="filter-button"
                sx={{ 
                  minWidth: 120,
                  bgcolor: theme.palette.error.main,
                  '&:hover': {
                    bgcolor: theme.palette.error.dark
                  }
                }}
              >
                Search
              </Button>
            </Box>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={severityFilter}
                  label="Severity"
                  onChange={handleSeverityFilterChange}
                  sx={{ borderRadius: 2 }}
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
                  sx={{ borderRadius: 2 }}
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
                className="filter-button"
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
        </Paper>
      </Fade>

      {/* Vulnerabilities Table */}
      <Fade in timeout={1800}>
        <TableContainer component={Paper} className="vulnerability-table-container">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 600 }}>CVE ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>CVSS Score</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Published</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>References</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(vulnerabilities || []).map((vuln, index) => {
                const description = vuln.descriptions?.find(d => d.lang === 'en')?.value || 
                                   vuln.descriptions?.[0]?.value || 
                                   vuln.description || 
                                   'No description available';
                
                const baseScore = vuln.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                                 vuln.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
                                 vuln.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore ||
                                 vuln.score;

                const severity = getSeverityLabel(baseScore);

                return (
                  <Grow in timeout={2000 + index * 100} key={vuln.id}>
                    <TableRow 
                      hover
                      onClick={() => handleRowClick(vuln.id)}
                      className="vulnerability-table-row"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.error.main, 0.05)
                        }
                      }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ 
                            bgcolor: getSeverityColorHex(severity),
                            width: 32,
                            height: 32
                          }}>
                            {getSeverityIcon(severity)}
                          </Avatar>
                          <Typography variant="subtitle2" color="primary" fontWeight="medium">
                            {vuln.id}
                          </Typography>
                        </Box>
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
                            label={baseScore.toFixed(1)}
                            className="severity-chip"
                            sx={{
                              bgcolor: getSeverityColorHex(severity),
                              color: '#ffffff',
                              fontWeight: 600
                            }}
                            size="small"
                          />
                        ) : (
                          <Chip label="No Score" variant="outlined" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={severity}
                          className="severity-chip"
                          sx={{
                            bgcolor: alpha(getSeverityColorHex(severity), 0.1),
                            color: getSeverityColorHex(severity),
                            border: `1px solid ${getSeverityColorHex(severity)}`,
                            fontWeight: 600
                          }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {vuln.published ? 
                            new Date(vuln.published).toLocaleDateString('fr-FR') : 
                            (vuln.published_date ? new Date(vuln.published_date).toLocaleDateString('fr-FR') : 'Unknown')
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={vuln.references?.length || 0}
                          variant="outlined"
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                    </TableRow>
                  </Grow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Fade>

      {/* Empty State */}
      {vulnerabilities.length === 0 && !loading && (
        <Fade in timeout={2000}>
          <Paper className="empty-state" sx={{ p: 6, textAlign: 'center', mt: 2 }}>
            <Security sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
              No vulnerabilities found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {searchTerm
                ? 'Try modifying your search term or clearing filters'
                : 'No vulnerabilities are currently in the database'
              }
            </Typography>
          </Paper>
        </Fade>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Fade in timeout={2200}>
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="large"
              sx={{
                '& .MuiPaginationItem-root': {
                  borderRadius: 2,
                  fontWeight: 500
                }
              }}
            />
          </Box>
        </Fade>
      )}
    </Box>
  );
};

export default Vulnerabilities;