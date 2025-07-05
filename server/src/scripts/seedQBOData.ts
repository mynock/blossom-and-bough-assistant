import { QuickBooksService } from '../services/QuickBooksService';
import { InvoiceService } from '../services/InvoiceService';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

interface SeedCustomer {
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  address: {
    line1: string;
    city: string;
    countrySubDivisionCode: string;
    postalCode: string;
  };
}

interface SeedItem {
  name: string;
  description: string;
  type: 'Service' | 'Inventory';
  unitPrice: number;
  incomeAccountRef?: string;
}

class QBOSeedDataGenerator {
  private qbService: QuickBooksService;
  private invoiceService: InvoiceService;

  constructor() {
    this.qbService = new QuickBooksService();
    this.invoiceService = new InvoiceService();
  }

  // Sample customers based on your landscaping business
  private readonly sampleCustomers: SeedCustomer[] = [
    {
      name: 'Sarah Johnson',
      companyName: 'Johnson Residence',
      email: 'sarah.johnson@example.com',
      phone: '(555) 123-4567',
      address: {
        line1: '123 Maple Street',
        city: 'Springfield',
        countrySubDivisionCode: 'CA',
        postalCode: '90210'
      }
    },
    {
      name: 'Michael Chen',
      companyName: 'Chen Family Home',
      email: 'michael.chen@example.com',
      phone: '(555) 234-5678',
      address: {
        line1: '456 Oak Avenue',
        city: 'Springfield',
        countrySubDivisionCode: 'CA',
        postalCode: '90211'
      }
    },
    {
      name: 'Emily Rodriguez',
      companyName: 'Rodriguez Property',
      email: 'emily.rodriguez@example.com',
      phone: '(555) 345-6789',
      address: {
        line1: '789 Pine Drive',
        city: 'Springfield',
        countrySubDivisionCode: 'CA',
        postalCode: '90212'
      }
    },
    {
      name: 'David Thompson',
      companyName: 'Thompson Estate',
      email: 'david.thompson@example.com',
      phone: '(555) 456-7890',
      address: {
        line1: '321 Cedar Lane',
        city: 'Springfield',
        countrySubDivisionCode: 'CA',
        postalCode: '90213'
      }
    },
    {
      name: 'Lisa Williams',
      companyName: 'Williams Residence',
      email: 'lisa.williams@example.com',
      phone: '(555) 567-8901',
      address: {
        line1: '654 Birch Court',
        city: 'Springfield',
        countrySubDivisionCode: 'CA',
        postalCode: '90214'
      }
    }
  ];

