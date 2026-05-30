import { Router } from 'express';
import { randomBytes } from 'crypto';
import { services } from '../services/container';
import { requireAuth } from '../middleware/auth';
import { invoices, invoiceLineItems, workActivities } from '../db';
import { eq, and } from 'drizzle-orm';

// Augment Express session with our OAuth state nonce.
declare module 'express-session' {
  interface SessionData {
    qboOauthState?: string;
  }
}

const router = Router();
const qbService = services.quickBooksService;
const invoiceService = services.invoiceService;

// Frontend route the OAuth popup lands on after the callback. The React page
// detects ?qbo=connected / ?qbo=error and posts a message to the opener.
const POPUP_LANDING_PATH = '/quickbooks';

function popupLandingUrl(req: any, params: Record<string, string>): string {
  // In dev the React app runs on a different port than the API (3000 vs 3001),
  // so we cannot use req.get('host'). FRONTEND_URL is the canonical source of
  // truth; fall back to the request host only in production where the SPA and
  // API share an origin.
  const frontendBase =
    process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  const base = `${frontendBase.replace(/\/$/, '')}${POPUP_LANDING_PATH}`;
  const query = new URLSearchParams(params).toString();
  return `${base}?${query}`;
}

/**
 * OAuth callback (public — Intuit redirects the browser here after the user
 * authorizes the app). Validates the state nonce against the session, exchanges
 * the code for tokens, and 302-redirects to the React app. We must NOT return
 * HTML here: Intuit forbids HTML responses on endpoints that receive auth
 * tokens in URL params because subsequent requests would leak the code in the
 * Referer header.
 */
router.get('/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const expectedState = req.session?.qboOauthState;
  // Consume the nonce regardless of outcome so it cannot be replayed.
  if (req.session) delete req.session.qboOauthState;

  if (!expectedState || !state || state !== expectedState) {
    return res.redirect(302, popupLandingUrl(req, { qbo: 'error', reason: 'invalid_state' }));
  }

  try {
    await qbService.handleOAuthCallback(req.url);
    return res.redirect(302, popupLandingUrl(req, { qbo: 'connected' }));
  } catch (error: any) {
    // intuit-oauth wraps the failing HTTP response; surface the underlying
    // body/status so the actual cause (bad redirect_uri, expired code,
    // sandbox/prod mismatch, etc.) shows up in the server log.
    console.error('OAuth token exchange failed:', {
      message: error?.message,
      originalMessage: error?.originalMessage,
      intuit_tid: error?.intuit_tid,
      authResponse: error?.authResponse?.response?.body || error?.authResponse?.body,
    });
    return res.redirect(302, popupLandingUrl(req, { qbo: 'error', reason: 'token_exchange_failed' }));
  }
});

// Authentication required for all other routes
router.use(requireAuth);

/**
 * Generate an OAuth authorization URL with a per-request state nonce stored
 * in the session. The callback verifies the returned state to prevent CSRF.
 */
router.get('/auth/url', async (req, res) => {
  try {
    const state = randomBytes(32).toString('hex');
    req.session.qboOauthState = state;
    const authUrl = qbService.getAuthUrl(state);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({ error: 'Failed to get authorization URL' });
  }
});

/**
 * Report whether the app has valid, non-expired QBO credentials stored.
 */
router.get('/auth/status', async (req, res) => {
  try {
    const isValid = await qbService.isAccessTokenValid();
    const credentialsConfigured = !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET);
    res.json({
      isValid,
      credentialsConfigured,
      error: credentialsConfigured ? null : 'QuickBooks credentials not configured',
    });
  } catch (error) {
    console.error('Error checking token status:', error);
    res.status(500).json({ error: 'Failed to check token status' });
  }
});

/**
 * Manually trigger a token refresh. Normally not needed — QuickBooksService
 * auto-refreshes before each API call — but useful as an admin override.
 */
