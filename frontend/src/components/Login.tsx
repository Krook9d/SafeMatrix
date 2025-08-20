import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Avatar,
  CssBaseline,
  Tab,
  Tabs,
  Paper,
  Grid,
  Divider,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import { 
  LockOutlined, 
  PersonAdd, 
  Security, 
  Shield, 
  BugReport,
  Visibility,
  VisibilityOff 
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Login: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login caught error:', err);
      setError(
        err.response?.data?.detail || 
        'Login error. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await authAPI.register({
        username,
        password
      });
      setSuccess('Account created successfully! You can now sign in.');
      setTabValue(0); // Switch to login tab
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(
        err.response?.data?.detail || 
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <CssBaseline />
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center" justifyContent="center">
          {/* Left side - Welcome section */}
          <Grid item xs={12} md={6}>
            <Box sx={{ textAlign: { xs: 'center', md: 'left' }, mb: { xs: 4, md: 0 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                <Avatar sx={{ width: 60, height: 60, bgcolor: 'primary.main', mr: 2 }}>
                  <Shield sx={{ fontSize: 30 }} />
                </Avatar>
                <Typography variant="h3" component="h1" fontWeight="bold" color="primary">
                  SafeMatrix
                </Typography>
              </Box>
              
              <Typography variant="h5" color="text.secondary" gutterBottom>
                Centralized Vulnerability Management Platform
              </Typography>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
                Monitor, analyze, and secure your infrastructure with real-time vulnerability detection 
                and comprehensive security insights across Windows, Linux, and macOS endpoints.
              </Typography>

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Security sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="body2">Real-time Security Monitoring</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BugReport sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="body2">Vulnerability Detection</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Visibility sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="body2">Comprehensive Dashboard</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Shield sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="body2">Multi-Platform Support</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Right side - Authentication form */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paper
                elevation={8}
                sx={{
                  width: '100%',
                  maxWidth: 450,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 3, textAlign: 'center' }}>
                  <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'white', color: 'primary.main' }}>
                    <LockOutlined />
                  </Avatar>
                  <Typography variant="h5" fontWeight="bold">
                    Welcome to SafeMatrix
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                    Secure your infrastructure today
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: 'background.paper' }}>
                  <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                      borderBottom: 1,
                      borderColor: 'divider',
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 600,
                      },
                    }}
                  >
                    <Tab
                      icon={<LockOutlined />}
                      iconPosition="start"
                      label="Sign In"
                      id="auth-tab-0"
                      aria-controls="auth-tabpanel-0"
                    />
                    <Tab
                      icon={<PersonAdd />}
                      iconPosition="start"
                      label="Sign Up"
                      id="auth-tab-1"
                      aria-controls="auth-tabpanel-1"
                    />
                  </Tabs>

                  {/* Login Tab */}
                  <TabPanel value={tabValue} index={0}>
                    <Box component="form" onSubmit={handleLogin}>
                      {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {error}
                        </Alert>
                      )}
                      {success && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          {success}
                        </Alert>
                      )}

                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="login-username"
                        label="Username"
                        name="username"
                        autoComplete="username"
                        autoFocus={tabValue === 0}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        variant="outlined"
                      />

                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        id="login-password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        variant="outlined"
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />

                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2, py: 1.5 }}
                        disabled={loading || !username || !password}
                        size="large"
                      >
                        {loading ? 'Signing in...' : 'Sign In'}
                      </Button>
                    </Box>
                  </TabPanel>

                  {/* Register Tab */}
                  <TabPanel value={tabValue} index={1}>
                    <Box component="form" onSubmit={handleRegister}>
                      {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {error}
                        </Alert>
                      )}

                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="register-username"
                        label="Username"
                        name="username"
                        autoComplete="username"
                        autoFocus={tabValue === 1}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        variant="outlined"
                        helperText="Choose a unique username"
                      />

                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        id="register-password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        variant="outlined"
                        helperText="Minimum 6 characters"
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />

                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="confirmPassword"
                        label="Confirm Password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="register-confirm-password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        variant="outlined"
                        helperText="Re-enter your password"
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              aria-label="toggle confirm password visibility"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                            >
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />

                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2, py: 1.5 }}
                        disabled={loading || !username || !password || !confirmPassword}
                        size="large"
                      >
                        {loading ? 'Creating Account...' : 'Create Account'}
                      </Button>
                    </Box>
                  </TabPanel>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Login; 