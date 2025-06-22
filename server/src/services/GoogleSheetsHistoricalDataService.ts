import { google } from 'googleapis';
import path from 'path';
import { createGoogleAuth, hasGoogleCredentials, getGoogleAuthConfig } from '../utils/googleAuth';

export interface SheetExtraction {
  clientName: string;
  headers: string[];
  dataRows: Array<{
    rowNumber: number;
    cells: string[];
    isEmpty: boolean;
  }>;
  metadata: {
    totalRows: number;
    dateColumnIndex?: number;
    hasTimeColumns: boolean;
    sheetId: string;
  };
}

export class GoogleSheetsHistoricalDataService {
  private auth: any = null;
  private sheets: any = null;
  private initialized: boolean = false;

  constructor() {
    // Don't call initializeAuth in constructor since it's async
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeAuth();
      this.initialized = true;
    }
  }

  private async initializeAuth() {
    try {
      // Check if Google Sheets ID is configured
      const historicalSheetId = process.env.GOOGLE_SHEETS_HISTORICAL_ID || process.env.GOOGLE_SHEETS_ID;
      
      if (!historicalSheetId) {
        throw new Error('Google Sheets ID not configured for historical data (GOOGLE_SHEETS_HISTORICAL_ID or GOOGLE_SHEETS_ID)');
      }

      // Check if any Google credentials are available
      if (!hasGoogleCredentials()) {
        const config = getGoogleAuthConfig();
        console.log('📝 Auth config:', config);
        throw new Error('Google Sheets credentials not configured for historical data. Please set either GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable.');
      }

      console.log('🔑 Loading Google Sheets credentials for historical data...');

      // Initialize Google Sheets API using shared auth utility
      this.auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Google Sheets API initialized for historical data');
    } catch (error) {
      console.error('❌ Google Sheets authentication failed:', error);
      throw error;
    }
  }

  /**
   * Get list of all client sheets (tabs) in the historical data spreadsheet
   */
  async getClientSheets(): Promise<string[]> {
    await this.ensureInitialized();
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_ID || process.env.GOOGLE_SHEETS_ID;
    
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title'
      });

      const sheetNames = response.data.sheets?.map((sheet: any) => sheet.properties.title) || [];
      
      // Filter out non-client sheets (like 'Overview', 'Settings', etc.)
      const clientSheets = sheetNames.filter((name: string) => {
        const lowerName = name.toLowerCase();
        return !['overview', 'settings', 'employees', 'clients', 'template'].includes(lowerName);
      });

      console.log(`📋 Found ${clientSheets.length} client sheets`);
      return clientSheets;
    } catch (error) {
      console.error('Error fetching sheet names:', error);
      throw new Error('Failed to get client sheets list');
    }
  }

  /**
   * Check if a cell value looks like a date
   */
  private looksLikeDate(value: string): boolean {
    if (!value || !value.trim()) return false;
    
    // Common date patterns
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}$/,          // M/D or MM/DD
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YY or MM/DD/YYYY
      /^\d{4}-\d{2}-\d{2}$/,         // YYYY-MM-DD
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i // Month names
    ];
    
    return datePatterns.some(pattern => pattern.test(value.trim()));
  }

  /**
   * Extract data from a specific client sheet
   */
  async extractClientData(clientName: string): Promise<SheetExtraction> {
    await this.ensureInitialized();
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_HISTORICAL_ID || process.env.GOOGLE_SHEETS_ID;
    
    try {
      console.log(`📖 Reading data for client: ${clientName}`);
      
      // Get all data from the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${clientName}'!A:Z`, // Get all columns up to Z
        valueRenderOption: 'FORMATTED_VALUE' // Get formatted values as displayed
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        throw new Error(`No data found in sheet: ${clientName}`);
      }

      // Extract headers (usually first row with data)
      let headerRowIndex = 0;
      let headers: string[] = [];
      
      // Find the header row (first row with multiple non-empty cells)
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] || [];
        const nonEmptyCells = row.filter((cell: any) => cell && cell.toString().trim());
        
        if (nonEmptyCells.length >= 2) {
          headerRowIndex = i;
          headers = row.map((cell: any) => (cell || '').toString().trim());
          break;
        }
      }

      // Process data rows
      const dataRows = [];
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const cells = row.map((cell: any) => (cell || '').toString());
        
        // Check if row is empty (all cells are empty or whitespace)
        const isEmpty = cells.every((cell: string) => !cell.trim());
        
        dataRows.push({
          rowNumber: i + 1, // 1-indexed for Google Sheets
          cells,
          isEmpty
        });
      }

      // Auto-detect column indices
      const dateColumnIndex = this.detectDateColumn(headers);
      const hasTimeColumns = headers.some(h => 
        h.toLowerCase().includes('start') || h.toLowerCase().includes('end')
      );

      const extraction: SheetExtraction = {
        clientName,
        headers,
        dataRows,
        metadata: {
          totalRows: dataRows.length,
          dateColumnIndex,
          hasTimeColumns,
          sheetId: spreadsheetId || ''
        }
      };

      console.log(`✅ Extracted ${dataRows.length} rows for ${clientName}`);
      return extraction;

    } catch (error) {
      console.error(`Error extracting data for ${clientName}:`, error);
      throw new Error(`Failed to extract data for client ${clientName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect which column likely contains dates
   */
  private detectDateColumn(headers: string[]): number | undefined {
    const dateKeywords = ['date', 'day', 'when'];
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (dateKeywords.some(keyword => header.includes(keyword))) {
        return i;
      }
    }
    
    // Default to first column if no date column found
    return 0;
  }

  /**
   * Get a preview of data from a client sheet (first 10 rows)
   */
  async previewClientData(clientName: string): Promise<{
    headers: string[];
    sampleRows: string[][];
    totalRows: number;
  }> {
    const extraction = await this.extractClientData(clientName);
    
    const sampleRows = extraction.dataRows
      .slice(0, 10)
      .filter(row => !row.isEmpty)
      .map(row => row.cells);
    
    return {
      headers: extraction.headers,
      sampleRows,
      totalRows: extraction.dataRows.filter(row => !row.isEmpty).length
    };
  }
} 