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
  Paper,
  Grid,
  Divider,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import { 
  LockOutlined, 
  Security, 
  Shield, 
  BugReport,
  Visibility,
  VisibilityOff 
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login caught error:', err);
      setError(err.response?.data?.detail || 'Login error. Please check your credentials.');
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

                <Box sx={{ bgcolor: 'background.paper', p: 3 }}>
                  <Box component="form" onSubmit={handleLogin}>
                    {error && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
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
                      autoFocus
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