import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  useTheme,
  Fade,
  Card,
  CardContent,
  Divider,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow,
  CheckCircle,
  Error,
  Info,
  Code,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { workflowAPI } from '../services/api';
import type { Workflow } from '../services/api';

const WorkflowTest: React.FC = () => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testData, setTestData] = useState({
    cve_id: 'CVE-2024-0001',
    cvss_score: 9.8,
    severity: 'CRITICAL',
    description: 'Remote code execution vulnerability in example application',
    affected_products: 'Example App v1.0-2.0'
  });
  
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();

  useEffect(() => {
    if (id) {
      fetchWorkflow();
    }
  }, [id]);

  const fetchWorkflow = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const workflowData = await workflowAPI.getById(parseInt(id));
      setWorkflow(workflowData);
    } catch (err: any) {
      console.error('Error loading workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWorkflow = async () => {
    if (!workflow) return;
    
    try {
      setTesting(true);
      setError(null);
      setTestResult(null);
      
      // TODO: Implement actual test API endpoint
      // For now, simulate a test execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock test result
      const mockResult = {
        success: true,
        execution_id: Math.floor(Math.random() * 1000),
        actions_executed: workflow.actions.length,
        results: workflow.actions.map((action, index) => ({
          action_type: action.type,
          action_index: index,
          success: Math.random() > 0.2, // 80% success rate
          message: action.type === 'email' 
            ? 'Email sent successfully to martcayrol@gmail.com'
            : `${action.type} action completed`,
          details: action.type === 'email' 
            ? {
                to: action.config.to,
                subject: 'Security Alert: CVE-2024-0001 - CRITICAL Vulnerability Detected',
                sent_at: new Date().toISOString()
              }
            : {}
        }))
      };
      
      setTestResult(mockResult);
    } catch (err: any) {
      console.error('Error testing workflow:', err);
      setError('Failed to test workflow');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Test Workflow
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography>Loading workflow...</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: 'none', 
      px: 3,
      py: 3,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 64px)',
      background: 'linear-gradient(135deg, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 1) 100%)'
    }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <Button
                startIcon={<ArrowBack />}
                onClick={() => navigate('/workflows')}
                variant="outlined"
              >
                Back to Workflows
              </Button>
            </Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <PlayArrow />
              Test Workflow
            </Typography>
            {workflow && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Test execution for "{workflow.name}"
              </Typography>
            )}
          </Box>
        </Box>
      </Fade>

      {error && (
        <Fade in timeout={800}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        </Fade>
      )}

      <Box display="flex" gap={3}>
        {/* Left Column - Workflow Info & Test Data */}
        <Box flex={1}>
          {/* Workflow Summary */}
          {workflow && (
            <Fade in timeout={1000}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Workflow Summary
                  </Typography>
                  <Box display="flex" gap={2} mb={2}>
                    <Chip 
                      label={`${workflow.rules.length} rule${workflow.rules.length !== 1 ? 's' : ''}`}
                      variant="outlined"
                      size="small"
                    />
                    <Chip 
                      label={`${workflow.actions.length} action${workflow.actions.length !== 1 ? 's' : ''}`}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {workflow.description}
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Rules:
                  </Typography>
                  {workflow.rules.map((rule, index) => (
                    <Typography key={index} variant="body2" sx={{ ml: 2, mb: 1 }}>
                      • {rule.field} {rule.operator.replace(/_/g, ' ')} {rule.value}
                    </Typography>
                  ))}
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Actions:
                  </Typography>
                  {workflow.actions.map((action, index) => (
                    <Typography key={index} variant="body2" sx={{ ml: 2, mb: 1 }}>
                      • {action.type.charAt(0).toUpperCase() + action.type.slice(1)} action
                    </Typography>
                  ))}
                </CardContent>
              </Card>
            </Fade>
          )}

          {/* Test Data */}
          <Fade in timeout={1200}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Test Data
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Modify the test data below to simulate different vulnerability scenarios
                </Typography>
                
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField
                    label="CVE ID"
                    value={testData.cve_id}
                    onChange={(e) => setTestData({...testData, cve_id: e.target.value})}
                    size="small"
                    fullWidth
                  />
                  
                  <TextField
                    label="CVSS Score"
                    type="number"
                    value={testData.cvss_score}
                    onChange={(e) => setTestData({...testData, cvss_score: parseFloat(e.target.value)})}
                    size="small"
                    inputProps={{ min: 0, max: 10, step: 0.1 }}
                    fullWidth
                  />
                  
                  <FormControl size="small" fullWidth>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={testData.severity}
                      label="Severity"
                      onChange={(e) => setTestData({...testData, severity: e.target.value})}
                    >
                      <MenuItem value="LOW">LOW</MenuItem>
                      <MenuItem value="MEDIUM">MEDIUM</MenuItem>
                      <MenuItem value="HIGH">HIGH</MenuItem>
                      <MenuItem value="CRITICAL">CRITICAL</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <TextField
                    label="Description"
                    value={testData.description}
                    onChange={(e) => setTestData({...testData, description: e.target.value})}
                    size="small"
                    multiline
                    rows={2}
                    fullWidth
                  />
                  
                  <TextField
                    label="Affected Products"
                    value={testData.affected_products}
                    onChange={(e) => setTestData({...testData, affected_products: e.target.value})}
                    size="small"
                    fullWidth
                  />
                </Box>
              </CardContent>
            </Card>
          </Fade>
        </Box>

        {/* Right Column - Test Execution */}
        <Box flex={1}>
          <Fade in timeout={1400}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Test Execution
                </Typography>
                
                <Button
                  variant="contained"
                  startIcon={testing ? <CircularProgress size={20} /> : <PlayArrow />}
                  onClick={handleTestWorkflow}
                  disabled={testing || !workflow}
                  fullWidth
                  sx={{ mb: 3 }}
                >
                  {testing ? 'Testing Workflow...' : 'Run Test'}
                </Button>

                {testResult && (
                  <Box>
                    <Alert 
                      severity={testResult.success ? 'success' : 'error'} 
                      icon={testResult.success ? <CheckCircle /> : <Error />}
                      sx={{ mb: 2 }}
                    >
                      Test {testResult.success ? 'completed successfully' : 'failed'}
                    </Alert>

                    <Typography variant="subtitle2" gutterBottom>
                      Execution Results:
                    </Typography>
                    
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 2 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        Execution ID: #{testResult.execution_id}
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        Actions Executed: {testResult.actions_executed}
                      </Typography>
                    </Box>

                    {testResult.results && testResult.results.map((result: any, index: number) => (
                      <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                        <CardContent sx={{ py: 2 }}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Chip
                              icon={result.success ? <CheckCircle /> : <Error />}
                              label={result.action_type.toUpperCase()}
                              color={result.success ? 'success' : 'error'}
                              size="small"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {result.message}
                          </Typography>
                          {result.details && Object.keys(result.details).length > 0 && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Details:
                              </Typography>
                              <pre style={{ 
                                fontSize: '0.75rem', 
                                margin: 0, 
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace'
                              }}>
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}

                {!testResult && !testing && (
                  <Alert severity="info" icon={<Info />}>
                    Click "Run Test" to execute this workflow with the test data and see the results
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Box>
      </Box>
    </Box>
  );
};

export default WorkflowTest;