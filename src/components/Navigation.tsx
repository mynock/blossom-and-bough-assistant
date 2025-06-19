import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Schedule, Chat, Dashboard, BugReport, Person, Assignment, AccessTime, Upload, Business } from '@mui/icons-material';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/work-activities', label: 'Work Log', icon: <AccessTime /> },
    { path: '/work-notes-import', label: 'Import Notes', icon: <Upload /> },
    { path: '/clients', label: 'Clients', icon: <Business /> },
    { path: '/employees', label: 'Employees', icon: <Person /> },
    { path: '/projects', label: 'Projects', icon: <Assignment /> },
    { path: '/schedule', label: 'Schedule', icon: <Schedule /> },
    { path: '/chat', label: 'AI Assistant', icon: <Chat /> },
    { path: '/debug', label: 'Reports', icon: <BugReport /> },
  ];

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          🌿 Garden Care CRM
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{
                bgcolor: location.pathname === item.path ? 'rgba(255,255,255,0.1)' : 'transparent',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation; 