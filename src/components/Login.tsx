import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, CircularProgress } from '@mui/material';
import { Leaf } from '../icons';
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error checking auth status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkAuthStatus();
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    } else if (errorParam === 'oauth_not_configured') {
      setError('Google OAuth is not configured. Please contact your administrator.');
    } else if (errorParam === 'email_not_authorized') {
      setError(
        'Your email address is not authorized to access this system. Please contact your administrator to request access.',
      );
    }
  }, [searchParams, checkAuthStatus]);

  const handleGoogleLogin = () => {
    window.location.href = API_ENDPOINTS.AUTH_LOGIN;
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(180deg, var(--mist) 0%, var(--parchment) 100%)',
          gap: 14,
        }}
      >
        <CircularProgress size={28} />
        <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>Checking authentication…</div>
      </div>
    );
  }

  return (
    <div
      data-screen-label="Login"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, var(--mist) 0%, var(--parchment) 100%)',
        padding: '40px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 60,
              lineHeight: 1,
              marginBottom: 14,
            }}
            aria-hidden="true"
          >
            🌿
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              lineHeight: 1.1,
            }}
          >
            Blossom <span style={{ fontWeight: 500, color: 'var(--fg-muted)', fontStyle: 'italic' }}>&amp;</span> Bough
          </div>
          <div className="gc-eyebrow" style={{ marginTop: 8 }}>Garden Care CRM</div>
        </div>

        <div className="gc-card padded" style={{ padding: 28 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--fg-muted)',
              marginBottom: 22,
              textAlign: 'center',
            }}
          >
            Sign in to access your scheduling and client management system.
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="gc-btn secondary full"
            style={{ height: 46, fontSize: 14.5, gap: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.183l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '22px 0 18px',
            }}
          >
            <hr style={{ flex: 1, border: 0, borderTop: '1px solid var(--hairline)', margin: 0 }} />
            <span
              style={{
                fontSize: 11,
                color: 'var(--fg-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Secure
            </span>
            <hr style={{ flex: 1, border: 0, borderTop: '1px solid var(--hairline)', margin: 0 }} />
          </div>

          <div
            style={{
              fontSize: 12,
              color: 'var(--fg-muted)',
              lineHeight: 1.55,
              textAlign: 'center',
            }}
          >
            Only authorized team members can access this system. Contact your administrator if you need access.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            alignItems: 'center',
            marginTop: 24,
            fontSize: 11.5,
            color: 'var(--fg-muted)',
          }}
        >
          <Leaf size={12} strokeWidth={1.6} color="var(--moss-500)" />
          Field-tested in Portland gardens since 2019
        </div>
      </div>
    </div>
  );
};

export default Login;
