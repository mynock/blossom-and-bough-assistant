import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import NotionQuickEntry from './NotionQuickEntry';

const NotionEmbedPage: React.FunctionComponent = () => {
  useEffect(() => {
    // iOS-specific optimizations
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Prevent iOS zoom on double tap
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      });

      // Prevent iOS scroll bounce
      document.body.style.overscrollBehavior = 'none';
      
      // Ensure proper viewport height on iOS
      const setVH = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      
      setVH();
      window.addEventListener('resize', setVH);
      
      return () => {
        window.removeEventListener('resize', setVH);
      };
    }
  }, []);

  return (
    <Box
      sx={{
        // Use CSS custom property for iOS viewport height, fallback to 100vh
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        backgroundColor: '#f5f5f5',
        padding: 2,
        margin: 0,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // iOS-specific fixes
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent',
        // Prevent selection on iOS
        WebkitUserSelect: 'none',
        userSelect: 'none',
        // Ensure proper touch targets
        '& button': {
          minHeight: '44px', // iOS minimum touch target
          WebkitTapHighlightColor: 'transparent',
        },
      }}
    >
      <NotionQuickEntry />
    </Box>
  );
};

export default NotionEmbedPage; 