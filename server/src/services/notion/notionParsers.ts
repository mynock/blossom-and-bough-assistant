// Pure domain parsers used by NotionSyncService.
// Extracted for testability — no behavior change.

import { debugLog } from '../../utils/logger';

export function parseHoursProperty(properties: any, propertyName: string): number | null {
  try {
    const property = properties[propertyName];
    if (!property) return null;

    if (property.type === 'number' && property.number) {
      return property.number;
    }

    if (property.type === 'rich_text' && property.rich_text?.[0]?.text?.content) {
      const text = property.rich_text[0].text.content.trim();
      const hours = parseFloat(text);
      return isNaN(hours) ? null : hours;
    }

    return null;
  } catch (error) {
    debugLog.warn(`Failed to parse hours property '${propertyName}':`, error);
    return null;
  }
}

export function parseTime(timeStr: string): number | null {
  try {
    const time = timeStr.toLowerCase().trim();

    const pmMatch = time.match(/(\d{1,2}):(\d{2})\s*pm/);
    const amMatch = time.match(/(\d{1,2}):(\d{2})\s*am/);
    const militaryMatch = time.match(/(\d{1,2}):(\d{2})$/);

    if (pmMatch) {
      let hours = parseInt(pmMatch[1]);
      const minutes = parseInt(pmMatch[2]);
      if (hours !== 12) hours += 12;
      return hours + minutes / 60;
    }

    if (amMatch) {
      let hours = parseInt(amMatch[1]);
      const minutes = parseInt(amMatch[2]);
      if (hours === 12) hours = 0;
      return hours + minutes / 60;
    }

    if (militaryMatch) {
      const hours = parseInt(militaryMatch[1]);
      const minutes = parseInt(militaryMatch[2]);
      return hours + minutes / 60;
    }

    return null;
  } catch (error) {
    return null;
  }
}

export function calculateHoursFromTimeRange(
  startTime: string,
  endTime: string,
  employeeCount: number
): number | null {
  try {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (!start || !end) return null;

    let duration = end - start;
    if (duration < 0) duration += 24;

    return duration * employeeCount;
  } catch (error) {
    debugLog.warn(`Failed to calculate hours from time range ${startTime}-${endTime}:`, error);
    return null;
  }
}

export function parseChargeFromText(
  text: string,
  isFromChargesSection: boolean = true
): { description: string; cost: number } | null {
  if (!text || text.trim() === '') return null;

  if (!isFromChargesSection) {
    const plantIndicators = ['native', 'achillea', 'agastache', 'guara', 'allium', 'terracotta', 'whirling', 'butterflies', 'kudos', 'yellow', 'cernuum'];
    const lowerText = text.toLowerCase();
    if (plantIndicators.some(indicator => lowerText.includes(indicator))) {
      debugLog.debug(`Skipping plant list item: ${text}`);
      return null;
    }
  }

  const costMatch = text.match(/\(.*?(\d+(?:\.\d{2})?)\s*\)/);
  const cost = costMatch ? parseFloat(costMatch[1]) : 0;

  let description = text.replace(/\(.*?\)/g, '').trim();

  if (cost === 0 && description.toLowerCase().includes('debris')) {
    return { description, cost: 25 };
  }

  return { description, cost };
}
