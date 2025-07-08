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
} from '@mui/material';
import {
  Search,
  Computer,
  Visibility,
  Refresh,
  FilterList,
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchHosts();
  }, []);

  useEffect(() => {
    // Filtrer les hosts basé sur le terme de recherche
    const filtered = hosts.filter(host =>
      host.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      host.ip_address.includes(searchTerm) ||
      host.os.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredHosts(filtered);
  }, [hosts, searchTerm]);

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

  const handleViewHost = (hostId: string) => {
    navigate(`/hosts/${hostId}`);
  };

  if (loading) {
    return (
      <Box>
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
      <Box>
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
    <Box>
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

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by name, IP or OS..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton onClick={() => setSearchTerm('')} edge="end">
                  ×
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Host</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Operating System</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Updated</TableCell>
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
                  <Tooltip title="View details">
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
            {searchTerm
              ? 'Try modifying your search'
              : 'No hosts are currently registered'
            }
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default Hosts; 