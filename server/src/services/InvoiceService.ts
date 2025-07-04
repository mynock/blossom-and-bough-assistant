import { DatabaseService } from './DatabaseService';
import { QuickBooksService } from './QuickBooksService';
import { ClientService } from './ClientService';
import { WorkActivityService } from './WorkActivityService';
import { 
  workActivities, 
  invoices, 
  invoiceLineItems, 
  qboItems, 
  otherCharges,
  clients 
} from '../db';
import { eq, and, inArray } from 'drizzle-orm';

export interface CreateInvoiceRequest {
  clientId: number;
  workActivityIds: number[];
  includeOtherCharges?: boolean;
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

export class InvoiceService extends DatabaseService {
  private qbService: QuickBooksService;
  private clientService: ClientService;
  private workActivityService: WorkActivityService;

  constructor() {
    super();
    this.qbService = new QuickBooksService();
    this.clientService = new ClientService();
    this.workActivityService = new WorkActivityService();
  }

  /**
   * Sync QBO Items to local database
   */
  async syncQBOItems(): Promise<void> {
    try {
      await this.qbService.syncItems();
      console.log('QBO Items synced successfully');
    } catch (error) {
      console.error('Error syncing QBO Items:', error);
      throw error;
    }
  }

  /**
   * Get all available QBO Items
   */
  async getQBOItems(): Promise<any[]> {
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
   * Create invoice from work activities
   */
  async createInvoiceFromWorkActivities(request: CreateInvoiceRequest): Promise<any> {
    try {
      // 1. Get client data and ensure QBO customer exists
      const client = await this.clientService.getClientById(request.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      // 2. Find or create QBO customer
      const qboCustomer = await this.ensureQBOCustomer(client);

      // 3. Get work activities and validate they're ready for invoicing
      const workActivitiesData = await this.validateWorkActivitiesForInvoicing(request.workActivityIds);

      // 4. Build invoice line items from work activities
      const lineItems = await this.buildInvoiceLineItems(workActivitiesData, request.includeOtherCharges);

      // 5. Create invoice data for QBO
      const qboInvoiceData = this.buildQBOInvoiceData(qboCustomer, lineItems, request);

      // 6. Create invoice in QuickBooks
      const qboInvoice = await this.qbService.createInvoice(qboInvoiceData);

      // 7. Save invoice to local database
      const localInvoice = await this.saveInvoiceToLocal(qboInvoice, client.id, lineItems);

      // 8. Update work activities status to 'invoiced'
      await this.updateWorkActivitiesStatus(request.workActivityIds, 'invoiced');

      return {
        invoice: localInvoice,
        qboInvoice: qboInvoice,
        lineItems: lineItems.length
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
   * Sync invoice status from QuickBooks
   */
  async syncInvoiceStatus(invoiceId: number): Promise<void> {
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
    // Try to find existing customer by name
    let qboCustomer = await this.qbService.findCustomerByName(client.name);
    
    if (!qboCustomer) {
      // Create customer in QuickBooks
      const customerData = {
        Name: client.name,
        BillAddr: {
          Line1: client.address,
        },
        CompanyName: client.name,
        Active: true
      };
      
      qboCustomer = await this.qbService.createCustomer(customerData);
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

    // Group work activities by work type to combine similar services
    const serviceGroups = new Map<string, { activities: any[], totalHours: number }>();
    
    for (const activity of workActivitiesData) {
      if (!serviceGroups.has(activity.workType)) {
        serviceGroups.set(activity.workType, { activities: [], totalHours: 0 });
      }
      
      const group = serviceGroups.get(activity.workType)!;
      group.activities.push(activity);
      group.totalHours += activity.billableHours || activity.totalHours || 0;
    }

    // Create line items for services
    for (const [workType, group] of serviceGroups) {
      const qboItem = await this.findQBOItemForWorkType(workType);
      
      if (qboItem && group.totalHours > 0) {
        const description = this.buildServiceDescription(workType, group.activities);
        const rate = qboItem.unitPrice || 55.00; // Default rate if not set in QBO
        
        lineItems.push({
          workActivityId: group.activities[0].id, // Link to first activity for reference
          qboItemId: qboItem.qboId,
          description: description,
          quantity: group.totalHours,
          rate: rate,
          amount: group.totalHours * rate
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
          const qboItem = await this.findQBOItemForChargeType(charge.chargeType);
          
          if (qboItem) {
            lineItems.push({
              otherChargeId: charge.id,
              qboItemId: qboItem.qboId,
              description: charge.description,
              quantity: charge.quantity || 1,
              rate: charge.unitRate || charge.totalCost,
              amount: charge.totalCost
            });
          }
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
      if (item) return item;
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

  private async findQBOItemForChargeType(chargeType: string): Promise<any> {
    // Map charge types to QBO items
    const chargeTypeMapping: { [key: string]: string[] } = {
      'debris': ['Debris disposal per yard', 'Debris disposal'],
      'material': ['Garden Supplies', 'Materials'],
      'plant': ['Plants', 'Garden Supplies'],
      'delivery': ['Delivery', 'Service']
    };

    const possibleNames = chargeTypeMapping[chargeType.toLowerCase()] || [chargeType];
    
    for (const name of possibleNames) {
      const item = await this.findQBOItemByName(name);
      if (item) return item;
    }

    return null;
  }

  private buildServiceDescription(workType: string, activities: any[]): string {
    const dates = activities.map(a => new Date(a.date).toLocaleDateString()).join(', ');
    const totalHours = activities.reduce((sum, a) => sum + (a.billableHours || a.totalHours || 0), 0);
    
    return `${this.formatWorkType(workType)} - ${totalHours} hours (${dates})`;
  }

  private formatWorkType(workType: string): string {
    return workType.charAt(0).toUpperCase() + workType.slice(1).replace(/([A-Z])/g, ' $1');
  }

  private buildQBOInvoiceData(qboCustomer: any, lineItems: InvoiceLineItemData[], request: CreateInvoiceRequest): any {
    const lines = lineItems.map((item, index) => ({
      LineNum: index + 1,
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: item.qboItemId,
          name: item.description.split(' - ')[0] // Use first part as item name
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
} 