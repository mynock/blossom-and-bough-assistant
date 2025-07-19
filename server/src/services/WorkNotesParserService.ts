import { AnthropicService, ParsedWorkActivity, WorkNotesParseResult } from './AnthropicService';
import { ClientService } from './ClientService';
import { EmployeeService } from './EmployeeService';
import { WorkActivityService, CreateWorkActivityData } from './WorkActivityService';
import { NewWorkActivity } from '../db';

export interface ClientMatch {
  originalName: string;
  matchedClient: { id: number; name: string } | null;
  confidence: number;
  suggestions: Array<{ id: number; name: string; score: number }>;
}

export interface EmployeeMatch {
  originalName: string;
  matchedEmployee: { id: number; name: string } | null;
  confidence: number;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidatedWorkActivity extends ParsedWorkActivity {
  clientId?: number;
  employeeIds: number[];
  validationIssues: ValidationIssue[];
  canImport: boolean;
  existingActivities?: Array<{
    id: number;
    totalHours: number;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
    workType: string;
    status: string;
  }>;
  isDuplicate?: boolean;
}

export interface ImportPreview {
  activities: ValidatedWorkActivity[];
  clientMatches: ClientMatch[];
  employeeMatches: EmployeeMatch[];
  summary: {
    totalActivities: number;
    validActivities: number;
    issuesCount: number;
    estimatedImportTime: number;
  };
}

export class WorkNotesParserService {
  private anthropicService: AnthropicService;
  private clientService: ClientService;
  private employeeService: EmployeeService;
  private workActivityService: WorkActivityService;

  // Employee name mapping for common abbreviations
  private readonly EMPLOYEE_NAME_MAP: Record<string, string> = {
    'V': 'Virginia',
    'Virginia': 'Virginia',
    'R': 'Rebecca', 
    'Rebecca': 'Rebecca',
    'A': 'Anne',
    'Anne': 'Anne',
    'M': 'Megan',
    'Megan': 'Megan',
    'solo': 'Andrea', // Assume solo work is done by Andrea
    'me': 'Andrea',
    'Andrea': 'Andrea'
  };

  constructor(anthropicService: AnthropicService) {
    this.anthropicService = anthropicService;
    this.clientService = new ClientService();
    this.employeeService = new EmployeeService();
    this.workActivityService = new WorkActivityService();
  }