  // Actual service items from your business
  private readonly sampleItems: SeedItem[] = [
    // Premium Services ($80+)
    { name: 'Design Consultation', unitPrice: 160, description: 'Professional garden design consultation', type: 'Service' },
    { name: 'Sod disposal', unitPrice: 100, description: 'Removal and disposal of existing sod', type: 'Service' },
    { name: 'Debris disposal per yard', unitPrice: 95, description: 'Yard debris removal and disposal service', type: 'Service' },
    { name: 'Garden coaching', unitPrice: 80, description: 'Educational garden coaching sessions', type: 'Service' },
    { name: 'Specialized pruning', unitPrice: 80, description: 'Expert pruning for specialized plants', type: 'Service' },
    { name: 'Project management', unitPrice: 80, description: 'Project coordination and management', type: 'Service' },
    { name: 'Design', unitPrice: 80, description: 'Garden and landscape design services', type: 'Service' },
    { name: 'Design and project management', unitPrice: 80, description: 'Combined design and project management', type: 'Service' },
    
    // Standard Services ($50-55)
    { name: 'Soil work', unitPrice: 55, description: 'Soil preparation and amendment', type: 'Service' },
    { name: 'Prep work', unitPrice: 55, description: 'Site preparation for planting', type: 'Service' },
    { name: 'Plant installation', unitPrice: 55, description: 'Professional plant installation service', type: 'Service' },
    { name: 'Plant procurement', unitPrice: 55, description: 'Plant sourcing and procurement', type: 'Service' },
    { name: 'Rock work', unitPrice: 55, description: 'Hardscape and rock installation', type: 'Service' },
    { name: 'Specialized garden care', unitPrice: 55, description: 'Specialized maintenance and care', type: 'Service' },
    { name: 'Landscape installation', unitPrice: 50, description: 'Complete landscape installation', type: 'Service' },
    { name: 'Garden installation', unitPrice: 50, description: 'Garden bed creation and installation', type: 'Service' },
    { name: 'Installation', unitPrice: 50, description: 'General installation services', type: 'Service' },
    
    // Disposal and Fees
    { name: 'Soil disposal fee', unitPrice: 35, description: 'Fee for soil removal and disposal', type: 'Service' },
    { name: 'Debris recycling fee per yard', unitPrice: 30, description: 'Recycling fee for yard debris', type: 'Service' },
    { name: 'Debris recycling fee', unitPrice: 30, description: 'General debris recycling fee', type: 'Service' },
    { name: 'Debris disposal per bag', unitPrice: 10, description: 'Per bag debris disposal fee', type: 'Service' },
    { name: 'Sluggo', unitPrice: 8, description: 'Sluggo application service', type: 'Service' },
    
    // Variable Rate Services (set to 0 for manual pricing)
    { name: 'Customer Tips', unitPrice: 0, description: 'Customer gratuity', type: 'Service' },
    { name: 'Design deposit', unitPrice: 0, description: 'Deposit for design services', type: 'Service' },
    { name: 'Consultation and specialized services', unitPrice: 0, description: 'Custom consultation services', type: 'Service' },
    { name: 'Installation services', unitPrice: 0, description: 'Custom installation services', type: 'Service' },
    { name: 'Pest treatment', unitPrice: 0, description: 'Pest control and treatment', type: 'Service' },
    { name: 'Boulders', unitPrice: 0, description: 'Boulder installation and placement', type: 'Service' },
    { name: 'Trash disposal fee', unitPrice: 0, description: 'General trash disposal fee', type: 'Service' },
    { name: 'Materials deposit', unitPrice: 0, description: 'Deposit for materials', type: 'Service' },
    { name: 'Debris disposal', unitPrice: 0, description: 'General debris disposal', type: 'Service' },
    { name: 'Irrigation service', unitPrice: 0, description: 'Irrigation system services', type: 'Service' },
    { name: 'Labor', unitPrice: 0, description: 'General labor services', type: 'Service' },
    { name: 'Installation labor', unitPrice: 0, description: 'Installation labor services', type: 'Service' },
    { name: 'Subcontracted services', unitPrice: 0, description: 'Third-party contractor services', type: 'Service' },
    { name: 'Garbage disposal', unitPrice: 0, description: 'Garbage removal service', type: 'Service' },
    { name: 'Rejected bank transfer', unitPrice: 0, description: 'Bank transfer payment processing', type: 'Service' },
    { name: 'Equipment rental fee', unitPrice: 0, description: 'Equipment rental charges', type: 'Service' },
    { name: 'Refund', unitPrice: 0, description: 'Service refunds', type: 'Service' },
    { name: 'Mulch blowing service', unitPrice: 0, description: 'Mulch installation via blowing', type: 'Service' },
    { name: 'Mulch service', unitPrice: 0, description: 'Mulch installation service', type: 'Service' }
  ];

