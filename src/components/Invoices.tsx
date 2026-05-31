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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Collapse,
} from '@mui/material';
import {
  Receipt,
  Plus as Add,
  Filter as FilterList,
  MoreVertical as MoreVert,
  RefreshCw as Sync,
  Eye as Visibility,
  DollarSign as AttachMoney,
  Building2 as Business,
  TrendingUp,
  CalendarDays as Schedule,
  ExternalLink as OpenInNew,
  Trash2 as Delete,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from '../icons';
import { useNavigate } from 'react-router-dom';
import { formatDateBriefPacific } from '../utils/dateUtils';
import { secureFetch } from '../services/csrf';

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

interface SyncResultError {
  type: 'unmatched_client' | 'qbo_fetch_failed' | 'invoice_persist_failed' | 'matcher_failed';
  qboInvoiceId?: string;
  message: string;
}

interface SyncPreviewLine {
  description: string;
  amount: number;
  kind: 'labor' | 'material';
  status: 'auto' | 'needs_review' | 'unmatched';
  matchedActivityId: number | null;
  matchScore: number | null;
}

interface SyncPreviewInvoice {
  qboInvoiceId: string;
  invoiceNumber: string;
  customerName: string;
  action: 'import' | 'update' | 'skip';
  lines: SyncPreviewLine[];
}

interface SyncResult {
  imported: number;
  updated: number;
  autoMatched: number;
  needsReview: number;
  unmatched: number;
  errors: SyncResultError[];
  dryRun?: boolean;
  preview?: SyncPreviewInvoice[];
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

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
      
      const response = await secureFetch(`/api/qbo/invoices/${invoiceId}/sync`, {
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

  const deleteInvoice = async (invoiceId: number) => {
    try {
      console.log('deleteInvoice function called with ID:', invoiceId);
      setDeleting(true);
      setError(null);
      
      console.log('Making DELETE request to:', `/api/qbo/invoices/${invoiceId}`);
      const response = await secureFetch(`/api/qbo/invoices/${invoiceId}`, {
        method: 'DELETE',
      });
      
      console.log('Delete response status:', response.status);
      console.log('Delete response ok:', response.ok);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete failed with error data:', errorData);
        throw new Error(errorData.details || 'Failed to delete invoice');
      }
      
      const result = await response.json();
      console.log('Delete successful, result:', result);
      
      await fetchInvoices(); // Refresh the list
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
    } catch (err) {
      console.error('Error deleting invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
    } finally {
      console.log('Delete operation finished, setting deleting to false');
      setDeleting(false);
    }
  };

  const runSync = async (dryRun: boolean) => {
    const setBusy = dryRun ? setPreviewing : setSyncing;
    try {
      setBusy(true);
      setError(null);

      const response = await secureFetch('/api/qbo/invoices/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        throw new Error(`${dryRun ? 'Preview' : 'Sync'} failed: ${response.status}`);
      }

      const result: SyncResult = await response.json();
      setSyncResult(result);
      setSyncModalOpen(true);
      setErrorsExpanded(false);
      setPreviewExpanded(false);
      // A dry run writes nothing, so the invoice list is unchanged.
      if (!dryRun) {
        await fetchInvoices();
      }
    } catch (err) {
      console.error('Error syncing invoices:', err);
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${dryRun ? 'preview' : 'sync'} invoices from QuickBooks`
      );
    } finally {
      setBusy(false);
    }
  };

  const syncAllInvoices = () => runSync(false);
  const previewSync = () => runSync(true);

  const humanizeErrorType = (type: SyncResultError['type']): string => {
    switch (type) {
      case 'unmatched_client': return 'Unmatched client';
      case 'qbo_fetch_failed': return 'QuickBooks fetch failed';
      case 'invoice_persist_failed': return 'Invoice save failed';
      case 'matcher_failed': return 'Matcher failed';
      default: return type;
    }
  };

  const handleSyncModalClose = () => {
    setSyncModalOpen(false);
    setSyncResult(null);
    setErrorsExpanded(false);
    setPreviewExpanded(false);
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
        return <AttachMoney size={16} />;
      case 'sent':
        return <OpenInNew size={16} />;
      case 'overdue':
        return <Schedule size={16} />;
      case 'draft':
        return <Receipt size={16} />;
      default:
        return <Receipt size={16} />;
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

  const handleDeleteClick = () => {
    console.log('Delete clicked for invoice:', selectedInvoice);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteConfirm = () => {
    console.log('Delete confirm clicked, selectedInvoice:', selectedInvoice);
    if (selectedInvoice) {
      console.log('Calling deleteInvoice with ID:', selectedInvoice.id);
      deleteInvoice(selectedInvoice.id);
    } else {
      console.error('No selected invoice found!');
    }
  };

  const handleDeleteCancel = () => {
    console.log('Delete cancelled');
    setDeleteDialogOpen(false);
    setSelectedInvoice(null);
  };

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
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="text"
              startIcon={previewing ? <CircularProgress size={16} /> : <Visibility size={16} />}
              onClick={previewSync}
              disabled={syncing || previewing}
            >
              {previewing ? 'Previewing...' : 'Preview sync'}
            </Button>
            <Button
              variant="outlined"
              startIcon={syncing ? <CircularProgress size={16} /> : <Sync />}
              onClick={syncAllInvoices}
              disabled={syncing || previewing}
            >
              {syncing ? 'Syncing...' : 'Sync from QuickBooks'}
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/clients')}
            >
              Create Invoice
            </Button>
          </Box>
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
                  <Receipt size={40} />
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
                  <AttachMoney size={40} />
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
                  <TrendingUp size={40} />
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
                  <Schedule size={40} />
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
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice from a client page'}
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
                <Visibility size={16} />
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
                <Sync size={16} />
              </ListItemIcon>
              <ListItemText>Sync Status</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => {
              if (selectedInvoice) {
                navigate(`/clients/${selectedInvoice.clientId}`);
              }
              handleMenuClose();
            }}>
              <ListItemIcon>
                <Business size={16} />
              </ListItemIcon>
              <ListItemText>View Client</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem 
              onClick={handleDeleteClick}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <Delete size={16} />
              </ListItemIcon>
              <ListItemText>Delete Invoice</ListItemText>
            </MenuItem>
          </MenuList>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Delete Invoice</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete invoice <strong>
                {selectedInvoice?.invoiceNumber || 'Unknown'}
              </strong>?
              {!selectedInvoice && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  Warning: No invoice selected!
                </Typography>
              )}
            </DialogContentText>
            <DialogContentText sx={{ mt: 2, color: 'warning.main' }}>
              This action will:
            </DialogContentText>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              <Typography component="li" variant="body2" color="warning.main">
                Remove the invoice from your local database
              </Typography>
              <Typography component="li" variant="body2" color="warning.main">
                Revert associated work activities back to "completed" status
              </Typography>
              <Typography component="li" variant="body2" color="warning.main">
                The invoice may need to be manually voided in QuickBooks
              </Typography>
            </Box>
            <DialogContentText sx={{ mt: 2, color: 'error.main', fontWeight: 'medium' }}>
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleDeleteCancel}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              onClick={(e) => {
                console.log('DELETE INVOICE button clicked!', e);
                e.preventDefault();
                e.stopPropagation();
                handleDeleteConfirm();
              }}
              color="error"
              variant="contained"
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
            >
              {deleting ? 'Deleting...' : 'Delete Invoice'}
            </Button>
          </DialogActions>
        </Dialog>
        {/* Sync Results Modal */}
        <Dialog
          open={syncModalOpen}
          onClose={handleSyncModalClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {syncResult?.dryRun ? 'QuickBooks sync preview' : 'QuickBooks sync complete'}
          </DialogTitle>
          <DialogContent>
            {syncResult?.dryRun && (
              <Alert severity="info" sx={{ mb: 2 }}>
                This is a preview — <strong>no changes were made</strong>. The numbers
                below show what a real sync would do.
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {syncResult?.imported ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {syncResult?.dryRun ? 'Would import' : 'Imported'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">
                    {syncResult?.updated ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {syncResult?.dryRun ? 'Would update' : 'Updated'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {syncResult?.autoMatched ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Auto-matched
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color={(syncResult?.needsReview ?? 0) > 0 ? 'warning.main' : 'text.primary'}>
                    {syncResult?.needsReview ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Needs review
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color={(syncResult?.errors?.length ?? 0) > 0 ? 'error.main' : 'text.primary'}>
                    {syncResult?.errors?.length ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Errors
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {(syncResult?.errors?.length ?? 0) > 0 && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  startIcon={<AlertTriangle size={16} />}
                  endIcon={errorsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  onClick={() => setErrorsExpanded(prev => !prev)}
                >
                  {errorsExpanded ? 'Hide' : 'Show'} errors ({syncResult!.errors.length})
                </Button>
                <Collapse in={errorsExpanded}>
                  <Box sx={{ mt: 1, maxHeight: 240, overflowY: 'auto' }}>
                    {syncResult!.errors.map((err, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          mb: 1,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'error.50',
                          border: '1px solid',
                          borderColor: 'error.200',
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium" color="error.main">
                          {humanizeErrorType(err.type)}
                          {err.qboInvoiceId && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              (QBO #{err.qboInvoiceId})
                            </Typography>
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {err.message}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}

            {syncResult?.dryRun && (syncResult.preview?.length ?? 0) > 0 && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  variant="text"
                  endIcon={previewExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  onClick={() => setPreviewExpanded(prev => !prev)}
                >
                  {previewExpanded ? 'Hide' : 'Show'} per-invoice breakdown ({syncResult.preview!.length})
                </Button>
                <Collapse in={previewExpanded}>
                  <Box sx={{ mt: 1, maxHeight: 320, overflowY: 'auto' }}>
                    {syncResult.preview!.map((inv) => (
                      <Box
                        key={inv.qboInvoiceId}
                        sx={{
                          mb: 1,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'grey.50',
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium">
                          #{inv.invoiceNumber} · {inv.customerName || '(unknown customer)'}
                          <Chip
                            label={inv.action}
                            size="small"
                            sx={{ ml: 1 }}
                            color={inv.action === 'skip' ? 'error' : inv.action === 'update' ? 'default' : 'success'}
                          />
                        </Typography>
                        {inv.lines.map((ln, lIdx) => (
                          <Box key={lIdx} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                              {ln.description || '(no description)'} · ${ln.amount.toFixed(2)}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={
                                ln.status === 'auto' ? 'success.main'
                                  : ln.status === 'needs_review' ? 'warning.main'
                                  : 'text.disabled'
                              }
                            >
                              {ln.status}
                              {ln.matchedActivityId != null && ` → #${ln.matchedActivityId}`}
                              {ln.matchScore != null && ` (${ln.matchScore.toFixed(1)})`}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleSyncModalClose}>
              Close
            </Button>
            {syncResult?.dryRun ? (
              <Button
                variant="contained"
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={16} /> : <Sync />}
                onClick={() => {
                  handleSyncModalClose();
                  syncAllInvoices();
                }}
              >
                Run sync for real
              </Button>
            ) : (
              (syncResult?.needsReview ?? 0) > 0 && (
                <Button
                  variant="contained"
                  onClick={() => {
                    handleSyncModalClose();
                    navigate('/invoices/review');
                  }}
                >
                  Review {syncResult!.needsReview} match{syncResult!.needsReview === 1 ? '' : 'es'}
                </Button>
              )
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Invoices;