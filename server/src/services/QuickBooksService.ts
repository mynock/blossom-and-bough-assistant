/// <reference path="../types/quickbooks.d.ts" />

import QuickBooksLib from 'node-quickbooks';
import OAuthClientLib from 'intuit-oauth';
import { DatabaseService } from './DatabaseService';
import { qboItems, qboCredentials, invoices, invoiceLineItems, clients } from '../db';
import { eq } from 'drizzle-orm';
import { encryptToken, decryptToken } from '../utils/encryption';

export interface QBOAppConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  redirectUri: string;
}

export interface QBOTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
}

export interface QBOItem {
  Id: string;
  Name: string;
  Description?: string;
  Type: string;
  UnitPrice?: number;
  IncomeAccountRef?: { value: string; name: string };
  Active: boolean;
}

export interface QBOCustomer {
  Id: string;
  DisplayName: string;
  Active?: boolean;
  BillAddr?: { Line1?: string };
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
  CustomerRef: { value: string; name: string };
  Line: Array<{
    Id: string;
    LineNum: number;
    Amount: number;
    DetailType: string;
    Description?: string; // Per-line description returned by QBO at the line level
    SalesItemLineDetail?: {
      ItemRef: { value: string; name: string };
      Qty: number;
      UnitPrice: number;
    };
  }>;
}

// Refresh the access token if it expires within this many seconds. Intuit
// access tokens last 1 hour; refreshing 5 minutes early avoids racing the
// expiry on any single in-flight request.
const REFRESH_LEEWAY_SECONDS = 5 * 60;

export class QuickBooksService extends DatabaseService {
  private qbo: any;
  private oauthClient: any;
  private cachedExpiresAt: Date | null = null;

  constructor() {
    super();
    this.initializeOAuthClient();
  }

  private getAppConfig(): QBOAppConfig {
    return {
      clientId: process.env.QBO_CLIENT_ID || '',
      clientSecret: process.env.QBO_CLIENT_SECRET || '',
      environment: (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      redirectUri: process.env.QBO_REDIRECT_URI || 'http://localhost:3001/api/qbo/callback',
    };
  }

  private initializeOAuthClient() {
    const config = this.getAppConfig();
    if (!config.clientId || !config.clientSecret) {
      // OAuth client cannot be constructed without app credentials; defer.
      return;
    }
    this.oauthClient = new OAuthClientLib({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      environment: config.environment,
      redirectUri: config.redirectUri,
    });
  }

  // ------------------------------------------------------------------
  // Credential persistence (encrypted at rest in qbo_credentials table)
  // ------------------------------------------------------------------

  private async loadTokensFromDb(): Promise<QBOTokens | null> {
    const rows = await this.db.select().from(qboCredentials).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      accessToken: decryptToken(row.accessTokenEncrypted),
      refreshToken: decryptToken(row.refreshTokenEncrypted),
      realmId: row.realmId,
      accessTokenExpiresAt: row.accessTokenExpiresAt,
      refreshTokenExpiresAt: row.refreshTokenExpiresAt,
    };
  }

