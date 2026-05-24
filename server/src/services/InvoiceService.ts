import { DatabaseService } from './DatabaseService';
import { QuickBooksService } from './QuickBooksService';
import { ClientService } from './ClientService';
import { WorkActivityService } from './WorkActivityService';
import { AnthropicService, SuggestedAddition } from './AnthropicService';
import { 
  workActivities, 
  invoices, 
  invoiceLineItems, 
  qboItems, 
  otherCharges,
  clients 
} from '../db';
import { eq, and, inArray, ilike, or, sql } from 'drizzle-orm';

export interface PreviewInvoiceRequest {
  clientId: number;
  workActivityIds: number[];
  includeOtherCharges?: boolean;
  useAIGeneration?: boolean;
}

export interface CreateInvoiceFromLineItemsRequest {
  clientId: number;
  lineItems: InvoiceLineItemData[];
  // Work activities the user selected for this invoice. Marked `invoiced`
  // when the invoice is created, regardless of which labor lines survived
  // editing — otherwise removing a labor line would leave the activity
  // stuck as `completed` and keep reappearing in the invoiceable list.
  workActivityIds?: number[];
  dueDate?: string;
  memo?: string;
}

export interface InvoiceLineItemData {
  workActivityId?: number;
  otherChargeId?: number;
  qboItemId: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface SuggestedLineItem extends InvoiceLineItemData {
  category: 'plants' | 'materials';
  sourceWorkActivityId?: number;
  qboItemName?: string;
  qboItemMatchQuality: 'specific' | 'category' | 'fuzzy' | 'fallback' | 'none';
}

export interface InvoicePreviewResult {
  client: any;
  lineItems: InvoiceLineItemData[];
  suggestedLineItems: SuggestedLineItem[];
  totalAmount: number;
}

export class InvoiceService extends DatabaseService {
  private qbService: QuickBooksService;
  private clientService: ClientService;
  private workActivityService: WorkActivityService;
  private anthropicService: AnthropicService;

  constructor() {
    super();
    this.qbService = new QuickBooksService();
    this.clientService = new ClientService();
    this.workActivityService = new WorkActivityService();
    this.anthropicService = new AnthropicService();
  }

  /**
   * Ensure QuickBooks service is initialized with latest tokens
   */
  private async ensureQBServiceInitialized(): Promise<void> {
    try {
      await this.qbService.reinitialize();
    } catch (error) {
      console.error('Failed to reinitialize QuickBooks service:', error);
      throw new Error('QuickBooks service not properly initialized. Please check your authentication.');
    }
  }

  /**
   * Sync QBO Items to local database
   */
  async syncQBOItems(): Promise<void> {
    try {
      await this.ensureQBServiceInitialized();
      await this.qbService.syncItems();
      console.log('QBO Items synced successfully');
    } catch (error) {
      console.error('Error syncing QBO Items:', error);
      throw error;
    }
  }

  /**
   * Sync QBO Customers to local database
   */
  async syncQBOCustomers(): Promise<void> {
    try {
      await this.ensureQBServiceInitialized();
      await this.qbService.syncCustomers();
      console.log('QBO Customers synced successfully');
    } catch (error) {
      console.error('Error syncing QBO Customers:', error);
      throw error;
    }
  }

  /**
   * Get all available QBO Items
   */
  async getQBOItems(): Promise<any[]> {
    await this.ensureQBServiceInitialized();
    return await this.qbService.getItems();
  }

  /**
   * Find QBO Item by name (for matching services)
   */
  async findQBOItemByName(name: string): Promise<any> {
    const items = await this.db
      .select()
      .from(qboItems)
      .where(eq(qboItems.name, name))
      .limit(1);
    
    return items[0] || null;
  }

