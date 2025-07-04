declare module 'node-quickbooks' {
  interface QuickBooksConstructor {
    new (
      consumerKey: string,
      consumerSecret: string,
      oauthToken: string,
      oauthTokenSecret: boolean,
      realmId: string,
      useSandbox: boolean,
      debug: boolean,
      minorVer: any,
      oAuthVer: string,
      refreshToken: string
    ): QuickBooksClient;
  }

  interface QuickBooksClient {
    findItems(criteria: any, callback: (err: any, items: any) => void): void;
    createInvoice(invoice: any, callback: (err: any, invoice: any) => void): void;
    getInvoice(id: string, callback: (err: any, invoice: any) => void): void;
    findInvoices(criteria: any, callback: (err: any, invoices: any) => void): void;
    createCustomer(customer: any, callback: (err: any, customer: any) => void): void;
    findCustomers(criteria: any, callback: (err: any, customers: any) => void): void;
  }

  const QuickBooks: QuickBooksConstructor;
  export = QuickBooks;
}

declare module 'intuit-oauth' {
  interface OAuthClientConstructor {
    new (config: {
      clientId: string;
      clientSecret: string;
      environment: string;
      redirectUri: string;
    }): OAuthClientInstance;
    scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      OpenId: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
    };
  }

  interface OAuthClientInstance {
    authorizeUri(options: { scope: string[]; state: string }): string;
    createToken(callbackUrl: string): Promise<any>;
    refresh(): Promise<any>;
    isAccessTokenValid(): boolean;
    getToken(): any;
  }

  const OAuthClient: OAuthClientConstructor;
  export = OAuthClient;
} 