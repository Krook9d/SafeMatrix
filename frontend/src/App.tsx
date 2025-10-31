import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import Hosts from './pages/Hosts';
import HostDetail from './pages/HostDetail';
import Vulnerabilities from './pages/Vulnerabilities';
import VulnerabilityDetail from './pages/VulnerabilityDetail';
import Inventory from './pages/Inventory';
import DSLQuery from './pages/DSLQuery';
import Workflows from './pages/Workflows';
import WorkflowForm from './pages/WorkflowForm';
import WorkflowExecutions from './pages/WorkflowExecutions';
import WorkflowTest from './pages/WorkflowTest';
import Connectors from './pages/Connectors';
import Profile from './pages/Profile';
import AdminUsers from './pages/AdminUsers';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Alerts from './pages/Alerts';
import AlertDetail from './pages/AlertDetail';
import DataEnrichment from './pages/DataEnrichment';

// Professional Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2', // Professional blue
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#f57c00', // Professional orange
      light: '#ffb74d',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    info: {
      main: '#0288d1',
      light: '#29b6f6',
      dark: '#0277bd',
    },
    success: {
      main: '#388e3c',
      light: '#66bb6a',
      dark: '#2e7d32',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 500,
      fontSize: '2.125rem',
    },
    h4: {
      fontWeight: 500,
      fontSize: '1.75rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    subtitle1: {
      fontWeight: 400,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f5f5f5',
          minHeight: '100vh',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          border: 'none',
          background: '#ffffff',
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
          border: 'none',
          background: '#ffffff',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 400,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#f5f5f5',
          '& .MuiTableCell-head': {
            color: '#424242',
            fontWeight: 600,
            fontSize: '0.875rem',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#f9f9f9',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e0e0e0',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#424242',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid #e0e0e0',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '4px 8px',
          '&.Mui-selected': {
            backgroundColor: '#e3f2fd',
            '&:hover': {
              backgroundColor: '#bbdefb',
            },
          },
        },
      },
    },
  },
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="hosts" element={<Hosts />} />
              <Route path="hosts/:hostId" element={<HostDetail />} />
              <Route path="vulnerabilities" element={<Vulnerabilities />} />
              <Route path="vulnerabilities/:cveId" element={<VulnerabilityDetail />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="alerts/:alertId" element={<AlertDetail />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="dsl-query" element={<DSLQuery />} />
              <Route path="workflows" element={<Workflows />} />
              <Route path="workflows/new" element={<WorkflowForm />} />
              <Route path="workflows/:id/edit" element={<WorkflowForm />} />
              <Route path="workflows/:id/executions" element={<WorkflowExecutions />} />
              <Route path="workflows/:id/test" element={<WorkflowTest />} />
              <Route path="connectors" element={<Connectors />} />
              <Route path="profile" element={<Profile />} />
              <Route
                path="admin/users"
                element={
                  <AdminRoute>
                    <AdminUsers />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/settings"
                element={
                  <AdminRoute>
                    <Settings />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/audit-logs"
                element={
                  <AdminRoute>
                    <AuditLogs />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/data-enrichment"
                element={
                  <AdminRoute>
                    <DataEnrichment />
                  </AdminRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
