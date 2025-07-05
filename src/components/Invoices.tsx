import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  IconButton,
  Menu,
  MenuList,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Receipt,
  Add,
  FilterList,
  MoreVert,
  Sync,
  Visibility,
  AttachMoney,
  Business,
  TrendingUp,
  Schedule,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { formatDateBriefPacific } from '../utils/dateUtils';

interface Invoice {
  id: number;
  qboInvoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  invoiceDate: string;
  dueDate: string | null;
  clientId: number;
  clientName: string;
  qboSyncAt: string;
  createdAt: string;
}

interface InvoiceStats {
  total: number;
  totalAmount: number;
  draftCount: number;
  sentCount: number;
  paidCount: number;
  overdueCount: number;
}

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<keyof Invoice>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    // Filter and sort invoices
    let filtered = invoices.filter(invoice => {
      const matchesSearch = !searchTerm || 
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort invoices
    filtered.sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return order === 'asc' ? -1 : 1;
      if (bValue === null) return order === 'asc' ? 1 : -1;
      
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, statusFilter, orderBy, order]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/qbo/invoices');
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const syncInvoiceStatus = async (invoiceId: number) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/qbo/invoices/${invoiceId}/sync`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync invoice status');
      }
      
      await fetchInvoices(); // Refresh the list
    } catch (err) {
      console.error('Error syncing invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync invoice');
    }
  };

  const handleSort = (property: keyof Invoice) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: Invoice) => {
    setAnchorEl(event.currentTarget);
    setSelectedInvoice(invoice);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedInvoice(null);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'success';
      case 'sent':
        return 'info';
      case 'overdue':
        return 'error';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <AttachMoney fontSize="small" />;
      case 'sent':
        return <OpenInNew fontSize="small" />;
      case 'overdue':
        return <Schedule fontSize="small" />;
      case 'draft':
        return <Receipt fontSize="small" />;
      default:
        return <Receipt fontSize="small" />;
    }
  };

  const calculateStats = (): InvoiceStats => {
    const stats: InvoiceStats = {
      total: invoices.length,
      totalAmount: invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      draftCount: invoices.filter(i => i.status === 'draft').length,
      sentCount: invoices.filter(i => i.status === 'sent').length,
      paidCount: invoices.filter(i => i.status === 'paid').length,
      overdueCount: invoices.filter(i => i.status === 'overdue').length,
    };
    return stats;
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Invoices
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and track your QuickBooks invoices
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/work-activities')}
          >
            Create Invoice
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Total Invoices
                    </Typography>
                    <Typography variant="h4">
                      {stats.total}
                    </Typography>
                  </Box>
                  <Receipt color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h4">
                      ${stats.totalAmount.toFixed(2)}
                    </Typography>
                  </Box>
                  <AttachMoney color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Paid
                    </Typography>
                    <Typography variant="h4">
                      {stats.paidCount}
                    </Typography>
                  </Box>
                  <TrendingUp color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      Overdue
                    </Typography>
                    <Typography variant="h4">
                      {stats.overdueCount}
                    </Typography>
                  </Box>
                  <Schedule color="error" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="sent">Sent</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Invoices Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'invoiceNumber'}
                    direction={orderBy === 'invoiceNumber' ? order : 'asc'}
                    onClick={() => handleSort('invoiceNumber')}
                  >
                    Invoice #
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'clientName'}
                    direction={orderBy === 'clientName' ? order : 'asc'}
                    onClick={() => handleSort('clientName')}
                  >
                    Client
                  </TableSortLabel>
                </TableCell>
                <TableCell>Status</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'totalAmount'}
                    direction={orderBy === 'totalAmount' ? order : 'asc'}
                    onClick={() => handleSort('totalAmount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'invoiceDate'}
                    direction={orderBy === 'invoiceDate' ? order : 'asc'}
                    onClick={() => handleSort('invoiceDate')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {invoice.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => navigate(`/clients/${invoice.clientId}`)}
                      sx={{ textTransform: 'none' }}
                    >
                      {invoice.clientName}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(invoice.status)}
                      label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      color={getStatusColor(invoice.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      ${invoice.totalAmount.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateBriefPacific(invoice.invoiceDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={invoice.dueDate && new Date(invoice.dueDate) < new Date() ? 'error' : 'text.secondary'}>
                      {invoice.dueDate ? formatDateBriefPacific(invoice.dueDate) : 'No due date'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, invoice)}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredInvoices.length === 0 && !loading && (
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="text.secondary">
              No invoices found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice from completed work activities'}
            </Typography>
          </Box>
        )}

        {/* Context Menu */}
        <Menu
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
          <MenuList>
            <MenuItem onClick={() => {
              if (selectedInvoice) {
                navigate(`/api/qbo/invoices/${selectedInvoice.id}`);
              }
              handleMenuClose();
            }}>
              <ListItemIcon>
                <Visibility fontSize="small" />
              </ListItemIcon>
              <ListItemText>View Details</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => {
              if (selectedInvoice) {
                syncInvoiceStatus(selectedInvoice.id);
              }
              handleMenuClose();
            }}>
              <ListItemIcon>
                <Sync fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sync Status</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => {
              if (selectedInvoice) {
                navigate(`/clients/${selectedInvoice.clientId}`);
              }
              handleMenuClose();
            }}>
              <ListItemIcon>
                <Business fontSize="small" />
              </ListItemIcon>
              <ListItemText>View Client</ListItemText>
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
    </Container>
  );
};

export default Invoices;