/// <reference path="../types/quickbooks.d.ts" />

// Temporary type declarations to bypass strict typing
declare const QuickBooks: any;
declare const OAuthClient: any;

import QuickBooksLib from 'node-quickbooks';
import OAuthClientLib from 'intuit-oauth';
import { DatabaseService } from './DatabaseService';
import { qboItems, invoices, invoiceLineItems } from '../db';
import { eq } from 'drizzle-orm';

export interface QBOCredentials {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

export interface QBOItem {
  Id: string;
  Name: string;
  Description?: string;
  Type: string;
  UnitPrice?: number;
  IncomeAccountRef?: {
    value: string;
    name: string;
  };
  Active: boolean;
}

export interface QBOInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  EmailStatus: string;
  PrintStatus: string;
  CustomerRef: {
    value: string;
    name: string;
  };
  Line: Array<{
    Id: string;
    LineNum: number;
    Amount: number;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef: {
        value: string;
        name: string;
      };
      Qty: number;
      UnitPrice: number;
    };
  }>;
}

export class QuickBooksService extends DatabaseService {
  private qbo: any;
  private oauthClient: any;

  constructor() {
    super();
    this.initializeClients();
  }

  /**
   * Reinitialize the QuickBooks clients (public method for token updates)
   */
  async reinitialize(): Promise<void> {
    this.initializeClients();
  }

  private initializeClients() {
    const credentials = this.getCredentials();
    
    // Initialize OAuth client
    this.oauthClient = new OAuthClientLib({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      environment: credentials.environment,
      redirectUri: process.env.QBO_REDIRECT_URI || 'http://localhost:3001/api/qbo/callback',
    });

    // If we have stored tokens, load them into the OAuth client
    if (credentials.accessToken && credentials.refreshToken && credentials.realmId) {
      try {
        this.oauthClient.setToken({
          token_type: 'bearer',
          access_token: credentials.accessToken,
          refresh_token: credentials.refreshToken,
          expires_in: 3600, // Default expiry
          x_refresh_token_expires_in: 8726400,
          realmId: credentials.realmId
        });
      } catch (error) {
        console.warn('Failed to set existing tokens in OAuth client:', error);
      }
    }

    // Initialize QuickBooks client if we have tokens
    if (credentials.accessToken && credentials.realmId) {
      this.qbo = new QuickBooksLib(
        credentials.clientId,
        credentials.clientSecret,
        credentials.accessToken,
        false, // no token secret for OAuth 2.0
        credentials.realmId,
        credentials.environment === 'sandbox', // use sandbox
        false, // enable debugging
        null, // minor version
        '2.0', // OAuth version
        credentials.refreshToken
      );
    }
  }

