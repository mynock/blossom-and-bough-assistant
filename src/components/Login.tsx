import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Container,
  Avatar,
  Divider
} from '@mui/material';
import { Google as GoogleIcon, LocalFlorist } from '@mui/icons-material';
import { API_ENDPOINTS, apiClient } from '../config/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.AUTH_STATUS);
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          navigate('/');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // Check if already authenticated
    checkAuthStatus();
    
    // Check for error in URL params
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    } else if (errorParam === 'oauth_not_configured') {
      setError('Google OAuth is not configured. Please contact your administrator.');
    } else if (errorParam === 'email_not_authorized') {
      setError('Your email address is not authorized to access this system. Please contact your administrator to request access.');
    }
  }, [searchParams, checkAuthStatus]);

  const handleGoogleLogin = () => {
    console.log('🔵 [FRONTEND] Sign in with Google button clicked');
    console.log('🔵 [FRONTEND] Redirecting to OAuth endpoint:', API_ENDPOINTS.AUTH_LOGIN);
    // Use centralized OAuth URL (environment-aware)
    window.location.href = API_ENDPOINTS.AUTH_LOGIN;
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'grey.50'
        }}
      >
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        bgcolor: 'grey.50',
        py: 12
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 64, height: 64, mb: 2 }}>
            <LocalFlorist sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h3" component="h1" fontWeight="bold" color="primary" gutterBottom>
            Garden Care CRM
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Sign in to access your scheduling and client management system
          </Typography>
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="outlined"
            size="large"
            fullWidth
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontSize: '1rem',
              borderColor: 'grey.300',
              color: 'grey.700',
              '&:hover': {
                borderColor: 'grey.400',
                bgcolor: 'grey.50'
              }
            }}
          >
            Sign in with Google
          </Button>

          <Divider sx={{ width: '100%', my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Secure authentication
            </Typography>
          </Divider>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            Only authorized team members can access this system.
            <br />
            Contact your administrator if you need access.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;

 