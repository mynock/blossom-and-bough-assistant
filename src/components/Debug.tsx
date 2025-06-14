import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  Refresh,
  BugReport,
  Speed,
  Memory,
  TextFields,
  Settings,
} from '@mui/icons-material';

interface SystemPromptData {
  meta: {
    showType: string;
    showFullContent: boolean;
    timestamp: string;
  };
  current: {
    type: string;
    length: number;
    estimatedTokens: number;
    content: string;
  };
  condensed?: {
    length: number;
    estimatedTokens: number;
    content: string;
  };
  full?: {
    length: number;
    estimatedTokens: number;
    content: string;
  };
  tokenSavings: {
    characters: number;
    estimatedTokens: number;
    percentReduction: number;
  };
}

const Debug: React.FC = () => {
  const [data, setData] = useState<SystemPromptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Controls
  const [promptType, setPromptType] = useState<string>('both');
  const [showFullContent, setShowFullContent] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (promptType !== 'both') {
        params.append('type', promptType);
      }
      if (showFullContent) {
        params.append('fullContent', 'true');
      }
      
      const url = `/api/debug/system-prompt${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debug data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, [promptType, showFullContent]);

  const formatContent = (content: string, maxLength: number = 500) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...[truncated]';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <BugReport sx={{ mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          System Prompt Debug
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchDebugData}
          disabled={loading}
          sx={{ ml: 'auto' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Settings sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Debug Controls</Typography>
        </Box>
        
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Prompt Type</InputLabel>
              <Select
                value={promptType}
                label="Prompt Type"
                onChange={(e) => setPromptType(e.target.value)}
              >
                <MenuItem value="both">Both Prompts</MenuItem>
                <MenuItem value="condensed">Condensed Only</MenuItem>
                <MenuItem value="full">Full Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={showFullContent}
                  onChange={(e) => setShowFullContent(e.target.checked)}
                  color="primary"
                />
              }
              label="Show Full Content (No Truncation)"
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            {data?.meta && (
              <Typography variant="body2" color="text.secondary">
                Last updated: {new Date(data.meta.timestamp).toLocaleTimeString()}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {data && (
        <>
          {/* Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Speed sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Current Mode</Typography>
                  </Box>
                  <Chip 
                    label={data.current.type.toUpperCase()} 
                    color={data.current.type === 'condensed' ? 'success' : 'warning'}
                    variant="filled"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Memory sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Token Usage</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {data.current.estimatedTokens.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    tokens
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TextFields sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Characters</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {data.current.length.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    characters
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Speed sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="h6">Savings</Typography>
                  </Box>
                  <Typography variant="h4" color="success.main">
                    {data.tokenSavings.percentReduction}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    reduction
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Token Savings Alert */}
          {data.tokenSavings.percentReduction > 0 && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <strong>Token Optimization Active:</strong> Saving ~{data.tokenSavings.estimatedTokens.toLocaleString()} tokens 
              ({data.tokenSavings.percentReduction}% reduction) compared to full prompt. 
              This helps avoid rate limits and reduces API costs.
            </Alert>
          )}

          {/* Full Content Warning */}
          {showFullContent && data.full && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <strong>Full Content Mode:</strong> Displaying complete prompts without truncation. 
              Large prompts may impact browser performance.
            </Alert>
          )}

          {/* System Prompts */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              System Prompts
            </Typography>
            
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Current Prompt ({data.current.type})
                  </Typography>
                  <Chip 
                    label={`${data.current.estimatedTokens.toLocaleString()} tokens`}
                    size="small"
                    color="primary"
                    sx={{ mr: 2 }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                  <Typography 
                    variant="body2" 
                    component="pre" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      lineHeight: 1.4
                    }}
                  >
                    {data.current.content}
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>

            {data.condensed && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      Condensed Prompt
                    </Typography>
                    <Chip 
                      label={`${data.condensed!.estimatedTokens.toLocaleString()} tokens`}
                      size="small"
                      color="success"
                      sx={{ mr: 2 }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                    <Typography 
                      variant="body2" 
                      component="pre" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.875rem',
                        lineHeight: 1.4
                      }}
                    >
                      {data.condensed!.content}
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}

            {data.full && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      Full Prompt {!showFullContent && '(Preview)'}
                    </Typography>
                    <Chip 
                      label={`${data.full!.estimatedTokens.toLocaleString()} tokens`}
                      size="small"
                      color="warning"
                      sx={{ mr: 2 }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {!showFullContent && data.full!.content.includes('[truncated for display]') && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Showing preview only. Enable "Show Full Content" above to see the complete prompt.
                    </Alert>
                  )}
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                    <Typography 
                      variant="body2" 
                      component="pre" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.875rem',
                        lineHeight: 1.4
                      }}
                    >
                      {data.full!.content}
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        </>
      )}
    </Container>
  );
};

export default Debug; 