import React from 'react';
import { Box } from '@mui/material';
import NotionQuickEntry from './NotionQuickEntry';

const NotionEmbedPage: React.FunctionComponent = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: 2,
        margin: 0,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <NotionQuickEntry />
    </Box>
  );
};

export default NotionEmbedPage; 