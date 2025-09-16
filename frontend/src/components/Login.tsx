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
import { keyframes } from '@mui/system';
import SafeMatrixTitle from '../assets/connectors/SafeMatrix_title.svg';
import BackgroundImg from '../assets/connectors/background.png';

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

  // Animation kept if we want to reuse later (not applied now)
  const float = keyframes({
    '0%': { transform: 'translateY(0px)' },
    '50%': { transform: 'translateY(-15px)' },
    '100%': { transform: 'translateY(0px)' },
  });

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100vh',
        width: '100vw',
        display: 'flex',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.info.main, 0.06)} 100%)`,
      }}
    >
      <CssBaseline />
      {/* Left background panel */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: { xs: 0, md: '35%' },
          backgroundImage: `url(${BackgroundImg})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: { xs: 'center', md: 'center right' },
          zIndex: 0,
        }}
      />

      {/* Right content panel */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          ml: 'auto',
          width: { xs: '100%', md: '35%' },
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, md: 6 },
        }}
      >
        <Box sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 2, md: 4 } }}>
            <Box component="img" src={SafeMatrixTitle} alt="SafeMatrix" sx={{ height: { xs: 160, md: 240 } }} />
          </Box>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h5" fontWeight={800} sx={{
              background: 'linear-gradient(90deg, #0EA5E9 0%, #22D3EE 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
              Welcome to SafeMatrix
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Secure your infrastructure today
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleLogin} sx={{
            width: '100%',
            px: { xs: 1, md: 0 },
          }}>
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'transparent' },
                  '&.Mui-focused fieldset': { borderColor: 'transparent' },
                  boxShadow: '0 2px 8px rgba(2,136,209,0.12)',
                },
              }}
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'transparent' },
                  '&.Mui-focused fieldset': { borderColor: 'transparent' },
                  boxShadow: '0 2px 8px rgba(2,136,209,0.12)',
                },
              }}
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
              sx={{
                mt: 3,
                mb: 2,
                py: 1.5,
                background: 'linear-gradient(90deg, #0EA5E9 0%, #22D3EE 100%)',
                boxShadow: '0 8px 20px rgba(2,136,209,0.25)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #0288D1 0%, #06B6D4 100%)',
                  boxShadow: '0 10px 24px rgba(2,136,209,0.35)',
                },
              }}
              disabled={loading || !username || !password}
              size="large"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;