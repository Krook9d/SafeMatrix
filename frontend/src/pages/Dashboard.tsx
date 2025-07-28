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
import type { DashboardSummary, VulnerabilityStats } from '../services/api';
import { dashboardAPI } from '../services/api';

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [vulnStats, setVulnStats] = useState<VulnerabilityStats | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingVuln, setLoadingVuln] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await dashboardAPI.getSummary();
        setSummary(data);
      } catch (err: any) {
        console.error('Dashboard summary error:', err);
        setError('Error loading dashboard data');
      } finally {
        setLoadingSummary(false);
      }
    };

    const fetchVuln = async () => {
      try {
        const data = await dashboardAPI.getVulnerabilityStats();
        setVulnStats(data);
      } catch (err: any) {
        console.error('Dashboard vuln error:', err);
        setError('Error loading vulnerability data');
      } finally {
        setLoadingVuln(false);
      }
    };

    fetchSummary();
    fetchVuln();
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

  const getSeverityColorHex = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return '#d32f2f';
      case 'HIGH': return '#ed6c02';
      case 'MEDIUM': return '#0288d1';
      case 'LOW': return '#2e7d32';
      default: return '#9e9e9e';
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
                  {summary ? summary.total_hosts : <Skeleton width={40} />}
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
                  {summary ? summary.total_software.toLocaleString() : <Skeleton width={40} />}
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
                  {summary ? summary.total_vulnerabilities : <Skeleton width={40} />}
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
                  {summary ? summary.critical_vulnerabilities : <Skeleton width={40} />}
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
          {summary ? (
            <PieChart
              series={[{
                innerRadius: 60,
                paddingAngle: 5,
                cornerRadius: 4,
                data: Object.entries(summary.hosts_by_os).map(([os, count]) => ({
                  id: os,
                  value: count,
                  label: os,
                }))
              }]}
              height={250}
            />
          ) : (
            <Skeleton variant="rectangular" width={350} height={250} />
          )}
        </Paper>

        <Paper sx={{ p: 3, flex: '1 1 400px' }}>
          <Typography variant="h6" gutterBottom>
            Vulnerabilities by Severity
          </Typography>
          {vulnStats ? (
            <PieChart
              series={[{
                innerRadius: 60,
                paddingAngle: 5,
                cornerRadius: 4,
                data: Object.entries(vulnStats.vulnerabilities_by_severity).map(([severity, count]) => ({
                  id: severity,
                  value: count,
                  label: severity,
                  color: getSeverityColorHex(severity),
                }))
              }]}
              height={250}
            />
          ) : (
            <Skeleton variant="rectangular" width={350} height={250} />
          )}
        </Paper>
      </Box>

      {/* Vulnérabilités récentes */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Vulnerabilities
        </Typography>
        <List>
          {vulnStats
            ? vulnStats.recent_vulnerabilities.map((vuln) => (
                <ListItem key={vuln.cve_id} divider>
                  <ListItemIcon>{getSeverityIcon(vuln.severity)}</ListItemIcon>
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
                        <Chip label={`CVSS ${vuln.cvss_score}`} variant="outlined" size="small" />
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
              ))
            : [...Array(3)].map((_, idx) => (
                <ListItem key={idx} divider>
                  <ListItemIcon>
                    <Skeleton variant="circular" width={24} height={24} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Skeleton width="60%" />}
                    secondary={<Skeleton width="80%" />}
                  />
                </ListItem>
              ))}
        </List>
      </Paper>
    </Box>
  );
};

export default Dashboard;
