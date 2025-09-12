import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Computer,
  Add,
} from '@mui/icons-material';
import type { VulnerabilityCollection, Vulnerability } from '../services/api';
import { vulnerabilitiesAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getAffectedProductsSummary } from '../utils/cpeUtils';
import './Vulnerabilities.css';

// Simple browser-safe random ID generator for matchCriteriaId
function genRandomId(): string {
  try {
    // Modern browsers
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      // @ts-ignore
      return (crypto as any).randomUUID();
    }
    // Fallback using getRandomValues
    // @ts-ignore
    if (typeof crypto !== 'undefined' && typeof (crypto as any).getRandomValues === 'function') {
      const arr = new Uint32Array(4);
      // @ts-ignore
      (crypto as any).getRandomValues(arr);
      return Array.from(arr).map(v => v.toString(16).padStart(8, '0')).join('');
    }
  } catch {}
  // Last resort
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

const Vulnerabilities: React.FC = () => {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [kpiSeverity, setKpiSeverity] = useState<{CRITICAL?: number; HIGH?: number; MEDIUM?: number; LOW?: number}>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Form fields for manual creation
  const [newId, setNewId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBaseScore, setNewBaseScore] = useState<string>('');
  const [newBaseSeverity, setNewBaseSeverity] = useState<string>('MEDIUM');
  const [newVector, setNewVector] = useState<string>('');
  const [newExploitability, setNewExploitability] = useState<string>('');
  const [newImpact, setNewImpact] = useState<string>('');
  const [newPublished, setNewPublished] = useState<string>('');
  const [newLastModified, setNewLastModified] = useState<string>('');
  const [newStatus, setNewStatus] = useState<string>('Analyzed');
  const [newReferenceUrl, setNewReferenceUrl] = useState<string>('');
  const [newAdditionalRefs, setNewAdditionalRefs] = useState<string>('');
  // Affected products (CPE URIs, one per line)
  const [affectedCPEs, setAffectedCPEs] = useState<string>('');

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
        limit: itemsPerPage,
        severity: severityFilter ? severityFilter.toUpperCase() : undefined,
        published: dateFilter || undefined,
      });
      
      setVulnerabilities(response.vulnerabilities);
      setTotal(response.total);
      setKpiSeverity(response.total_by_severity || {});

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

  const submitSearch = () => {
    const value = searchInputRef.current?.value ?? '';
    setSearchTerm(value);
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
    if (searchInputRef.current) searchInputRef.current.value = '';
    setPage(1);
  };

  // Calculate stats
  const criticalCount = kpiSeverity.CRITICAL ?? 0;
  const highCount = kpiSeverity.HIGH ?? 0;

  // Compute pagination and memoized table BEFORE any early returns (Rules of Hooks)
  const tableContent = useMemo(() => (
    <Fade in timeout={1800}>
      <TableContainer component={Paper} className="vulnerability-table-container">
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell sx={{ fontWeight: 600 }}>CVE ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Affected Products</TableCell>
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
              const productsSummary = getAffectedProductsSummary(vuln.configurations || []);

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
                          maxWidth: 350,
                        }}
                      >
                        {description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={productsSummary}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Computer sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 200,
                              fontSize: '0.875rem'
                            }}
                          >
                            {productsSummary}
                          </Typography>
                        </Box>
                      </Tooltip>
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
  ), [vulnerabilities, theme]);

  const totalPages = Math.ceil(total / itemsPerPage);

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

  // Duplicate declarations removed (tableContent/totalPages are defined earlier)

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
          <Box display="flex" gap={2}>
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
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                // Pre-fill ISO dates if empty for convenience
                const nowIso = new Date().toISOString();
                if (!newPublished) setNewPublished(nowIso);
                if (!newLastModified) setNewLastModified(nowIso);
                setCreateError(null);
                setCreateOpen(true);
              }}
              sx={{ bgcolor: theme.palette.error.main, '&:hover': { bgcolor: theme.palette.error.dark } }}
            >
              Add Vulnerability
            </Button>
          </Box>
        </Box>
      </Fade>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4, width: '100%', maxWidth: 'none' }}>
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={800}>
            <Card className="stats-card">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2}>
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
                    height: 50,
                    ml: 'auto'
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
                <Box display="flex" alignItems="center" gap={2}>
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
                    height: 50,
                    ml: 'auto'
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
                <Box display="flex" alignItems="center" gap={2}>
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
                    height: 50,
                    ml: 'auto'
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
                <Box display="flex" alignItems="center" gap={2}>
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
                    height: 50,
                    ml: 'auto'
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
                inputRef={searchInputRef}
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
                disabled={!severityFilter && !dateFilter && !searchTerm}
                className="filter-button"
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
        </Paper>
      </Fade>

      {/* Vulnerabilities Table (memoized) */}
      {tableContent}

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

      {/* Create Vulnerability Dialog */}
      <Dialog open={createOpen} onClose={() => !createSubmitting && setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Vulnerability (manual)</DialogTitle>
        <DialogContent dividers>
          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>
          )}
          <Grid container spacing={2}>
            {/* Identity and status */}
            <Grid item xs={12} sm={6}>
              <TextField label="CVE ID" fullWidth required value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="CVE-2025-12345" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Status" fullWidth required value={newStatus} onChange={(e) => setNewStatus(e.target.value)} />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField label="English Description" fullWidth required multiline minRows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            </Grid>

            {/* CVSS Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">CVSS (v3.x)</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Base Score (0.0 - 10.0)" type="number" inputProps={{ step: '0.1', min: 0, max: 10 }} fullWidth required value={newBaseScore} onChange={(e) => setNewBaseScore(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select label="Severity" value={newBaseSeverity} onChange={(e) => setNewBaseSeverity(String(e.target.value))}>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Vector String (e.g., AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)" fullWidth value={newVector} onChange={(e) => setNewVector(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Exploitability Score (optional)" type="number" inputProps={{ step: '0.1', min: 0 }} fullWidth value={newExploitability} onChange={(e) => setNewExploitability(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Impact Score (optional)" type="number" inputProps={{ step: '0.1', min: 0 }} fullWidth value={newImpact} onChange={(e) => setNewImpact(e.target.value)} />
            </Grid>

            {/* Affected products */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Affected Products (CPE URIs, one per line)</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                placeholder="cpe:2.3:a:vendor:product:version:*:*:*:*:*:*:*\n..."
                fullWidth
                multiline
                minRows={3}
                value={affectedCPEs}
                onChange={(e) => setAffectedCPEs(e.target.value)}
                helperText="Enter CPE 2.3 criteria per line. Version range fields can be left to be interpreted from CPE version."
              />
            </Grid>

            {/* References and dates */}
            <Grid item xs={12} sm={6}>
              <TextField label="Primary Reference URL" type="url" fullWidth required value={newReferenceUrl} onChange={(e) => setNewReferenceUrl(e.target.value)} placeholder="https://example.com/advisory" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Additional References (one per line)" fullWidth multiline minRows={2} value={newAdditionalRefs} onChange={(e) => setNewAdditionalRefs(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Published (ISO)" fullWidth required value={newPublished} onChange={(e) => setNewPublished(e.target.value)} placeholder={new Date().toISOString()} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Last Modified (ISO)" fullWidth required value={newLastModified} onChange={(e) => setNewLastModified(e.target.value)} placeholder={new Date().toISOString()} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={createSubmitting}>Cancel</Button>
          <Button variant="contained" disabled={createSubmitting} onClick={async () => {
            setCreateError(null);
            // Basic validation
            if (!newId || !newDescription || !newBaseScore || !newPublished || !newLastModified || !newReferenceUrl) {
              setCreateError('Please fill all required fields.');
              return;
            }
            // Quick URL validation
            try {
              const u = new URL(newReferenceUrl);
              if (!u.protocol.startsWith('http')) throw new Error('Invalid protocol');
            } catch {
              setCreateError('Reference URL must be a valid http(s) URL');
              return;
            }
            const baseScoreNum = parseFloat(newBaseScore);
            if (isNaN(baseScoreNum) || baseScoreNum < 0 || baseScoreNum > 10) {
              setCreateError('Base score must be between 0.0 and 10.0');
              return;
            }
            const exploitabilityNum = newExploitability ? parseFloat(newExploitability) : undefined;
            const impactNum = newImpact ? parseFloat(newImpact) : undefined;
            if (newExploitability && isNaN(Number(newExploitability))) {
              setCreateError('Exploitability score must be a number');
              return;
            }
            if (newImpact && isNaN(Number(newImpact))) {
              setCreateError('Impact score must be a number');
              return;
            }
            setCreateSubmitting(true);
            try {
              // Build references array (primary + additional)
              const references = [newReferenceUrl, ...newAdditionalRefs.split(/\r?\n/).map(s => s.trim()).filter(Boolean)]
                .map(url => ({ url, source: 'MANUAL' }));

              // Build configurations from CPE list
              const cpeLines = affectedCPEs.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
              const cpeMatch = cpeLines.map((criteria) => ({
                vulnerable: true,
                criteria,
                matchCriteriaId: genRandomId(),
              }));

              const payload: any = {
                id: newId.trim(),
                sourceIdentifier: 'manual',
                published: newPublished,
                lastModified: newLastModified,
                vulnStatus: newStatus,
                descriptions: [{ lang: 'en', value: newDescription.trim() }],
                metrics: {
                  cvssMetricV31: [
                    {
                      source: 'MANUAL',
                      type: 'Primary',
                      cvssData: {
                        version: '3.1',
                        vectorString: newVector,
                        baseScore: baseScoreNum,
                        baseSeverity: newBaseSeverity,
                      },
                      ...(exploitabilityNum !== undefined ? { exploitabilityScore: exploitabilityNum } : {}),
                      ...(impactNum !== undefined ? { impactScore: impactNum } : {}),
                    },
                  ],
                },
                weaknesses: [],
                configurations: cpeMatch.length ? [{ nodes: [{ operator: 'OR', negate: false, cpeMatch }] }] : [],
                references,
              };
              await vulnerabilitiesAPI.create(payload);
              setCreateOpen(false);
              // reset form
              setNewId('');
              setNewDescription('');
              setNewBaseScore('');
              setNewBaseSeverity('MEDIUM');
              setNewVector('');
              setNewExploitability('');
              setNewImpact('');
              setNewPublished('');
              setNewLastModified('');
              setNewStatus('Analyzed');
              setNewReferenceUrl('');
              setNewAdditionalRefs('');
              setAffectedCPEs('');
              // refresh list
              fetchVulnerabilities();
            } catch (e: any) {
              console.error(e);
              setCreateError(e?.response?.data?.detail || 'Failed to create vulnerability');
            } finally {
              setCreateSubmitting(false);
            }
          }}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vulnerabilities;