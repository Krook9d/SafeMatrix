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
  IconButton,
  TextField,
  InputAdornment,
  Alert,
  Skeleton,
  Avatar,
  Tooltip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Card,
  CardContent,
  Grid,
  useTheme,
  alpha,
  Fade,
  Grow,
} from '@mui/material';
import {
  Search,
  Computer,
  Visibility,
  Refresh,
  Clear,
  Storage,
  NetworkCheck,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { Host } from '../services/api';
import { hostsAPI } from '../services/api';
import './Hosts.css';

const Hosts: React.FC = () => {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [filteredHosts, setFilteredHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [lastSeenFilter, setLastSeenFilter] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    fetchHosts();
  }, []);

  useEffect(() => {
    // Filter hosts based on search term and filters
    let filtered = hosts.filter(host =>
      host.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      host.ip_address.includes(searchTerm) ||
      host.os.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // OS Filter
    if (osFilter) {
      filtered = filtered.filter(host => 
        host.os.name.toLowerCase().includes(osFilter.toLowerCase())
      );
    }

    // Last Seen Filter
    if (lastSeenFilter) {
      const now = new Date();
      filtered = filtered.filter(host => {
        const lastSeen = new Date(host.updated_at);
        const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
        
        switch (lastSeenFilter) {
          case 'online':
            return diffInMinutes < 10;
          case 'recent':
            return diffInMinutes >= 10 && diffInMinutes < 60;
          case 'offline':
            return diffInMinutes >= 60;
          default:
            return true;
        }
      });
    }

    setFilteredHosts(filtered);
  }, [hosts, searchTerm, osFilter, lastSeenFilter]);

  const fetchHosts = async () => {
    try {
      const data = await hostsAPI.getAll();
      setHosts(data);
    } catch (err: any) {
      console.error('Error loading hosts:', err);
      setError('Error loading hosts');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchInput('');
    setOsFilter('');
    setLastSeenFilter('');
  };

  const getOSIcon = (osName: string) => {
    if (osName.toLowerCase().includes('windows')) {
      return '🪟';
    } else if (osName.toLowerCase().includes('ubuntu') || osName.toLowerCase().includes('linux')) {
      return '🐧';
    } else if (osName.toLowerCase().includes('macos')) {
      return '🍎';
    }
    return '💻';
  };

  const getLastSeenColor = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);

    if (diffInMinutes < 10) {
      return 'success';
    } else if (diffInMinutes < 60) {
      return 'warning';
    } else {
      return 'error';
    }
  };

  const getLastSeenColorHex = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);

    if (diffInMinutes < 10) {
      return '#2e7d32';
    } else if (diffInMinutes < 60) {
      return '#ed6c02';
    } else {
      return '#d32f2f';
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)} min ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getStatusLabel = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);

    if (diffInMinutes < 10) {
      return 'Online';
    } else if (diffInMinutes < 60) {
      return 'Recent';
    } else {
      return 'Offline';
    }
  };

  const handleViewHost = (hostId: string) => {
    navigate(`/hosts/${hostId}`);
  };

  // Get unique OS names for filter
  const uniqueOSNames = [...new Set(hosts.map(host => host.os.name))];

  // Calculate stats
  const onlineCount = hosts.filter(host => {
    const now = new Date();
    const lastSeen = new Date(host.updated_at);
    const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return diffInMinutes < 10;
  }).length;

  const recentCount = hosts.filter(host => {
    const now = new Date();
    const lastSeen = new Date(host.updated_at);
    const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return diffInMinutes >= 10 && diffInMinutes < 60;
  }).length;

  const offlineCount = hosts.filter(host => {
    const now = new Date();
    const lastSeen = new Date(host.updated_at);
    const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return diffInMinutes >= 60;
  }).length;

  if (loading) {
    return (
      <Box className="hosts-container" sx={{ 
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
            color: theme.palette.primary.main,
            mb: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Computer />
            Hosts
          </Typography>
        </Fade>
        <Paper className="hosts-table-container" sx={{ p: 2 }}>
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={60} className="skeleton-row-hosts" />
          ))}
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="hosts-container" sx={{ 
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
          color: theme.palette.primary.main,
          mb: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Computer />
          Hosts
        </Typography>
        <Alert severity="error" sx={{ borderRadius: 3 }} action={
          <Button onClick={fetchHosts} startIcon={<Refresh />}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="hosts-container" sx={{ 
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
            color: theme.palette.primary.main,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Computer />
            Hosts ({filteredHosts.length})
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchHosts}
            className="filter-button-hosts"
            sx={{
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              '&:hover': {
                borderColor: theme.palette.primary.dark,
                bgcolor: alpha(theme.palette.primary.main, 0.05)
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
            <Card className="stats-card-hosts">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Total Hosts
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                      {hosts.length}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.primary.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <Storage />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1000}>
            <Card className="stats-card-hosts">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Online
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                      {onlineCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.success.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <NetworkCheck />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1200}>
            <Card className="stats-card-hosts">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Recent
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                      {recentCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.warning.main, 
                    width: 50, 
                    height: 50
                  }}>
                    <Schedule />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1400}>
            <Card className="stats-card-hosts">
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.8, mb: 1 }}>
                      Offline
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
                      {offlineCount}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.error.main, 
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
        <Card className="search-container-hosts" sx={{ 
          mb: 3,
          position: 'sticky', 
          top: 0, 
          zIndex: 100
        }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  sx={{ minWidth: 300 }}
                  variant="outlined"
                  placeholder="Search by name, IP or OS..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                  size="small"
                />
                <Button 
                  variant="contained" 
                  size="small" 
                  onClick={() => setSearchTerm(searchInput)}
                  className="filter-button-hosts"
                  sx={{ 
                    bgcolor: theme.palette.primary.main,
                    '&:hover': {
                      bgcolor: theme.palette.primary.dark
                    }
                  }}
                >
                  Search
                </Button>
              </Box>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Operating System</InputLabel>
                <Select
                  value={osFilter}
                  label="Operating System"
                  onChange={(e) => setOsFilter(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All OS</MenuItem>
                  {uniqueOSNames.map((os) => (
                    <MenuItem key={os} value={os}>{os}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={lastSeenFilter}
                  label="Status"
                  onChange={(e) => setLastSeenFilter(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="online">Online (&lt; 10 min)</MenuItem>
                  <MenuItem value="recent">Recent (&lt; 1 hour)</MenuItem>
                  <MenuItem value="offline">Offline (&gt; 1 hour)</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearFilters}
                disabled={!searchTerm && !searchInput && !osFilter && !lastSeenFilter}
                size="small"
                className="filter-button-hosts"
              >
                Clear Filters
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Fade>

      {/* Hosts Table */}
      <Fade in timeout={1800}>
        <TableContainer component={Paper} className="hosts-table-container">
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 600 }}>Host</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>IP Address</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Operating System</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Seen</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHosts.map((host, index) => (
                <Grow in timeout={2000 + index * 100} key={host._id}>
                  <TableRow 
                    hover
                    className="hosts-table-row"
                    sx={{ 
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                      }
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar className="host-avatar" sx={{ bgcolor: theme.palette.primary.main }}>
                          <Computer />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {host.hostname}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {host._id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={host.ip_address}
                        variant="outlined"
                        size="small"
                        sx={{ 
                          fontFamily: 'monospace',
                          fontWeight: 500,
                          borderColor: theme.palette.info.main,
                          color: theme.palette.info.main
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <span className="os-icon">
                          {getOSIcon(host.os.name)}
                        </span>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {host.os.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {host.os.version}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(host.created_at).toLocaleDateString('fr-FR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {formatLastSeen(host.updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(host.updated_at)}
                        className="status-chip"
                        sx={{
                          bgcolor: getLastSeenColorHex(host.updated_at),
                          color: '#ffffff'
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View inventory">
                        <IconButton
                          onClick={() => handleViewHost(host._id)}
                          className="action-button"
                          sx={{ 
                            color: theme.palette.primary.main,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.1)
                            }
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                </Grow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Fade>

      {/* Empty State */}
      {filteredHosts.length === 0 && !loading && (
        <Fade in timeout={2000}>
          <Paper className="empty-state-hosts" sx={{ p: 6, textAlign: 'center', mt: 2 }}>
            <Computer sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
              No hosts found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {searchTerm || osFilter || lastSeenFilter
                ? 'Try modifying your search or filters'
                : 'No hosts are currently registered'
              }
            </Typography>
          </Paper>
        </Fade>
      )}
    </Box>
  );
};

export default Hosts;