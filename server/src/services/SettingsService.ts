import { eq, gt, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { settings, NewSetting, Setting, workActivities, WorkActivity } from '../db/schema';

export interface SettingDefinition {
  key: string;
  value: string;
  description?: string;
  category: string;
}

export class SettingsService {
  
  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(category: string): Promise<Setting[]> {
    return await db.select().from(settings).where(eq(settings.category, category));
  }

  /**
   * Get a specific setting by key
   */
  async getSetting(key: string): Promise<Setting | null> {
    const result = await db.select().from(settings).where(eq(settings.key, key));
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get a setting value with a default fallback
   */
  async getSettingValue(key: string, defaultValue?: string): Promise<string | null> {
    const setting = await this.getSetting(key);
    return setting ? setting.value : (defaultValue || null);
  }

  /**
   * Get a parsed JSON setting value
   */
  async getSettingValueParsed<T>(key: string, defaultValue?: T): Promise<T | null> {
    const setting = await this.getSetting(key);
    if (!setting) return defaultValue || null;
    
    try {
      return JSON.parse(setting.value);
    } catch (error) {
      console.error(`Failed to parse setting ${key}:`, error);
      return defaultValue || null;
    }
  }

  /**
   * Set a setting value
   */
  async setSetting(key: string, value: string, description?: string, category: string = 'general'): Promise<Setting> {
    const existingSetting = await this.getSetting(key);
    
    if (existingSetting) {
      // Update existing setting
      const updated = await db.update(settings)
        .set({ 
          value, 
          description: description || existingSetting.description,
          category,
          updatedAt: new Date()
        })
        .where(eq(settings.key, key))
        .returning();
      return updated[0];
    } else {
      // Create new setting
      const newSetting: NewSetting = {
        key,
        value,
        description,
        category
      };
      const created = await db.insert(settings).values(newSetting).returning();
      return created[0];
    }
  }

  /**
   * Set a setting value with JSON serialization
   */
  async setSettingValue<T>(key: string, value: T, description?: string, category: string = 'general'): Promise<Setting> {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    return await this.setSetting(key, serializedValue, description, category);
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<boolean> {
    const result = await db.delete(settings).where(eq(settings.key, key)).returning();
    return result.length > 0;
  }

  /**
   * Initialize default settings
   */
  async initializeDefaultSettings(): Promise<void> {
    const defaultSettings: SettingDefinition[] = [
      {
        key: 'billable_hours_rounding',
        value: 'false',
        description: 'Whether to round billable hours to the nearest half hour',
        category: 'billing'
      },
      {
        key: 'billable_hours_rounding_method',
        value: 'up',
        description: 'How to round billable hours: "up", "down", or "nearest"',
        category: 'billing'
      },
      {
        key: 'default_hourly_rate',
        value: '50',
        description: 'Default hourly rate for new work activities',
        category: 'billing'
      },
      {
        key: 'app_name',
        value: 'Garden Care CRM',
        description: 'Application name displayed in the UI',
        category: 'general'
      }
    ];

    for (const setting of defaultSettings) {
      const existing = await this.getSetting(setting.key);
      if (!existing) {
        await this.setSetting(setting.key, setting.value, setting.description, setting.category);
      }
    }
  }

  /**
   * Get billing-related settings
   */
  async getBillingSettings(): Promise<{
    roundBillableHours: boolean;
    roundingMethod: 'up' | 'down' | 'nearest';
    defaultHourlyRate: number;
  }> {
    const [roundingEnabled, roundingMethod, defaultRate] = await Promise.all([
      this.getSettingValue('billable_hours_rounding', 'false'),
      this.getSettingValue('billable_hours_rounding_method', 'up'),
      this.getSettingValue('default_hourly_rate', '50')
    ]);

    return {
      roundBillableHours: roundingEnabled === 'true',
      roundingMethod: roundingMethod as 'up' | 'down' | 'nearest',
      defaultHourlyRate: parseFloat(defaultRate || '50')
    };
  }

  /**
   * Utility function to round hours based on settings
   */
  async roundHours(hours: number): Promise<number> {
    const billingSettings = await this.getBillingSettings();
    
    if (!billingSettings.roundBillableHours) {
      return hours;
    }

    // Handle negative values by clamping to 0
    if (hours < 0) {
      return 0;
    }

    // Round to nearest half hour
    const halfHours = hours * 2;
    let roundedHalfHours: number;

    switch (billingSettings.roundingMethod) {
      case 'up':
        roundedHalfHours = Math.ceil(halfHours);
        break;
      case 'down':
        roundedHalfHours = Math.floor(halfHours);
        break;
      case 'nearest':
      default:
        roundedHalfHours = Math.round(halfHours);
        break;
    }

    return roundedHalfHours / 2;
  }

  /**
   * Apply billable hours rounding to existing work activities
   * This will update all work activities that have billable hours set
   */
  async applyRoundingToExistingWorkActivities(): Promise<{
    success: boolean;
    totalActivities: number;
    updatedActivities: number;
    skippedActivities: number;
    error?: string;
    updates: Array<{
      id: number;
      oldHours: number;
      newHours: number;
      workType: string;
      date: string;
    }>;
  }> {
    try {
      const billingSettings = await this.getBillingSettings();
      
      if (!billingSettings.roundBillableHours) {
        return {
          success: false,
          totalActivities: 0,
          updatedActivities: 0,
          skippedActivities: 0,
          error: 'Billable hours rounding is not enabled',
          updates: []
        };
      }

      // Get all work activities that have billable hours set
      const workActivitiesWithBillableHours = await db
        .select()
        .from(workActivities)
        .where(
          isNotNull(workActivities.billableHours)
        );

      const totalActivities = workActivitiesWithBillableHours.length;
      let updatedActivities = 0;
      let skippedActivities = 0;
      const updates: Array<{
        id: number;
        oldHours: number;
        newHours: number;
        workType: string;
        date: string;
      }> = [];

      // Process each work activity
      for (const activity of workActivitiesWithBillableHours) {
        if (activity.billableHours === null || activity.billableHours === undefined) {
          skippedActivities++;
          continue;
        }

        const originalHours = activity.billableHours;
        const roundedHours = await this.roundHours(originalHours);

        // Only update if the rounded hours are different
        if (Math.abs(roundedHours - originalHours) > 0.001) { // Use small epsilon for floating point comparison
          await db
            .update(workActivities)
            .set({ 
              billableHours: roundedHours,
              updatedAt: new Date()
            })
            .where(eq(workActivities.id, activity.id));

          updates.push({
            id: activity.id,
            oldHours: originalHours,
            newHours: roundedHours,
            workType: activity.workType,
            date: activity.date
          });

          updatedActivities++;
        } else {
          skippedActivities++;
        }
      }

      return {
        success: true,
        totalActivities,
        updatedActivities,
        skippedActivities,
        updates
      };
    } catch (error) {
      console.error('Error applying rounding to existing work activities:', error);
      return {
        success: false,
        totalActivities: 0,
        updatedActivities: 0,
        skippedActivities: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        updates: []
      };
    }
  }

  /**
   * Preview what would happen if we apply rounding to existing work activities
   * This doesn't actually update the database, just returns what would change
   */
  async previewRoundingForExistingWorkActivities(): Promise<{
    success: boolean;
    totalActivities: number;
    activitiesAffected: number;
    activitiesUnchanged: number;
    error?: string;
    previews: Array<{
      id: number;
      workType: string;
      date: string;
      currentHours: number;
      roundedHours: number;
      change: number;
    }>;
  }> {
    try {
      const billingSettings = await this.getBillingSettings();
      
      if (!billingSettings.roundBillableHours) {
        return {
          success: false,
          totalActivities: 0,
          activitiesAffected: 0,
          activitiesUnchanged: 0,
          error: 'Billable hours rounding is not enabled',
          previews: []
        };
      }

      // Get all work activities that have billable hours set
      const workActivitiesWithBillableHours = await db
        .select()
        .from(workActivities)
        .where(
          isNotNull(workActivities.billableHours)
        );

      const totalActivities = workActivitiesWithBillableHours.length;
      let activitiesAffected = 0;
      let activitiesUnchanged = 0;
      const previews: Array<{
        id: number;
        workType: string;
        date: string;
        currentHours: number;
        roundedHours: number;
        change: number;
      }> = [];

      // Process each work activity
      for (const activity of workActivitiesWithBillableHours) {
        if (activity.billableHours === null || activity.billableHours === undefined) {
          activitiesUnchanged++;
          continue;
        }

        const originalHours = activity.billableHours;
        const roundedHours = await this.roundHours(originalHours);
        const change = roundedHours - originalHours;

        if (Math.abs(change) > 0.001) { // Use small epsilon for floating point comparison
          previews.push({
            id: activity.id,
            workType: activity.workType,
            date: activity.date,
            currentHours: originalHours,
            roundedHours: roundedHours,
            change: change
          });
          activitiesAffected++;
        } else {
          activitiesUnchanged++;
        }
      }

      return {
        success: true,
        totalActivities,
        activitiesAffected,
        activitiesUnchanged,
        previews
      };
    } catch (error) {
      console.error('Error previewing rounding for existing work activities:', error);
      return {
        success: false,
        totalActivities: 0,
        activitiesAffected: 0,
        activitiesUnchanged: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        previews: []
      };
    }
  }
} 