  private async saveTokensToDb(tokens: QBOTokens): Promise<void> {
    const row = {
      id: 1,
      realmId: tokens.realmId,
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken),
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      updatedAt: new Date(),
    };
    await this.db
      .insert(qboCredentials)
      .values({ ...row, createdAt: new Date() })
      .onConflictDoUpdate({ target: qboCredentials.id, set: row });
    this.cachedExpiresAt = tokens.accessTokenExpiresAt;
  }

  private async clearTokensInDb(): Promise<void> {
    await this.db.delete(qboCredentials).where(eq(qboCredentials.id, 1));
    this.cachedExpiresAt = null;
  }

  /**
   * Convert an Intuit token response into a QBOTokens with absolute expiries.
   * The library returns expires_in / x_refresh_token_expires_in as seconds
   * from now; we store absolute timestamps so we can persist them.
   */
  private toQBOTokens(token: any): QBOTokens {
    const now = Date.now();
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      realmId: token.realmId,
      accessTokenExpiresAt: new Date(now + (token.expires_in ?? 3600) * 1000),
      refreshTokenExpiresAt: token.x_refresh_token_expires_in
        ? new Date(now + token.x_refresh_token_expires_in * 1000)
        : null,
    };
  }

  /**
   * Push tokens into the in-memory OAuth client and rebuild the QB API client.
   * Computes a synthetic expires_in so the library's own expiry tracking stays
   * accurate when we restore from DB.
   */
  private hydrateClients(tokens: QBOTokens) {
    if (!this.oauthClient) {
      this.initializeOAuthClient();
      if (!this.oauthClient) {
        throw new Error('Cannot hydrate QuickBooks client: app credentials are missing');
      }
    }
    const config = this.getAppConfig();
    const expiresInSec = Math.max(
      0,
      Math.floor((tokens.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
    );
    const refreshExpiresInSec = tokens.refreshTokenExpiresAt
      ? Math.max(0, Math.floor((tokens.refreshTokenExpiresAt.getTime() - Date.now()) / 1000))
      : 8726400;
    this.oauthClient.setToken({
      token_type: 'bearer',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: expiresInSec,
      x_refresh_token_expires_in: refreshExpiresInSec,
      realmId: tokens.realmId,
    });
    this.qbo = new QuickBooksLib(
      config.clientId,
      config.clientSecret,
      tokens.accessToken,
      false,
      tokens.realmId,
      config.environment === 'sandbox',
      false,
      null,
      '2.0',
      tokens.refreshToken
    );
    this.cachedExpiresAt = tokens.accessTokenExpiresAt;
  }

  /**
   * Ensure an authenticated QB client is available and the access token is
   * fresh. Called before every API operation. Loads from DB on first use,
   * refreshes if within the leeway window of expiry.
   */
  private async ensureClient(): Promise<void> {
    if (!this.qbo) {
      const tokens = await this.loadTokensFromDb();
      if (!tokens) {
        throw new Error('QuickBooks is not connected. Authorize the app first.');
      }
      this.hydrateClients(tokens);
    }
    const expiresAt = this.cachedExpiresAt;
    if (expiresAt && expiresAt.getTime() - Date.now() < REFRESH_LEEWAY_SECONDS * 1000) {
      await this.refreshTokens();
    }
  }

  // ------------------------------------------------------------------
  // OAuth flow
  // ------------------------------------------------------------------

  /**
   * Get OAuth authorization URL. State is supplied by the caller (a
   * per-request nonce stored in the session) so the callback can verify
   * it and reject forged callbacks. See routes/quickbooks.ts.
   */
  getAuthUrl(state: string): string {
    const config = this.getAppConfig();
    if (!config.clientId || !config.clientSecret) {
      throw new Error('QuickBooks credentials not configured. Please set QBO_CLIENT_ID and QBO_CLIENT_SECRET.');
    }
    if (!this.oauthClient) {
      this.initializeOAuthClient();
    }
    if (!this.oauthClient) {
      throw new Error('QuickBooks OAuth client not initialized properly.');
    }
    if (!state) {
      throw new Error('OAuth state nonce is required');
    }
    return this.oauthClient.authorizeUri({
      scope: [OAuthClientLib.scopes.Accounting],
      state,
    });
  }

  /**
   * Exchange the OAuth callback URL for tokens and persist them encrypted.
   */
  async handleOAuthCallback(callbackUrl: string): Promise<void> {
    if (!this.oauthClient) {
      this.initializeOAuthClient();
    }
    if (!this.oauthClient) {
      throw new Error('QuickBooks OAuth client not initialized properly.');
    }
    const authResponse = await this.oauthClient.createToken(callbackUrl);
    const tokens = this.toQBOTokens(authResponse.getToken());
    await this.saveTokensToDb(tokens);
    this.hydrateClients(tokens);
  }

  /**
   * Refresh the access token using the stored refresh token, persist the
   * new tokens, and rebuild the QB API client.
   */
  async refreshTokens(): Promise<void> {
    if (!this.oauthClient) {
      const stored = await this.loadTokensFromDb();
      if (!stored) {
        throw new Error('Cannot refresh: no stored QuickBooks credentials');
      }
      this.hydrateClients(stored);
    }
    const authResponse = await this.oauthClient.refresh();
    const tokens = this.toQBOTokens(authResponse.getToken());
    await this.saveTokensToDb(tokens);
    this.hydrateClients(tokens);
  }

  /**
   * True when the app has stored, non-expired QBO credentials it can use.
   */
  async isAccessTokenValid(): Promise<boolean> {
    const config = this.getAppConfig();
    if (!config.clientId || !config.clientSecret) return false;
    const tokens = await this.loadTokensFromDb();
    if (!tokens) return false;
    return tokens.accessTokenExpiresAt.getTime() > Date.now();
  }

  /**
   * Disconnect the QuickBooks integration: revoke at Intuit if possible and
   * remove the encrypted credentials from the database.
   */
  async disconnect(): Promise<void> {
    try {
      if (this.oauthClient && this.qbo) {
        await this.oauthClient.revoke();
      }
    } catch (error) {
      // Best-effort; clearing local credentials is the important part.
      console.warn('QuickBooks token revoke failed; clearing local credentials anyway:', error);
    }
    this.qbo = null;
    await this.clearTokensInDb();
  }

  // ------------------------------------------------------------------
  // QuickBooks API operations — each ensures a fresh client first.
  // ------------------------------------------------------------------

  async syncItems(): Promise<void> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.findItems({}, async (err: any, items: any) => {
        if (err) return reject(err);
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
    const existingItem = await this.db
      .select()
      .from(qboItems)
      .where(eq(qboItems.qboId, qboItem.Id))
      .limit(1);
    if (existingItem.length > 0) {
      await this.db.update(qboItems).set(itemData).where(eq(qboItems.qboId, qboItem.Id));
    } else {
      await this.db.insert(qboItems).values({ ...itemData, createdAt: new Date() });
    }
  }

  async getItems(): Promise<any[]> {
    return await this.db
      .select()
      .from(qboItems)
      .where(eq(qboItems.active, true))
      .orderBy(qboItems.name);
  }

  async createInvoice(invoiceData: any): Promise<any> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.createInvoice(invoiceData, (err: any, invoice: any) => {
        if (err) return reject(err);
        resolve(invoice);
      });
    });
  }

  async getInvoice(invoiceId: string): Promise<any> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.getInvoice(invoiceId, (err: any, invoice: any) => {
        if (err) return reject(err);
        resolve(invoice);
      });
    });
  }

  async findInvoicesByCustomer(customerId: string): Promise<any[]> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.findInvoices({ CustomerRef: customerId }, (err: any, invoicesResp: any) => {
        if (err) return reject(err);
        resolve(invoicesResp.QueryResponse?.Invoice || []);
      });
    });
  }

  /**
   * Fetch all invoices from QuickBooks. Uses fetchAll: true so the library
   * handles pagination automatically — no explicit page/offset needed.
   */
  async getAllInvoices(): Promise<QBOInvoice[]> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.findInvoices({ fetchAll: true }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response.QueryResponse?.Invoice || []);
      });
    });
  }

  async createCustomer(customerData: any): Promise<any> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.createCustomer(customerData, (err: any, customer: any) => {
        if (err) return reject(err);
        resolve(customer);
      });
    });
  }

  async createItem(itemData: any): Promise<any> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.createItem(itemData, (err: any, item: any) => {
        if (err) return reject(err);
        resolve(item);
      });
    });
  }

  async getIncomeAccounts(): Promise<any[]> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.findAccounts({ AccountType: 'Income' }, (err: any, accounts: any) => {
        if (err) return reject(err);
        resolve(accounts.QueryResponse?.Account || []);
      });
    });
  }

  async getAllCustomers(): Promise<QBOCustomer[]> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      // fetchAll so we page past QBO's default result cap.
      this.qbo.findCustomers({ fetchAll: true }, (err: any, customers: any) => {
        if (err) return reject(err);
        const customerList = (customers.QueryResponse?.Customer || []) as QBOCustomer[];
        console.log(`getAllCustomers: Found ${customerList.length} customers`);
        resolve(customerList);
      });
    });
  }

  async findCustomerByName(name: string): Promise<any> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.findCustomers({}, (err: any, customers: any) => {
        if (err) return reject(err);
        const customerList = customers.QueryResponse?.Customer || [];
        console.log(`findCustomerByName: Searching for "${name}" among ${customerList.length} customers`);
        console.log(`First 5 customer names:`, customerList.slice(0, 5).map((c: any) => `"${c.DisplayName}"`).join(', '));
        const foundCustomer = customerList.find((customer: any) => {
          const customerName = customer.DisplayName?.toLowerCase() || '';
          const searchName = name.toLowerCase();
          return customer.DisplayName && customerName === searchName;
        });
        resolve(foundCustomer || null);
      });
    });
  }

  async syncCustomers(): Promise<void> {
    await this.ensureClient();
    return new Promise((resolve, reject) => {
      this.qbo.findCustomers({}, async (err: any, customers: any) => {
        if (err) return reject(err);
        try {
          const qboCustomerList = customers.QueryResponse?.Customer || [];
          console.log(`Found ${qboCustomerList.length} customers in QuickBooks`);
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

  private async upsertCustomer(qboCustomer: any, clientService: any): Promise<void> {
    try {
      const existingClient = await clientService.getClientByName(qboCustomer.DisplayName);
      if (!existingClient) {
        const newClient = {
          clientId: `qbo-${qboCustomer.Id}`,
          name: qboCustomer.DisplayName,
          address: qboCustomer.BillAddr?.Line1 || '',
          geoZone: '',
          isRecurringMaintenance: false,
          activeStatus: qboCustomer.Active ? 'active' : 'inactive',
          qboCustomerId: qboCustomer.Id,
        };
        await clientService.createClient(newClient);
        console.log(`Created local client from QuickBooks: ${qboCustomer.DisplayName} (qboCustomerId=${qboCustomer.Id})`);
      } else {
        // Backfill qboCustomerId on the existing local client if not already set.
        // If a different non-null qboCustomerId is already present, log a warning
        // rather than overwriting — two QBO customers mapping to one local client
        // is a data-quality issue that needs manual review.
        if (!existingClient.qboCustomerId) {
          await this.db
            .update(clients)
            .set({ qboCustomerId: qboCustomer.Id, updatedAt: new Date() })
            .where(eq(clients.id, existingClient.id));
          console.log(`Backfilled qboCustomerId=${qboCustomer.Id} for existing client: ${qboCustomer.DisplayName}`);
        } else if (existingClient.qboCustomerId !== qboCustomer.Id) {
          console.warn(
            `Data quality warning: local client "${qboCustomer.DisplayName}" (id=${existingClient.id}) ` +
            `already has qboCustomerId="${existingClient.qboCustomerId}" but QBO customer has Id="${qboCustomer.Id}". ` +
            `Skipping update — manual review required.`
          );
        } else {
          console.log(`Customer already exists locally with matching qboCustomerId: ${qboCustomer.DisplayName}`);
        }
      }
    } catch (error) {
      console.error(`Error upserting customer ${qboCustomer.DisplayName}:`, error);
    }
  }
}
