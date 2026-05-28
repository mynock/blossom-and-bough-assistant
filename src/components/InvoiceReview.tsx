import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
} from '../icons';
import { useNavigate } from 'react-router-dom';
import { formatDateBriefPacific } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// Local types — mirror exactly what getReviewQueue() returns.
// clientName can be null if the join finds no client row.
// billableHours can be null if not set on the activity.
// ---------------------------------------------------------------------------

type MatchCandidate = {
  workActivityId: number;
  score: number;
  reason: string;
  date: string;
  workType: string;
  billableHours: number | null;
  notesSnippet: string;
};

type ReviewQueueEntry = {
  lineItemId: number;
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  candidates: MatchCandidate[] | null;
};

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

const formatMoney = (n: number): string => '$' + n.toFixed(2);

// ---------------------------------------------------------------------------
// Double-link warning modal
// ---------------------------------------------------------------------------

interface DoubleLink409 {
  warning: 'already_linked';
  existingInvoices: Array<{ invoiceId: number; invoiceNumber: string }>;
}

interface DoubleLinkModalProps {
  open: boolean;
  data: DoubleLink409 | null;
  onCancel: () => void;
  onLinkAnyway: () => void;
  linking: boolean;
}

const DoubleLinkModal: React.FC<DoubleLinkModalProps> = ({
  open,
  data,
  onCancel,
  onLinkAnyway,
  linking,
}) => {
  const totalCount = (data?.existingInvoices.length ?? 0) + 1;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      // Default focus goes to the first focusable element — Cancel is first
      // in DialogActions so it receives focus automatically.
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} />
          Activity already linked to another invoice
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          This work activity is already linked to:
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 2, pl: 2 }}>
          {data?.existingInvoices.map((inv) => (
            <li key={inv.invoiceId}>
              <Typography variant="body2">
                Invoice #{inv.invoiceNumber}
              </Typography>
            </li>
          ))}
        </Box>
        <Typography variant="body2" color="warning.main">
          Linking it here will result in this activity being counted on{' '}
          {totalCount} invoice{totalCount !== 1 ? 's' : ''}.
        </Typography>
      </DialogContent>
      <DialogActions>
        {/* Cancel is listed first so it receives default focus */}
        <Button
          onClick={onCancel}
          variant="contained"
          disabled={linking}
          autoFocus
        >
          Cancel
        </Button>
        <Button
          onClick={onLinkAnyway}
          variant="text"
          color="warning"
          disabled={linking}
        >
          {linking ? <CircularProgress size={16} /> : 'Link anyway'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Per-entry card
// ---------------------------------------------------------------------------

interface EntryCardProps {
  entry: ReviewQueueEntry;
  isActive: boolean;
  onConfirmed: (lineItemId: number) => void;
}

const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  isActive,
  onConfirmed,
}) => {
  const candidates = entry.candidates ?? [];
  const defaultValue = candidates.length > 0
    ? String(candidates[0].workActivityId)
    : 'unmatched';

  const [selected, setSelected] = useState<string>(defaultValue);
  const [confirming, setConfirming] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLinking, setModalLinking] = useState(false);
  const [pendingLink, setPendingLink] = useState<DoubleLink409 | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-focus when this card becomes active
  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isActive]);

  const doConfirm = async (force?: boolean) => {
    setConfirming(true);
    setCardError(null);
    try {
      const workActivityId =
        selected === 'unmatched' ? null : Number(selected);
      const body: Record<string, unknown> = {
        workActivityId,
        source: 'review',
      };
      if (force) body.force = true;

      const resp = await fetch(
        `/api/qbo/invoices/${entry.invoiceId}/line-items/${entry.lineItemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );

      if (resp.ok) {
        onConfirmed(entry.lineItemId);
        return;
      }

      if (resp.status === 409) {
        const data = await resp.json();
        if (data.warning === 'already_linked') {
          setPendingLink(data as DoubleLink409);
          setModalOpen(true);
          return;
        }
      }

      // Other non-2xx error
      let errMsg = `Request failed (${resp.status})`;
      try {
        const errData = await resp.json();
        if (errData.error || errData.message) {
          errMsg = errData.error ?? errData.message;
        }
      } catch {
        // ignore parse errors
      }
      setCardError(errMsg);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setConfirming(false);
    }
  };

  const handleLinkAnyway = async () => {
    setModalLinking(true);
    // Keep the modal open so the spinner is visible while the request is in flight.
    try {
      await doConfirm(true);
    } finally {
      setModalLinking(false);
      setModalOpen(false);
      setPendingLink(null);
    }
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setPendingLink(null);
  };

  // Keyboard shortcuts on the focused card
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isActive) return;
    // Ignore key events that originated from inside interactive elements
    // (radio, button) so we don't conflict with their native behaviour.
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === 'input' || tag === 'button') return;

    switch (e.key) {
      case '1':
        if (candidates.length >= 1) setSelected(String(candidates[0].workActivityId));
        break;
      case '2':
        if (candidates.length >= 2) setSelected(String(candidates[1].workActivityId));
        break;
      case '3':
        if (candidates.length >= 3) setSelected(String(candidates[2].workActivityId));
        break;
      case '0':
        setSelected('unmatched');
        break;
      case 'Enter':
        e.preventDefault();
        if (!confirming) doConfirm();
        break;
      default:
        break;
    }
  };

  const headerLine = [
    `Invoice #${entry.invoiceNumber}`,
    entry.clientName ?? '(unknown client)',
    formatDateBriefPacific(entry.invoiceDate),
  ].join(' · ');

  const amountLine = [
    entry.description || '(no description)',
    `Qty ${entry.quantity} × ${formatMoney(entry.rate)} = ${formatMoney(entry.amount)}`,
  ].join(' · ');

  return (
    <>
      <Card
        ref={cardRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        sx={{
          mb: 2,
          outline: isActive ? '2px solid' : 'none',
          outlineColor: isActive ? 'primary.main' : 'transparent',
          outlineOffset: 2,
          '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        <CardContent>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="subtitle1" fontWeight="medium">
              {headerLine}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {amountLine}
            </Typography>
          </Box>

          {/* Candidate radio group */}
          <RadioGroup
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {candidates.map((c, idx) => (
              <Box key={c.workActivityId} sx={{ mb: 1 }}>
                <FormControlLabel
                  value={String(c.workActivityId)}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2">
                        {[
                          formatDateBriefPacific(c.date),
                          c.workType,
                          c.billableHours != null ? `${c.billableHours}h` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        {' '}
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          score {c.score.toFixed(2)}
                        </Typography>
                      </Typography>
                      {c.notesSnippet && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ ml: 0, mt: 0.25, fontStyle: 'italic' }}
                        >
                          {c.notesSnippet}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.disabled">
                        [{idx + 1}] {c.reason}
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            ))}

            {/* Leave unmatched option */}
            <FormControlLabel
              value="unmatched"
              control={<Radio size="small" />}
              label={
                <Typography variant="body2" color="text.secondary">
                  Leave unmatched{' '}
                  <Typography component="span" variant="caption" color="text.disabled">
                    [0]
                  </Typography>
                </Typography>
              }
            />
          </RadioGroup>

          {cardError && (
            <Alert severity="error" sx={{ mt: 1 }} onClose={() => setCardError(null)}>
              {cardError}
            </Alert>
          )}
        </CardContent>

        <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
          <Button
            variant="contained"
            startIcon={
              confirming ? <CircularProgress size={16} /> : <CheckCircle size={16} />
            }
            disabled={confirming}
            onClick={() => doConfirm()}
          >
            {confirming ? 'Confirming…' : 'Confirm'}
          </Button>
        </CardActions>
      </Card>

      <DoubleLinkModal
        open={modalOpen}
        data={pendingLink}
        onCancel={handleModalCancel}
        onLinkAnyway={handleLinkAnyway}
        linking={modalLinking}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const InvoiceReview: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReviewQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/qbo/invoices/review-queue', {
        credentials: 'include',
      });
      if (!resp.ok) {
        throw new Error(`Failed to load review queue (${resp.status})`);
      }
      const data: ReviewQueueEntry[] = await resp.json();
      setQueue(data);
      if (data.length === 0) {
        // Empty on load — navigate immediately; no flash needed.
        navigate('/invoices', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleConfirmed = (lineItemId: number) => {
    setQueue((prev) => {
      const next = prev.filter((e) => e.lineItemId !== lineItemId);
      if (next.length === 0) {
        navigate('/invoices', { replace: true });
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchQueue}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Back link + title */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="text"
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/invoices')}
          sx={{ mb: 1, pl: 0 }}
        >
          Back to Invoices
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <Typography variant="h5" component="h1">
            Review matches
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {queue.length} remaining
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Pick the best work activity for each line item, or leave it unmatched.
          Keyboard: <strong>1 / 2 / 3</strong> to pick, <strong>0</strong> to leave
          unmatched, <strong>Enter</strong> to confirm.
        </Typography>
      </Box>

      {/* Cards */}
      {queue.map((entry, idx) => (
        <EntryCard
          key={entry.lineItemId}
          entry={entry}
          isActive={idx === 0}
          onConfirmed={handleConfirmed}
        />
      ))}
    </Container>
  );
};

export default InvoiceReview;
