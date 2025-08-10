import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  Avatar, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Divider,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Dashboard,
  Business,
  People,
  Assignment,
  Schedule,
  Logout,
  AccountCircle,
  Menu as MenuIcon,
  LocalFlorist,
  Work,
  Analytics,
  Settings,
  Receipt,
  AccountBalance,
  Psychology
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
  };

  const handleMobileDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  };

  // Main navigation items
  const mainNavItems = [
    { path: '/', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/review', label: 'Review', icon: <Assignment /> },
    { path: '/work-activities', label: 'Work', icon: <Work /> },
    { path: '/clients', label: 'Clients', icon: <Business /> },
    { path: '/employees', label: 'Employees', icon: <People /> },
    { path: '/projects', label: 'Projects', icon: <Assignment /> },
    { path: '/invoices', label: 'Invoices', icon: <Receipt /> },
    ...(process.env.NODE_ENV !== 'production' ? [{ path: '/quickbooks', label: 'QuickBooks', icon: <AccountBalance /> }] : []),
    { path: '/ask-data', label: 'Ask Your Data', icon: <Psychology /> },
    { path: '/schedule', label: 'Schedule', icon: <Schedule /> },
    { path: '/notion-sync', label: 'Notion Sync', icon: <Assignment /> },
    // { path: '/chat', label: 'AI Assistant', icon: <Chat /> }, // Hidden for now
  ];

  // Management items (now empty, but keeping for future use)
  const managementNavItems: Array<{ path: string; label: string; icon: React.ReactElement }> = [
    // { path: '/work-notes-import', label: 'Import Notes', icon: <Upload /> }, // Hidden for now
  ];

  // Secondary items
  const secondaryNavItems = [
    { path: '/reports', label: 'Reports', icon: <Analytics /> },
    { path: '/debug', label: 'Debug', icon: <Analytics /> },
    { path: '/settings', label: 'Settings', icon: <Settings /> },
    { path: '/admin', label: 'Admin', icon: <Settings /> },
  ];

  const isActiveItem = (path: string) => location.pathname === path;

  // Desktop Navigation
  const DesktopNav = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {/* Main Navigation */}
      {mainNavItems.map((item) => (
        <Button
          key={item.path}
          color="inherit"
          startIcon={item.icon}
          onClick={() => navigate(item.path)}
          sx={{
            bgcolor: isActiveItem(item.path) ? 'rgba(255,255,255,0.15)' : 'transparent',
            borderRadius: 2,
            px: 2,
            py: 1,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          {item.label}
        </Button>
      ))}

      {/* Management Items - Condensed */}
      {managementNavItems.map((item) => (
        <Button
          key={item.path}
          color="inherit"
          startIcon={item.icon}
          onClick={() => navigate(item.path)}
          size="small"
          sx={{
            bgcolor: isActiveItem(item.path) ? 'rgba(255,255,255,0.15)' : 'transparent',
            borderRadius: 2,
            px: 1.5,
            py: 1,
            minWidth: 'auto',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
            },
            '& .MuiButton-startIcon': {
              mr: 0.5,
            }
          }}
        >
          {item.label}
        </Button>
      ))}
    </Box>
  );

  // Mobile Navigation Drawer
  const MobileNav = () => (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={handleMobileDrawerToggle}
    >
      <Box sx={{ width: 280, pt: 2 }}>
        {/* Logo */}
        <Box sx={{ px: 2, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalFlorist color="primary" />
          <Typography variant="h6" color="primary" fontWeight="bold">
            Garden Care CRM
          </Typography>
        </Box>
        <Divider />

        <List>
          {/* Main Items */}
          {mainNavItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileDrawerOpen(false);
                }}
                selected={isActiveItem(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}

          <Divider sx={{ my: 1 }} />

          {/* Management Items */}
          {managementNavItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileDrawerOpen(false);
                }}
                selected={isActiveItem(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}

          <Divider sx={{ my: 1 }} />

          {/* Secondary Items */}
          {secondaryNavItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileDrawerOpen(false);
                }}
                selected={isActiveItem(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleMobileDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 3 }}>
            <LocalFlorist />
            <Typography variant="h6" component="div" fontWeight="bold">
              Garden Care CRM
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          {!isMobile && <DesktopNav />}

          <Box sx={{ flexGrow: 1 }} />

          {/* User Menu */}
          <Button
            color="inherit"
            onClick={handleUserMenuOpen}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textTransform: 'none',
              borderRadius: 2,
              px: 2,
              py: 1,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <Avatar
              src={user?.picture}
              alt={user?.name}
              sx={{ width: 32, height: 32 }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
            {!isMobile && (
              <Typography variant="body2">
                {user?.name?.split(' ')[0]}
              </Typography>
            )}
          </Button>
          
          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleUserMenuClose}
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
              <ListItemIcon>
                <AccountCircle />
              </ListItemIcon>
              <ListItemText 
                primary={user?.name}
                secondary={user?.email}
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="Sign Out" />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      {isMobile && <MobileNav />}
    </>
  );
};

export default Navigation; 