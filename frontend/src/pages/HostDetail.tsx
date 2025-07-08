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
  Alert,
  Skeleton,
  Button,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Divider,
  Stack,
  Badge,
} from '@mui/material';
import {
  ArrowBack,
  Computer,
  Security,
  Refresh,
  Warning,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { hostsAPI, inventoryAPI, type Host, type Inventory } from '../services/api';

const HostDetail: React.FC = () => {
  const { hostId } = useParams<{ hostId: string }>();
  const navigate = useNavigate();
  const [host, setHost] = useState<Host | null>(null);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hostId) {
      fetchHostDetails(hostId);
    }
  }, [hostId]);

  const fetchHostDetails = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch host details and inventory in parallel
      const [hostData, inventoryData] = await Promise.all([
        hostsAPI.getById(id),
        inventoryAPI.getAll(id)
      ]);
      
      setHost(hostData);
      setInventory(inventoryData);
    } catch (err: any) {
      console.error('Error loading host details:', err);
      setError('Failed to load host details');
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

  const getSoftwareIcon = (softwareName: string) => {
    const name = softwareName.toLowerCase();
    if (name.includes('java') || name.includes('jdk') || name.includes('jre')) {
      return '☕';
    } else if (name.includes('python')) {
      return '🐍';
    } else if (name.includes('node') || name.includes('npm')) {
      return '📗';
    } else if (name.includes('docker')) {
      return '🐳';
    } else if (name.includes('apache') || name.includes('nginx')) {
      return '🌐';
    } else if (name.includes('mysql') || name.includes('postgres') || name.includes('database')) {
      return '🗄️';
    } else if (name.includes('git')) {
      return '📋';
    } else if (name.includes('chrome') || name.includes('firefox') || name.includes('browser')) {
      return '🌐';
    }
    return '📦';
  };

  const getRiskLevel = (vulnCount: number) => {
    if (vulnCount === 0) return { label: 'Low', color: 'success', icon: <CheckCircle /> };
    if (vulnCount <= 5) return { label: 'Medium', color: 'warning', icon: <Warning /> };
    return { label: 'High', color: 'error', icon: <Error /> };
  };

  const getTotalVulnerabilities = () => {
    return inventory.reduce((total, item) => total + item.vulnerabilities.length, 0);
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton onClick={() => navigate('/hosts')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">
            Loading host details...
          </Typography>
        </Box>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="text" width="40%" height={40} />
          <Skeleton variant="text" width="80%" height={20} sx={{ mt: 2 }} />
          <Skeleton variant="rectangular" height={200} sx={{ mt: 2 }} />
        </Paper>
      </Box>
    );
  }

  if (error || !host) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton onClick={() => navigate('/hosts')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4">
            Host Details
          </Typography>
        </Box>
        <Alert severity="error" action={
          <Button onClick={() => hostId && fetchHostDetails(hostId)} startIcon={<Refresh />}>
            Retry
          </Button>
        }>
          {error || 'Host not found'}
        </Alert>
      </Box>
    );
  }

  const totalVulns = getTotalVulnerabilities();
  const riskLevel = getRiskLevel(totalVulns);

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/hosts')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4" gutterBottom>
            {host.hostname}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip 
              icon={<span style={{ fontSize: '16px' }}>{getOSIcon(host.os.name)}</span>}
              label={`${host.os.name} ${host.os.version}`} 
              variant="outlined" 
            />
            <Chip 
              label={host.ip_address} 
              variant="outlined" 
            />
          </Stack>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => fetchHostDetails(host._id)}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Host Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center">
            <Computer sx={{ mr: 1 }} />
            Host Information
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} divider={<Divider orientation="vertical" flexItem />}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Hostname
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {host.hostname}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                IP Address
              </Typography>
              <Typography variant="body1" fontFamily="monospace">
                {host.ip_address}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Operating System
              </Typography>
              <Typography variant="body1">
                {host.os.name} {host.os.version}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body1">
                {new Date(host.updated_at).toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Software Count
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {inventory.length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Security Risk
              </Typography>
              <Chip
                icon={riskLevel.icon}
                label={`${riskLevel.label} (${totalVulns} vulns)`}
                color={riskLevel.color as any}
                size="small"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Software Inventory */}
      <Paper>
        <Box p={2} borderBottom={1} borderColor="divider">
          <Typography variant="h6" display="flex" alignItems="center">
            <Security sx={{ mr: 1 }} />
            Software Inventory ({inventory.length})
          </Typography>
        </Box>
        
        {inventory.length === 0 ? (
          <Box p={4} textAlign="center">
            <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No software inventory found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No software has been discovered on this host yet
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Software</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="center">Vulnerabilities</TableCell>
                  <TableCell>Discovered</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item._id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'grey.100', color: 'text.primary', width: 32, height: 32 }}>
                          <span style={{ fontSize: '16px' }}>
                            {getSoftwareIcon(item.software_name)}
                          </span>
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {item.software_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.install_date ? `Installed: ${new Date(item.install_date).toLocaleDateString()}` : 'Install date unknown'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {item.version}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {item.vulnerabilities.length > 0 ? (
                        <Badge badgeContent={item.vulnerabilities.length} color="error">
                          <Chip
                            icon={<Warning />}
                            label={`${item.vulnerabilities.length} vuln${item.vulnerabilities.length > 1 ? 's' : ''}`}
                            color="error"
                            size="small"
                          />
                        </Badge>
                      ) : (
                        <Chip
                          icon={<CheckCircle />}
                          label="No vulnerabilities"
                          color="success"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(item.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default HostDetail; 