  async createCustomers(qbService?: QuickBooksService): Promise<any[]> {
    console.log('Creating sample customers in QuickBooks...');
    const customers: any[] = [];
    const qbSvc = qbService || this.qbService;
    
    for (const customerData of this.sampleCustomers) {
      try {
        console.log(`Creating customer: ${customerData.name}`);
        
        const customer = await qbSvc.createCustomer({
          Name: customerData.name,
          CompanyName: customerData.companyName,
          PrimaryEmailAddr: {
            Address: customerData.email
          },
          PrimaryPhone: {
            FreeFormNumber: customerData.phone
          },
          BillAddr: {
            Line1: customerData.address.line1,
            City: customerData.address.city,
            CountrySubDivisionCode: customerData.address.countrySubDivisionCode,
            PostalCode: customerData.address.postalCode
          },
          ShipAddr: {
            Line1: customerData.address.line1,
            City: customerData.address.city,
            CountrySubDivisionCode: customerData.address.countrySubDivisionCode,
            PostalCode: customerData.address.postalCode
          }
        });
        
        customers.push(customer);
        console.log(`✓ Created customer: ${customerData.name} (ID: ${customer.Id})`);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`✗ Failed to create customer ${customerData.name}:`, JSON.stringify(error, null, 2));
      }
    }
    
