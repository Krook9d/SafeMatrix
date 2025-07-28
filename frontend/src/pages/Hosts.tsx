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
} from '@mui/material';
import {
  Search,
  Computer,
  Visibility,
  Refresh,
  Clear,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { Host } from '../services/api';
import { hostsAPI } from '../services/api';

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

  if (loading) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
        <Typography variant="h4" gutterBottom>
          Hosts
        </Typography>
        <Paper sx={{ p: 2 }}>
          {[...Array(5)].map((_, index) => (
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
          Hosts
        </Typography>
        <Alert severity="error" action={
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
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Hosts ({filteredHosts.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchHosts}
        >
          Refresh
        </Button>
      </Box>

      {/* Fixed Filter Bar */}
      <Card sx={{ 
        mb: 3,
        position: 'sticky', 
        top: 0, 
        zIndex: 100,
        boxShadow: 3,
      }}>
        <CardContent>
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
              <Button variant="contained" size="small" onClick={() => setSearchTerm(searchInput)}>Search</Button>
            </Box>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Operating System</InputLabel>
              <Select
                value={osFilter}
                label="Operating System"
                onChange={(e) => setOsFilter(e.target.value)}
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
            >
              Clear Filters
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Host</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Operating System</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last Seen</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredHosts.map((host) => (
              <TableRow key={host._id} hover>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
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
                  <Typography variant="body2" fontFamily="monospace">
                    {host.ip_address}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <span style={{ fontSize: '20px' }}>
                      {getOSIcon(host.os.name)}
                    </span>
                    <Box>
                      <Typography variant="body2">
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
                    {new Date(host.created_at).toLocaleDateString('en-US')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatLastSeen(host.updated_at)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={getStatusLabel(host.updated_at)}
                    color={getLastSeenColor(host.updated_at) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View inventory">
                    <IconButton
                      onClick={() => handleViewHost(host._id)}
                      color="primary"
                    >
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredHosts.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <Computer sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No hosts found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm || osFilter || lastSeenFilter
              ? 'Try modifying your search or filters'
              : 'No hosts are currently registered'
            }
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default Hosts; 