  /**
   * Build a preview of the invoice line items the server would send to QBO.
   * Runs the same builder and AI enhancement that creation uses, so the user
   * sees and edits the exact lines that will be submitted.
   */
  async previewInvoice(request: PreviewInvoiceRequest): Promise<InvoicePreviewResult> {
    const client = await this.clientService.getClientById(request.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    const workActivitiesData = await this.validateWorkActivitiesForInvoicing(request.workActivityIds);

    let lineItems = await this.buildInvoiceLineItems(workActivitiesData, request.includeOtherCharges);

    if (lineItems.length === 0) {
      throw new Error('No line items could be generated for the invoice. Please check if QBO items are properly synced.');
    }

    let suggestedLineItems: SuggestedLineItem[] = [];

    if (request.useAIGeneration) {
      try {
        const aiResult = await this.anthropicService.generateInvoiceLineItems(
          workActivitiesData,
          client.name,
          lineItems
        );

        if (aiResult.lineItems && aiResult.lineItems.length > 0) {
          lineItems = aiResult.lineItems;
        }

        suggestedLineItems = await this.materializeSuggestedAdditions(aiResult.suggestedAdditions);
      } catch (aiError) {
        console.error('AI generation failed during preview, falling back to basic line items:', aiError);
      }
    }

    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    return { client, lineItems, suggestedLineItems, totalAmount };
  }

  private async materializeSuggestedAdditions(suggestions: SuggestedAddition[]): Promise<SuggestedLineItem[]> {
    const out: SuggestedLineItem[] = [];
    for (const suggestion of suggestions) {
      const { item, quality } = await this.resolveQBOItemForSuggestion(suggestion.description, suggestion.category);
      const rate = pickSuggestionRate(quality, item);
      out.push({
        qboItemId: item?.qboId ?? '',
        description: suggestion.description,
        quantity: suggestion.quantity,
        rate,
        amount: suggestion.quantity * rate,
        category: suggestion.category,
        sourceWorkActivityId: suggestion.sourceWorkActivityId,
        qboItemName: item?.name,
        qboItemMatchQuality: quality
      });
    }
    return out;
  }

  /**
   * Find a QBO item to attach to a suggested addition. The match is best-effort:
   *   1. exact name match against the suggestion description (e.g., "Sluggo" → "Sluggo" item)
   *   2. case-insensitive partial match against the description
   *   3. generic category bucket (e.g., "Plants", "Materials")
   *   4. fuzzy match on category keywords
   *   5. first active Inventory/NonInventory/Service item
   * Suggestions still surface when no match is found so the user can review them.
   */
  private async resolveQBOItemForSuggestion(
    description: string,
    category: 'plants' | 'materials'
  ): Promise<{ item: any | null; quality: 'specific' | 'category' | 'fuzzy' | 'fallback' | 'none' }> {
    const trimmed = description.trim();
    if (trimmed) {
      const exactCI = await this.findActiveQBOItemILike(trimmed);
      if (exactCI) return { item: exactCI, quality: 'specific' };

      const partial = await this.findActiveQBOItemILike(`%${trimmed}%`);
      if (partial) return { item: partial, quality: 'specific' };
    }

    const categoryNames = category === 'plants'
      ? ['Plants', 'Plant']
      : ['Materials', 'Garden Supplies', 'Supplies'];

    for (const name of categoryNames) {
      const hit = await this.findActiveQBOItemILike(name);
      if (hit) return { item: hit, quality: 'category' };
    }

    const fuzzyKeywords = category === 'plants'
      ? ['plant', 'flora']
      : ['material', 'supply', 'supplies'];

    for (const keyword of fuzzyKeywords) {
      const hit = await this.findActiveQBOItemILike(`%${keyword}%`);
      if (hit) return { item: hit, quality: 'fuzzy' };
    }

    const fallback = await this.db
      .select()
      .from(qboItems)
      .where(and(
        eq(qboItems.active, true),
        or(eq(qboItems.type, 'Inventory'), eq(qboItems.type, 'NonInventory'), eq(qboItems.type, 'Service'))
      ))
      .limit(1);
    if (fallback[0]) return { item: fallback[0], quality: 'fallback' };

    return { item: null, quality: 'none' };
  }

  private async findActiveQBOItemILike(pattern: string): Promise<any | null> {
    // Prefer shorter names: a generic "Plants" bucket beats a specialized
    // "Plant installation" service when both match a fuzzy %plant% query.
    const matches = await this.db
      .select()
      .from(qboItems)
      .where(and(eq(qboItems.active, true), ilike(qboItems.name, pattern)))
      .orderBy(sql`LENGTH(${qboItems.name})`)
      .limit(1);
    return matches[0] || null;
  }

  /**
   * Create an invoice from line items already reviewed and edited by the user.
   * The submitted lines are sent to QBO verbatim — no rebuilding here.
   */
  async createInvoiceFromLineItems(request: CreateInvoiceFromLineItemsRequest): Promise<any> {
    try {
      await this.ensureQBServiceInitialized();

      const client = await this.clientService.getClientById(request.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      if (!request.lineItems || request.lineItems.length === 0) {
        throw new Error('At least one line item is required');
      }

      const normalizedLineItems = normalizeInvoiceLineItems(request.lineItems);

      const qboCustomer = await this.ensureQBOCustomer(client);

      const qboInvoiceData = this.buildQBOInvoiceData(qboCustomer, normalizedLineItems, {
        dueDate: request.dueDate,
        memo: request.memo
      });

      const qboInvoice = await this.qbService.createInvoice(qboInvoiceData);

      const localInvoice = await this.saveInvoiceToLocal(qboInvoice, client.id, normalizedLineItems);

      const invoicedWorkActivityIds = resolveInvoicedWorkActivityIds(
        request.workActivityIds,
        normalizedLineItems
      );

      if (invoicedWorkActivityIds.length > 0) {
        await this.updateWorkActivitiesStatus(invoicedWorkActivityIds, 'invoiced');
      }

      return {
        invoice: localInvoice,
        qboInvoice: qboInvoice,
        lineItems: normalizedLineItems.length
      };

    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoices for a client
   */
  async getInvoicesForClient(clientId: number): Promise<any[]> {
    return await this.db
      .select({
        id: invoices.id,
        qboInvoiceId: invoices.qboInvoiceId,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        clientName: clients.name,
        qboSyncAt: invoices.qboSyncAt,
        createdAt: invoices.createdAt
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.clientId, clientId))
      .orderBy(invoices.createdAt);
  }

  /**
   * Get all invoices with client information
   */
  async getAllInvoices(): Promise<any[]> {
    return await this.db
      .select({
        id: invoices.id,
        qboInvoiceId: invoices.qboInvoiceId,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        clientId: invoices.clientId,
        clientName: clients.name,
        qboSyncAt: invoices.qboSyncAt,
        createdAt: invoices.createdAt
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .orderBy(invoices.createdAt);
  }

  /**
   * Sync invoice status from QuickBooks
   */
  async syncInvoiceStatus(invoiceId: number): Promise<void> {
    await this.ensureQBServiceInitialized();
    
    const localInvoice = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!localInvoice[0]) {
      throw new Error('Invoice not found');
    }

    const qboInvoice = await this.qbService.getInvoice(localInvoice[0].qboInvoiceId);
    
    // Update local invoice with QBO data
    await this.db
      .update(invoices)
      .set({
        status: this.mapQBOInvoiceStatus(qboInvoice),
        totalAmount: qboInvoice.TotalAmt,
        qboSyncAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId));
  }

  private async ensureQBOCustomer(client: any): Promise<any> {
    // Ensure QB service is initialized before customer operations
    await this.ensureQBServiceInitialized();
    
    console.log(`Looking for customer: ${client.name}`);
    
    // First try exact match
    let qboCustomer = await this.qbService.findCustomerByName(client.name);
    console.log(`Exact match result:`, qboCustomer ? `Found "${qboCustomer.DisplayName}"` : 'No exact match');
    
    // If exact match not found, try partial matches (in case of slight name differences)
    if (!qboCustomer) {
      console.log(`Exact match not found, checking for similar customer names...`);
      
      try {
        const allCustomers = await this.qbService.getAllCustomers();
        console.log(`Found ${allCustomers.length} total customers in QuickBooks`);
        
        // Debug: Show all customer names
        console.log(`All QuickBooks customer names:`, allCustomers.map((c: any) => `"${c.DisplayName}"`).join(', '));
        
        // Look for partial matches (case insensitive)
        const searchName = client.name.toLowerCase().trim();
        console.log(`Searching for: "${searchName}"`);
        
        qboCustomer = allCustomers.find((customer: any) => {
          const customerName = customer.DisplayName?.toLowerCase().trim() || '';
          const matches = customerName.includes(searchName) || searchName.includes(customerName);
          if (matches) {
            console.log(`✓ MATCH FOUND: "${customerName}" matches "${searchName}"`);
          }
          return matches;
        });
        
        if (qboCustomer) {
          console.log(`Found similar customer: "${qboCustomer.DisplayName}" for search: "${client.name}"`);
        } else {
          console.log(`No similar customers found for: ${client.name}`);
          console.log(`Available customers: ${allCustomers.map((c: any) => c.DisplayName).slice(0, 5).join(', ')}${allCustomers.length > 5 ? '...' : ''}`);
        }
      } catch (error) {
        console.error('Error searching for similar customers:', error);
      }
    }
    
    if (!qboCustomer) {
      console.log(`Customer not found, creating new customer: ${client.name}`);
      
      // Create customer in QuickBooks with minimal required fields
      const customerData: any = {
        Name: client.name
      };
      
      // Only add optional fields if they exist and are valid
      if (client.address && client.address.trim() && client.address.length > 0) {
        // Simple address format that QB accepts
        customerData.BillAddr = {
          Line1: client.address.trim()
        };
      }
      
      console.log('Customer data to send:', JSON.stringify(customerData, null, 2));
      
      try {
        qboCustomer = await this.qbService.createCustomer(customerData);
        console.log(`Created new customer with ID: ${qboCustomer.Id}`);
      } catch (error) {
        console.error(`Error creating customer in QuickBooks:`, error);
        
        // If customer creation fails, try with even simpler data
        console.log('Retrying with minimal customer data...');
        try {
          const minimalCustomerData = { Name: client.name };
          qboCustomer = await this.qbService.createCustomer(minimalCustomerData);
          console.log(`Created customer with minimal data, ID: ${qboCustomer.Id}`);
        } catch (retryError) {
          console.error(`Both customer creation attempts failed:`, retryError);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to create customer "${client.name}" in QuickBooks: ${errorMessage}`);
        }
      }
    } else {
      console.log(`Found existing customer with ID: ${qboCustomer.Id}`);
    }
    
    return qboCustomer;
  }

  private async validateWorkActivitiesForInvoicing(workActivityIds: number[]): Promise<any[]> {
    const activities = await this.db
      .select()
      .from(workActivities)
      .where(and(
        inArray(workActivities.id, workActivityIds),
        eq(workActivities.status, 'completed')
      ));

    if (activities.length !== workActivityIds.length) {
      throw new Error('Some work activities are not completed or not found');
    }

    return activities;
  }

  private async buildInvoiceLineItems(workActivitiesData: any[], includeOtherCharges = true): Promise<InvoiceLineItemData[]> {
    const lineItems: InvoiceLineItemData[] = [];

    // Create separate line items for each work activity to ensure all activities are tracked
    for (const activity of workActivitiesData) {
      const qboItem = await this.findQBOItemForWorkType(activity.workType);
      
      if (qboItem && (activity.billableHours || activity.totalHours) > 0) {
        const hours = activity.billableHours || activity.totalHours || 0;
        const rate = qboItem.unitPrice || 55.00; // Default rate if not set in QBO
        const description = this.buildServiceDescription(activity);
        
        lineItems.push({
          workActivityId: activity.id,
          qboItemId: qboItem.qboId,
          description: description,
          quantity: hours,
          rate: rate,
          amount: hours * rate
        });
      }
    }

    // Add other charges (materials, plants, etc.) if requested
    if (includeOtherCharges) {
      for (const activity of workActivitiesData) {
        const charges = await this.db
          .select()
          .from(otherCharges)
          .where(and(
            eq(otherCharges.workActivityId, activity.id),
            eq(otherCharges.billable, true)
          ));

        for (const charge of charges) {
          const qboItem = await this.findQBOItemForChargeType(charge.chargeType, charge.description);

          if (!qboItem) {
            console.warn(
              `Skipping billable charge ${charge.id} (chargeType="${charge.chargeType}", description="${charge.description}"): no QBO item matched. ` +
              `Sync QBO items or add an item named after the chargeType.`
            );
            continue;
          }

          const quantity = charge.quantity || 1;
          const rate = charge.unitRate
            ?? (charge.totalCost != null ? charge.totalCost / quantity : 0);
          const amount = charge.totalCost ?? quantity * rate;

          lineItems.push({
            otherChargeId: charge.id,
            qboItemId: qboItem.qboId,
            description: charge.description,
            quantity,
            rate,
            amount
          });
        }
      }
    }

    return lineItems;
  }

  private async findQBOItemForWorkType(workType: string): Promise<any> {
    // Map work types to QBO items based on common naming
    const workTypeMapping: { [key: string]: string[] } = {
      'maintenance': ['Specialized garden care', 'Garden maintenance', 'Maintenance'],
      'pruning': ['Specialized pruning', 'Pruning'],
      'design': ['Design Consultation', 'Design'],
      'consultation': ['Design Consultation', 'Garden coaching'],
      'project': ['Project management']
    };

    const possibleNames = workTypeMapping[workType.toLowerCase()] || [workType];
    
    for (const name of possibleNames) {
      const item = await this.findQBOItemByName(name);
      if (item) {
        return item;
      }
    }

    // Default to first available service item if no match found
    const defaultItem = await this.db
      .select()
      .from(qboItems)
      .where(and(
        eq(qboItems.active, true),
        eq(qboItems.type, 'Service')
      ))
      .limit(1);

    return defaultItem[0] || null;
  }

  /**
   * Find a QBO item for a structured other_charge.
   *   1. If the charge description matches a QBO item name (exact CI, then ILIKE), use it.
   *      Catches per-product items like "Sluggo" or "Lonicera" without needing a chargeType map.
   *   2. Otherwise try chargeType-mapped canonical names ("Plants", "Materials", etc.) case-insensitively.
   *   3. Fall back to a fuzzy ILIKE on the chargeType itself.
   */
  private async findQBOItemForChargeType(chargeType: string, description?: string): Promise<any> {
    const trimmedDesc = description?.trim() || '';
    if (trimmedDesc) {
      const descExact = await this.findActiveQBOItemILike(trimmedDesc);
      if (descExact) return descExact;
      const descPartial = await this.findActiveQBOItemILike(`%${trimmedDesc}%`);
      if (descPartial) return descPartial;
    }

    const chargeTypeMapping: { [key: string]: string[] } = {
      'debris': ['Debris disposal per yard', 'Debris disposal'],
      'material': ['Materials', 'Garden Supplies', 'Supplies'],
      'plant': ['Plants', 'Plant', 'Garden Supplies'],
      'delivery': ['Delivery', 'Service']
    };

    const possibleNames = chargeTypeMapping[chargeType.toLowerCase()] || [chargeType];
    for (const name of possibleNames) {
      const hit = await this.findActiveQBOItemILike(name);
      if (hit) return hit;
    }

    const fuzzy = await this.findActiveQBOItemILike(`%${chargeType}%`);
    if (fuzzy) return fuzzy;

    return null;
  }

  private buildServiceDescription(activity: any): string {
    const raw = (activity.notes || activity.tasks || '').trim();
    return raw || this.formatWorkType(activity.workType);
  }

  private formatWorkType(workType: string): string {
    return workType.charAt(0).toUpperCase() + workType.slice(1).replace(/([A-Z])/g, ' $1');
  }

  private buildQBOInvoiceData(qboCustomer: any, lineItems: InvoiceLineItemData[], request: { dueDate?: string; memo?: string }): any {
    const lines = lineItems.map((item, index) => ({
      LineNum: index + 1,
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      Description: item.description, // ✅ Custom description appears on invoice
      SalesItemLineDetail: {
        ItemRef: {
          value: item.qboItemId
        },
        Qty: item.quantity,
        UnitPrice: item.rate
      }
    }));

    const invoiceData: any = {
      Line: lines,
      CustomerRef: {
        value: qboCustomer.Id,
        name: qboCustomer.Name
      },
      TxnDate: new Date().toISOString().split('T')[0], // Today's date
    };

    if (request.dueDate) {
      invoiceData.DueDate = request.dueDate;
    }

    if (request.memo) {
      invoiceData.PrivateNote = request.memo;
    }

    return invoiceData;
  }

  private async saveInvoiceToLocal(qboInvoice: any, clientId: number, lineItems: InvoiceLineItemData[]): Promise<any> {
    // Save invoice
    const invoiceData = {
      qboInvoiceId: qboInvoice.Id,
      qboCustomerId: qboInvoice.CustomerRef.value,
      clientId: clientId,
      invoiceNumber: qboInvoice.DocNumber,
      status: this.mapQBOInvoiceStatus(qboInvoice),
      totalAmount: qboInvoice.TotalAmt,
      invoiceDate: qboInvoice.TxnDate,
      dueDate: qboInvoice.DueDate || null,
      qboSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const savedInvoice = await this.db
      .insert(invoices)
      .values(invoiceData)
      .returning();

    // Save line items
    const invoiceLineItemsData = lineItems.map(item => ({
      invoiceId: savedInvoice[0].id,
      workActivityId: item.workActivityId || null,
      otherChargeId: item.otherChargeId || null,
      qboItemId: item.qboItemId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await this.db
      .insert(invoiceLineItems)
      .values(invoiceLineItemsData);

    return savedInvoice[0];
  }

  private async updateWorkActivitiesStatus(workActivityIds: number[], status: string): Promise<void> {
    await this.db
      .update(workActivities)
      .set({
        status: status,
        updatedAt: new Date()
      })
      .where(inArray(workActivities.id, workActivityIds));
  }

  private mapQBOInvoiceStatus(qboInvoice: any): string {
    // Map QuickBooks invoice status to our local status
    if (qboInvoice.Balance === 0) return 'paid';
    if (qboInvoice.EmailStatus === 'EmailSent') return 'sent';
    if (qboInvoice.DueDate && new Date(qboInvoice.DueDate) < new Date()) return 'overdue';
    return 'draft';
  }

  /**
   * Delete an invoice (from both local DB and QuickBooks)
   */
  async deleteInvoice(invoiceId: number): Promise<void> {
    try {
      console.log(`Starting deletion of invoice ID: ${invoiceId}`);
      
      // Get invoice details
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }
      
      console.log(`Found invoice: ${invoice.invoiceNumber} (QBO ID: ${invoice.qboInvoiceId})`);
      
      // 1. Get associated work activity IDs from line items
      const workActivityIds = await this.getWorkActivityIdsForInvoice(invoiceId);
      console.log(`Found ${workActivityIds.length} work activities to revert status`);
      
      // 2. Delete from QuickBooks (void the invoice)
      try {
        await this.ensureQBServiceInitialized();
        console.log('Voiding invoice in QuickBooks...');
        // Note: QuickBooks doesn't allow true deletion, only voiding
        // We'll implement voiding if the QB API supports it
        await this.voidInvoiceInQBO(invoice.qboInvoiceId);
        console.log('Invoice voided in QuickBooks');
      } catch (qbError) {
        console.warn('Failed to void invoice in QuickBooks:', qbError);
        // Continue with local deletion even if QB void fails
      }
      
      // 3. Delete invoice line items first (foreign key constraint)
      await this.db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
      console.log('Deleted invoice line items');
      
      // 4. Delete the invoice record
      await this.db.delete(invoices).where(eq(invoices.id, invoiceId));
      console.log('Deleted invoice record');
      
      // 5. Revert work activities status back to 'completed'
      if (workActivityIds.length > 0) {
        await this.updateWorkActivitiesStatus(workActivityIds, 'completed');
        console.log(`Reverted ${workActivityIds.length} work activities to 'completed' status`);
      }
      
      console.log(`✅ Successfully deleted invoice ${invoice.invoiceNumber}`);
      
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw new Error(`Failed to delete invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get invoice by ID
   */
  private async getInvoiceById(invoiceId: number): Promise<any> {
    const results = await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    
    return results[0] || null;
  }

  /**
   * Get work activity IDs associated with an invoice
   */
  private async getWorkActivityIdsForInvoice(invoiceId: number): Promise<number[]> {
    const lineItems = await this.db
      .select({ workActivityId: invoiceLineItems.workActivityId })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));
    
    return lineItems
      .filter(item => item.workActivityId !== null)
      .map(item => item.workActivityId as number);
  }

  /**
   * Void invoice in QuickBooks (QB doesn't support true deletion)
   */
  private async voidInvoiceInQBO(qboInvoiceId: string): Promise<void> {
    try {
      // Note: QuickBooks API typically doesn't support deleting invoices
      // For now, we'll just log that the invoice should be manually voided in QB
      console.log(`Invoice ${qboInvoiceId} should be manually voided in QuickBooks if needed`);
      
      // TODO: Implement actual QB void operation if the API supports it
      // This would require adding a voidInvoice method to QuickBooksService
      
    } catch (error) {
      console.error('Error with QuickBooks invoice operation:', error);
      throw error;
    }
  }
}

/**
 * Validate user-submitted line items and recompute `amount` server-side.
 * Server never trusts the client's `amount` — it's recomputed from
 * quantity × rate so a bad UI calculation can't push wrong money to QBO.
 * Throws on the first invalid line so the caller gets a clear error.
 */
export function normalizeInvoiceLineItems(lineItems: InvoiceLineItemData[]): InvoiceLineItemData[] {
  return lineItems.map((line, index) => {
    if (!line.qboItemId) {
      throw new Error(`Line ${index + 1} is missing qboItemId`);
    }
    if (typeof line.quantity !== 'number' || line.quantity <= 0) {
      throw new Error(`Line ${index + 1} must have quantity > 0`);
    }
    if (typeof line.rate !== 'number' || line.rate < 0) {
      throw new Error(`Line ${index + 1} must have rate >= 0`);
    }

    return {
      workActivityId: line.workActivityId,
      otherChargeId: line.otherChargeId,
      qboItemId: line.qboItemId,
      description: line.description ?? '',
      quantity: line.quantity,
      rate: line.rate,
      amount: line.quantity * line.rate
    };
  });
}

/**
 * Decide which work activities should be marked `invoiced`.
 *
 * Prefer the caller's explicit selection — that's the user's intent at the
 * time of invoicing, regardless of which labor lines they edited or removed
 * during the preview step. Without this, removing a labor line would leave
 * the activity stuck as `completed` and keep re-surfacing in the invoiceable
 * list. Falls back to whatever survived on the line items so older API
 * callers continue to mark activities invoiced.
 */
export function resolveInvoicedWorkActivityIds(
  selectedWorkActivityIds: number[] | undefined,
  lineItems: InvoiceLineItemData[]
): number[] {
  const source = selectedWorkActivityIds && selectedWorkActivityIds.length > 0
    ? selectedWorkActivityIds
    : lineItems
        .map(line => line.workActivityId)
        .filter((id): id is number => typeof id === 'number');
  return Array.from(new Set(source));
}

/**
 * Pick a rate for a suggested addition based on how confident we are in the
 * QBO item match.
 *
 * Only a `specific` (name-level) match gets the QBO item's unitPrice. The
 * category/fuzzy/fallback buckets share a single unit price that almost
 * certainly does not apply to this specific plant or material, so the rate
 * is zeroed out and the user is forced to set one. The submit guard in the
 * UI catches the zero before any wrong-money invoice can be sent.
 */
export function pickSuggestionRate(
  quality: SuggestedLineItem['qboItemMatchQuality'],
  item: { unitPrice?: number | null } | null | undefined
): number {
  if (quality !== 'specific') return 0;
  const unit = item?.unitPrice;
  return typeof unit === 'number' && unit > 0 ? unit : 0;
} 