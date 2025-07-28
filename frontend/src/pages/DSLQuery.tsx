import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert } from '@mui/material';
import { opensearchAPI } from '../services/api';

const DSLQuery: React.FC = () => {
  const [index, setIndex] = useState('');
  const defaultQuery = JSON.stringify({ query: { match_all: {} } }, null, 2);
  const [queryText, setQueryText] = useState(defaultQuery);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    try {
      setLoading(true);
      setError(null);
      const body = JSON.parse(queryText);
      const response = await opensearchAPI.query(index, body);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Error executing query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', px: 3 }}>
      <Typography variant="h4" gutterBottom>
        OpenSearch DSL Query
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          label="Index"
          fullWidth
          margin="normal"
          value={index}
          onChange={(e) => setIndex(e.target.value)}
        />
        <TextField
          label="Query JSON"
          fullWidth
          multiline
          minRows={6}
          margin="normal"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        />
        <Button variant="contained" onClick={runQuery} disabled={loading}>
          Run Query
        </Button>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {result && (
        <Paper sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </Paper>
      )}
    </Box>
  );
};

export default DSLQuery;
