import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { secureFetch } from '../services/csrf';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Plus,
  Search,
  Repeat,
  Download,
  ChevronRight,
} from '../icons';

interface Client {
  id: number;
  clientId: string;
  name: string;
  address: string;
  geoZone: string;
  isRecurringMaintenance: boolean;
  maintenanceIntervalWeeks?: number;
  maintenanceHoursPerVisit?: string;
  maintenanceRate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceTarget?: string;
  priorityLevel: 'High' | 'Medium' | 'Low';
  scheduleFlexibility?: string;
  preferredDays?: string;
  preferredTime?: string;
  specialNotes?: string;
  activeStatus: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  totalWorkActivities: number;
  totalHours: number;
  totalBillableHours: number;
}

type PriorityFilter = 'All' | 'High' | 'Medium' | 'Low';

const priorityChipClass = (p: Client['priorityLevel']) => {
  if (p === 'High') return 'gc-chip bloom';
  if (p === 'Medium') return 'gc-chip honey';
  return 'gc-chip green';
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const ClientManagement: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');

  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    address: '',
    geoZone: '',
    isRecurringMaintenance: false,
    priorityLevel: 'Medium',
    activeStatus: 'active',
  });

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const response = await secureFetch('/api/clients');
      const data = await response.json();
      setClients(data.clients);
    } catch (error) {
      showSnackbar('Failed to fetch clients', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleCreate = () => {
    setSelectedClient(null);
    setFormData({
      name: '',
      address: '',
      geoZone: '',
      isRecurringMaintenance: false,
      priorityLevel: 'Medium',
      activeStatus: 'active',
    });
    setIsCreating(true);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = isCreating ? '/api/clients' : `/api/clients/${selectedClient?.id}`;
      const method = isCreating ? 'POST' : 'PUT';
      const response = await secureFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        showSnackbar(isCreating ? 'Client created' : 'Client updated', 'success');
        setEditDialogOpen(false);
        fetchClients();
      } else {
        throw new Error('Save failed');
      }
    } catch {
      showSnackbar('Failed to save client', 'error');
    }
  };

  const handleInputChange = <K extends keyof Client>(field: K, value: Client[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (priorityFilter !== 'All' && c.priorityLevel !== priorityFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.clientId && c.clientId.toLowerCase().includes(q))
      );
    });
  }, [clients, query, priorityFilter]);

  const recurringCount = useMemo(
    () => clients.filter((c) => c.isRecurringMaintenance).length,
    [clients],
  );

  if (loading) {
    return (
      <main className="gc-page-wide" style={{ textAlign: 'center', paddingTop: 48 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading clients…
        </Typography>
      </main>
    );
  }

  return (
    <main className="gc-page-wide" data-screen-label="Clients">
      <div
        className="gc-page-header"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="gc-eyebrow">Roster</div>
          <h1>Clients</h1>
          <div className="sub">
            {clients.length} {clients.length === 1 ? 'client' : 'clients'} · {recurringCount} on recurring maintenance
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="gc-btn secondary">
            <Download size={15} strokeWidth={1.8} className="ic" />
            Export CSV
          </button>
          <button type="button" className="gc-btn primary" onClick={handleCreate}>
            <Plus size={15} strokeWidth={1.8} className="ic" />
            Add client
          </button>
        </div>
      </div>

      <div className="gc-card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: 16,
            borderBottom: '1px solid var(--hairline)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 260px', maxWidth: 320, position: 'relative' }}>
            <Search
              size={14}
              strokeWidth={1.6}
              style={{
                position: 'absolute',
                top: '50%',
                left: 10,
                transform: 'translateY(-50%)',
                color: 'var(--fg-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="gc-input"
              style={{ paddingLeft: 30 }}
              placeholder="Search clients or addresses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['All', 'High', 'Medium', 'Low'] as PriorityFilter[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`gc-btn sm ${priorityFilter === p ? 'primary' : 'secondary'}`}
              >
                {p}
                {p !== 'All' ? ' priority' : ''}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 12,
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {filtered.length} / {clients.length} shown
          </span>
        </div>

        <table className="gc-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Address</th>
              <th>Zone</th>
              <th>Priority</th>
              <th>Maintenance</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Hours</th>
              <th style={{ textAlign: 'right' }}>Billable</th>
              <th aria-label="" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="gc-avatar sm">{initials(c.name)}</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--fg-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {c.clientId}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--fg-muted)' }}>{c.address}</td>
                <td>
                  <span className="gc-chip outline">{c.geoZone || '—'}</span>
                </td>
                <td>
                  <span className={priorityChipClass(c.priorityLevel)}>
                    <span className="dot" />
                    {c.priorityLevel}
                  </span>
                </td>
                <td>
                  {c.isRecurringMaintenance ? (
                    <span className="gc-chip green">
                      <Repeat size={11} strokeWidth={1.8} />
                      {c.maintenanceIntervalWeeks ? `every ${c.maintenanceIntervalWeeks}w` : 'Recurring'}
                    </span>
                  ) : (
                    <span className="gc-chip outline">One-time</span>
                  )}
                </td>
                <td>
                  {c.activeStatus === 'active' ? (
                    <span className="gc-chip green">
                      <span className="dot" />
                      Active
                    </span>
                  ) : (
                    <span className="gc-chip outline">Paused</span>
                  )}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {Number(c.totalHours ?? 0).toFixed(1)}h
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--moss-700)',
                    fontWeight: 600,
                  }}
                >
                  {Number(c.totalBillableHours ?? 0).toFixed(1)}h
                </td>
                <td style={{ width: 40 }}>
                  <ChevronRight size={16} strokeWidth={1.8} color="var(--fg-subtle)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'var(--fg-muted)' }}>
            No clients match the current filters.
          </Box>
        )}
      </div>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isCreating ? 'Create new client' : `Edit ${selectedClient?.name}`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                fullWidth
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Client ID"
                fullWidth
                value={formData.clientId || ''}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                disabled={!isCreating}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Address"
                fullWidth
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Geographic zone"
                fullWidth
                value={formData.geoZone || ''}
                onChange={(e) => handleInputChange('geoZone', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority level</InputLabel>
                <Select
                  label="Priority level"
                  value={formData.priorityLevel || 'Medium'}
                  onChange={(e) => handleInputChange('priorityLevel', e.target.value as Client['priorityLevel'])}
                >
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.activeStatus || 'active'}
                  onChange={(e) => handleInputChange('activeStatus', e.target.value as Client['activeStatus'])}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isRecurringMaintenance || false}
                    onChange={(e) =>
                      handleInputChange('isRecurringMaintenance', e.target.checked)
                    }
                  />
                }
                label="Recurring maintenance"
              />
            </Grid>
            {formData.isRecurringMaintenance && (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Interval (weeks)"
                    type="number"
                    fullWidth
                    value={formData.maintenanceIntervalWeeks || ''}
                    onChange={(e) =>
                      handleInputChange(
                        'maintenanceIntervalWeeks',
                        parseInt(e.target.value, 10),
                      )
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Hours per visit"
                    fullWidth
                    value={formData.maintenanceHoursPerVisit || ''}
                    onChange={(e) =>
                      handleInputChange('maintenanceHoursPerVisit', e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Maintenance rate"
                    fullWidth
                    value={formData.maintenanceRate || ''}
                    onChange={(e) => handleInputChange('maintenanceRate', e.target.value)}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Preferred days"
                fullWidth
                value={formData.preferredDays || ''}
                onChange={(e) => handleInputChange('preferredDays', e.target.value)}
                placeholder="e.g., Monday Wednesday Friday"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Preferred time"
                fullWidth
                value={formData.preferredTime || ''}
                onChange={(e) => handleInputChange('preferredTime', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={formData.specialNotes || ''}
                onChange={(e) => handleInputChange('specialNotes', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {isCreating ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

export default ClientManagement;
