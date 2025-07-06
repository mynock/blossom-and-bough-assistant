import { eq } from 'drizzle-orm';
import { db } from '../db';
import { settings, NewSetting, Setting } from '../db/schema';

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
} 