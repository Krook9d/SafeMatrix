import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Skeleton,
  Paper,
  Avatar,
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import {
  Computer,
  Security,
  Warning,
  CheckCircle,
  BugReport,
  TrendingUp,
} from '@mui/icons-material';
import type { DashboardStats } from '../services/api';
import { dashboardAPI } from '../services/api';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await dashboardAPI.getStats();
        setStats(data);
      } catch (err: any) {
        console.error('Dashboard error:', err);
        setError('Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'success';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <BugReport color="error" />;
      case 'HIGH': return <Warning color="warning" />;
      case 'MEDIUM': return <Security color="info" />;
      case 'LOW': return <CheckCircle color="success" />;
      default: return <Security />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {[...Array(4)].map((_, index) => (
            <Card key={index} sx={{ minWidth: 250 }}>
              <CardContent>
                <Skeleton variant="rectangular" height={100} />
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!stats) return null;

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Dashboard
      </Typography>

      {/* KPI Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <Computer />
              </Avatar>
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Total Hosts
                </Typography>
                <Typography variant="h4">
                  {stats.total_hosts}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: 'info.main' }}>
                <TrendingUp />
              </Avatar>
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Software
                </Typography>
                <Typography variant="h4">
                  {stats.total_software.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: 'warning.main' }}>
                <Security />
              </Avatar>
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Vulnerabilities
                </Typography>
                <Typography variant="h4">
                  {stats.total_vulnerabilities}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: 'error.main' }}>
                <BugReport />
              </Avatar>
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Critical
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.critical_vulnerabilities}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Résumé OS */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 3, flex: '1 1 400px' }}>
          <Typography variant="h6" gutterBottom>
            OS Distribution
          </Typography>
          <PieChart
            series={[{
              data: Object.entries(stats.hosts_by_os).map(([os, count]) => ({
                id: os,
                value: count,
                label: os,
              }))
            }]}
            width={350}
            height={250}
          />
        </Paper>

        <Paper sx={{ p: 3, flex: '1 1 400px' }}>
          <Typography variant="h6" gutterBottom>
            Vulnerabilities by Severity
          </Typography>
          <PieChart
            series={[{
              data: Object.entries(stats.vulnerabilities_by_severity).map(([severity, count]) => ({
                id: severity,
                value: count,
                label: severity,
              }))
            }]}
            width={350}
            height={250}
          />
        </Paper>
      </Box>

      {/* Vulnérabilités récentes */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Vulnerabilities
        </Typography>
        <List>
          {stats.recent_vulnerabilities.map((vuln) => (
            <ListItem key={vuln.cve_id} divider>
              <ListItemIcon>
                {getSeverityIcon(vuln.severity)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="subtitle1" component="span">
                      {vuln.cve_id}
                    </Typography>
                    <Chip
                      label={vuln.severity}
                      color={getSeverityColor(vuln.severity) as any}
                      size="small"
                    />
                    <Chip
                      label={`CVSS ${vuln.cvss_score}`}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {vuln.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Published on {new Date(vuln.published_date).toLocaleDateString('en-US')}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Dashboard;