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
  Avatar,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Search,
  Inventory2,
  Refresh,
  ExpandMore,
  ExpandLess,
  Computer,
  Security,
  BugReport,
} from '@mui/icons-material';
import type { SoftwareSummary, Inventory } from '../services/api';
import { inventoryAPI } from '../services/api';

const InventoryPage: React.FC = () => {
  const [softwareSummary, setSoftwareSummary] = useState<SoftwareSummary[]>([]);
  const [filteredSoftware, setFilteredSoftware] = useState<SoftwareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSoftware, setExpandedSoftware] = useState<string | null>(null);
  const [softwareDetails, setSoftwareDetails] = useState<Inventory[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchSoftwareSummary();
  }, []);

  useEffect(() => {
    // Filter software based on search term
    const filtered = softwareSummary.filter(software =>
      software.software_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSoftware(filtered);
  }, [softwareSummary, searchTerm]);

  const fetchSoftwareSummary = async () => {
    try {
      const data = await inventoryAPI.getSoftwareSummary();
      setSoftwareSummary(data);
    } catch (err: any) {
      console.error('Error loading software summary:', err);
      setError('Error loading software inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchSoftwareDetails = async (softwareName: string) => {
    try {
      setLoadingDetails(true);
      const data = await inventoryAPI.getAll(undefined, 0, 100);
      // Filter by software name on frontend since backend doesn't have this filter yet
      const filtered = data.filter(item => item.software_name === softwareName);
      setSoftwareDetails(filtered);
    } catch (err: any) {
      console.error('Error loading software details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExpandSoftware = async (softwareName: string) => {
    if (expandedSoftware === softwareName) {
      setExpandedSoftware(null);
      setSoftwareDetails([]);
    } else {
      setExpandedSoftware(softwareName);
      await fetchSoftwareDetails(softwareName);
    }
  };

  const getRiskLevel = (vulnerabilityCount: number) => {
    if (vulnerabilityCount === 0) return { color: 'success', level: 'Low' };
    if (vulnerabilityCount < 5) return { color: 'warning', level: 'Medium' };
    return { color: 'error', level: 'High' };
  };

  const getSoftwareIcon = (softwareName: string) => {
    const name = softwareName.toLowerCase();
    if (name.includes('microsoft') || name.includes('windows')) return '🪟';
    if (name.includes('chrome') || name.includes('browser')) return '🌐';
    if (name.includes('java')) return '☕';
    if (name.includes('python')) return '🐍';
    if (name.includes('node')) return '🟢';
    if (name.includes('docker')) return '🐳';
    if (name.includes('git')) return '📁';
    return '📦';
  };

  if (loading && softwareSummary.length === 0) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
        <Typography variant="h4" gutterBottom>
          Software Inventory
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
          Software Inventory
        </Typography>
        <Alert severity="error" action={
          <Button onClick={fetchSoftwareSummary} startIcon={<Refresh />}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Software Inventory ({filteredSoftware.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchSoftwareSummary}
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
          placeholder="Search software by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
              <TableCell>Software</TableCell>
              <TableCell align="center">Installations</TableCell>
              <TableCell align="center">Versions</TableCell>
              <TableCell>Latest Version</TableCell>
              <TableCell align="center">Hosts</TableCell>
              <TableCell align="center">Vulnerabilities</TableCell>
              <TableCell align="center">Risk Level</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSoftware.map((software) => {
              const riskInfo = getRiskLevel(software.vulnerability_count);
              const isExpanded = expandedSoftware === software.software_name;
              
              return (
                <React.Fragment key={software.software_name}>
                  <TableRow hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          <span style={{ fontSize: '16px' }}>
                            {getSoftwareIcon(software.software_name)}
                          </span>
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {software.software_name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight="medium">
                        {software.total_installations.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {software.unique_versions}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {software.latest_version}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                        <Computer sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {software.hosts_count}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                        <BugReport sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {software.vulnerability_count}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={riskInfo.level}
                        color={riskInfo.color as any}
                        size="small"
                        icon={<Security sx={{ fontSize: 16 }} />}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={isExpanded ? "Hide details" : "Show details"}>
                        <IconButton
                          onClick={() => handleExpandSoftware(software.software_name)}
                          disabled={loadingDetails}
                        >
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded Details Row */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box margin={2}>
                          <Typography variant="h6" gutterBottom component="div">
                            Installation Details
                          </Typography>
                          {loadingDetails ? (
                            <Box>
                              {[...Array(3)].map((_, index) => (
                                <Skeleton key={index} variant="rectangular" height={40} sx={{ mb: 1 }} />
                              ))}
                            </Box>
                          ) : (
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Host</TableCell>
                                  <TableCell>Version</TableCell>
                                  <TableCell>Install Date</TableCell>
                                  <TableCell>Vulnerabilities</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {softwareDetails.map((detail) => (
                                  <TableRow key={detail._id}>
                                    <TableCell>
                                      <Typography variant="body2" color="primary">
                                        {detail.host_id}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" fontFamily="monospace">
                                        {detail.version}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" color="text.secondary">
                                        {detail.install_date 
                                          ? new Date(detail.install_date).toLocaleDateString('en-US')
                                          : 'Unknown'
                                        }
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Box display="flex" gap={1} flexWrap="wrap">
                                        {detail.vulnerabilities.slice(0, 3).map((vuln, index) => (
                                          <Chip
                                            key={index}
                                            label={vuln.cve_id}
                                            size="small"
                                            color="error"
                                          />
                                        ))}
                                        {detail.vulnerabilities.length > 3 && (
                                          <Chip
                                            label={`+${detail.vulnerabilities.length - 3} more`}
                                            size="small"
                                            variant="outlined"
                                          />
                                        )}
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredSoftware.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Inventory2 sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No software found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? 'Try modifying your search term'
              : 'No software is currently inventoried'
            }
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default InventoryPage; 