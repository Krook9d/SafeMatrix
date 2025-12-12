import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Tooltip,
  Alert,
  Divider,
  useTheme,
} from '@mui/material';
import { Add, Delete, Edit, Groups, Notes, People, Storage } from '@mui/icons-material';
import { teamAPI } from '../services/api';
import type { Team, TeamCreateMemberInput } from '../services/api';

const emptyMember: TeamCreateMemberInput = { email: '', name: '', role: '', notes: '' };

const CustomDatabase: React.FC = () => {
  const theme = useTheme();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamNotes, setTeamNotes] = useState('');
  const [members, setMembers] = useState<TeamCreateMemberInput[]>([emptyMember]);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const resetForm = () => {
    setTeamName('');
    setTeamDescription('');
    setTeamNotes('');
    setMembers([emptyMember]);
    setEditingTeam(null);
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await teamAPI.list();
      setTeams(data);
    } catch (err: any) {
      console.error(err);
      setError('Unable to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamDescription(team.description || '');
    setTeamNotes(team.notes || '');
    setMembers(
      team.members.length ? team.members.map(({ email, name, role, notes }) => ({ email, name, role, notes })) : [emptyMember],
    );
    setDialogOpen(true);
  };

  const handleSaveTeam = async () => {
    const payload = {
      name: teamName.trim(),
      description: teamDescription.trim() || undefined,
      notes: teamNotes.trim() || undefined,
      members: members
        .filter((m) => m.email.trim())
        .map((m) => ({
          ...m,
          email: m.email.trim(),
          name: m.name?.trim() || undefined,
          role: m.role?.trim() || undefined,
          notes: m.notes?.trim() || undefined,
        })),
    };

    if (!payload.name) {
      setError('Team name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (editingTeam) {
        await teamAPI.update(editingTeam.id, payload);
      } else {
        await teamAPI.create(payload);
      }
      setDialogOpen(false);
      resetForm();
      await loadTeams();
    } catch (err: any) {
      console.error(err);
      setError('Unable to save team');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      setError(null);
      await teamAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadTeams();
    } catch (err: any) {
      console.error(err);
      setError('Unable to delete team');
    } finally {
      setLoading(false);
    }
  };

  const memberCount = useMemo(() => teams.reduce((acc, t) => acc + t.members.length, 0), [teams]);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 'none',
        px: 3,
        py: 3,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 64px)',
        background: 'linear-gradient(135deg, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 1) 100%)',
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Storage />
            Directory
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Centralize teams and contacts to reuse them in email workflows.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
          New team
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip icon={<Groups />} label={`${teams.length} team(s)`} />
          <Chip icon={<People />} label={`${memberCount} contact(s)`} />
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {teams.map((team) => (
          <Grid item xs={12} md={6} lg={4} key={team.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="h6" fontWeight={700}>
                    {team.name}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                  <Tooltip title="Edit">
                      <IconButton onClick={() => handleOpenEdit(team)} size="small">
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => setDeleteTarget(team)} size="small">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
                {team.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {team.description}
                  </Typography>
                )}
                {team.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Notes fontSize="small" />
                    {team.notes}
                  </Typography>
                )}
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {team.members.map((member) => (
                    <Paper variant="outlined" key={member.id} sx={{ p: 1.2, borderRadius: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Box>
                          <Typography variant="subtitle2">{member.email}</Typography>
                          {(member.name || member.role) && (
                            <Typography variant="body2" color="text.secondary">
                              {[member.name, member.role].filter(Boolean).join(' • ')}
                            </Typography>
                          )}
                          {member.notes && (
                            <Typography variant="body2" color="text.secondary">
                              {member.notes}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                  {team.members.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No contacts yet.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
              <CardActions>
                <Button onClick={() => handleOpenEdit(team)} size="small" startIcon={<Edit />}>
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {!teams.length && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                No team yet
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Create a team to store recurring email contacts.
              </Typography>
              <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
                Create a team
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingTeam ? 'Edit team' : 'New team'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
            <TextField label="Description" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} multiline minRows={2} />
            <TextField label="Internal notes" value={teamNotes} onChange={(e) => setTeamNotes(e.target.value)} multiline minRows={2} />
            <Divider />
            <Typography variant="subtitle1" fontWeight={700}>
              Contacts
            </Typography>
            <Stack spacing={2}>
              {members.map((member, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} mb={1}>
                    <Typography variant="subtitle2">Contact #{idx + 1}</Typography>
                    {members.length > 1 && (
                      <IconButton color="error" size="small" onClick={() => setMembers(members.filter((_, i) => i !== idx))}>
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Email"
                        fullWidth
                        value={member.email}
                        required
                        onChange={(e) => {
                          const copy = [...members];
                          copy[idx] = { ...copy[idx], email: e.target.value };
                          setMembers(copy);
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Name"
                        fullWidth
                        value={member.name || ''}
                        onChange={(e) => {
                          const copy = [...members];
                          copy[idx] = { ...copy[idx], name: e.target.value };
                          setMembers(copy);
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Role / function"
                        fullWidth
                        value={member.role || ''}
                        onChange={(e) => {
                          const copy = [...members];
                          copy[idx] = { ...copy[idx], role: e.target.value };
                          setMembers(copy);
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Notes"
                        fullWidth
                        multiline
                        minRows={2}
                        value={member.notes || ''}
                        onChange={(e) => {
                          const copy = [...members];
                          copy[idx] = { ...copy[idx], notes: e.target.value };
                          setMembers(copy);
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Stack>
            <Button variant="outlined" startIcon={<Add />} onClick={() => setMembers([...members, emptyMember])}>
              Add contact
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTeam} variant="contained" disabled={loading}>
            {editingTeam ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete this team?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDeleteTeam} color="error" variant="contained" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomDatabase;