  private getCredentials(): QBOCredentials {
    return {
      clientId: process.env.QBO_CLIENT_ID || '',
      clientSecret: process.env.QBO_CLIENT_SECRET || '',
      accessToken: process.env.QBO_ACCESS_TOKEN || '',
      refreshToken: process.env.QBO_REFRESH_TOKEN || '',
      realmId: process.env.QBO_REALM_ID || '',
      environment: (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    };
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(): string {
    const credentials = this.getCredentials();
    
    // Check if required credentials are present
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('QuickBooks credentials not configured. Please set QBO_CLIENT_ID and QBO_CLIENT_SECRET in your environment variables.');
    }
    
    if (!this.oauthClient) {
      throw new Error('QuickBooks OAuth client not initialized properly.');
    }
    
    try {
      return this.oauthClient.authorizeUri({
        scope: [OAuthClientLib.scopes.Accounting],
        state: 'qbo_auth',
      });
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
      throw new Error('Failed to generate QuickBooks authorization URL. Please check your QuickBooks credentials.');
    }
  }

  /**
   * Handle OAuth callback and get tokens
   */
  async handleOAuthCallback(callbackUrl: string): Promise<any> {
    try {
      const authResponse = await this.oauthClient.createToken(callbackUrl);
      const token = authResponse.getToken();
      
      // Store the token in the OAuth client for future use
      this.oauthClient.setToken(authResponse);
      
      return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        realmId: token.realmId,
        expiresIn: token.expires_in,
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshTokens(): Promise<void> {
    try {
      const authResponse = await this.oauthClient.refresh();
      const token = authResponse.getToken();
      
      // Update tokens - in production, store these securely
      process.env.QBO_ACCESS_TOKEN = token.access_token;
      process.env.QBO_REFRESH_TOKEN = token.refresh_token;
      
      // Update the OAuth client's token state
      this.oauthClient.setToken(authResponse);
      
      // Reinitialize the QB client with new tokens
      this.initializeClients();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Check if access token is valid
   */
  isAccessTokenValid(): boolean {
    const credentials = this.getCredentials();
    
    if (!credentials.clientId || !credentials.clientSecret) {
      return false;
    }
    
    if (!this.oauthClient) {
      return false;
    }
    
    try {
      return this.oauthClient.isAccessTokenValid();
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }

  /**
   * Sync QBO Items to local database
   */
  async syncItems(): Promise<void> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.findItems({}, async (err: any, items: any) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const qboItemList = items.QueryResponse?.Item || [];
          
          for (const item of qboItemList) {
            await this.upsertItem(item);
          }
          
          console.log(`Synced ${qboItemList.length} items from QuickBooks`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Upsert QBO Item to local database
   */
  private async upsertItem(qboItem: QBOItem): Promise<void> {
    const itemData = {
      qboId: qboItem.Id,
      name: qboItem.Name,
      description: qboItem.Description || null,
      type: qboItem.Type,
      unitPrice: qboItem.UnitPrice || null,
      incomeAccountRef: qboItem.IncomeAccountRef?.value || null,
      active: qboItem.Active,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    };

    // Check if item exists
    const existingItem = await this.db
      .select()
      .from(qboItems)
      .where(eq(qboItems.qboId, qboItem.Id))
      .limit(1);

    if (existingItem.length > 0) {
      // Update existing item
      await this.db
        .update(qboItems)
        .set(itemData)
        .where(eq(qboItems.qboId, qboItem.Id));
    } else {
      // Insert new item
      await this.db
        .insert(qboItems)
        .values({
          ...itemData,
          createdAt: new Date(),
        });
    }
  }

  /**
   * Get all synced QBO Items
   */
  async getItems(): Promise<any[]> {
    return await this.db
      .select()
      .from(qboItems)
      .where(eq(qboItems.active, true))
      .orderBy(qboItems.name);
  }

  /**
   * Create invoice in QuickBooks
   */
  async createInvoice(invoiceData: any): Promise<any> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.createInvoice(invoiceData, (err: any, invoice: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(invoice);
      });
    });
  }

  /**
   * Get invoice from QuickBooks
   */
  async getInvoice(invoiceId: string): Promise<any> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.getInvoice(invoiceId, (err: any, invoice: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(invoice);
      });
    });
  }

  /**
   * Find invoices for a customer
   */
  async findInvoicesByCustomer(customerId: string): Promise<any[]> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.findInvoices({
        CustomerRef: customerId
      }, (err: any, invoices: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(invoices.QueryResponse?.Invoice || []);
      });
    });
  }

  /**
   * Create customer in QuickBooks
   */
  async createCustomer(customerData: any): Promise<any> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.createCustomer(customerData, (err: any, customer: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(customer);
      });
    });
  }

  /**
   * Create item in QuickBooks
   */
  async createItem(itemData: any): Promise<any> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.createItem(itemData, (err: any, item: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(item);
      });
    });
  }

  /**
   * Get income accounts
   */
  async getIncomeAccounts(): Promise<any[]> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.findAccounts({
        AccountType: 'Income'
      }, (err: any, accounts: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(accounts.QueryResponse?.Account || []);
      });
    });
  }

  /**
   * Get all customers
   */
  async getAllCustomers(): Promise<any[]> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.findCustomers({}, (err: any, customers: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        const customerList = customers.QueryResponse?.Customer || [];
        console.log(`getAllCustomers: Found ${customerList.length} customers`);
        
        resolve(customerList);
      });
    });
  }

  /**
   * Find customer by name
   */
  async findCustomerByName(name: string): Promise<any> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      // Get all customers and filter by name (more reliable than direct search)
      this.qbo.findCustomers({}, (err: any, customers: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        const customerList = customers.QueryResponse?.Customer || [];
        console.log(`findCustomerByName: Searching for "${name}" among ${customerList.length} customers`);
        
        // Debug: Show first few customer names
        console.log(`First 5 customer names:`, customerList.slice(0, 5).map((c: any) => `"${c.DisplayName}"`).join(', '));
        
        // Case-insensitive search for exact match
        const foundCustomer = customerList.find((customer: any) => {
          const customerName = customer.DisplayName?.toLowerCase() || '';
          const searchName = name.toLowerCase();
          return customer.DisplayName && customerName === searchName;
        });
        
        resolve(foundCustomer || null);
      });
    });
  }

  /**
   * Sync QBO Customers to local database
   */
  async syncCustomers(): Promise<void> {
    if (!this.qbo) {
      throw new Error('QuickBooks client not initialized');
    }

    return new Promise((resolve, reject) => {
      this.qbo.findCustomers({}, async (err: any, customers: any) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const qboCustomerList = customers.QueryResponse?.Customer || [];
          
          console.log(`Found ${qboCustomerList.length} customers in QuickBooks`);
          
          // Import customers into local database
          const { ClientService } = await import('./ClientService');
          const clientService = new ClientService();
          
          for (const customer of qboCustomerList) {
            await this.upsertCustomer(customer, clientService);
          }
          
          console.log(`Synced ${qboCustomerList.length} customers from QuickBooks`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Upsert a customer from QuickBooks to local database
   */
  private async upsertCustomer(qboCustomer: any, clientService: any): Promise<void> {
    try {
      // Check if customer already exists locally by name
      const existingClient = await clientService.getClientByName(qboCustomer.DisplayName);
      
      if (!existingClient) {
        // Create new local client from QuickBooks customer
        const newClient = {
          clientId: `qbo-${qboCustomer.Id}`,
          name: qboCustomer.DisplayName,
          address: qboCustomer.BillAddr?.Line1 || '',
          geoZone: '', // Can be filled in later
          isRecurringMaintenance: false,
          activeStatus: qboCustomer.Active ? 'active' : 'inactive'
        };
        
        await clientService.createClient(newClient);
        console.log(`Created local client from QuickBooks: ${qboCustomer.DisplayName}`);
      } else {
        console.log(`Customer already exists locally: ${qboCustomer.DisplayName}`);
      }
    } catch (error) {
      console.error(`Error upserting customer ${qboCustomer.DisplayName}:`, error);
      // Continue with other customers
    }
  }
} 