  /**
   * Parse work notes text and return preview with validation
   */
  async parseAndPreview(workNotesText: string): Promise<ImportPreview> {
    try {
      // Step 1: Parse with AI
      console.log('🤖 Parsing work notes with AI...');
      const aiResult = await this.anthropicService.parseWorkNotes(workNotesText);
      
      return await this.validateAndPreview(aiResult);
    } catch (error) {
      console.error('Error parsing work notes:', error);
      throw new Error(`Failed to parse work notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate already parsed work notes and return preview
   */
  async validateAndPreview(aiResult: WorkNotesParseResult): Promise<ImportPreview> {
    try {
      // Step 1: Get all clients and employees for matching
      const [allClients, allEmployees] = await Promise.all([
        this.clientService.getAllClients(),
        this.employeeService.getAllEmployees()
      ]);

      // Step 2: Match clients
      console.log('🔍 Matching clients...');
      const clientMatches = await this.matchClients(
        [...new Set(aiResult.activities.map(a => a.clientName))],
        allClients
      );

      // Step 3: Match employees
      console.log('👥 Matching employees...');
      const employeeMatches = await this.matchEmployees(
        [...new Set(aiResult.activities.flatMap(a => a.employees))],
        allEmployees
      );

      // Step 4: Validate activities
      console.log('✅ Validating activities...');
      const validatedActivities = await this.validateActivities(
        aiResult.activities,
        clientMatches,
        employeeMatches
      );

      // Step 5: Generate summary
      const summary = {
        totalActivities: validatedActivities.length,
        validActivities: validatedActivities.filter(a => a.canImport).length,
        issuesCount: validatedActivities.reduce((sum, a) => sum + a.validationIssues.length, 0),
        estimatedImportTime: validatedActivities.length * 2 // 2 seconds per activity estimate
      };

      return {
        activities: validatedActivities,
        clientMatches,
        employeeMatches,
        summary
      };

    } catch (error) {
      console.error('Error validating work notes:', error);
      throw new Error(`Failed to validate work notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import validated activities to the database
   */
  async importActivities(validatedActivities: ValidatedWorkActivity[]): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const activity of validatedActivities) {
      if (!activity.canImport) {
        results.failed++;
        results.errors.push(`Skipped ${activity.clientName} on ${activity.date}: validation issues`);
        continue;
      }

      // Skip if duplicate (unless explicitly allowed)
      if (activity.isDuplicate && activity.existingActivities && activity.existingActivities.length > 0) {
        results.failed++;
        results.errors.push(`Skipped ${activity.clientName} on ${activity.date}: duplicate activity exists (ID: ${activity.existingActivities[0].id})`);
        continue;
      }

      try {
        // Convert to work activity format
        const workActivity: NewWorkActivity = {
          workType: activity.workType,
          date: activity.date,
          status: 'completed', // Default to completed for imported activities
          startTime: activity.startTime,
          endTime: activity.endTime,
          billableHours: this.calculateBillableHours(activity.totalHours, activity.lunchTime, 0, 0, activity.hoursAdjustments),
          totalHours: activity.totalHours,
          hourlyRate: null, // Will be set based on client rate
          clientId: activity.clientId || null,
          projectId: null, // TODO: Add project matching
          travelTimeMinutes: activity.driveTime || 0,
          breakTimeMinutes: activity.lunchTime || 0,
          nonBillableTimeMinutes: 0, // Default to 0 for work notes import
          notes: activity.notes,
          tasks: activity.tasks.join('\n'),
          lastUpdatedBy: 'web_app' as const // Explicitly mark as web app import
        };

        // Prepare employee assignments - each employee gets the work duration
        // Since totalHours is already duration × employees, we need to get back to the base duration
        const workDuration = activity.employeeIds.length > 0 ? activity.totalHours / activity.employeeIds.length : activity.totalHours;
        const employees = activity.employeeIds.map(employeeId => ({
          employeeId,
          hours: workDuration // Each employee gets the work duration
        }));

        // Prepare charges
        const charges = activity.charges?.map(charge => ({
          chargeType: charge.type,
          description: charge.description,
          quantity: 1,
          unitRate: charge.cost || 0,
          totalCost: charge.cost || 0,
          billable: true
        })) || [];

        // Create work activity
        const createData: CreateWorkActivityData = {
          workActivity,
          employees,
          charges
        };

        await this.workActivityService.createWorkActivity(createData);
        results.imported++;

      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to import ${activity.clientName} on ${activity.date}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Match client names to existing clients using fuzzy matching
   */
  private async matchClients(clientNames: string[], allClients: any[]): Promise<ClientMatch[]> {
    return clientNames.map(originalName => {
      const suggestions = allClients
        .map(client => ({
          id: client.id,
          name: client.name,
          score: this.calculateStringSimilarity(originalName.toLowerCase(), client.name.toLowerCase())
        }))
        .filter(s => s.score > 0.3) // Only include reasonable matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5 suggestions

      const bestMatch = suggestions[0];
      const confidence = bestMatch?.score || 0;

      return {
        originalName,
        matchedClient: confidence > 0.8 ? { id: bestMatch.id, name: bestMatch.name } : null,
        confidence,
        suggestions
      };
    });
  }

  /**
   * Match employee names to existing employees
   */
  private async matchEmployees(employeeNames: string[], allEmployees: any[]): Promise<EmployeeMatch[]> {
    return employeeNames.map(originalName => {
      // First try direct mapping from abbreviations
      const mappedName = this.EMPLOYEE_NAME_MAP[originalName];
      if (mappedName) {
        const exactMatch = allEmployees.find(emp => 
          emp.name.toLowerCase().includes(mappedName.toLowerCase())
        );
        
        if (exactMatch) {
          return {
            originalName,
            matchedEmployee: { id: exactMatch.id, name: exactMatch.name },
            confidence: 1.0
          };
        }
      }

      // Fallback to fuzzy matching
      const bestMatch = allEmployees
        .map(emp => ({
          id: emp.id,
          name: emp.name,
          score: this.calculateStringSimilarity(originalName.toLowerCase(), emp.name.toLowerCase())
        }))
        .sort((a, b) => b.score - a.score)[0];

      return {
        originalName,
        matchedEmployee: bestMatch?.score > 0.7 ? { id: bestMatch.id, name: bestMatch.name } : null,
        confidence: bestMatch?.score || 0
      };
    });
  }

  /**
   * Validate parsed activities and add validation issues
   */
  private async validateActivities(
    activities: ParsedWorkActivity[],
    clientMatches: ClientMatch[],
    employeeMatches: EmployeeMatch[]
  ): Promise<ValidatedWorkActivity[]> {
    const validatedActivities: ValidatedWorkActivity[] = [];

    for (const activity of activities) {
      const validationIssues: ValidationIssue[] = [];
      
      // Calculate total hours if missing or zero and we have start/end times
      const calculatedTotalHours = this.calculateTotalHours(activity);
      if (calculatedTotalHours !== null && (!activity.totalHours || activity.totalHours === 0)) {
        activity.totalHours = calculatedTotalHours;
        console.log(`📊 Calculated total hours for ${activity.clientName} on ${activity.date}: ${calculatedTotalHours}h from ${activity.startTime}-${activity.endTime} with ${activity.employees.length} employee(s)`);
      }
      
      // Find matches for this activity
      const clientMatch = clientMatches.find(c => c.originalName === activity.clientName);
      const activityEmployeeMatches = activity.employees.map(empName => 
        employeeMatches.find(e => e.originalName === empName)
      );

      // Validate client
      if (!clientMatch?.matchedClient) {
        validationIssues.push({
          type: 'error',
          field: 'client',
          message: `Client "${activity.clientName}" could not be matched`,
          suggestion: clientMatch?.suggestions[0]?.name
        });
      }

      // Validate employees
      const matchedEmployeeIds: number[] = [];
      activity.employees.forEach((empName, index) => {
        const match = activityEmployeeMatches[index];
        if (!match?.matchedEmployee) {
          validationIssues.push({
            type: 'error',
            field: 'employees',
            message: `Employee "${empName}" could not be matched`,
            suggestion: 'Check employee name or add to system'
          });
        } else {
          matchedEmployeeIds.push(match.matchedEmployee.id);
        }
      });

      // Validate date
      if (!this.isValidDate(activity.date)) {
        validationIssues.push({
          type: 'error',
          field: 'date',
          message: `Invalid date format: ${activity.date}`
        });
      }

      // Validate hours
      if (activity.totalHours <= 0 || activity.totalHours > 24) {
        validationIssues.push({
          type: 'warning',
          field: 'hours',
          message: `Unusual hour count: ${activity.totalHours}`
        });
      }

      // Validate confidence
      if (activity.confidence < 0.7) {
        validationIssues.push({
          type: 'warning',
          field: 'parsing',
          message: `Low parsing confidence: ${Math.round(activity.confidence * 100)}%`
        });
      }

      // Check for existing activities (duplicate detection)
      let existingActivities: any[] = [];
      let isDuplicate = false;
      
      if (clientMatch?.matchedClient) {
        try {
          existingActivities = await this.workActivityService.findExistingWorkActivities(
            clientMatch.matchedClient.id,
            activity.date
          );
          
          if (existingActivities.length > 0) {
            isDuplicate = true;
            validationIssues.push({
              type: 'warning',
              field: 'duplicate',
              message: `Found ${existingActivities.length} existing work activity(s) for ${activity.clientName} on ${activity.date}`,
              suggestion: 'Review existing activities before importing'
            });
          }
        } catch (error) {
          console.error('Error checking for existing activities:', error);
        }
      }

      const canImport = validationIssues.filter(i => i.type === 'error').length === 0;

      const validatedActivity: ValidatedWorkActivity = {
        ...activity,
        clientId: clientMatch?.matchedClient?.id,
        employeeIds: matchedEmployeeIds,
        validationIssues,
        canImport,
        existingActivities: existingActivities.map(existing => ({
          id: existing.id,
          totalHours: existing.totalHours,
          startTime: existing.startTime,
          endTime: existing.endTime,
          notes: existing.notes,
          workType: existing.workType,
          status: existing.status
        })),
        isDuplicate
      };

      validatedActivities.push(validatedActivity);
    }

    return validatedActivities;
  }

  /**
   * Calculate total hours from start time, end time, and number of employees
   * Returns null if calculation is not possible
   */
  private calculateTotalHours(activity: ParsedWorkActivity): number | null {
    if (!activity.startTime || !activity.endTime || activity.employees.length === 0) {
      return null;
    }

    try {
      // Parse times - they should be in HH:MM format
      const startParts = activity.startTime.split(':');
      const endParts = activity.endTime.split(':');
      
      if (startParts.length !== 2 || endParts.length !== 2) {
        return null;
      }

      const startHour = parseInt(startParts[0], 10);
      const startMinute = parseInt(startParts[1], 10);
      const endHour = parseInt(endParts[0], 10);
      const endMinute = parseInt(endParts[1], 10);

      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
        return null;
      }

      // Convert to minutes
      const startMinutes = startHour * 60 + startMinute;
      let endMinutes = endHour * 60 + endMinute;

      // Handle overnight work (end time is next day)
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60; // Add 24 hours
      }

      const durationMinutes = endMinutes - startMinutes;
      const durationHours = durationMinutes / 60;

      // Multiply by number of employees to get total person-hours
      const totalHours = durationHours * activity.employees.length;

      return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('Error calculating total hours:', error);
      return null;
    }
  }

  /**
   * Calculate billable hours from total hours minus non-billable time
   * Raw travel time is NOT subtracted - only adjustedTravelTimeMinutes affects billable hours
   * Hours adjustments are applied to total hours first, then billable hours calculated
   * Formula: adjustedTotalHours = totalHours + hoursAdjustments
   *          billableHours = adjustedTotalHours - (lunchTime/60) - (nonBillableTime/60) + (adjustedTravelTimeMinutes/60)
   */
  private calculateBillableHours(
    totalHours: number, 
    lunchTime?: number, 
    nonBillableTime?: number,
    adjustedTravelTimeMinutes: number = 0,
    hoursAdjustments?: Array<{ person: string; adjustment: string; notes: string; hours?: number }>
  ): number {
    const breakHours = (lunchTime || 0) / 60; // Convert minutes to hours
    const nonBillableHours = (nonBillableTime || 0) / 60; // Convert minutes to hours
    const adjustedTravelHours = adjustedTravelTimeMinutes / 60; // Convert minutes to hours
    
    // Calculate hours adjustments and apply to total hours first
    let totalAdjustmentHours = 0;
    if (hoursAdjustments && hoursAdjustments.length > 0) {
      totalAdjustmentHours = hoursAdjustments.reduce((sum, adj) => {
        if (adj.hours !== undefined) {
          return sum + adj.hours;
        }
        // Parse adjustment string if hours not already calculated
        const parsedHours = this.parseTimeToHours(adj.adjustment);
        return sum + parsedHours;
      }, 0);
      console.log(`⏰ Total hours adjustments: ${totalAdjustmentHours} hours from ${hoursAdjustments.length} adjustments`);
    }
    
    // Apply hours adjustments to total hours first, then calculate billable hours
    const adjustedTotalHours = totalHours + totalAdjustmentHours;
    console.log(`📊 Adjusted total hours: ${totalHours} + ${totalAdjustmentHours} = ${adjustedTotalHours}`);
    
    const billableHours = adjustedTotalHours - breakHours - nonBillableHours + adjustedTravelHours;
    
    // Ensure billable hours is not negative
    return Math.max(0, Math.round(billableHours * 100) / 100); // Round to 2 decimal places
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Validate date string
   */
  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Parse time string like "2:25" or "-0:30" to decimal hours
   */
  private parseTimeToHours(timeString: string): number {
    if (!timeString || typeof timeString !== 'string') {
      return 0;
    }

    // Remove any whitespace
    const cleanTime = timeString.trim();
    
    // Check for negative sign
    const isNegative = cleanTime.startsWith('-');
    const timeWithoutSign = isNegative ? cleanTime.substring(1) : cleanTime;
    
    // Parse H:MM or HH:MM format
    const timeParts = timeWithoutSign.split(':');
    if (timeParts.length !== 2) {
      console.warn(`Invalid time format for hours adjustment: ${timeString}`);
      return 0;
    }
    
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn(`Could not parse hours adjustment: ${timeString}`);
      return 0;
    }
    
    const decimalHours = hours + (minutes / 60);
    const result = isNegative ? -decimalHours : decimalHours;
    
    console.log(`⏰ Parsed "${timeString}" to ${result} hours`);
    return result;
  }
} 