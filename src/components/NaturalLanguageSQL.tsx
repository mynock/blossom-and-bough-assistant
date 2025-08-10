import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send,
  ExpandMore,
  QuestionMark,
  Code,
  BarChart,
  TableChart,
  Info,
  Schema,
  Lightbulb,
  ContentCopy,
  CheckCircle,
} from '@mui/icons-material';
import BreakdownChart from './charts/BreakdownChart';
import TimeSeriesChart from './charts/TimeSeriesChart';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface SQLQueryResult {
  query: string;
  results: any[];
  rowCount: number;
  explanation: string;
  chartConfig?: {
    type: 'bar' | 'line' | 'pie';
    xAxisKey: string;
    yAxisKey: string;
    title: string;
  };
  summaryStats?: {
    [key: string]: number | string;
  };
}

interface ExampleCategory {
  category: string;
  questions: string[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const NaturalLanguageSQL: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SQLQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleCategory[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [copiedQuery, setCopiedQuery] = useState(false);

  useEffect(() => {
    fetchExamples();
  }, []);

  const fetchExamples = async () => {
    try {
      const response = await api.get('/natural-language-sql/examples');
      setExamples(response.data.data);
    } catch (error) {
      console.error('Failed to fetch examples:', error);
    }
  };

  const fetchSchema = async () => {
    try {
      const response = await api.get('/natural-language-sql/schema');
      setSchema(response.data.data);
    } catch (error) {
      console.error('Failed to fetch schema:', error);
      setError('Failed to fetch database schema');
    }
  };

  const handleSubmit = async (questionToAsk: string = question) => {
    if (!questionToAsk.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post('/natural-language-sql/query', {
        question: questionToAsk.trim(),
        includeChartConfig: true
      });

      setResult(response.data.data);
      setTabValue(1); // Switch to results tab
    } catch (error: any) {
      console.error('Query failed:', error);
      setError(
        error.response?.data?.message || 
        error.message || 
        'An unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuestion: string) => {
    setQuestion(exampleQuestion);
    handleSubmit(exampleQuestion);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      handleSubmit();
    }
  };

  const handleCopyQuery = async () => {
    if (result?.query) {
      await navigator.clipboard.writeText(result.query);
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    }
  };

  const handleSchemaClick = async () => {
    if (!schema) {
      await fetchSchema();
    }
    setSchemaDialogOpen(true);
  };

  const renderChart = () => {
    if (!result?.chartConfig || !result.results.length) return null;

    const { chartConfig } = result;
    const chartData = result.results.map((row, index) => ({
      name: row[chartConfig.xAxisKey] || `Row ${index + 1}`,
      value: parseFloat(row[chartConfig.yAxisKey]) || 0,
      ...row
    }));

    if (chartConfig.type === 'line') {
      // For line charts, we need to transform the data to match TimeSeriesDataPoint interface
      const timeSeriesData = result.results.map((row, index) => ({
        date: row[chartConfig.xAxisKey] || `Row ${index + 1}`,
        billableHours: parseFloat(row[chartConfig.yAxisKey]) || 0,
        totalHours: parseFloat(row[chartConfig.yAxisKey]) || 0,
        travelTimeHours: 0,
        breakTimeHours: 0,
        clientName: row.client_name || row.name || '',
        employeeName: row.employee_name || row.name || ''
      }));

      const dataKeys = [
        {
          key: 'billableHours' as keyof typeof timeSeriesData[0],
          name: chartConfig.yAxisKey,
          color: '#2e7d32'
        }
      ];

      return (
        <TimeSeriesChart
          data={timeSeriesData}
          title={chartConfig.title}
          dataKeys={dataKeys}
          height={400}
          yAxisLabel={chartConfig.yAxisKey}
        />
      );
    } else {
      return (
        <BreakdownChart
          data={chartData}
          title={chartConfig.title}
          dataKey="value"
          height={400}
          showToggle={chartConfig.type !== 'pie'}
        />
      );
    }
  };

  const renderResultsTable = () => {
    if (!result?.results.length) return null;

    const columns = Object.keys(result.results[0]);
    const maxRows = 100; // Limit displayed rows

    return (
      <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column} sx={{ fontWeight: 'bold' }}>
                  {column}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {result.results.slice(0, maxRows).map((row, index) => (
              <TableRow key={index} hover>
                {columns.map((column) => (
                  <TableCell key={column}>
                    {row[column] !== null && row[column] !== undefined
                      ? String(row[column])
                      : '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {result.results.length > maxRows && (
          <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
            <Typography variant="body2" color="text.secondary">
              Showing first {maxRows} of {result.results.length} rows
            </Typography>
          </Box>
        )}
      </TableContainer>
    );
  };

  const renderSummaryStats = () => {
    if (!result?.summaryStats) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(result.summaryStats).map(([key, value]) => (
          <Grid item xs={6} sm={4} md={3} key={key}>
            <Card elevation={1}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h6" color="primary">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {key}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
        Ask Your Data
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Ask natural language questions about your business data and get instant insights with charts and analysis.
      </Typography>

      {/* Query Input */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your data... (e.g., 'How many clients do we have?' or 'Show me our top clients by revenue this year')"
            variant="outlined"
            disabled={loading}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => handleSubmit()}
              disabled={loading || !question.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <Send />}
              sx={{ minWidth: 120 }}
            >
              {loading ? 'Analyzing...' : 'Ask'}
            </Button>
            <Tooltip title="View database schema">
              <IconButton onClick={handleSchemaClick} size="small">
                <Schema />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Tip: Press Ctrl+Enter to submit quickly
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results and Examples Tabs */}
      <Paper elevation={2} sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<Lightbulb />} label="Examples & Help" />
          {result && <Tab icon={<BarChart />} label="Results & Analysis" />}
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Examples */}
          <Typography variant="h6" gutterBottom>
            Example Questions
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Click any question to run it instantly, or use them as inspiration for your own questions.
          </Typography>

          <Grid container spacing={2}>
            {examples.map((category) => (
              <Grid item xs={12} md={6} lg={4} key={category.category}>
                <Card elevation={1}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                      {category.category}
                    </Typography>
                    <List dense>
                      {category.questions.map((q, index) => (
                        <ListItem 
                          key={index}
                          button
                          onClick={() => handleExampleClick(q)}
                          sx={{ 
                            pl: 0, 
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'grey.50' }
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <QuestionMark fontSize="small" color="primary" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={q}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {result && (
          <TabPanel value={tabValue} index={1}>
            {/* Query Info */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Code color="primary" />
                <Typography variant="h6">Generated SQL Query</Typography>
                <Tooltip title={copiedQuery ? "Copied!" : "Copy query"}>
                  <IconButton size="small" onClick={handleCopyQuery}>
                    {copiedQuery ? <CheckCircle color="success" /> : <ContentCopy />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                  {result.query}
                </Typography>
              </Paper>
            </Box>

            {/* Explanation */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Analysis:</strong> {result.explanation}
              </Typography>
            </Alert>

            {/* Summary Stats */}
            {renderSummaryStats()}

            {/* Chart */}
            {result.chartConfig && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  <BarChart sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Visual Analysis
                </Typography>
                {renderChart()}
              </Box>
            )}

            {/* Results Table */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                <TableChart sx={{ mr: 1, verticalAlign: 'middle' }} />
                Raw Data ({result.rowCount} rows)
              </Typography>
              {renderResultsTable()}
            </Box>
          </TabPanel>
        )}
      </Paper>

      {/* Schema Dialog */}
      <Dialog 
        open={schemaDialogOpen} 
        onClose={() => setSchemaDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schema color="primary" />
            Database Schema Reference
          </Box>
        </DialogTitle>
        <DialogContent>
          {schema && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Available Tables
              </Typography>
              {schema.tables.map((table: any) => (
                <Accordion key={table.name}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {table.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                      {table.description}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {table.columns.map((column: any) => (
                        <ListItem key={column.name}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip label={column.name} size="small" variant="outlined" />
                                <Chip label={column.type} size="small" color="primary" />
                              </Box>
                            }
                            secondary={column.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Query Tips
              </Typography>
              <List>
                {schema.tips.map((tip: string, index: number) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Info color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={tip} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSchemaDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NaturalLanguageSQL;