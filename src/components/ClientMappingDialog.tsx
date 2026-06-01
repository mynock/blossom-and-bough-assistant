import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Autocomplete,
} from '@mui/material';
import { secureFetch } from '../services/csrf';

// Mirror of server/src/services/ClientLinkService types.
interface MappingClient {
  id: number;
  name: string;
  qboCustomerId: string | null;
}

interface CustomerMappingRow {
  qboCustomerId: string;
  qboName: string;
  linkedClientId: number | null;
  suggestedClientId: number | null;
  candidateClientIds: number[];
}

interface MappingState {
  clients: MappingClient[];
  customers: CustomerMappingRow[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const ClientMappingDialog: React.FC<Props> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [clients, setClients] = useState<MappingClient[]>([]);
  const [customers, setCustomers] = useState<CustomerMappingRow[]>([]);
  // qboCustomerId -> chosen clientId (null = unmapped)
  const [selection, setSelection] = useState<Record<string, number | null>>({});
  const [filterText, setFilterText] = useState('');
  const [onlyAttention, setOnlyAttention] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSavedNote(null);
    try {
      const resp = await fetch('/api/qbo/customers/mapping', { credentials: 'include' });
      if (!resp.ok) throw new Error(`Failed to load mapping (${resp.status})`);
      const data: MappingState = await resp.json();
      setClients(data.clients);
      setCustomers(data.customers);
      // Pre-fill with the current link, or a confident suggestion.
      const init: Record<string, number | null> = {};
      for (const c of data.customers) {
        init[c.qboCustomerId] = c.linkedClientId ?? c.suggestedClientId ?? null;
      }
      setSelection(init);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client mapping');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const clientById = useMemo(() => {
    const m: Record<number, MappingClient> = {};
    for (const c of clients) m[c.id] = c;
    return m;
  }, [clients]);

  // Clients currently chosen in any row — used to prevent picking one client
  // for two customers (which the server would reject).
  const selectedClientIds = useMemo(() => {
    const s = new Set<number>();
    for (const id of Object.values(selection)) if (id != null) s.add(id);
    return s;
  }, [selection]);

  const setRow = (qboCustomerId: string, clientId: number | null) => {
    setSelection((prev) => ({ ...prev, [qboCustomerId]: clientId }));
    setSavedNote(null);
  };

  const acceptAllSuggestions = () => {
    setSelection((prev) => {
      const next = { ...prev };
      const taken = new Set(selectedClientIds);
      for (const c of customers) {
        if (
          c.linkedClientId == null &&
          c.suggestedClientId != null &&
          next[c.qboCustomerId] == null &&
          !taken.has(c.suggestedClientId)
        ) {
          next[c.qboCustomerId] = c.suggestedClientId;
          taken.add(c.suggestedClientId);
        }
      }
      return next;
    });
    setSavedNote(null);
  };

  const dirtyChanges = useMemo(
    () =>
      customers
        .filter((c) => (selection[c.qboCustomerId] ?? null) !== (c.linkedClientId ?? null))
        .map((c) => ({ qboCustomerId: c.qboCustomerId, clientId: selection[c.qboCustomerId] ?? null })),
    [customers, selection]
  );

  const save = async () => {
    if (dirtyChanges.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await secureFetch('/api/qbo/customers/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: dirtyChanges }),
      });
      if (!resp.ok) {
        let msg = `Save failed (${resp.status})`;
        try {
          const d = await resp.json();
          msg = d.details || d.error || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const note = `Saved ${dirtyChanges.length} mapping${dirtyChanges.length === 1 ? '' : 's'}.`;
      await load(); // refresh linked state
      setSavedNote(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const rowStatus = (c: CustomerMappingRow) => {
    const sel = selection[c.qboCustomerId] ?? null;
    const orig = c.linkedClientId ?? null;
    if (sel !== orig) {
      return sel != null
        ? { label: 'will link', color: 'primary' as const }
        : { label: 'will unlink', color: 'warning' as const };
    }
    if (sel != null) return { label: 'linked', color: 'success' as const };
    if (c.candidateClientIds.length > 1) return { label: 'ambiguous', color: 'warning' as const };
    return { label: 'no match', color: 'default' as const };
  };

  const visibleCustomers = useMemo(() => {
    const ft = filterText.trim().toLowerCase();
    return customers.filter((c) => {
      if (ft && !c.qboName.toLowerCase().includes(ft)) return false;
      if (onlyAttention) {
        const sel = selection[c.qboCustomerId] ?? null;
        if (sel != null) return false; // already handled
      }
      return true;
    });
  }, [customers, filterText, onlyAttention, selection]);

  const counts = useMemo(() => {
    let linked = 0;
    let attention = 0;
    for (const c of customers) {
      const sel = selection[c.qboCustomerId] ?? null;
      if (sel != null) linked++;
      else attention++;
    }
    return { linked, attention, total: customers.length };
  }, [customers, selection]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Map clients to QuickBooks</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Each QuickBooks customer links to one CRM client. Confident surname matches are
          pre-filled as suggestions — review them, resolve couples/businesses by hand, then save.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {savedNote && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSavedNote(null)}>
            {savedNote}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="body2">
                {counts.linked}/{counts.total} mapped · {counts.attention} need attention
              </Typography>
              <Box sx={{ flex: 1 }} />
              <TextField
                size="small"
                placeholder="Filter by customer…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                sx={{ width: 220 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={onlyAttention}
                    onChange={(e) => setOnlyAttention(e.target.checked)}
                  />
                }
                label="Only unmapped"
              />
              <Button size="small" onClick={acceptAllSuggestions}>
                Accept all suggestions
              </Button>
            </Box>

            <Box sx={{ maxHeight: 440, overflowY: 'auto' }}>
              {visibleCustomers.map((c) => {
                const status = rowStatus(c);
                const selId = selection[c.qboCustomerId] ?? null;
                return (
                  <Box
                    key={c.qboCustomerId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap title={c.qboName}>
                        {c.qboName || '(unnamed)'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        QBO #{c.qboCustomerId}
                      </Typography>
                    </Box>
                    <Chip label={status.label} size="small" color={status.color} sx={{ flexShrink: 0 }} />
                    <Autocomplete
                      size="small"
                      options={clients}
                      getOptionLabel={(o) => o.name}
                      value={selId != null ? clientById[selId] ?? null : null}
                      onChange={(_, val) => setRow(c.qboCustomerId, val ? val.id : null)}
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      getOptionDisabled={(o) => selectedClientIds.has(o.id) && o.id !== selId}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Choose client…" />
                      )}
                      sx={{ width: 260, flexShrink: 0 }}
                    />
                  </Box>
                );
              })}
              {visibleCustomers.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  No customers match the current filter.
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || loading || dirtyChanges.length === 0}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? 'Saving…' : `Save${dirtyChanges.length ? ` (${dirtyChanges.length})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientMappingDialog;
