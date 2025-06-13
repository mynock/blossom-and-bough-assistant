import { google } from 'googleapis';
import { Helper, Client, Project } from '../types';

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

  async getHelpers(): Promise<Helper[]> {
    if (!this.sheets) {
      return this.getMockHelpers();
    }

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const range = 'Helpers!A2:L100'; // Adjust range as needed

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
      const range = 'Clients!A2:Z100'; // Adjust range as needed

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
      const range = 'Projects!A2:Z100'; // Adjust range as needed

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      return rows.map((row: any[]) => this.parseProjectRow(row)).filter(Boolean);
    } catch (error) {
      console.error('Error fetching projects from Google Sheets:', error);
      return this.getMockProjects();
    }
  }

  private parseHelperRow(row: any[]): Helper | null {
    if (!row[0]) return null; // Skip empty rows

    return {
      id: row[0] || '',
      name: row[1] || '',
      workdays: (row[2] || '').split(',').map((day: string) => day.trim()),
      homeAddress: row[3] || '',
      minHours: parseInt(row[4]) || 7,
      maxHours: parseInt(row[5]) || 8,
      capabilityTier: row[6] as 'Beginner' | 'Intermediate' | 'Advanced' || 'Beginner',
      skills: (row[7] || '').split(',').map((skill: string) => skill.trim()),
      hourlyRate: parseFloat(row[8]) || 0,
      status: row[9] as 'active' | 'inactive' || 'active',
    };
  }

  private parseClientRow(row: any[]): Client | null {
    if (!row[0]) return null; // Skip empty rows

    return {
      id: row[0] || '',
      name: row[1] || '',
      address: row[2] || '',
      zone: row[3] || '',
      email: row[4] || undefined,
      phone: row[5] || undefined,
      maintenanceSchedule: {
        isMaintenance: row[6] === 'TRUE' || row[6] === 'true',
        intervalWeeks: parseInt(row[7]) || undefined,
        hoursPerVisit: parseInt(row[8]) || undefined,
        lastVisit: row[9] || undefined,
        nextTarget: row[10] || undefined,
        rate: parseFloat(row[11]) || undefined,
      },
      preferences: {
        preferredDays: (row[12] || '').split(',').map((day: string) => day.trim()),
        preferredTime: row[13] as 'morning' | 'afternoon' | 'evening' | 'flexible' || 'flexible',
        flexibility: row[14] as 'Fixed' | 'Preferred' | 'Flexible' || 'Flexible',
        specialRequirements: row[15] || undefined,
      },
      priority: row[16] as 'High' | 'Medium' | 'Low' || 'Medium',
      status: row[17] as 'active' | 'inactive' | 'seasonal' || 'active',
      notes: row[18] || undefined,
    };
  }

  private parseProjectRow(row: any[]): Project | null {
    if (!row[0]) return null; // Skip empty rows

    return {
      id: row[0] || '',
      clientId: row[1] || '',
      name: row[2] || '',
      description: row[3] || '',
      type: row[4] as 'Design' | 'Install' | 'Pruning' | 'Maintenance' | 'Repair' | 'Other' || 'Other',
      status: row[5] as 'Quoted' | 'Approved' | 'In Progress' | 'Completed' | 'On Hold' || 'Quoted',
      schedulingDetails: {
        estimatedHours: parseFloat(row[6]) || 0,
        officeHours: parseFloat(row[7]) || undefined,
        preferredCompletionDate: row[8] || undefined,
        urgency: row[9] as 'Low' | 'Medium' | 'High' | 'Critical' || 'Medium',
        weatherSensitive: row[10] === 'TRUE' || row[10] === 'true',
      },
      requirements: {
        requiredCapabilityLevel: row[11] as 'Beginner' | 'Intermediate' | 'Advanced' || 'Beginner',
        requiredSkills: (row[12] || '').split(',').map((skill: string) => skill.trim()),
        materialsNeeded: row[13] ? (row[13] as string).split(',').map((item: string) => item.trim()) : undefined,
        equipmentRequired: row[14] ? (row[14] as string).split(',').map((item: string) => item.trim()) : undefined,
      },
      financial: {
        quotedAmount: parseFloat(row[15]) || undefined,
        approvedBudget: parseFloat(row[16]) || undefined,
        actualHours: parseFloat(row[17]) || undefined,
      },
      notes: row[18] || undefined,
    };
  }

  private getMockHelpers(): Helper[] {
    return [
      {
        id: 'helper_001',
        name: 'Sarah',
        workdays: ['Monday', 'Wednesday', 'Friday'],
        homeAddress: '789 Elm St, Portland, OR 97210',
        minHours: 7,
        maxHours: 8,
        capabilityTier: 'Advanced',
        skills: ['pruning', 'maintenance', 'irrigation'],
        hourlyRate: 25,
        status: 'active',
      },
      {
        id: 'helper_002',
        name: 'Mike',
        workdays: ['Tuesday', 'Thursday'],
        homeAddress: '321 Maple Dr, Portland, OR 97211',
        minHours: 7,
        maxHours: 8,
        capabilityTier: 'Intermediate',
        skills: ['installs', 'basic_maintenance'],
        hourlyRate: 22,
        status: 'active',
      },
    ];
  }

  private getMockClients(): Client[] {
    return [
      {
        id: 'client_001',
        name: 'Smith Property',
        address: '123 Oak St, Portland, OR 97201',
        zone: 'Downtown',
        maintenanceSchedule: {
          isMaintenance: true,
          intervalWeeks: 2,
          hoursPerVisit: 4,
          lastVisit: '2024-01-01',
          nextTarget: '2024-01-15',
        },
        preferences: {
          preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
          preferredTime: 'morning',
          flexibility: 'Preferred',
        },
        priority: 'High',
        status: 'active',
      },
      {
        id: 'client_002',
        name: 'Johnson Landscape',
        address: '456 Pine Ave, Portland, OR 97202',
        zone: 'Southeast',
        maintenanceSchedule: {
          isMaintenance: false,
        },
        preferences: {
          preferredDays: ['Thursday', 'Friday'],
          preferredTime: 'afternoon',
          flexibility: 'Flexible',
        },
        priority: 'Medium',
        status: 'active',
      },
    ];
  }

  private getMockProjects(): Project[] {
    return [
      {
        id: 'project_001',
        clientId: 'client_002',
        name: 'Garden Installation',
        description: 'Install new perennial garden beds',
        type: 'Install',
        status: 'Approved',
        schedulingDetails: {
          estimatedHours: 12,
          officeHours: 2,
          preferredCompletionDate: '2024-01-20',
          urgency: 'Medium',
          weatherSensitive: true,
        },
        requirements: {
          requiredCapabilityLevel: 'Intermediate',
          requiredSkills: ['installs', 'planting'],
          materialsNeeded: ['plants', 'mulch', 'soil'],
        },
        financial: {
          quotedAmount: 1500,
          approvedBudget: 1500,
        },
        notes: 'Client prefers native plants',
      },
    ];
  }
} 