router.post('/auth/refresh', async (req, res) => {
  try {
    await qbService.refreshTokens();
    res.json({ message: 'Tokens refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    res.status(500).json({ error: 'Failed to refresh tokens' });
  }
});

/**
 * Disconnect QuickBooks — revoke tokens at Intuit and remove from local DB.
 */
router.post('/auth/disconnect', async (req, res) => {
  try {
    await qbService.disconnect();
    res.json({ message: 'Disconnected from QuickBooks' });
  } catch (error) {
    console.error('Error disconnecting QuickBooks:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.post('/items/sync', async (req, res) => {
  try {
    await invoiceService.syncQBOItems();
    res.json({ message: 'Items synced successfully' });
  } catch (error) {
    console.error('Error syncing items:', error);
    res.status(500).json({ error: 'Failed to sync items' });
  }
});

router.post('/customers/sync', async (req, res) => {
  try {
    await invoiceService.syncQBOCustomers();
    res.json({ message: 'Customers synced successfully' });
  } catch (error) {
    console.error('Error syncing customers:', error);
    res.status(500).json({ error: 'Failed to sync customers' });
  }
});

router.get('/items', async (req, res) => {
  try {
    const items = await invoiceService.getQBOItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const { clientId, lineItems, workActivityIds, dueDate, memo } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: 'lineItems (array) is required' });
    }

    const result = await invoiceService.createInvoiceFromLineItems({
      clientId,
      lineItems,
      workActivityIds: Array.isArray(workActivityIds)
        ? workActivityIds.filter((id: unknown): id is number => typeof id === 'number')
        : undefined,
      dueDate,
      memo,
    });

    res.json({
      success: true,
      result,
      message: 'Invoice created successfully',
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      error: 'Failed to create invoice',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/invoices/client/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    const invoiceList = await invoiceService.getInvoicesForClient(clientId);
    res.json(invoiceList);
  } catch (error) {
    console.error('Error fetching client invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const invoiceList = await invoiceService.getAllInvoices();
    res.json(invoiceList);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Fetch all QBO invoices and import / reconcile them against the local DB.
 * Per-invoice errors are captured inside the SyncResult.errors array; only
 * blanket failures (e.g. QBO token expired before any work begins) bubble up
 * to the catch block and return 500.
 */
router.post('/invoices/sync-all', async (req, res) => {
  try {
    const { since } = req.body ?? {};
    if (since !== undefined) {
      if (typeof since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
        return res.status(400).json({ error: 'since must be a date string in YYYY-MM-DD format' });
      }
    }
    const result = await services.invoiceImportService.syncAllInvoices({ since });
    res.json(result);
  } catch (error) {
    console.error('Error syncing all invoices:', error);
    res.status(500).json({ error: 'Failed to sync invoices' });
  }
});

/**
 * Return the current review queue: invoices with line items whose match status
 * is 'needs_review' or 'unmatched', along with their candidates.
 */
router.get('/invoices/review-queue', async (req, res) => {
  try {
    const queue = await services.invoiceImportService.getReviewQueue();
    res.json(queue);
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

/**
 * Re-run the auto-matcher for a single invoice's line items, preserving any
 * manual user decisions. Returns match-status counts for the invoice.
 */
router.post('/invoices/:invoiceId/rematch', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }
    const result = await services.invoiceImportService.rematchInvoice(invoiceId);
    res.json(result);
  } catch (error) {
    console.error('Error rematching invoice:', error);
    res.status(500).json({ error: 'Failed to rematch invoice' });
  }
});

/**
 * Manually link (or unlink) a line item to a work activity. Returns 409 when
 * the activity is already linked to another invoice and `force` was not set.
 */
router.patch('/invoices/:invoiceId/line-items/:lineItemId', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }
    const lineItemId = parseInt(req.params.lineItemId);
    if (isNaN(lineItemId)) {
      return res.status(400).json({ error: 'Invalid line item ID' });
    }

    const { workActivityId, force, source } = req.body ?? {};
    if (workActivityId !== null && typeof workActivityId !== 'number') {
      return res.status(400).json({ error: 'workActivityId must be a number or null' });
    }

    const existingLine = await invoiceService.db
      .select({ invoiceId: invoiceLineItems.invoiceId })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.id, lineItemId))
      .limit(1);

    if (!existingLine[0]) {
      return res.status(404).json({ error: 'Line item not found' });
    }
    if (existingLine[0].invoiceId !== invoiceId) {
      return res.status(404).json({ error: 'Line item does not belong to this invoice' });
    }

    const resolvedSource: 'review' | 'detail' =
      source === 'detail' ? 'detail' : 'review';

    const result = await services.invoiceImportService.relinkLineItem(lineItemId, workActivityId, {
      source: resolvedSource,
      force: force === true,
    });

    if ('warning' in result) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error relinking line item:', error);
    res.status(500).json({ error: 'Failed to relink line item' });
  }
});

router.get('/invoices/:invoiceId', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const invoice = await invoiceService.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const lineItems = await invoiceService.db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    res.json({ invoice: invoice[0], lineItems });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ error: 'Failed to fetch invoice details' });
  }
});

router.post('/invoices/:invoiceId/sync', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }
    await invoiceService.syncInvoiceStatus(invoiceId);
    res.json({ message: 'Invoice status synced successfully' });
  } catch (error) {
    console.error('Error syncing invoice status:', error);
    res.status(500).json({ error: 'Failed to sync invoice status' });
  }
});

router.get('/clients/:clientId/invoiceable-activities', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    const activities = await invoiceService.db
      .select()
      .from(workActivities)
      .where(and(eq(workActivities.clientId, clientId), eq(workActivities.status, 'completed')))
      .orderBy(workActivities.date);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching invoiceable activities:', error);
    res.status(500).json({ error: 'Failed to fetch invoiceable activities' });
  }
});

router.post('/invoices/preview', async (req, res) => {
  try {
    const { clientId, workActivityIds, includeOtherCharges, useAIGeneration } = req.body;
    if (!clientId || !workActivityIds || !Array.isArray(workActivityIds) || workActivityIds.length === 0) {
      return res.status(400).json({ error: 'clientId and workActivityIds (array) are required' });
    }
    const result = await invoiceService.previewInvoice({
      clientId,
      workActivityIds,
      includeOtherCharges: includeOtherCharges !== false,
      useAIGeneration: useAIGeneration === true,
    });
    res.json(result);
  } catch (error) {
    console.error('Error generating invoice preview:', error);
    res.status(500).json({
      error: 'Failed to generate invoice preview',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Seed sandbox QuickBooks data. Dev-only: only runs when NODE_ENV is explicitly
 * 'development'. Refuses in production, staging, test, or undefined envs.
 */
router.post('/seed', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Seeding is only available in development' });
  }
  try {
    const { default: QBOSeedDataGenerator } = await import('../scripts/seedQBOData');
    const seedGenerator = new QBOSeedDataGenerator();
    const startTime = Date.now();
    await seedGenerator.generateAllSeedData();
    const duration = Date.now() - startTime;
    res.json({
      success: true,
      message: 'QuickBooks sandbox data seeded successfully. Created customers, service items, and sample invoices.',
      duration,
    });
  } catch (error) {
    console.error('Error seeding QuickBooks data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to seed QuickBooks data';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

router.delete('/invoices/:invoiceId', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }
    console.log(`Deleting invoice ID: ${invoiceId}`);
    await invoiceService.deleteInvoice(invoiceId);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      error: 'Failed to delete invoice',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
