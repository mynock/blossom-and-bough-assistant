import { google } from 'googleapis';
import { Helper, Client, Project } from '../types';

export interface BusinessSettings {
  maxTravelBetweenJobsMinutes: number;
  maxTotalTravelPerDayMinutes: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  bufferBetweenJobsMinutes: number;
  bufferStartOfDayMinutes: number;
  bufferEndOfDayMinutes: number;
}

export class GoogleSheetsService {
  private auth: any = null;
  private sheets: any = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Initialize Google Sheets API
      this.auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      console.error('Failed to initialize Google Sheets auth:', error);
    }
  }

  async getBusinessSettings(): Promise<BusinessSettings> {
    if (!this.sheets) {
      return this.getMockBusinessSettings();
    }

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const range = 'Settings!A1:C10'; // Adjust range as needed

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      return this.parseSettingsRows(rows);
    } catch (error) {
      console.error('Error fetching settings from Google Sheets:', error);
      return this.getMockBusinessSettings();
    }
  }

  async getHelpers(): Promise<Helper[]> {
    if (!this.sheets) {
      return this.getMockHelpers();
    }

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const range = 'Helpers!A2:K100'; // Adjust range as needed

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      return rows.map((row: any[]) => this.parseHelperRow(row)).filter(Boolean);
    } catch (error) {
      console.error('Error fetching helpers from Google Sheets:', error);
      return this.getMockHelpers();
    }
  }

  async getClients(): Promise<Client[]> {
    if (!this.sheets) {
      return this.getMockClients();
    }

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const range = 'Clients!A2:S100'; // Adjust range as needed

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      return rows.map((row: any[]) => this.parseClientRow(row)).filter(Boolean);
    } catch (error) {
      console.error('Error fetching clients from Google Sheets:', error);
      return this.getMockClients();
    }
  }

  async getProjects(): Promise<Project[]> {
    if (!this.sheets) {
      return this.getMockProjects();
    }

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      
      // First, check if the Projects sheet exists
      const spreadsheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });
      
      const sheetNames = spreadsheetInfo.data.sheets?.map((sheet: any) => sheet.properties.title) || [];
      
      if (!sheetNames.includes('Projects')) {
        console.log('Projects sheet not found. Available sheets:', sheetNames);
        return []; // Return empty array if Projects sheet doesn't exist
      }

      const range = 'Projects!A2:Z100'; // Adjust range as needed

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      return rows.map((row: any[]) => this.parseProjectRow(row)).filter(Boolean);
    } catch (error) {
      console.error('Error fetching projects from Google Sheets:', error);
      return []; // Return empty array instead of mock projects for production use
    }
  }

  private parseHelperRow(row: any[]): Helper | null {
    if (!row[0]) return null; // Skip empty rows

    // Based on your Helpers sheet structure:
    // Helper_ID | Name | Regular_Workdays | Home_Address | Min_Hours_Per_Day | Max_Hours_Per_Day | Capability_Level | Hourly_Rate | Notes | Active_Status
    
    const workdays = (row[2] || '').split(' ').filter((day: string) => day.trim()); // Split "Mon Wed Fri" format
    
    return {
      id: row[0] || '',
      name: row[1] || '',
      workdays: workdays,
      homeAddress: row[3] || '',
      minHours: parseInt(row[4]) || 7,
      maxHours: parseInt(row[5]) || 8,
      capabilityTier: this.mapCapabilityLevel(row[6]) || 'Beginner',
      skills: this.inferSkillsFromCapability(row[6], row[8]), // Infer from capability and notes
      hourlyRate: parseFloat(row[7]) || 0,
      status: (row[9] === 'Active' ? 'active' : 'inactive') as 'active' | 'inactive',
    };
  }

  private parseClientRow(row: any[]): Client | null {
    if (!row[0]) return null; // Skip empty rows

    // Based on your Clients sheet structure:
    // Client_ID | Name | Address | Geo Zone | Is_Recurring_Maintenance | Maintenance_Interval_Weeks | Maintenance_Hours_Per_Visit | 
    // Maintenance_Rate | Last_Maintenance | Next_Maintenance | Priority_Level | Schedule_Flexibility | Preferred_Days | 
    // Preferred_Time | Special_Notes | Active_Status

    const preferredDays = (row[12] || '').split(' ').filter((day: string) => day.trim()); // Split "Mon Tue Wed" format
    
    return {
      id: row[0] || '',
      name: row[1] || '',
      address: row[2] || '',
      zone: row[3] || this.inferZoneFromAddress(row[2]), // Use Geo Zone column, fallback to address inference
      email: undefined, // Not in your sheet structure
      phone: undefined, // Not in your sheet structure
      maintenanceSchedule: {
        isMaintenance: row[4] === 'TRUE',
        intervalWeeks: parseInt(row[5]) || undefined,
        hoursPerVisit: parseFloat(row[6]) || undefined,
        lastVisit: row[8] || undefined,
        nextTarget: row[9] || undefined,
        rate: parseFloat(row[7]) || undefined,
      },
      preferences: {
        preferredDays: preferredDays,
        preferredTime: this.mapPreferredTime(row[13]) || 'flexible',
        flexibility: this.mapFlexibility(row[11]) || 'Flexible',
        specialRequirements: row[14] || undefined,
      },
      priority: this.mapPriority(row[10]) || 'Medium',
      status: (row[15] === 'Active' ? 'active' : 'inactive') as 'active' | 'inactive' | 'seasonal',
      notes: row[14] || undefined,
    };
  }

  private parseProjectRow(row: any[]): Project | null {
    // If you don't have a Projects sheet yet, return empty for now
    // You can add this later when you create the Projects tab
    return null;
  }

  // Helper methods to map your data format to the application format
  private mapCapabilityLevel(level: string): 'Beginner' | 'Intermediate' | 'Advanced' {
    const numLevel = parseInt(level);
    if (numLevel <= 2) return 'Beginner';
    if (numLevel <= 4) return 'Intermediate';
    return 'Advanced';
  }

  private inferSkillsFromCapability(capability: string, notes: string): string[] {
    const skills: string[] = [];
    const capNum = parseInt(capability);
    const notesLower = (notes || '').toLowerCase();
    
    // Basic skills for everyone
    skills.push('basic_maintenance');
    
    // Add skills based on capability level
    if (capNum >= 3) {
      skills.push('pruning', 'planting');
    }
    if (capNum >= 4) {
      skills.push('irrigation', 'design_consultation');
    }
    if (capNum >= 5) {
      skills.push('project_management', 'client_consultation');
    }
    
    // Add skills based on notes
    if (notesLower.includes('install')) skills.push('installs');
    if (notesLower.includes('difficult')) skills.push('problem_solving');
    if (notesLower.includes('experience')) skills.push('experienced');
    
    return skills;
  }

  private inferZoneFromAddress(address: string): string {
    const addressLower = address.toLowerCase();
    
    // Portland area zone mapping based on common patterns
    if (addressLower.includes('sw ') || addressLower.includes('capitol hwy')) return 'Southwest';
    if (addressLower.includes('nw ') || addressLower.includes('nw ')) return 'Northwest';
    if (addressLower.includes('ne ') || addressLower.includes('northeast')) return 'Northeast';
    if (addressLower.includes('se ') || addressLower.includes('southeast')) return 'Southeast';
    if (addressLower.includes('lake oswego') || addressLower.includes('lake bay')) return 'Lake Oswego';
    if (addressLower.includes('downtown') || addressLower.includes('pearl')) return 'Downtown';
    
    return 'Portland Metro'; // Default zone
  }

  private mapPreferredTime(time: string): 'morning' | 'afternoon' | 'evening' | 'flexible' {
    const timeLower = (time || '').toLowerCase();
    if (timeLower.includes('morning')) return 'morning';
    if (timeLower.includes('afternoon')) return 'afternoon';
    if (timeLower.includes('evening')) return 'evening';
    return 'flexible';
  }

  private mapFlexibility(flexibility: string): 'Fixed' | 'Preferred' | 'Flexible' {
    const flexLower = (flexibility || '').toLowerCase();
    if (flexLower.includes('fixed')) return 'Fixed';
    if (flexLower.includes('preferred')) return 'Preferred';
    return 'Flexible';
  }

  private mapPriority(priority: string): 'High' | 'Medium' | 'Low' {
    const priorityLower = (priority || '').toLowerCase();
    if (priorityLower.includes('high')) return 'High';
    if (priorityLower.includes('low')) return 'Low';
    return 'Medium';
  }

  private parseSettingsRows(rows: any[]): BusinessSettings {
    const settings: any = {};
    
    // Parse settings from Setting | Value | Notes format
    for (const row of rows) {
      if (row.length >= 2) {
        const settingName = row[0];
        const value = row[1];
        
        switch (settingName) {
          case 'Max_Travel_Between_Jobs_Minutes':
            settings.maxTravelBetweenJobsMinutes = parseInt(value) || 30;
            break;
          case 'Max_Total_Travel_Per_Day_Minutes':
            settings.maxTotalTravelPerDayMinutes = parseInt(value) || 90;
            break;
          case 'Business_Hours_Start':
            settings.businessHoursStart = value || '8:00';
            break;
          case 'Business_Hours_End':
            settings.businessHoursEnd = value || '18:00';
            break;
          case 'Buffer_Between_Jobs_Minutes':
            settings.bufferBetweenJobsMinutes = parseInt(value) || 15;
            break;
          case 'Buffer_Start_Of_Day_Minutes':
            settings.bufferStartOfDayMinutes = parseInt(value) || 15;
            break;
          case 'Buffer_End_Of_Day_Minutes':
            settings.bufferEndOfDayMinutes = parseInt(value) || 15;
            break;
        }
      }
    }

    return {
      maxTravelBetweenJobsMinutes: settings.maxTravelBetweenJobsMinutes || 30,
      maxTotalTravelPerDayMinutes: settings.maxTotalTravelPerDayMinutes || 90,
      businessHoursStart: settings.businessHoursStart || '8:00',
      businessHoursEnd: settings.businessHoursEnd || '18:00',
      bufferBetweenJobsMinutes: settings.bufferBetweenJobsMinutes || 15,
      bufferStartOfDayMinutes: settings.bufferStartOfDayMinutes || 15,
      bufferEndOfDayMinutes: settings.bufferEndOfDayMinutes || 15,
    };
  }

  private getMockBusinessSettings(): BusinessSettings {
    return {
      maxTravelBetweenJobsMinutes: 30,
      maxTotalTravelPerDayMinutes: 90,
      businessHoursStart: '8:00',
      businessHoursEnd: '18:00',
      bufferBetweenJobsMinutes: 15,
      bufferStartOfDayMinutes: 15,
      bufferEndOfDayMinutes: 15,
    };
  }

  private getMockHelpers(): Helper[] {
    return [
      {
        id: 'H001',
        name: 'Sarah Martinez',
        workdays: ['Monday', 'Wednesday', 'Friday'],
        homeAddress: '456 Oak Ave Portland, OR',
        minHours: 7,
        maxHours: 8,
        capabilityTier: 'Advanced',
        skills: ['pruning', 'maintenance', 'irrigation', 'difficult_properties'],
        hourlyRate: 23,
        status: 'active',
      },
      {
        id: 'H002',
        name: 'Mike Thompson',
        workdays: ['Tuesday', 'Thursday'],
        homeAddress: '789 Pine St Portland, OR',
        minHours: 7,
        maxHours: 8,
        capabilityTier: 'Intermediate',
        skills: ['installs', 'basic_maintenance', 'strong_worker'],
        hourlyRate: 22,
        status: 'active',
      },
      {
        id: 'H003',
        name: 'Jessica Chen',
        workdays: ['Wednesday', 'Friday'],
        homeAddress: '321 Elm Dr Portland, OR',
        minHours: 6,
        maxHours: 8,
        capabilityTier: 'Advanced',
        skills: ['experienced', 'project_management', 'client_consultation'],
        hourlyRate: 25,
        status: 'active',
      },
      {
        id: 'H004',
        name: 'Carlos Rodriguez',
        workdays: ['Monday', 'Tuesday'],
        homeAddress: '654 Maple Rd Portland, OR',
        minHours: 7,
        maxHours: 8,
        capabilityTier: 'Beginner',
        skills: ['basic_maintenance', 'learning'],
        hourlyRate: 22,
        status: 'active',
      },
    ];
  }

  private getMockClients(): Client[] {
    return [
      {
        id: 'C001',
        name: 'Thomas',
        address: '1764 SW 123rd Pl, 97229',
        zone: 'Southwest',
        maintenanceSchedule: {
          isMaintenance: true,
          intervalWeeks: 4,
          hoursPerVisit: 4,
          lastVisit: '2024-01-01',
          nextTarget: '2024-01-29',
        },
        preferences: {
          preferredDays: ['Tuesday', 'Wednesday', 'Thursday'],
          preferredTime: 'morning',
          flexibility: 'Flexible',
          specialRequirements: 'Gate code: 1234',
        },
        priority: 'High',
        status: 'active',
      },
      // Add more mock clients based on your sheet...
    ];
  }

  private getMockProjects(): Project[] {
    return []; // Empty for now since no Projects sheet structure shown
  }
} 