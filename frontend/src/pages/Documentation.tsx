import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Link as MuiLink,
  Chip,
  Stack,
} from '@mui/material';

type DocCalloutProps = {
  type: 'info' | 'warning' | 'tip';
  title: string;
  children: React.ReactNode;
};

const DocCallout: React.FC<DocCalloutProps> = ({ type, title, children }) => {
  const colors: Record<DocCalloutProps['type'], { bg: string; border: string }> = {
    info: { bg: 'rgba(2, 136, 209, 0.06)', border: 'rgba(2, 136, 209, 0.5)' },
    warning: { bg: 'rgba(245, 124, 0, 0.06)', border: 'rgba(245, 124, 0, 0.6)' },
    tip: { bg: 'rgba(56, 142, 60, 0.06)', border: 'rgba(56, 142, 60, 0.6)' },
  };

  const palette = colors[type];

  return (
    <Paper
      sx={{
        p: 2.5,
        mt: 2,
        mb: 1,
        backgroundColor: palette.bg,
        borderLeft: `4px solid ${palette.border}`,
        boxShadow: 'none',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Paper>
  );
};

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <Box
    component="pre"
    sx={{
      mt: 2,
      mb: 2,
      px: 2,
      py: 1.5,
      borderRadius: 1,
      fontFamily: 'monospace',
      fontSize: 13,
      overflowX: 'auto',
      backgroundColor: 'rgba(0,0,0,0.04)',
      border: '1px solid rgba(0,0,0,0.08)',
    }}
  >
    {children}
  </Box>
);

const Documentation: React.FC = () => {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 'none',
        px: 3,
        py: 4,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Paper
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #1976d2 0%, #0ea5e9 40%, #22d3ee 100%)',
          color: '#ffffff',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          SafeMatrix Documentation
        </Typography>
        <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
          Learn how to navigate the interface, configure connectors, and interact with the API.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          <Chip label="UI Navigation" color="primary" variant="outlined" sx={{ borderColor: '#ffffff', color: '#ffffff' }} />
          <Chip label="Automation" color="primary" variant="outlined" sx={{ borderColor: '#ffffff', color: '#ffffff' }} />
          <Chip label="Integrations" color="primary" variant="outlined" sx={{ borderColor: '#ffffff', color: '#ffffff' }} />
          <Chip label="API" color="primary" variant="outlined" sx={{ borderColor: '#ffffff', color: '#ffffff' }} />
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Paper
          sx={{
            p: 3,
            flexBasis: { xs: '100%', md: '35%' },
            position: 'sticky',
            top: 88,
            alignSelf: 'flex-start',
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Table of contents
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          <List dense sx={{ '& a': { textDecoration: 'none', color: 'inherit' } }}>
            <ListItem component="a" href="#overview" button>
              <ListItemText primary="1. Overview & quick start" />
            </ListItem>
            <ListItem component="a" href="#dashboard" button>
              <ListItemText primary="2. Dashboard" />
            </ListItem>
            <ListItem component="a" href="#hosts" button>
              <ListItemText primary="3. Hosts" />
            </ListItem>
            <ListItem component="a" href="#vulnerabilities" button>
              <ListItemText primary="4. Vulnerabilities" />
            </ListItem>
            <ListItem component="a" href="#alerts" button>
              <ListItemText primary="5. Alerts" />
            </ListItem>
            <ListItem component="a" href="#inventory" button>
              <ListItemText primary="6. Inventory" />
            </ListItem>
            <ListItem component="a" href="#workflows" button>
              <ListItemText primary="7. Workflows" />
            </ListItem>
            <ListItem component="a" href="#dsl-query" button>
              <ListItemText primary="8. DSL Query" />
            </ListItem>
            <ListItem component="a" href="#connectors" button>
              <ListItemText primary="9. Connectors" />
            </ListItem>
            <ListItem component="a" href="#profile" button>
              <ListItemText primary="10. Profile" />
            </ListItem>
            <ListItem component="a" href="#admin" button>
              <ListItemText primary="11. Admin pages" />
            </ListItem>
            <ListItem component="a" href="#api" button>
              <ListItemText primary="12. API / Swagger" />
            </ListItem>
          </List>
        </Paper>

        <Stack spacing={3} sx={{ flex: 1 }}>
          <Paper id="overview" sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              1. Overview & quick start
            </Typography>
            <Typography variant="body1" paragraph>
              SafeMatrix is a security and asset management platform focused on asset inventory,
              vulnerability management, alerting, automation and integrations.
            </Typography>

            <DocCallout type="info" title="Quick start">
              To get started quickly:
              <br />
              1. Start the backend API.
              <br />
              2. Start the frontend UI.
              <br />
              3. Log in with an admin account and configure your first connectors.
            </DocCallout>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2 }}>
              Start backend (FastAPI)
            </Typography>
            <CodeBlock>{`# From the project root
uvicorn backend.main:app --reload`}</CodeBlock>

            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Start frontend (Vite / React)
            </Typography>
            <CodeBlock>{`docker compose restart frontend
`}</CodeBlock>
          </Paper>

          <Paper id="dashboard" sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              2. Dashboard
            </Typography>
            <Typography variant="body1" paragraph>
              The dashboard provides a high-level view of your environment: total hosts, software,
              vulnerabilities and severity distribution, and recent vulnerability trends.
            </Typography>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              Typical use cases
            </Typography>
            <Typography variant="body2" paragraph>
              - Monitor overall exposure at a glance.
              <br />
              - Detect spikes in vulnerabilities or critical findings.
              <br />
              - Track the effect of patching activities over time.
            </Typography>
          </Paper>

          <Paper id="hosts" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          3. Hosts
        </Typography>
        <Typography variant="body1" paragraph>
          The Hosts page lists all discovered hosts in your environment with key metadata such as hostname,
          IP addresses, operating system, and associated vulnerabilities.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          3.1 Hosts list
        </Typography>
        <Typography variant="body2" paragraph>
          Use filters and sorting to focus on specific hosts, such as those with the highest number of
          vulnerabilities or those recently seen by agents.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          3.2 Host detail
        </Typography>
        <Typography variant="body2" paragraph>
          The Host detail view provides per-host insights: detailed metadata, associated vulnerabilities,
          and potentially related alerts or workflow executions.
        </Typography>
      </Paper>

          <Paper id="vulnerabilities" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          4. Vulnerabilities
        </Typography>
        <Typography variant="body1" paragraph>
          The Vulnerabilities page aggregates all known vulnerabilities, typically grouped by CVE ID and
          severity. It allows you to prioritize remediation based on risk.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          4.1 Vulnerabilities list
        </Typography>
        <Typography variant="body2" paragraph>
          Filter by severity, status, or date to focus on the most impactful vulnerabilities. The view often
          includes the number of affected hosts and CVSS scores.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          4.2 Vulnerability detail
        </Typography>
        <Typography variant="body2" paragraph>
          The detail page for a CVE shows its description, references, CVSS details, and the list of affected
          hosts, helping you plan remediation.
        </Typography>
      </Paper>

          <Paper id="alerts" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          5. Alerts
        </Typography>
        <Typography variant="body1" paragraph>
          Alerts represent important security or operational events generated by the platform or workflows.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          5.1 Alerts list
        </Typography>
        <Typography variant="body2" paragraph>
          Review and filter alerts by severity, type, and status (open, acknowledged, resolved) to drive your
          incident response.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          5.2 Alert detail
        </Typography>
        <Typography variant="body2" paragraph>
          Each alert detail page provides full context: description, impacted entities, and links to related
          vulnerabilities or workflows.
        </Typography>
      </Paper>

          <Paper id="inventory" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          6. Inventory
        </Typography>
        <Typography variant="body1" paragraph>
          Inventory centralizes all assets known to SafeMatrix, giving you a complete view of your estate and
          its exposure.
        </Typography>
      </Paper>

          <Paper id="workflows" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          7. Workflows
        </Typography>
        <Typography variant="body1" paragraph>
          Workflows let you automate security and operational tasks, from enrichment to notification and
          ticketing.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          7.1 Workflows list
        </Typography>
        <Typography variant="body2" paragraph>
          Browse all defined workflows, see their status, and check when they were last executed.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          7.2 Workflow editor
        </Typography>
        <Typography variant="body2" paragraph>
          Use the creation and edit pages to define triggers, steps, and actions composing your workflow.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          7.3 Executions & tests
        </Typography>
        <Typography variant="body2" paragraph>
          Inspect historical executions and use the test view to validate workflows safely before enabling
          them in production.
        </Typography>
      </Paper>

          <Paper id="dsl-query" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          8. DSL Query
        </Typography>
        <Typography variant="body1" paragraph>
          The DSL Query page offers an advanced search interface for power users. You can combine conditions
          across hosts, vulnerabilities, alerts, and inventory.
        </Typography>
      </Paper>

          <Paper id="connectors" sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              9. Connectors
            </Typography>
            <Typography variant="body1" paragraph>
              Connectors integrate SafeMatrix with external systems such as scanners, ticketing tools,
              case management platforms, or notification channels.
            </Typography>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              9.1 General pattern
            </Typography>
            <Typography variant="body2" paragraph>
              Each connector usually requires:
            </Typography>
            <Typography variant="body2" component="div">
              - A base URL for the remote system.
              <br />
              - One or more credentials (API token, username/password, etc.).
              <br />
              - Optional advanced settings (verify SSL, timeout, mapping).
            </Typography>

            <DocCallout type="warning" title="SSL and self-signed certificates">
              When connecting to internal or lab systems over HTTPS (for example TheHive in a SOC lab),
              you may use self-signed certificates. Make sure to configure certificate validation according to
              your security policy.
            </DocCallout>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
              9.2 Example 	TheHive connector
            </Typography>
            <Typography variant="body2" paragraph>
              A typical TheHive instance URL might look like:
            </Typography>
            <CodeBlock>{`https://localhost/thehive/`}</CodeBlock>

            <Typography variant="body2" paragraph>
              Example JSON payload for configuring a TheHive connector via API or configuration file:
            </Typography>
            <CodeBlock>{`{
  "name": "thehive-prod",
  "type": "thehive",
  "base_url": "https://localhost/thehive/",
  "api_key": "YOUR_THEHIVE_API_KEY",
  "verify_ssl": false
}`}</CodeBlock>

            <DocCallout type="tip" title="Using connectors in workflows">
              Once a connector is configured and healthy, you can use it inside workflows to automatically
              create cases, tickets, or send notifications when new high-severity vulnerabilities or alerts
              are detected.
            </DocCallout>
          </Paper>

          <Paper id="profile" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          10. Profile
        </Typography>
        <Typography variant="body1" paragraph>
          The Profile page shows your account information and, depending on implementation, may expose
          personal settings such as language or notification preferences.
        </Typography>
      </Paper>

          <Paper id="admin" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          11. Admin pages
        </Typography>
        <Typography variant="body1" paragraph>
          Admin-only sections include Users, Settings, Audit Logs and Data Enrichment.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          11.1 Users
        </Typography>
        <Typography variant="body2" paragraph>
          Manage user accounts and roles (user/admin), onboard new users, and disable accounts when needed.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          11.2 Settings
        </Typography>
        <Typography variant="body2" paragraph>
          Configure global platform options such as security defaults or integration behavior.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          11.3 Audit Logs
        </Typography>
        <Typography variant="body2" paragraph>
          Audit logs record important administrative and user actions for traceability and compliance.
        </Typography>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          11.4 Data Enrichment
        </Typography>
        <Typography variant="body2" paragraph>
          Configure external enrichment sources (such as NVD) and their credentials. Keep these settings up
          to date to maintain rich security context.
        </Typography>
      </Paper>

          <Paper id="api" sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              12. API / Swagger
            </Typography>
            <Typography variant="body1" paragraph>
              The API/Swagger menu entry opens the interactive FastAPI documentation where you can explore and
              test all available endpoints.
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              12.1 Open the API docs
            </Typography>
            <Typography variant="body2" paragraph>
              From the SafeMatrix UI, use the <b>API/Swagger</b> entry in the left sidebar. Alternatively, you can
              browse directly to the backend Swagger UI:
            </Typography>
            <CodeBlock>{`http://localhost:8000/docs`}</CodeBlock>
            <Typography variant="body2" paragraph>
              Adjust the host and port to your deployment (for example an internal hostname or reverse proxy).
            </Typography>
            <DocCallout type="info" title="Authentication in Swagger UI">
              Use the <b>Authorize</b> button in Swagger UI to provide your token or credentials when required.
              This ensures that calls from the documentation are executed with the same permissions as your
              logged in account.
            </DocCallout>
            <Typography variant="body2">
              For more details, open the Swagger UI directly from the sidebar or visit{' '}
              <MuiLink href="/docs" target="_blank" rel="noopener noreferrer">
                /docs
              </MuiLink>{' '}
              on the backend service.
            </Typography>
          </Paper>
        </Stack>
      </Stack>
    </Box>
  );
};

export default Documentation;
