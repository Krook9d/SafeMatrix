import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Computer,
  Security,
  AccountCircle,
  Logout,
  Inventory2,
  Code,
  AccountTree,
  Settings,
  Description,
  People,
  AdminPanelSettings,
  ExpandMore,
  ExpandLess,
  NotificationsActive,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/api';
import logoSafeMatrix from '../assets/connectors/logo_safematrix.svg';

const drawerWidth = 240;

interface NavigationItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  adminOnly?: boolean;
}

const navigationItems: NavigationItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/' },
  { text: 'Hosts', icon: <Computer />, path: '/hosts' },
  { text: 'Vulnerabilities', icon: <Security />, path: '/vulnerabilities' },
  { text: 'Alerts', icon: <NotificationsActive />, path: '/alerts' },
  { text: 'Inventory', icon: <Inventory2 />, path: '/inventory' },
  { text: 'Workflows', icon: <AccountTree />, path: '/workflows' },
  { text: 'Connectors', icon: <Settings />, path: '/connectors' },
  { text: 'DSL Query', icon: <Code />, path: '/dsl-query' },
];

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            component="img"
            src={logoSafeMatrix}
            alt="SafeMatrix logo"
            sx={{ width: 55, height: 55, mr: 1 }}
          />
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{
              fontWeight: 800,
              letterSpacing: 0.2,
              lineHeight: 1,
              fontSize: '1.25rem',
              background: 'linear-gradient(90deg, #0EA5E9 0%, #22D3EE 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            SafeMatrix
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {navigationItems
          .filter((item) => !item.adminOnly || user?.role === 'admin')
          .map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '& .MuiListItemIcon-root': { color: 'text.secondary' },
                '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' },
                '&:hover .MuiListItemIcon-root': { color: 'primary.main' },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ mt: 'auto' }}>
        <Divider />
        <List>
          {user?.role === 'admin' && (
            <>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  sx={{
                    '& .MuiListItemIcon-root': { color: 'text.secondary' },
                    '&:hover .MuiListItemIcon-root': { color: 'primary.main' },
                  }}
                >
                  <ListItemIcon><AdminPanelSettings /></ListItemIcon>
                  <ListItemText primary="Settings" />
                  {settingsOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>
              {settingsOpen && (
                <>
                  <ListItem disablePadding sx={{ pl: 4 }}>
                    <ListItemButton
                      selected={location.pathname === '/admin/users'}
                      onClick={() => handleNavigation('/admin/users')}
                      sx={{
                        '& .MuiListItemIcon-root': { color: 'text.secondary' },
                        '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' },
                        '&:hover .MuiListItemIcon-root': { color: 'primary.main' },
                      }}
                    >
                      <ListItemIcon><People /></ListItemIcon>
                      <ListItemText primary="Users" />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding sx={{ pl: 4 }}>
                    <ListItemButton
                      selected={location.pathname === '/admin/audit-logs'}
                      onClick={() => handleNavigation('/admin/audit-logs')}
                      sx={{
                        '& .MuiListItemIcon-root': { color: 'text.secondary' },
                        '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' },
                        '&:hover .MuiListItemIcon-root': { color: 'primary.main' },
                      }}
                    >
                      <ListItemIcon><Description /></ListItemIcon>
                      <ListItemText primary="Audit Logs" />
                    </ListItemButton>
                  </ListItem>
                </>
              )}
            </>
          )}
          <ListItem disablePadding>
            <ListItemButton
              component="a"
              href={`${API_BASE_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ListItemIcon sx={{ color: 'text.secondary' }}><Description /></ListItemIcon>
              <ListItemText primary="Documentation" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ 
      display: 'flex', 
      minHeight: '100vh',
      width: '100%',
      maxWidth: 'none'
    }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navigationItems.find(item => item.path === location.pathname)?.text || 'SafeMatrix'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              size="large"
              edge="end"
              aria-label="user account"
              aria-controls="menu-user"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-user"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem disabled>
                <Avatar sx={{ mr: 1, width: 24, height: 24 }}>
                  {user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                {user?.username}
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { handleNavigation('/profile'); handleMenuClose(); }}>
                <AccountCircle sx={{ mr: 1 }} />
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          width: '100%',
          maxWidth: 'none',
          mx: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          width: '100%',
          maxWidth: 'none',
          minWidth: 0
        }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout; 