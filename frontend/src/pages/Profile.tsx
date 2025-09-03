import React from 'react';
import { Card, CardContent, Typography, Grid, Chip, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Username
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {user.username}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Role
                </Typography>
                <Chip
                  label={user.role}
                  color={user.role === 'admin' ? 'error' : user.role === 'analyst' ? 'primary' : 'default'}
                  variant="outlined"
                  sx={{ textTransform: 'capitalize', mb: 2 }}
                />

                <Typography variant="body2" color="text.secondary">
                  Member since
                </Typography>
                <Typography variant="body1">
                  {new Date(user.created_at).toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
