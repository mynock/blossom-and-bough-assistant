/**
 * Date utility functions for consistent Pacific Time handling
 */

const PACIFIC_TIMEZONE = 'America/Los_Angeles';

/**
 * Format a date string as Pacific Time in MM/DD/YYYY format
 */
export const formatDatePacific = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  // Handle ISO date strings (YYYY-MM-DD) by adding time component for proper timezone handling
  const dateToFormat = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
  
  return new Date(dateToFormat).toLocaleDateString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};

/**
 * Format a date string as Pacific Time in short format (MMM DD, YYYY)
 */
export const formatDateShortPacific = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  const dateToFormat = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
  
  return new Date(dateToFormat).toLocaleDateString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a date string as Pacific Time in long format (Weekday, Month DD, YYYY)
 */
export const formatDateLongPacific = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  const dateToFormat = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
  
  return new Date(dateToFormat).toLocaleDateString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format a date string as Pacific Time in brief format (MMM DD)
 */
export const formatDateBriefPacific = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  const dateToFormat = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
  
  return new Date(dateToFormat).toLocaleDateString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format a date string as Pacific Time with weekday (e.g., "Mon, Dec 23")
 */
export const formatDateWithWeekdayPacific = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  
  const dateToFormat = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
  
  return new Date(dateToFormat).toLocaleDateString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format a timestamp as Pacific Time (date + time)
 */
export const formatTimestampPacific = (timestamp?: string | null): string => {
  if (!timestamp) return 'Never';
  
  const date = new Date(timestamp);
  return `${date.toLocaleDateString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: '2-digit'
  })} ${date.toLocaleTimeString('en-US', { 
    timeZone: PACIFIC_TIMEZONE,
    hour: '2-digit', 
    minute: '2-digit' 
  })}`;
};

/**
 * Format a datetime as Pacific Time (full date + time)
 */
export const formatDateTimePacific = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format time only as Pacific Time
 */
export const formatTimePacific = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get current date in Pacific Time as YYYY-MM-DD string
 */
export const getCurrentDatePacific = (): string => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', {
    timeZone: PACIFIC_TIMEZONE
  }); // en-CA gives YYYY-MM-DD format
};

/**
 * Get current Pacific Time as a Date object
 */
export const getCurrentDateTimePacific = (): Date => {
  const now = new Date();
  // Get Pacific time as string and convert back to Date
  const pacificTimeString = now.toLocaleString('en-US', {
    timeZone: PACIFIC_TIMEZONE
  });
  return new Date(pacificTimeString);
};

/**
 * Parse a date string and ensure it's interpreted in Pacific Time
 */
export const parseDateAsPacific = (dateString: string): Date => {
  // If it's just a date (YYYY-MM-DD), treat it as midnight Pacific time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(`${dateString}T00:00:00-08:00`); // PST offset
  }
  
  return new Date(dateString);
};