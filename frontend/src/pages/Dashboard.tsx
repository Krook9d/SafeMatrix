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
  Grid,
  useTheme,
  alpha,
  Fade,
  Grow,
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import {
  Computer,
  Security,
  Warning,
  CheckCircle,
  BugReport,
  TrendingUp,
  Shield,
  Assessment,
} from '@mui/icons-material';
import type { DashboardStats } from '../services/api';
import { dashboardAPI } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

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
      case 'CRITICAL': return <BugReport sx={{ color: '#ffffff' }} />;
      case 'HIGH': return <Warning sx={{ color: '#ffffff' }} />;
      case 'MEDIUM': return <Security sx={{ color: '#ffffff' }} />;
      case 'LOW': return <CheckCircle sx={{ color: '#ffffff' }} />;
      default: return <Security sx={{ color: '#ffffff' }} />;
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
    <Box className="dashboard-container" sx={{
      width: '100%',
      maxWidth: 'none',
      px: 3,
      py: 3,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 64px)'
    }}>


      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={600}>
            <Card className="kpi-card" sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: '#ffffff'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                      Total Hosts
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats ? stats.total_hosts : <Skeleton width={60} sx={{ bgcolor: 'rgba(255, 255, 255, 0.3)' }} />}
                    </Typography>
                  </Box>
                  <Avatar sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    width: 60,
                    height: 60,
                    color: '#ffffff'
                  }}>
                    <Computer sx={{ fontSize: 30 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={800}>
            <Card className="kpi-card" sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
              color: '#ffffff'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                      Software
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats ? stats.total_software.toLocaleString() : <Skeleton width={80} sx={{ bgcolor: 'rgba(255, 255, 255, 0.3)' }} />}
                    </Typography>
                  </Box>
                  <Avatar sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    width: 60,
                    height: 60,
                    color: '#ffffff'
                  }}>
                    <Assessment sx={{ fontSize: 30 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1000}>
            <Card className="kpi-card" sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
              color: '#ffffff'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                      Vulnerabilities
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats ? stats.total_vulnerabilities.toLocaleString() : <Skeleton width={80} sx={{ bgcolor: 'rgba(255, 255, 255, 0.3)' }} />}
                    </Typography>
                  </Box>
                  <Avatar sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    width: 60,
                    height: 60,
                    color: '#ffffff'
                  }}>
                    <Shield sx={{ fontSize: 30 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Grow in timeout={1200}>
            <Card className={`kpi-card ${stats?.critical_vulnerabilities && stats.critical_vulnerabilities > 0 ? 'critical-card' : ''}`} sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
              color: '#ffffff'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                      Critical
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {stats ? stats.critical_vulnerabilities.toLocaleString() : <Skeleton width={60} sx={{ bgcolor: 'rgba(255, 255, 255, 0.3)' }} />}
                    </Typography>
                  </Box>
                  <Avatar sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    width: 60,
                    height: 60,
                    color: '#ffffff'
                  }}>
                    <BugReport sx={{ fontSize: 30 }} />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grow>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={6}>
          <Fade in timeout={1400}>
            <Paper className="chart-container" sx={{
              p: 4,
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}>
              <Typography variant="h5" gutterBottom sx={{
                fontWeight: 600,
                color: theme.palette.primary.main,
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Computer />
                OS Distribution
              </Typography>
              {stats ? (
                <PieChart
                  series={[{
                    innerRadius: 70,
                    paddingAngle: 3,
                    cornerRadius: 6,
                    data: Object.entries(stats.hosts_by_os).map(([os, count], index) => ({
                      id: os,
                      value: count,
                      label: os,
                      color: [
                        theme.palette.primary.main,
                        theme.palette.secondary.main,
                        theme.palette.info.main,
                        theme.palette.success.main,
                        theme.palette.warning.main,
                      ][index % 5]
                    }))
                  }]}
                  height={300}
                  slotProps={{
                    legend: {
                      direction: 'column',
                      position: { vertical: 'middle', horizontal: 'right' },
                    },
                  }}
                />
              ) : (
                <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2 }} />
              )}
            </Paper>
          </Fade>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Fade in timeout={1600}>
            <Paper className="chart-container" sx={{
              p: 4,
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.02)} 0%, ${alpha(theme.palette.error.main, 0.08)} 100%)`,
              border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`
            }}>
              <Typography variant="h5" gutterBottom sx={{
                fontWeight: 600,
                color: theme.palette.error.main,
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Security />
                Vulnerabilities by Severity
              </Typography>
              {stats ? (
                <PieChart
                  series={[{
                    innerRadius: 70,
                    paddingAngle: 3,
                    cornerRadius: 6,
                    data: Object.entries(stats.vulnerabilities_by_severity).map(([severity, count]) => ({
                      id: severity,
                      value: count,
                      label: severity,
                      color: getSeverityColorHex(severity),
                    }))
                  }]}
                  height={300}
                  slotProps={{
                    legend: {
                      direction: 'column',
                      position: { vertical: 'middle', horizontal: 'right' },
                    },
                  }}
                />
              ) : (
                <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2 }} />
              )}
            </Paper>
          </Fade>
        </Grid>
      </Grid>

      {/* Recent Vulnerabilities */}
      <Fade in timeout={1800}>
        <Paper sx={{
          p: 4,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.02)} 0%, ${alpha(theme.palette.warning.main, 0.08)} 100%)`,
          border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`
        }}>
          <Typography variant="h5" gutterBottom sx={{
            fontWeight: 600,
            color: theme.palette.warning.main,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <TrendingUp />
            Recent Vulnerabilities
          </Typography>
          <List sx={{ '& .MuiListItem-root': { borderRadius: 2, mb: 1 } }}>
            {stats
              ? stats.recent_vulnerabilities.map((vuln, index) => (
                <Grow in timeout={2000 + index * 200} key={vuln.cve_id}>
                  <ListItem
                    className="vulnerability-item"
                    sx={{
                      bgcolor: alpha(theme.palette.background.paper, 0.7)
                    }}
                  >
                    <ListItemIcon>
                      <Avatar sx={{
                        bgcolor: getSeverityColorHex(vuln.severity),
                        width: 40,
                        height: 40
                      }}>
                        {getSeverityIcon(vuln.severity)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
                          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                            {vuln.cve_id}
                          </Typography>
                          <Chip
                            label={vuln.severity}
                            sx={{
                              bgcolor: getSeverityColorHex(vuln.severity),
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                            size="small"
                          />
                          <Chip
                            label={`CVSS ${vuln.cvss_score}`}
                            variant="outlined"
                            size="small"
                            sx={{
                              borderColor: getSeverityColorHex(vuln.severity),
                              color: getSeverityColorHex(vuln.severity),
                              fontWeight: 500
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {vuln.description && vuln.description.length > 120
                              ? `${vuln.description.substring(0, 120)}...`
                              : vuln.description || 'No description available'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontWeight: 500
                          }}>
                            📅 Published on {vuln.published_date ? new Date(vuln.published_date).toLocaleDateString('fr-FR') : 'Unknown date'}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </Grow>
              ))
              : [...Array(5)].map((_, idx) => (
                <ListItem key={idx} sx={{ bgcolor: alpha(theme.palette.background.paper, 0.7), mb: 1, borderRadius: 2 }}>
                  <ListItemIcon>
                    <Skeleton variant="circular" width={40} height={40} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Skeleton width="60%" height={24} />}
                    secondary={
                      <Box>
                        <Skeleton width="90%" height={16} sx={{ mb: 0.5 }} />
                        <Skeleton width="40%" height={14} />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
          </List>
        </Paper>
      </Fade>
    </Box>
  );
};

export default Dashboard;