    return customers;
  }

  async createItems(qbService?: QuickBooksService): Promise<any[]> {
    console.log('Creating sample service items in QuickBooks...');
    const items: any[] = [];
    const qbSvc = qbService || this.qbService;
    
    for (const itemData of this.sampleItems) {
      try {
        console.log(`Creating item: ${itemData.name}`);
        
        const item = await qbSvc.createItem({
          Name: itemData.name,
          Description: itemData.description,
          Type: itemData.type,
          UnitPrice: itemData.unitPrice,
          Taxable: false,
          TrackQtyOnHand: false
        });
        
        items.push(item);
        console.log(`✓ Created item: ${itemData.name} (ID: ${item.Id}) - $${itemData.unitPrice}`);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`✗ Failed to create item ${itemData.name}:`, JSON.stringify(error, null, 2));
      }
    }
    
    return items;
  }

  async createSampleInvoices(customers: any[], items: any[], qbService?: QuickBooksService): Promise<any[]> {
    console.log('Creating sample invoices in QuickBooks...');
    const invoices: any[] = [];
    const qbSvc = qbService || this.qbService;
    
    if (customers.length === 0 || items.length === 0) {
      console.log('No customers or items available for invoice creation');
      return invoices;
    }
    
    // Create 3-5 sample invoices
    const invoiceCount = Math.min(5, customers.length);
    
    // Filter items by categories for more realistic combinations
    const premiumServices = items.filter(item => item.UnitPrice >= 80);
    const standardServices = items.filter(item => item.UnitPrice >= 50 && item.UnitPrice < 80);
    const disposalServices = items.filter(item => item.UnitPrice > 0 && item.UnitPrice < 50);
    
    for (let i = 0; i < invoiceCount; i++) {
      try {
        const customer = customers[i];
        console.log(`Creating invoice for: ${customer.Name}`);
        
        // Create realistic service combinations
        const selectedItems: any[] = [];
        const invoiceType = Math.random();
        
        if (invoiceType < 0.3 && premiumServices.length > 0) {
          // 30% chance: Design/consultation project
          selectedItems.push(...this.getRandomItems(premiumServices, 1));
          if (standardServices.length > 0) {
            selectedItems.push(...this.getRandomItems(standardServices, Math.floor(Math.random() * 2) + 1));
          }
        } else if (invoiceType < 0.7 && standardServices.length > 0) {
          // 40% chance: Standard maintenance/installation
          selectedItems.push(...this.getRandomItems(standardServices, Math.floor(Math.random() * 3) + 1));
          if (disposalServices.length > 0 && Math.random() < 0.5) {
            selectedItems.push(...this.getRandomItems(disposalServices, 1));
          }
        } else {
          // 30% chance: Mixed services
          if (standardServices.length > 0) selectedItems.push(...this.getRandomItems(standardServices, 1));
          if (disposalServices.length > 0) selectedItems.push(...this.getRandomItems(disposalServices, 1));
        }
        
        // Fallback if no items selected
        if (selectedItems.length === 0) {
          selectedItems.push(...this.getRandomItems(items.filter(item => item.UnitPrice > 0), 1));
        }
        
        const lineItems = selectedItems.map((item, index) => {
          // Realistic quantities based on service type
          let qty = 1;
          if (item.UnitPrice >= 50) {
            qty = Math.floor(Math.random() * 6) + 2; // 2-7 hours for labor services
          } else if (item.UnitPrice > 0) {
            qty = Math.floor(Math.random() * 3) + 1; // 1-3 units for disposal/materials
          }
          
          const amount = item.UnitPrice * qty;
          
          return {
            Id: String(index + 1),
            LineNum: index + 1,
            Amount: amount,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              ItemRef: {
                value: item.Id,
                name: item.Name
              },
              UnitPrice: item.UnitPrice,
              Qty: qty
            }
          };
        });
        
        const totalAmount = lineItems.reduce((sum, line) => sum + line.Amount, 0);
        
        const invoice = await qbSvc.createInvoice({
          CustomerRef: {
            value: customer.Id,
            name: customer.Name
          },
          Line: lineItems,
          TotalAmt: totalAmount,
          DueDate: this.getFutureDateString(30), // 30 days from now
          TxnDate: this.getCurrentDateString()
        });
        
        invoices.push(invoice);
        console.log(`✓ Created invoice for ${customer.Name} - $${totalAmount.toFixed(2)} (ID: ${invoice.Id})`);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`✗ Failed to create invoice:`, error);
      }
    }
    
    return invoices;
  }

  private getRandomItems(items: any[], count: number): any[] {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getFutureDateString(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  async syncItemsToLocalDB(invoiceService?: InvoiceService): Promise<void> {
    console.log('Syncing QBO items to local database...');
    const invoiceSvc = invoiceService || this.invoiceService;
    try {
      await invoiceSvc.syncQBOItems();
      console.log('✓ Successfully synced QBO items to local database');
    } catch (error) {
      console.error('✗ Failed to sync items to local database:', error);
    }
  }

  async generateAllSeedData(qbService?: QuickBooksService, invoiceService?: InvoiceService): Promise<void> {
    console.log('🌱 Starting QBO Sandbox Seed Data Generation...\n');
    
    // Use provided services if available (for API calls), otherwise use instance services
    const qbSvc = qbService || this.qbService;
    const invoiceSvc = invoiceService || this.invoiceService;
    
    try {
      // If using provided service, make sure our instance is also initialized with tokens
      if (qbService && !this.qbService.isAccessTokenValid()) {
        // Reinitialize our instance to get the tokens from environment
        this.qbService = new QuickBooksService();
        this.invoiceService = new InvoiceService();
      }
      
      // Check if we're authenticated
      if (!qbSvc.isAccessTokenValid()) {
        console.error('❌ QuickBooks not authenticated. Please run OAuth flow first.');
        return;
      }
      
      console.log('✓ QuickBooks authentication verified\n');
      
      // Step 1: Create customers
      const customers = await this.createCustomers(qbSvc);
      console.log(`\n✓ Created ${customers.length} customers\n`);
      
      // Step 2: Create service items
      const items = await this.createItems(qbSvc);
      console.log(`\n✓ Created ${items.length} service items\n`);
      
      // Step 3: Sync items to local database
      await this.syncItemsToLocalDB(invoiceSvc);
      console.log();
      
      // Step 4: Create sample invoices
      const invoices = await this.createSampleInvoices(customers, items, qbSvc);
      console.log(`\n✓ Created ${invoices.length} sample invoices\n`);
      
      console.log('🎉 Seed data generation completed successfully!');
      console.log('\nSummary:');
      console.log(`- Customers: ${customers.length}`);
      console.log(`- Service Items: ${items.length}`);
      console.log(`- Sample Invoices: ${invoices.length}`);
      
    } catch (error) {
      console.error('❌ Seed data generation failed:', error);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const generator = new QBOSeedDataGenerator();
  generator.generateAllSeedData()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default QBOSeedDataGenerator;