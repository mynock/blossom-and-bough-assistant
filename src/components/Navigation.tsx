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
  useMediaQuery,
  Paper,
  MenuList,
  ClickAwayListener
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
  KeyboardArrowDown,
  FolderOpen,
  Build,
  Computer
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
  const [dropdownAnchors, setDropdownAnchors] = useState<{[key: string]: HTMLElement | null}>({
    resources: null,
    tools: null,
    system: null
  });

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

  const handleDropdownToggle = (dropdown: string) => (event: React.MouseEvent<HTMLElement>) => {
    setDropdownAnchors(prev => {
      // Close all other dropdowns and toggle this one
      const newState: {[key: string]: HTMLElement | null} = {
        resources: null,
        tools: null,
        system: null
      };
      
      // Toggle the clicked dropdown
      newState[dropdown] = prev[dropdown] ? null : event.currentTarget;
      
      return newState;
    });
  };

  const handleDropdownClose = (dropdown: string) => () => {
    setDropdownAnchors(prev => ({
      ...prev,
      [dropdown]: null
    }));
  };

  const handleDropdownItemClick = (path: string, dropdown: string) => () => {
    navigate(path);
    handleDropdownClose(dropdown)();
  };

  const handleTopLevelNavClick = (path: string) => () => {
    // Close all dropdowns when navigating to top-level items
    setDropdownAnchors({
      resources: null,
      tools: null,
      system: null
    });
    navigate(path);
  };

  // Top-level navigation items
  const topLevelNavItems = [
    { path: '/', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/schedule', label: 'Schedule', icon: <Schedule /> },
    { path: '/reports', label: 'Reports', icon: <Analytics /> },
  ];

  // Dropdown navigation groups
  const dropdownNavGroups = {
    resources: {
      label: 'Resources',
      icon: <FolderOpen />,
      items: [
        { path: '/review', label: 'Review', icon: <Assignment /> },
        { path: '/work-activities', label: 'Work', icon: <Work /> },
        { path: '/clients', label: 'Clients', icon: <Business /> },
        { path: '/projects', label: 'Projects', icon: <Assignment /> },
        { path: '/employees', label: 'Employees', icon: <People /> },
        { path: '/invoices', label: 'Invoices', icon: <Receipt /> },
      ]
    },
    tools: {
      label: 'Tools',
      icon: <Build />,
      items: [
        { path: '/notion-sync', label: 'Notion Sync', icon: <Assignment /> },
        ...(process.env.NODE_ENV !== 'production' ? [{ path: '/quickbooks', label: 'QuickBooks', icon: <AccountBalance /> }] : []),
      ]
    },
    system: {
      label: 'System',
      icon: <Computer />,
      items: [
        { path: '/settings', label: 'Settings', icon: <Settings /> },
        { path: '/admin', label: 'Admin', icon: <Settings /> },
        { path: '/debug', label: 'Debug', icon: <Analytics /> },
      ]
    }
  };

  // All items for mobile navigation (flattened)
  const allNavItems = [
    ...topLevelNavItems,
    ...Object.values(dropdownNavGroups).flatMap(group => group.items)
  ];

  const isActiveItem = (path: string) => location.pathname === path;

  const isDropdownActive = (groupKey: string) => {
    return dropdownNavGroups[groupKey as keyof typeof dropdownNavGroups].items.some(item => isActiveItem(item.path));
  };

  // Desktop Navigation
  const DesktopNav = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {/* Top-level Navigation Items */}
      {topLevelNavItems.map((item) => (
        <Button
          key={item.path}
          color="inherit"
          startIcon={item.icon}
          onClick={handleTopLevelNavClick(item.path)}
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

      {/* Dropdown Navigation Groups */}
      {Object.entries(dropdownNavGroups).map(([groupKey, group]) => (
        <Box key={groupKey} sx={{ position: 'relative' }}>
          <Button
            color="inherit"
            startIcon={group.icon}
            endIcon={<KeyboardArrowDown />}
            onClick={handleDropdownToggle(groupKey)}
            sx={{
              bgcolor: (isDropdownActive(groupKey) || Boolean(dropdownAnchors[groupKey])) ? 'rgba(255,255,255,0.15)' : 'transparent',
              borderRadius: 2,
              px: 2,
              py: 1,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            {group.label}
          </Button>
          {Boolean(dropdownAnchors[groupKey]) && (
            <Paper
              elevation={4}
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                mt: 1,
                minWidth: 180,
                zIndex: 1300,
                bgcolor: 'background.paper',
              }}
            >
              <ClickAwayListener onClickAway={handleDropdownClose(groupKey)}>
                <MenuList dense sx={{ py: 1 }}>
                  {group.items.map((item) => (
                    <MenuItem
                      key={item.path}
                      onClick={handleDropdownItemClick(item.path, groupKey)}
                      selected={isActiveItem(item.path)}
                      sx={{
                        px: 2,
                        py: 1,
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          },
                          '& .MuiListItemIcon-root': {
                            color: 'inherit',
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          )}
        </Box>
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
          {/* Top-level Items */}
          {topLevelNavItems.map((item) => (
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

          {/* Grouped Items */}
          {Object.entries(dropdownNavGroups).map(([groupKey, group]) => (
            <Box key={groupKey}>
              {/* Group Header */}
              <ListItem>
                <ListItemIcon>{group.icon}</ListItemIcon>
                <ListItemText 
                  primary={group.label} 
                  primaryTypographyProps={{ 
                    variant: 'subtitle2', 
                    fontWeight: 'bold',
                    color: 'text.secondary' 
                  }} 
                />
              </ListItem>
              
              {/* Group Items */}
              {group.items.map((item) => (
                <ListItem key={item.path} disablePadding sx={{ pl: 2 }}>
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      setMobileDrawerOpen(false);
                    }}
                    selected={isActiveItem(item.path)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              ))}
              
              {groupKey !== 'system' && <Divider sx={{ my: 1 }} />}
            </Box>
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