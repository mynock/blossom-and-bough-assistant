import { Router } from 'express';
import { QuickBooksService } from '../services/QuickBooksService';
import { InvoiceService } from '../services/InvoiceService';
import { requireAuth } from '../middleware/auth';
import { invoices, invoiceLineItems, workActivities, clients, otherCharges } from '../db';
import { eq, and, inArray } from 'drizzle-orm';

const router = Router();
const qbService = new QuickBooksService();
const invoiceService = new InvoiceService();

/**
 * Handle OAuth callback (must be public, not require auth)
 */
router.get('/callback', async (req, res) => {
  try {
    const callbackUrl = req.url;
    const tokens = await qbService.handleOAuthCallback(callbackUrl);
    // In production, you might want to store these tokens securely
    // For now, we'll just return them
    res.json({ 
      message: 'Authentication successful',
      tokens: tokens 
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Apply authentication middleware to all other routes
router.use(requireAuth);

/**
 * Get OAuth authorization URL
 */
router.get('/auth/url', async (req, res) => {
  try {
    const authUrl = qbService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({ error: 'Failed to get authorization URL' });
  }
});

/**
 * Check if access token is valid
 */
router.get('/auth/status', async (req, res) => {
  try {
    const isValid = qbService.isAccessTokenValid();
    
    // Check if credentials are configured
    const credentials = process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET;
    
    res.json({ 
      isValid,
      credentialsConfigured: !!credentials,
      error: !credentials ? 'QuickBooks credentials not configured' : null
    });
  } catch (error) {
    console.error('Error checking token status:', error);
    res.status(500).json({ error: 'Failed to check token status' });
  }
});

/**
 * Refresh access token
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
 * Sync QBO Items to local database
 */
router.post('/items/sync', async (req, res) => {
  try {
    await invoiceService.syncQBOItems();
    res.json({ message: 'Items synced successfully' });
  } catch (error) {
    console.error('Error syncing items:', error);
    res.status(500).json({ error: 'Failed to sync items' });
  }
});

/**
 * Get all QBO Items
 */
router.get('/items', async (req, res) => {
  try {
    const items = await invoiceService.getQBOItems();
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/**
 * Create invoice from work activities
 */
router.post('/invoices', async (req, res) => {
  try {
    const {
      clientId,
      workActivityIds,
      includeOtherCharges = true,
      dueDate,
      memo
    } = req.body;

    // Validate required fields
    if (!clientId || !workActivityIds || !Array.isArray(workActivityIds) || workActivityIds.length === 0) {
      return res.status(400).json({ 
        error: 'clientId and workActivityIds (array) are required' 
      });
    }

    const result = await invoiceService.createInvoiceFromWorkActivities({
      clientId,
      workActivityIds,
      includeOtherCharges,
      dueDate,
      memo
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating invoice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create invoice';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Get invoices for a client
 */
router.get('/invoices/client/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const invoices = await invoiceService.getInvoicesForClient(clientId);
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching client invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Get invoice details with line items
 */
router.get('/invoices/:invoiceId', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    // Get invoice details
    const invoice = await invoiceService.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice[0]) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get line items
    const lineItems = await invoiceService.db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    res.json({
      invoice: invoice[0],
      lineItems: lineItems
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ error: 'Failed to fetch invoice details' });
  }
});

/**
 * Sync invoice status from QuickBooks
 */
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

/**
 * Get work activities that can be invoiced for a client
 */
router.get('/clients/:clientId/invoiceable-activities', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const activities = await invoiceService.db
      .select()
      .from(workActivities)
      .where(and(
        eq(workActivities.clientId, clientId),
        eq(workActivities.status, 'completed')
      ))
      .orderBy(workActivities.date);

    res.json(activities);
  } catch (error) {
    console.error('Error fetching invoiceable activities:', error);
    res.status(500).json({ error: 'Failed to fetch invoiceable activities' });
  }
});

/**
 * Preview invoice before creating it
 */
router.post('/invoices/preview', async (req, res) => {
  try {
    const {
      clientId,
      workActivityIds,
      includeOtherCharges = true
    } = req.body;

    // Validate required fields
    if (!clientId || !workActivityIds || !Array.isArray(workActivityIds) || workActivityIds.length === 0) {
      return res.status(400).json({ 
        error: 'clientId and workActivityIds (array) are required' 
      });
    }

    // Get client info
    const client = await invoiceService.db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client[0]) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get work activities
    const activities = await invoiceService.db
      .select()
      .from(workActivities)
      .where(inArray(workActivities.id, workActivityIds));

    // Calculate preview data without creating actual invoice
    let totalAmount = 0;
    const previewLines = [];

    // Group activities by work type
    const serviceGroups = new Map();
    for (const activity of activities) {
      if (!serviceGroups.has(activity.workType)) {
        serviceGroups.set(activity.workType, { activities: [], totalHours: 0 });
      }
      const group = serviceGroups.get(activity.workType);
      group.activities.push(activity);
      group.totalHours += activity.billableHours || activity.totalHours || 0;
    }

    // Add service lines
    for (const [workType, group] of serviceGroups) {
      const rate = 55.00; // Default rate - in production, get from QBO items
      const amount = group.totalHours * rate;
      
      previewLines.push({
        type: 'service',
        workType: workType,
        description: `${workType} - ${group.totalHours} hours`,
        quantity: group.totalHours,
        rate: rate,
        amount: amount
      });
      
      totalAmount += amount;
    }

    // Add other charges if requested
    if (includeOtherCharges) {
      for (const activity of activities) {
        const charges = await invoiceService.db
          .select()
          .from(otherCharges)
          .where(and(
            eq(otherCharges.workActivityId, activity.id),
            eq(otherCharges.billable, true)
          ));

        for (const charge of charges) {
          previewLines.push({
            type: 'charge',
            chargeType: charge.chargeType,
            description: charge.description,
            quantity: charge.quantity || 1,
            rate: charge.unitRate || charge.totalCost,
            amount: charge.totalCost
          });
          
          totalAmount += charge.totalCost;
        }
      }
    }

    res.json({
      client: client[0],
      activities: activities,
      previewLines: previewLines,
      totalAmount: totalAmount,
      lineCount: previewLines.length
    });

  } catch (error) {
    console.error('Error generating invoice preview:', error);
    res.status(500).json({ error: 'Failed to generate invoice preview' });
  }
});

export default router; 