import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Alert
} from '@mui/material';
import { People, History } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Vérifier si l'utilisateur est admin
  if (user?.role !== 'admin') {
    return (
      <Box p={3}>
        <Alert severity="error">
          Access denied. This page is reserved for administrators.
        </Alert>
      </Box>
    );
  }

  const settingsOptions = [
    {
      title: 'User Management',
      description: 'Create, modify and manage system users',
      icon: <People sx={{ fontSize: 40 }} />,
      path: '/admin/users',
      color: '#1976d2'
    },
    {
      title: 'Audit Logs',
      description: 'View the history of actions performed in the application',
      icon: <History sx={{ fontSize: 40 }} />,
      path: '/admin/audit-logs',
      color: '#388e3c'
    }
  ];

  return (
    <Box p={3}>
      <Typography variant="h4" component="h1" gutterBottom>
        Administrator Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Access administration and system management tools
      </Typography>

      <Grid container spacing={3}>
        {settingsOptions.map((option, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardActionArea 
                onClick={() => navigate(option.path)}
                sx={{ height: '100%' }}
              >
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Box 
                    sx={{ 
                      color: option.color,
                      mb: 2,
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    {option.icon}
                  </Box>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {option.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Settings;