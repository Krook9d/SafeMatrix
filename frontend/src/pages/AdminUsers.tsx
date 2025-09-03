import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Toolbar,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Stack,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add, Delete, Refresh } from '@mui/icons-material';
import { usersAPI } from '../services/api';
import type { Role, User } from '../services/api';

const roleColors: Record<Role, 'default' | 'primary' | 'success' | 'warning'> = {
  admin: 'primary',
  analyst: 'success',
  viewer: 'default',
};

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [openCreate, setOpenCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('viewer');
  const [creating, setCreating] = useState(false);

  const availableRoles: Role[] = useMemo(() => ['admin', 'analyst', 'viewer'], []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await usersAPI.list();
      setUsers(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await usersAPI.create({ username: newUsername.trim(), password: newPassword, role: newRole });
      setOpenCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      await loadUsers();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (username: string, role: Role) => {
    setError('');
    try {
      await usersAPI.updateRole(username, role);
      setUsers(prev => prev.map(u => (u.username === username ? { ...u, role } : u)));
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    setError('');
    try {
      await usersAPI.delete(username);
      setUsers(prev => prev.filter(u => u.username !== username));
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete user');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Toolbar disableGutters sx={{ mb: 2, justifyContent: 'space-between' }}>
        <Typography variant="h5" fontWeight={600}>Users</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={loadUsers} disabled={loading}>
                {loading ? <CircularProgress size={20} /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>
          <Button startIcon={<Add />} variant="contained" onClick={() => setOpenCreate(true)}>
            New User
          </Button>
        </Stack>
      </Toolbar>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.username, e.target.value as Role)}
                    >
                      {availableRoles.map((r) => (
                        <MenuItem key={r} value={r}>{r}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={new Date(user.created_at).toLocaleString()} color={roleColors[user.role as Role]} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete user">
                      <IconButton color="error" onClick={() => handleDelete(user.username)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary">No users found.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoFocus
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
            />
            <TextField
              select
              label="Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              fullWidth
            >
              {availableRoles.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!newUsername || !newPassword || creating} variant="contained">
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUsers;
